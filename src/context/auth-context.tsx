'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';

interface AuthContextType {
  user: AuthenticatedUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 🛡️ المطور السيادي (Root)
    if (sanitizedEmail === 'alaawaaheeb@gmail.com') {
        const devProfile: AuthenticatedUser = {
            uid: firebaseUser.uid,
            id: firebaseUser.uid,
            email: sanitizedEmail,
            username: 'alaa',
            role: 'Developer',
            isActive: true,
            currentCompanyId: null,
            companyName: 'Master Console'
        };
        await setDoc(doc(firestore, 'developers', firebaseUser.uid), { ...devProfile, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
        return { user: devProfile, company: null };
    }

    try {
        let companyId: string | null = null;
        const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
        const globalSnap = await getDocs(globalQuery);
        
        if (!globalSnap.empty) {
            companyId = globalSnap.docs[0].data().companyId;
        }
        
        if (companyId) {
            // جلب بيانات الشركة أولاً لمعرفة مصفوفة الربط
            const companyDoc = await getDoc(doc(firestore, 'companies', companyId));
            const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

            // جلب ملف المستخدم من المجلد المعزول
            const tenantDoc = await getDoc(doc(firestore, `companies/${companyId}/users/${firebaseUser.uid}`));
            
            if (tenantDoc.exists()) {
                return {
                  user: { ...tenantDoc.data(), uid: firebaseUser.uid, id: tenantDoc.id, currentCompanyId: companyId, companyName: companyData?.name } as AuthenticatedUser,
                  company: companyData
                };
            }
        }
    } catch (e) { 
        console.warn("Identity lookup failed:", e); 
    }
    return { user: null, company: null };
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!masterAuth?.currentUser || !masterFirestore) return;
    const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, masterAuth.currentUser, masterAuth.currentUser.email || '');
    if (resolvedUser) {
        setUser(resolvedUser);
        setCompany(resolvedCompany);
    }
  }, [masterAuth, masterFirestore, fetchUserWithContext]);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null); setCompany(null); setLoading(false);
          clearSessionIndicators(); return;
        }

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          // 🛡️ درع مزامنة التوكن: التأكد من وجود صلاحيات الشركة في التوكن
          const tokenResult = await firebaseUser.getIdTokenResult();
          if (!tokenResult.claims.companyId && resolvedUser.currentCompanyId) {
              await firebaseUser.getIdToken(true);
          }

          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
        } else {
          setUser(null);
          clearSessionIndicators();
          if (resolvedUser && !resolvedUser.isActive) setError("هذا الحساب معطل حالياً.");
          await signOut(masterAuth);
        }
      } catch (err) { 
        console.error("Auth Cycle Error:", err);
      } finally { 
        setLoading(false); 
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('بوابة الدخول غير متصلة.');
    return signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
  }, [masterAuth]);

  const logout = useCallback(async () => {
    if (!masterAuth) return;
    await signOut(masterAuth);
    setUser(null); setCompany(null);
    clearSessionIndicators();
    router.replace('/');
  }, [masterAuth, router]);

  const resetPassword = async (email: string) => {
      if (!masterAuth) return;
      await sendPasswordResetEmail(masterAuth, email.toLowerCase().trim());
  };

  const value = useMemo(() => ({ 
    user, company, loading, error, login, logout, resetPassword, refreshUserData
  }), [user, company, loading, error, login, logout, refreshUserData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
