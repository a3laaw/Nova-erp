'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit, Firestore } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import { AuthenticatedUser, Company } from '@/lib/types/auth';
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
  const isMounted = useRef(true);
  
  const [state, setState] = useState<AuthState>({
    user: null, company: null, loading: true, error: null, loadingStage: 'initializing'
  });

  const updateState = useCallback((next: Partial<AuthState>) => {
    if (isMounted.current) {
        setState(prev => ({ ...prev, ...next }));
    }
  }, []);

  // 🔍 محرك جلب بيانات المستخدم وسياق المنشأة
  const fetchUserWithContext = useCallback(async (firestore: Firestore, user: FirebaseUser, email: string) => {
    try {
        updateState({ loadingStage: 'checking_global' });
        
        // 1. البحث في الفهرس العالمي (Global Index)
        const globalSnap = await getDocs(query(collection(firestore, 'global_users'), where('email', '==', email), limit(1)));
        
        if (!globalSnap.empty) {
            const idx = globalSnap.docs[0].data();
            updateState({ loadingStage: 'fetching_tenant' });
            
            // 2. جلب ملف المستخدم المعزول داخل المنشأة
            const tenantDoc = await getDoc(doc(firestore, `companies/${idx.companyId}/users`, user.uid));
            
            if (!tenantDoc.exists()) {
                logAuthEvent('USER_NOT_FOUND_IN_TENANT', { uid: user.uid, companyId: idx.companyId });
                return { user: null, company: null };
            }

            const profileData = tenantDoc.data();
            if (!profileData.isActive) {
                return { user: null, company: null, error: 'حسابك غير مفعل، يرجى مراجعة الإدارة.' };
            }

            updateState({ loadingStage: 'validating_role' });
            const profile = validateUserProfile(profileData);
            const role = await getUserRole(user);
            
            const companyDoc = await getDoc(doc(firestore, 'companies', idx.companyId));
            const company: Company | null = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

            return {
                user: { 
                    ...profile, 
                    uid: user.uid, 
                    id: tenantDoc.id, 
                    currentCompanyId: idx.companyId, 
                    companyName: idx.companyName || company?.name || 'Nova Client', 
                    isSuperAdmin: role === 'Developer' 
                } as AuthenticatedUser,
                company
            };
        }

        // 🛠️ فحص صلاحية المطور السيادي (Root Access)
        updateState({ loadingStage: 'validating_role' });
        const idToken = await user.getIdTokenResult();
        const role = idToken.claims.role;

        if (role === 'Developer' || email.endsWith('@nova-erp.local')) {
            const devDoc = await getDoc(doc(firestore, 'developers', user.uid));
            return {
                user: { 
                    id: user.uid, 
                    uid: user.uid, 
                    email: user.email!, 
                    role: 'Developer', 
                    isActive: true, 
                    fullName: devDoc.data()?.fullName || 'Sovereign Developer', 
                    isSuperAdmin: true, 
                    currentCompanyId: idToken.claims.currentCompanyId || null, 
                    companyName: idToken.claims.companyName || 'Nova ERP Platform' 
                } as AuthenticatedUser,
                company: null
            };
        }

        logAuthEvent('USER_NOT_REGISTERED', { uid: user.uid, email });
        return { user: null, company: null };
    } catch (error) {
        console.error("Fetch context failed:", error);
        return { user: null, company: null };
    }
  }, [updateState]);

  // 🔄 مراقبة حالة Firebase الحية
  useEffect(() => {
    isMounted.current = true;
    if (!masterAuth || !masterFirestore) {
      updateState({ loading: false, loadingStage: 'complete' });
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          updateState({ user: null, company: null, loading: false, error: null, loadingStage: 'complete' });
          setCurrentCompany(null);
          clearSessionIndicators();
          return;
        }

        const email = firebaseUser.email?.toLowerCase();
        if (!email) {
            updateState({ loading: false, loadingStage: 'complete' }); 
            return; 
        }

        logAuthEvent('AUTH_STATE_CHANGED', { uid: firebaseUser.uid, email });
        const result = await fetchUserWithContext(masterFirestore, firebaseUser, email);

        if (isMounted.current) {
          if (result.user?.isActive) {
            setSessionIndicators(firebaseUser.uid, result.user.role);
            updateState({ user: result.user, company: result.company, loading: false, error: null, loadingStage: 'complete' });
            if (result.company) setCurrentCompany(result.company);
            logAuthEvent('LOGIN_SUCCESS', { uid: firebaseUser.uid, role: result.user.role });
          } else {
            const errorMsg = (result as any).error || 'الحساب غير مصرح له بالدخول حالياً.';
            updateState({ user: null, company: null, loading: false, error: errorMsg, loadingStage: 'complete' });
            clearSessionIndicators();
            await signOut(masterAuth);
          }
        }
      } catch (err: any) {
        console.error('Auth Context Loop Error:', err);
        if (isMounted.current) {
            updateState({ user: null, company: null, loading: false, error: 'فشل تحميل الملف الشخصي، يرجى إعادة المحاولة.', loadingStage: 'complete' });
        }
        clearSessionIndicators();
      }
    });

    return () => { 
        isMounted.current = false; 
        unsubscribe(); 
    };
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext, updateState]);

  // 🔐 إجراء تسجيل الدخول
  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('خدمة المصادقة غير متصلة.');
    updateState({ loading: true, error: null, loadingStage: 'initializing' });
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
      updateState({ loading: false, loadingStage: 'complete' });
      const msg = mapFirebaseAuthError(err.code);
      logAuthEvent('LOGIN_FAILED', { email, code: err.code });
      throw new Error(msg);
    }
  }, [masterAuth, updateState]);

  // 🚪 إجراء تسجيل الخروج
  const logout = useCallback(async () => {
    if (!masterAuth) return;
    try { 
        await signOut(masterAuth); 
    } catch (e) { 
        console.error('Logout err:', e); 
    } finally {
      updateState({ user: null, company: null, loading: false, error: null, loadingStage: 'complete' });
      setCurrentCompany(null);
      clearSessionIndicators();
      router.replace('/');
    }
  }, [masterAuth, router, setCurrentCompany, updateState]);

  // 🔄 تحديث البيانات يدوياً دون خروج
  const refreshUserData = useCallback(async () => {
    if (!state.user || !masterFirestore) return;
    updateState({ loading: true });
    try {
      const result = await fetchUserWithContext(
        masterFirestore, 
        { uid: state.user.uid, email: state.user.email } as FirebaseUser, 
        state.user.email
      );
      updateState({ user: result.user, company: result.company, loading: false });
      if (result.company) setCurrentCompany(result.company);
    } catch (e) {
      updateState({ loading: false, error: 'فشل تحديث البيانات اللحظية.' });
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
