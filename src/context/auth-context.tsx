'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company, UserProfile } from '@/lib/types';
import { mapFirebaseAuthError, setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';

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
    try {
      const sanitizedEmail = email.toLowerCase().trim();

      // 🛡️ استثناء المعماري السيادي (Sovereign Architect Exception V42):
      // بريدك الجيميل هو الماستر، نمنحه رتبة المطور "في الذاكرة" فوراً لكسر الحلقة المفرغة.
      if (sanitizedEmail === 'alaawaaheeb@gmail.com') {
        const devProfile = {
            uid: firebaseUser.uid,
            email: sanitizedEmail,
            role: 'Developer' as const,
            fullName: 'علاء وهيب (Master Admin)',
            isActive: true,
            id: firebaseUser.uid,
            currentCompanyId: null,
            companyName: 'Sovereign Control'
        };

        // تحديث سجل المطور في الخلفية
        try {
            await setDoc(doc(firestore, 'developers', firebaseUser.uid), { ...devProfile, updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) { console.warn("Auto-provisioning write skipped due to rules, but memory session is active."); }

        return { user: devProfile as AuthenticatedUser, company: null };
      }

      // 1. البحث للمستخدمين العاديين
      const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
      const globalSnap = await getDocs(globalQuery);
      
      if (!globalSnap.empty) {
        const idx = globalSnap.docs[0].data();
        const tenantUserPath = `companies/${idx.companyId}/users/${firebaseUser.uid}`;
        const tenantDoc = await getDoc(doc(firestore, tenantUserPath));
        
        if (tenantDoc.exists()) {
            const companyDoc = await getDoc(doc(firestore, 'companies', idx.companyId));
            const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

            return {
              user: { ...tenantDoc.data(), uid: firebaseUser.uid, id: tenantDoc.id, currentCompanyId: idx.companyId, companyName: companyData?.name || 'Nova ERP' } as AuthenticatedUser,
              company: companyData
            };
        }
      }
    } catch (e) { console.error("Identity Resolution Error:", e); }

    return { user: null, company: null };
  }, []);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setCompany(null);
          setLoading(false);
          clearSessionIndicators();
          return;
        }

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
        } else {
          setUser(null);
          setError('حساب غير مفعل أو غير مسجل.');
          clearSessionIndicators();
        }
      } catch (err: any) {
        setError('تعذر التحقق من الجلسة.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('خدمة المصادقة غير متاحة');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
      setLoading(false);
      throw new Error(mapFirebaseAuthError(err.code));
    }
  }, [masterAuth]);

  const logout = useCallback(async () => {
    if (!masterAuth) return;
    await signOut(masterAuth);
    setUser(null);
    setCompany(null);
    clearSessionIndicators();
    router.replace('/');
  }, [masterAuth, router, setCurrentCompany]);

  const resetPassword = async (email: string) => {
      if (!masterAuth) return;
      await sendPasswordResetEmail(masterAuth, email.toLowerCase().trim());
  };

  const value = useMemo(() => ({ 
    user, company, loading, error, login, logout, resetPassword, 
    refreshUserData: async () => {} 
  }), [user, company, loading, error, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
