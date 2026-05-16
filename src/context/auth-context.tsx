
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
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
   * ⚡ محرك جلب الهوية الهجين (Hybrid Identity Engine V6.0):
   * تم تحصينه بكافة الاستدعاءات المفقودة ودعم كامل للبحث المتعدد لضمان استقرار الحسابات القديمة.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 🛡️ المسار السيادي للمطور الأساسي
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
        let companyId = null;
        let globalData = null;
        
        // محاولة 1: الوصول المباشر بالـ UID (سريع جداً)
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (globalSnap.exists()) {
            globalData = globalSnap.data();
            companyId = globalData.companyId;
        } else {
            // محاولة 2: البحث بالايميل (لدعم الحسابات القديمة)
            const oldQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
            const oldSnap = await getDocs(oldQuery);
            if (!oldSnap.empty) {
                globalData = oldSnap.docs[0].data();
                companyId = globalData.companyId;
                
                // 🔄 إجراء "الترميم الذاتي": تحديث الفهرس العالمي ليعتمد الـ UID كمفتاح مستقبلي
                await setDoc(doc(firestore, 'global_users', firebaseUser.uid), {
                    ...globalData,
                    uid: firebaseUser.uid,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        }
        
        if (!companyId) return { user: null, company: null };

        // جلب بيانات الشركة
        const companyDoc = await getDoc(doc(firestore, 'companies', companyId));
        const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

        // محاولة جلب ملف المستخدم من داخل المنشأة (بالـ UID أولاً ثم بالايميل)
        let tenantUserDocSnap = await getDoc(doc(firestore, `companies/${companyId}/users/${firebaseUser.uid}`));
        let userData: any = null;

        if (tenantUserDocSnap.exists()) {
            userData = tenantUserDocSnap.data();
        } else {
            const tenantUserQuery = query(collection(firestore, `companies/${companyId}/users`), where('email', '==', sanitizedEmail), limit(1));
            const tenantUserSnap = await getDocs(tenantUserQuery);
            if (!tenantUserSnap.empty) {
                userData = tenantUserSnap.docs[0].data();
            }
        }

        if (userData) {
            const finalUser = { 
                ...userData, 
                uid: firebaseUser.uid, 
                id: firebaseUser.uid, 
                currentCompanyId: companyId, 
                companyName: companyData?.name || 'منشأة غير معروفة'
            } as AuthenticatedUser;

            if (typeof window !== 'undefined') {
                localStorage.setItem(`${CACHE_KEY}_${firebaseUser.uid}`, JSON.stringify({ user: finalUser, company: companyData }));
            }

            return { user: finalUser, company: companyData };
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

        // محاولة استعادة سريعة من الكاش (Optimistic Identity)
        if (isInitialLoad.current) {
            const cached = localStorage.getItem(`${CACHE_KEY}_${firebaseUser.uid}`);
            if (cached) {
                try {
                    const { user: cachedUser, company: cachedCompany } = JSON.parse(cached);
                    setUser(cachedUser);
                    setCompany(cachedCompany);
                    if (cachedCompany) setCurrentCompany(cachedCompany);
                } catch (e) {}
            }
        }

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setLoading(false);
        } else {
          // فقط إذا لم يكن تحميل أولياً، نقوم بتسجيل الخروج إذا فشل التحقق
          if (!isInitialLoad.current) {
            await signOut(masterAuth);
            setUser(null);
            clearSessionIndicators();
            if (resolvedUser && !resolvedUser.isActive) setError("هذا الحساب معطل حالياً.");
          }
          setLoading(false);
        }
        isInitialLoad.current = false;
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

  const resetPassword = useCallback(async (email: string) => {
      if (!masterAuth) return;
      await sendPasswordResetEmail(masterAuth, email.toLowerCase().trim());
  }, [masterAuth]);

  const value = useMemo(() => ({ 
    user, company, loading, error, login, logout, resetPassword, refreshUserData
  }), [user, company, loading, error, login, logout, resetPassword, refreshUserData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};
