'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, getIdToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { setSessionIndicators, clearSessionIndicators, mapFirebaseAuthError } from '@/lib/auth/utils';

interface AuthContextType {
  user: AuthenticatedUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshToken: () => Promise<void>;
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

  // 🛡️ دالة تجديد التوكن السيادي لضمان استلام الصلاحيات فوراً
  const refreshToken = useCallback(async () => {
    if (masterAuth?.currentUser) {
      await getIdToken(masterAuth.currentUser, true);
    }
  }, [masterAuth]);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      setLoading(true);
      setError(null);

      if (!firebaseUser) {
        setUser(null);
        setCompany(null);
        setCurrentCompany(null);
        clearSessionIndicators();
        setLoading(false);
        return;
      }

      const email = firebaseUser.email?.toLowerCase().trim() || '';

      // مسار المطور
      if (email === 'alaawaaheeb@gmail.com') {
        const devProfile: AuthenticatedUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          email,
          username: 'alaa',
          role: 'Developer',
          isActive: true,
          currentCompanyId: null,
          companyName: 'Nova Master Admin'
        };
        setUser(devProfile);
        setSessionIndicators(firebaseUser.uid, 'Developer');
        setLoading(false);
        return;
      }

      try {
        const globalRef = doc(masterFirestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (!globalSnap.exists()) {
          throw new Error("عذراً، هذا الحساب غير مربوط بأي منشأة مسجلة.");
        }

        const { companyId } = globalSnap.data();
        
        // ⚡ 🛡️ تجديد التوكن فوراً لضمان وجود ادعاءات الـ Multi-tenancy
        await getIdToken(firebaseUser, true);

        const [compDoc, userDoc] = await Promise.all([
          getDoc(doc(masterFirestore, 'companies', companyId)),
          getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid))
        ]);

        if (!userDoc.exists()) {
            throw new Error("لم يتم العثور على ملفك الشخصي داخل المنشأة.");
        }

        const userData = userDoc.data();
        const companyData = compDoc.exists() ? { id: compDoc.id, ...compDoc.data() } as Company : null;

        if (!userData.isActive) {
          throw new Error("هذا الحساب معطل حالياً.");
        }

        const finalUser = {
          ...userData,
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          currentCompanyId: companyId,
          companyName: companyData?.name || 'منشأة غير مسماة'
        } as AuthenticatedUser;

        setUser(finalUser);
        setCompany(companyData);
        if (companyData) setCurrentCompany(companyData);
        setSessionIndicators(firebaseUser.uid, finalUser.role);

      } catch (err: any) {
        console.error("Auth context error:", err);
        setError(err.message);
        setUser(null);
        clearSessionIndicators();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = async (email: string, password: string) => {
    if (!masterAuth) throw new Error('بوابة الدخول غير متصلة.');
    try {
        setError(null);
        await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (e: any) {
        const msg = mapFirebaseAuthError(e.code);
        setError(msg);
        throw new Error(msg);
    }
  };

  const logout = async () => {
    if (!masterAuth) return;
    await signOut(masterAuth);
    setUser(null);
    setCompany(null);
    setCurrentCompany(null);
    clearSessionIndicators();
    router.replace('/');
  };

  const resetPassword = (email: string) => {
    if (!masterAuth) return Promise.reject();
    return sendPasswordResetEmail(masterAuth, email.toLowerCase().trim());
  };

  const value = useMemo(() => ({ 
    user, company, loading, error, login, logout, resetPassword, refreshToken 
  }), [user, company, loading, error, refreshToken]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};