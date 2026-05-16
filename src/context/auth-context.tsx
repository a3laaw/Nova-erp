'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
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

const CACHE_KEY = 'nova_identity_cache';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isInitialLoad = useRef(true);

  /**
   * ⚡ محرك جلب الهوية المطور (Flash Identity Engine V2.6):
   * تم تحصينه لمنع حلقات التكرار اللانهائية.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 🛡️ المسار البرقي للمطور (Sovereign Lightning Path)
    // تم حذف البريد الإضافي لضمان دخوله كمستخدم منشأة عادي
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
        return { user: devProfile, company: null };
    }

    try {
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (!globalSnap.exists()) return { user: null, company: null };
        
        const companyId = globalSnap.data().companyId;
        if (!companyId) return { user: null, company: null };

        const [companyDoc, tenantDoc] = await Promise.all([
            getDoc(doc(firestore, 'companies', companyId)),
            getDoc(doc(firestore, `companies/${companyId}/users/${firebaseUser.uid}`))
        ]);

        if (tenantDoc.exists()) {
            const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;
            const userData = { 
                ...tenantDoc.data(), 
                uid: firebaseUser.uid, 
                id: tenantDoc.id, 
                currentCompanyId: companyId, 
                companyName: companyData?.name 
            } as AuthenticatedUser;

            if (typeof window !== 'undefined') {
                localStorage.setItem(`${CACHE_KEY}_${firebaseUser.uid}`, JSON.stringify({ user: userData, company: companyData }));
            }

            return { user: userData, company: companyData };
        }
    } catch (e) { 
        console.error("Critical Identity Error:", e); 
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

        // 🚀 استعادة فورية من الكاش لتجنب تجميد الواجهة
        if (isInitialLoad.current) {
            const cached = localStorage.getItem(`${CACHE_KEY}_${firebaseUser.uid}`);
            if (cached) {
                try {
                  const { user: cachedUser, company: cachedCompany } = JSON.parse(cached);
                  setUser(cachedUser);
                  setCompany(cachedCompany);
                  if (cachedCompany) setCurrentCompany(cachedCompany);
                  setLoading(false);
                  isInitialLoad.current = false;
                } catch (e) {
                  localStorage.removeItem(`${CACHE_KEY}_${firebaseUser.uid}`);
                }
            }
        }

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          // 🛡️ فحص التغيير الحقيقي قبل التحديث لمنع الـ Loop
          setUser(prev => {
              if (JSON.stringify(prev) === JSON.stringify(resolvedUser)) return prev;
              return resolvedUser;
          });
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setLoading(false);
        } else if (!isInitialLoad.current) {
          await signOut(masterAuth);
          setUser(null);
          clearSessionIndicators();
          if (resolvedUser && !resolvedUser.isActive) setError("هذا الحساب معطل حالياً.");
          setLoading(false);
        }
      } catch (err) { 
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
    const uid = masterAuth.currentUser?.uid;
    if (uid) localStorage.removeItem(`${CACHE_KEY}_${uid}`);
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
