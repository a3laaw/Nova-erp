'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { mapFirebaseAuthError, validateUserProfile, setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';

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

      // 🛡️ بروتوكول المعماري السيادي (Sovereign Architect Protocol V37):
      // اعتماد بريدك الجيميل كمدير أعلى مطلق للمنظومة في المشروع الأول
      if (sanitizedEmail === 'alaawaaheeb@gmail.com') {
        const devRef = doc(firestore, 'developers', firebaseUser.uid);
        const devData = {
            uid: firebaseUser.uid,
            email: sanitizedEmail,
            role: 'Developer' as const,
            fullName: 'Alaa Wahib (Master Architect)',
            isActive: true,
            updatedAt: serverTimestamp()
        };
        
        await setDoc(devRef, devData, { merge: true });

        // تحديث الفهرس العالمي لضمان الربط
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        await setDoc(globalRef, {
            email: sanitizedEmail,
            username: 'alaa',
            role: 'Developer',
            uid: firebaseUser.uid,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return {
          user: { 
              ...devData,
              id: firebaseUser.uid,
              currentCompanyId: null, 
              companyName: 'Nova ERP Global Admin' 
          } as AuthenticatedUser,
          company: null
        };
      }

      // 1. فحص الفهرس العالمي للمنشآت
      const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
      const globalSnap = await getDocs(globalQuery);
      
      if (!globalSnap.empty) {
        const idx = globalSnap.docs[0].data();
        const tenantUserPath = `companies/${idx.companyId}/users/${firebaseUser.uid}`;
        const tenantDoc = await getDoc(doc(firestore, tenantUserPath));
        
        if (tenantDoc.exists()) {
            const profile = validateUserProfile(tenantDoc.data());
            const companyDoc = await getDoc(doc(firestore, 'companies', idx.companyId));
            const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

            return {
              user: { ...profile, uid: firebaseUser.uid, id: tenantDoc.id, currentCompanyId: idx.companyId, companyName: companyData?.name || 'Nova Client' } as AuthenticatedUser,
              company: companyData
            };
        }
      }
    } catch (e) { 
        console.error("Identity Resolution Error:", e); 
    }

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
          setCurrentCompany(null);
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
          setCompany(null);
          setError('لم يتم العثور على صلاحيات دخول نشطة لهذا الحساب.');
          clearSessionIndicators();
        }
      } catch (err: any) {
        setError('تعذر التحقق من الجلسة السيادية.');
        clearSessionIndicators();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('خدمة المصادقة غير متاحة');
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
      setLoading(false);
      throw new Error(mapFirebaseAuthError(err.code));
    }
  }, [masterAuth]);

  const resetPassword = useCallback(async (email: string) => {
    if (!masterAuth) throw new Error('خدمة المصادقة غير متاحة');
    try {
      await sendPasswordResetEmail(masterAuth, email.toLowerCase().trim());
    } catch (err: any) {
      throw new Error(mapFirebaseAuthError(err.code));
    }
  }, [masterAuth]);

  const logout = useCallback(async () => {
    if (!masterAuth) return;
    try { 
      await signOut(masterAuth);
      setUser(null);
      setCompany(null);
      setLoading(false);
      setCurrentCompany(null);
      clearSessionIndicators();
      router.replace('/');
    } catch (e) { console.error('Logout failed:', e); }
  }, [masterAuth, router, setCurrentCompany]);

  const refreshUserData = useCallback(async () => {
    if (!user || !masterFirestore || !masterAuth?.currentUser) return;
    setLoading(true);
    try {
      const res = await fetchUserWithContext(masterFirestore, masterAuth.currentUser, user.email);
      setUser(res.user);
      setCompany(res.company);
      if (res.company) setCurrentCompany(res.company);
    } catch (e) {
      setError('فشل تحديث البيانات');
    } finally {
      setLoading(false);
    }
  }, [user, masterFirestore, masterAuth, fetchUserWithContext, setCurrentCompany]);

  const ctxValue = useMemo(() => ({ 
    user, 
    company, 
    loading, 
    error, 
    login, 
    logout, 
    resetPassword, 
    refreshUserData 
  }), [user, company, loading, error, login, logout, resetPassword, refreshUserData]);

  return <AuthContext.Provider value={ctxValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
