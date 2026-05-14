'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company, UserProfile } from '@/lib/types';
import { mapFirebaseAuthError, validateUserProfile, setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';

interface AuthState {
  user: AuthenticatedUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
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
  
  const [state, setState] = useState<AuthState>({
    user: null, company: null, loading: true, error: null
  });

  const updateState = useCallback((next: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...next }));
  }, []);

  const fetchUserWithContext = useCallback(async (firestore: Firestore, user: FirebaseUser, email: string) => {
    try {
      const sanitizedEmail = email.toLowerCase().trim();

      // 🛡️ بروتوكول المعماري السيادي (Resilient Architect Bypass):
      // إذا كان البريد يحتوي على اسمك (alaawaaheeb)، نمنحك رتبة مطور فوراً لكسر نقطة الصفر.
      if (sanitizedEmail.includes('alaawaaheeb')) {
        const devRef = doc(firestore, 'developers', user.uid);
        // نحدث السجل في قاعدة البيانات لضمان وجوده للأبد
        await setDoc(devRef, {
            uid: user.uid,
            email: sanitizedEmail,
            role: 'Developer',
            fullName: 'Alaa Wahib (Master Admin)',
            isActive: true,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return {
          user: { 
              id: user.uid, 
              uid: user.uid, 
              email: sanitizedEmail, 
              role: 'Developer', 
              isActive: true, 
              fullName: 'Alaa Wahib', 
              isSuperAdmin: true, 
              currentCompanyId: null, 
              companyName: 'Nova ERP Platform' 
          } as AuthenticatedUser,
          company: null
        };
      }

      // 1. فحص الفهرس العالمي للمنشآت
      const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
      const globalSnap = await getDocs(globalQuery);
      
      if (!globalSnap.empty) {
        const idx = globalSnap.docs[0].data();
        const tenantUserPath = `companies/${idx.companyId}/users/${user.uid}`;
        const tenantDoc = await getDoc(doc(firestore, tenantUserPath));
        
        if (tenantDoc.exists()) {
            const profile = validateUserProfile(tenantDoc.data());
            const companyDoc = await getDoc(doc(firestore, 'companies', idx.companyId));
            const company = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

            return {
              user: { ...profile, uid: user.uid, id: tenantDoc.id, currentCompanyId: idx.companyId, companyName: company?.name || 'Nova Client' } as AuthenticatedUser,
              company
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
      updateState({ loading: false });
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          updateState({ user: null, company: null, loading: false, error: null });
          setCurrentCompany(null);
          clearSessionIndicators();
          return;
        }

        const { user, company } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (user && user.isActive) {
          setSessionIndicators(firebaseUser.uid, user.role);
          updateState({ user, company, loading: false, error: null });
          if (company) setCurrentCompany(company);
        } else {
          updateState({ 
              user: null, 
              company: null, 
              loading: false, 
              error: 'لم يتم العثور على صلاحيات دخول نشطة لهذا الحساب.' 
          });
          clearSessionIndicators();
        }
      } catch (err: any) {
        updateState({ user: null, company: null, loading: false, error: 'تعذر التحقق من الجلسة السيادية.' });
        clearSessionIndicators();
      } finally {
        updateState({ loading: false });
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext, updateState]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('خدمة المصادقة غير متاحة');
    updateState({ loading: true, error: null });
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
      updateState({ loading: false });
      throw new Error(mapFirebaseAuthError(err.code));
    }
  }, [masterAuth, updateState]);

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
      updateState({ user: null, company: null, loading: false, error: null });
      setCurrentCompany(null);
      clearSessionIndicators();
      router.replace('/');
    } catch (e) { console.error('Logout failed:', e); }
  }, [masterAuth, router, setCurrentCompany, updateState]);

  const refreshUserData = useCallback(async () => {
    if (!state.user || !masterFirestore) return;
    updateState({ loading: true });
    try {
      const { user, company } = await fetchUserWithContext(masterFirestore, { uid: state.user.uid, email: state.user.email } as FirebaseUser, state.user.email);
      updateState({ user, company, loading: false });
      if (company) setCurrentCompany(company);
    } catch (e) {
      updateState({ loading: false, error: 'فشل تحديث البيانات' });
    }
  }, [state.user, masterFirestore, fetchUserWithContext, updateState, setCurrentCompany]);

  const ctx = useMemo(() => ({ ...state, login, logout, resetPassword, refreshUserData }), [state, login, logout, resetPassword, refreshUserData]);

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
