'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, sendPasswordResetEmail, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, limit, type Firestore, setDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { setSessionIndicators, clearSessionIndicators } from '@/lib/auth/utils';
import { cleanFirestoreData } from '@/lib/utils';

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
   * ⚡ محرك جلب الهوية المستقر (Stable Identity Core V93.0):
   * تم إرجاع المنطق الأصلي مع دعم البحث المزدوج (UID + Email) لضمان دخول الجميع.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser, email: string) => {
    const sanitizedEmail = email.toLowerCase().trim();
    
    // 🛡️ المسار السيادي للمطور
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
        let globalData: any = null;
        
        // 1. البحث في الفهرس العالمي (UID أولاً ثم البريد)
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (globalSnap.exists()) {
            globalData = globalSnap.data();
            companyId = globalData.companyId;
        } else {
            const oldQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
            const oldSnap = await getDocs(oldQuery);
            if (!oldSnap.empty) {
                globalData = oldSnap.docs[0].data();
                companyId = globalData.companyId;
                // تحديث الفهرس ليعتمد الـ UID مستقبلاً (Auto-Repair)
                await setDoc(doc(firestore, 'global_users', firebaseUser.uid), { ...globalData, uid: firebaseUser.uid, updatedAt: serverTimestamp() }, { merge: true });
            }
        }
        
        if (!companyId) return { user: null, company: null };

        // 2. جلب بيانات المنشأة
        const companyDoc = await getDoc(doc(firestore, 'companies', companyId));
        const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

        // 3. جلب ملف المستخدم المعزول
        const tenantUserPath = `companies/${companyId}/users/${firebaseUser.uid}`;
        const tenantUserDocSnap = await getDoc(doc(firestore, tenantUserPath));
        
        let userData: any = null;

        if (tenantUserDocSnap.exists()) {
            userData = tenantUserDocSnap.data();
        } else {
            // محاولة ثانية بالبريد داخل الشركة
            const tenantUserQuery = query(collection(firestore, `companies/${companyId}/users`), where('email', '==', sanitizedEmail), limit(1));
            const tenantUserSnap = await getDocs(tenantUserQuery);
            if (!tenantUserSnap.empty) {
                userData = tenantUserSnap.docs[0].data();
            } else if (globalData?.role === 'Admin') {
                // 🔄 ترميم تلقائي للمديرين الجدد (Auto-Healing)
                userData = {
                    id: firebaseUser.uid,
                    uid: firebaseUser.uid,
                    email: sanitizedEmail,
                    fullName: firebaseUser.displayName || companyData?.name || 'Admin',
                    role: 'Admin',
                    isActive: true,
                    companyId: companyId,
                    createdAt: serverTimestamp()
                };
                await setDoc(doc(firestore, tenantUserPath), cleanFirestoreData(userData));
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

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser, firebaseUser.email || '');

        if (resolvedUser && resolvedUser.isActive) {
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
          setLoading(false);
        } else {
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