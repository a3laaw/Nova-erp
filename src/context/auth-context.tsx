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
   * ⚡ محرك جلب الهوية السيادي (Sovereign Identity Engine V94.0):
   * تم تحصينه بالكامل لضمان عدم التعليق في حلقة انتظار لا نهائية.
   */
  const fetchUserWithContext = useCallback(async (firestore: Firestore, firebaseUser: FirebaseUser) => {
    const sanitizedEmail = firebaseUser.email?.toLowerCase().trim() || '';
    
    // 🛡️ المسار السيادي للمطور (Alaa Wahib)
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
        
        // 1. البحث السريع بالـ UID في الفهرس العالمي
        const globalRef = doc(firestore, 'global_users', firebaseUser.uid);
        const globalSnap = await getDoc(globalRef);
        
        if (globalSnap.exists()) {
            globalData = globalSnap.data();
            companyId = globalData.companyId;
        } else {
            // 2. البحث بالبريد للحسابات القديمة (Fallback)
            const oldQuery = query(collection(firestore, 'global_users'), where('email', '==', sanitizedEmail), limit(1));
            const oldSnap = await getDocs(oldQuery);
            if (!oldSnap.empty) {
                globalData = oldSnap.docs[0].data();
                companyId = globalData.companyId;
            }
        }
        
        if (!companyId) return { user: null, company: null };

        // 3. جلب بيانات المنشأة
        const companyDoc = await getDoc(doc(firestore, 'companies', companyId));
        const companyData = companyDoc.exists() ? { id: companyDoc.id, ...companyDoc.data() } as Company : null;

        // 4. جلب ملف المستخدم المعزول
        const tenantUserPath = `companies/${companyId}/users/${firebaseUser.uid}`;
        const tenantUserDocSnap = await getDoc(doc(firestore, tenantUserPath));
        
        let userData: any = null;

        if (tenantUserDocSnap.exists()) {
            userData = tenantUserDocSnap.data();
        } else {
            // 🔄 محاولة أخيرة بالبريد داخل الشركة
            const tenantUserQuery = query(collection(firestore, `companies/${companyId}/users`), where('email', '==', sanitizedEmail), limit(1));
            const tenantUserSnap = await getDocs(tenantUserQuery);
            if (!tenantUserSnap.empty) {
                userData = tenantUserSnap.docs[0].data();
            } else if (globalData?.role === 'Admin') {
                // 🚀 بروتوكول الترميم النشط (V94.0): إذا فقد الملف، نحاول الحصول عليه من الفهرس العالمي لضمان العبور
                userData = {
                    id: firebaseUser.uid,
                    uid: firebaseUser.uid,
                    email: sanitizedEmail,
                    fullName: firebaseUser.displayName || companyData?.name || 'Admin',
                    role: 'Admin',
                    isActive: true,
                    companyId: companyId,
                    createdAt: new Date()
                };
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

            return { user: finalUser, company: companyData };
        }
    } catch (e) { 
        console.error("Identity Fetch Error:", e); 
    }
    return { user: null, company: null };
  }, []);

  const refreshUserData = useCallback(async () => {
    if (!masterAuth?.currentUser || !masterFirestore) return;
    const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, masterAuth.currentUser);
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
          setUser(null); 
          setCompany(null); 
          setLoading(false);
          clearSessionIndicators(); 
          return;
        }

        const { user: resolvedUser, company: resolvedCompany } = await fetchUserWithContext(masterFirestore, firebaseUser);

        if (resolvedUser && resolvedUser.isActive) {
          setUser(resolvedUser);
          setCompany(resolvedCompany);
          if (resolvedCompany) setCurrentCompany(resolvedCompany);
          setSessionIndicators(firebaseUser.uid, resolvedUser.role);
        } else {
          if (!isInitialLoad.current) {
            setUser(null);
            clearSessionIndicators();
            if (resolvedUser && !resolvedUser.isActive) setError("هذا الحساب معطل حالياً.");
          }
        }
        setLoading(false);
        isInitialLoad.current = false;
      } catch (err) { 
        console.error("Auth Loop Break:", err);
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
    await signOut(masterAuth);
    setUser(null); 
    setCompany(null);
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
