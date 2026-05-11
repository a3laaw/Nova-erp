'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, type Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { mapFirebaseAuthError, validateUserProfile, getUserRole, logAuthEvent, setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';

interface AuthState {
  user: AuthenticatedUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
  loadingStage?: 'initializing' | 'checking_global' | 'fetching_tenant' | 'validating_role' | 'complete';
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  
  const [state, setState] = useState<AuthState>({
    user: null, company: null, loading: true, error: null, loadingStage: 'initializing'
  });

  const updateState = useCallback((next: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...next }));
  }, []);

  const fetchUserWithContext = useCallback(async (firestore: Firestore, user: FirebaseUser, email: string) => {
    updateState({ loadingStage: 'checking_global' });
    
    // 1. الأولوية المطلقة: الفحص في الفهرس العالمي (لضمان دخول nova1 لشركته)
    const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', email), limit(1));
    const globalSnap = await getDocs(globalQuery);
    
    if (!globalSnap.empty) {
      const idx = globalSnap.docs[0].data();
      updateState({ loadingStage: 'fetching_tenant' });
      const tenantDoc = await getDoc(doc(firestore, `companies/${idx.companyId}/users`, user.uid));
      
      if (tenantDoc.exists()) {
          updateState({ loadingStage: 'validating_role' });
          const profile = validateUserProfile(tenantDoc.data());
          const role = await getUserRole(user);
          
          const companyDoc = await getDoc(doc(firestore, 'companies', idx.companyId));
          const company: Company | null = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

          return {
            user: { ...profile, uid: user.uid, id: tenantDoc.id, currentCompanyId: idx.companyId, companyName: company?.name || 'Nova Client', isSuperAdmin: role === 'Developer' } as AuthenticatedUser,
            company
          };
      }
    }

    // 2. فحص وضع المطور (فقط إذا لم يكن في الفهرس العالمي)
    updateState({ loadingStage: 'validating_role' });
    if (email.endsWith('@nova-erp.local')) {
      const devDoc = await getDoc(doc(firestore, 'developers', user.uid));
      if (devDoc.exists()) {
        return {
          user: { id: user.uid, uid: user.uid, email: user.email!, username: 'root', role: 'Developer', isActive: true, fullName: devDoc.data()?.fullName || 'Master Developer', isSuperAdmin: true, currentCompanyId: null, companyName: 'Nova ERP Platform' } as AuthenticatedUser,
          company: null
        };
      }
    }

    logAuthEvent('USER_NOT_FOUND', { uid: user.uid, email });
    return { user: null, company: null };
  }, [updateState]);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      updateState({ loading: false, loadingStage: 'complete' });
      return;
    }

    let isMounted = true;
    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          if (isMounted) {
            updateState({ user: null, company: null, loading: false, error: null, loadingStage: 'complete' });
            setCurrentCompany(null);
            clearSessionIndicators();
          }
          return;
        }

        const email = firebaseUser.email?.toLowerCase();
        if (!email) { if (isMounted) updateState({ loading: false, loadingStage: 'complete' }); return; }

        logAuthEvent('AUTH_STATE_CHANGED', { uid: firebaseUser.uid, email });
        const { user, company } = await fetchUserWithContext(masterFirestore, firebaseUser, email);

        if (isMounted) {
          if (user?.isActive) {
            setSessionIndicators(firebaseUser.uid, user.role);
            updateState({ user, company, loading: false, error: null, loadingStage: 'complete' });
            if (company) setCurrentCompany(company);
            logAuthEvent('LOGIN_SUCCESS', { uid: firebaseUser.uid, role: user.role, companyId: company?.id });
          } else {
            updateState({ user: null, company: null, loading: false, error: user ? 'حسابك معطل حالياً.' : 'لم يتم العثور على صلاحيات دخول.', loadingStage: 'complete' });
            clearSessionIndicators();
            if (!user?.isSuperAdmin) await signOut(masterAuth);
          }
        }
      } catch (err: any) {
        if (isMounted) updateState({ user: null, company: null, loading: false, error: 'تعذر مزامنة الجلسة السيادية.', loadingStage: 'complete' });
        clearSessionIndicators();
      }
    });

    return () => { isMounted = false; unsubscribe(); };
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

  const logout = useCallback(async () => {
    if (!masterAuth) return;
    try { 
      await signOut(masterAuth);
      updateState({ user: null, company: null, loading: false, error: null, loadingStage: 'complete' });
      setCurrentCompany(null);
      clearSessionIndicators();
      router.replace('/');
    } catch (e) { console.error('Logout err:', e); }
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

  const ctx = useMemo(() => ({ ...state, login, logout, refreshUserData }), [state, login, logout, refreshUserData]);

  return <AuthContext.Provider value={ctx}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
