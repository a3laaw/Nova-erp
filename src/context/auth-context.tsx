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
  
  // 🛡️ استخدام المرجع لمنع الحلقات اللانهائية في التحديث
  const isInitialLoad = useRef(true);

  /**
   * محرك جلب الهوية المطور (Lightning Fetch V2.0):
   * يستخدم المعالجة المتوازية لتقليص زمن الاستجابة.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 1. المطور السيادي (Root) - أولوية قصوى
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
        // 2. البحث عن معرّف الشركة (Tenant ID) من الفهرس العالمي
        const globalQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
        const globalSnap = await getDocs(globalQuery);
        
        if (globalSnap.empty) return { user: null, company: null };
        
        const companyId = globalSnap.docs[0].data().companyId;
        if (!companyId) return { user: null, company: null };

        // ⚡ ميزة البرق: جلب بيانات الشركة وملف المستخدم في آنٍ واحد (Parallel Request)
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

            // 💾 تحديث الذاكرة اللحظية للزيارة القادمة
            localStorage.setItem(`${CACHE_KEY}_${firebaseUser.uid}`, JSON.stringify({ user: userData, company: companyData }));

            return { user: userData, company: companyData };
        }
    } catch (e) { 
        console.error("Identity lookup failed:", e); 
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

        // 🚀 محاولة استعادة الهوية من الكاش (Instant Access)
        const cached = localStorage.getItem(`${CACHE_KEY}_${firebaseUser.uid}`);
        if (cached && isInitialLoad.current) {
            const { user: cachedUser, company: cachedCompany } = JSON.parse(cached);
            setUser(cachedUser);
            setCompany(cachedCompany);
            if (cachedCompany) setCurrentCompany(cachedCompany);
            setLoading(false); // فك الحظر عن الواجهة فوراً
            isInitialLoad.current = false;
        }

        // 🛡️ التحقق الحقيقي في الخلفية لضمان سلامة الصلاحيات
        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          // مزامنة التوكن إذا لزم الأمر دون حظر الواجهة
          firebaseUser.getIdTokenResult().then(tokenResult => {
            if (!tokenResult.claims.companyId && resolvedUser.currentCompanyId) {
                firebaseUser.getIdToken(true);
            }
          });

          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
        } else if (!cached) {
          // لم نجد كاش ولم ينجح التحقق -> خروج
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
