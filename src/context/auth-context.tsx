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
   * ⚡ محرك جلب الهوية المطور (Flash Identity Engine V2.5):
   * تم الانتقال للبحث المباشر بالـ UID بدلاً من الاستعلام بالبريد لسرعة فائقة.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 🛡️ المسار البرقي للمطور (Sovereign Lightning Path)
    if (sanitizedEmail === 'alaawaaheeb@gmail.com' || sanitizedEmail === 'alaaeng045@gmail.com') {
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
        // ⚡ البحث المباشر (Direct Get) - أسرع من الـ Query بـ 10 أضعاف
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (!globalSnap.exists()) return { user: null, company: null };
        
        const companyId = globalSnap.data().companyId;
        if (!companyId) return { user: null, company: null };

        // ⚡ جلب متوازي لبيانات الشركة والموظف
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

            localStorage.setItem(`${CACHE_KEY}_${firebaseUser.uid}`, JSON.stringify({ user: userData, company: companyData }));

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

        // 🚀 محاولة استعادة الهوية فوراً من الكاش (Instant Dashboard Unlock)
        if (isInitialLoad.current) {
            const cached = localStorage.getItem(`${CACHE_KEY}_${firebaseUser.uid}`);
            if (cached) {
                const { user: cachedUser, company: cachedCompany } = JSON.parse(cached);
                setUser(cachedUser);
                setCompany(cachedCompany);
                if (cachedCompany) setCurrentCompany(cachedCompany);
                setLoading(false); // فك حظر الواجهة فوراً
                isInitialLoad.current = false;
            }
        }

        // 🛡️ المزامنة الحقيقية في الخلفية للتأكد من الحالة المالية للشركة
        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setLoading(false);
        } else if (!user) {
          // لم نجد كاش ولم ينجح التحقق -> خروج
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
  }, [masterAuth, masterFirestore, setCurrentCompany, fetchUserWithContext, user]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error('بوابة الدخول غير متصلة.');
    // ⚡ التوجيه المتفائل يبدأ هنا
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
