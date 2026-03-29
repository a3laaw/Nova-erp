'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, GlobalUserIndex, AuthenticatedUser, Company } from '@/lib/types';
import { useCompany } from './company-context';

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const isInitialized = useRef(false);
  const MASTER_DEV_EMAIL = 'dev@nova-erp.local';

  // 🛡️ صمام الأمان النووي: يمنع التعليق للأبد ويضمن إطلاق الواجهة
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("🛡️ Auth Shield: Safety timeout reached. Releasing UI.");
        setLoading(false);
      }
    }, 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setCurrentCompany(null);
          setLoading(false);
          return;
        }

        const idTokenResult = await firebaseUser.getIdTokenResult();
        const claims = idTokenResult.claims as any;

        // 1. معالجة حالة المطور السيادي (Master Developer)
        if (firebaseUser.email === MASTER_DEV_EMAIL) {
          const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
          
          const activeCompanyId = claims.currentCompanyId || null;
          const devData: AuthenticatedUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            username: 'root',
            role: 'Developer',
            isActive: true,
            fullName: devDoc.exists() ? devDoc.data().fullName : 'Master Developer',
            isSuperAdmin: true,
            currentCompanyId: activeCompanyId,
            companyName: claims.companyName || null
          };

          setUser(devData);
          
          if (activeCompanyId) {
            const companyDoc = await getDoc(doc(masterFirestore, 'companies', activeCompanyId));
            if (companyDoc.exists()) {
              setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          }
          setLoading(false);
          return;
        }

        // 2. معالجة مستخدم المنشأة (SaaS Tenant User)
        const userEmail = firebaseUser.email?.toLowerCase();
        if (userEmail) {
          // البحث السريع في الفهرس العالمي
          const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', userEmail)));
          
          if (!userIndexSnap.empty) {
            const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
            const companyId = userIndex.companyId;
            
            const [companyDoc, tenantUserDoc] = await Promise.all([
              getDoc(doc(masterFirestore, 'companies', companyId)),
              getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid))
            ]);

            if (companyDoc.exists() && tenantUserDoc.exists()) {
              const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
              const userData = tenantUserDoc.data() as UserProfile;
              
              setCurrentCompany(companyData);
              setUser({ 
                ...userData, 
                uid: firebaseUser.uid, 
                id: tenantUserDoc.id,
                currentCompanyId: companyId,
                companyName: companyData.name
              });
            }
          }
        }
      } catch (error) {
        console.error("Critical Auth Sync Error:", error);
      } finally {
        setLoading(false);
        isInitialized.current = true;
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (identifier: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بخادم الأمان.");

    let email = identifier.toLowerCase().trim();

    // دعم الدخول باسم المستخدم (Username)
    if (!email.includes('@')) {
      const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('username', '==', email)));
      if (userIndexSnap.empty) throw new Error('اسم المستخدم هذا غير مسجل في المنصة.');
      email = userIndexSnap.docs[0].data().email;
    }

    try {
      await signInWithEmailAndPassword(masterAuth, email, password);
      // ضبط الكوكيز السيادية لخدمة الـ Middleware والتوجيه
      const sessionExpiry = 86400; // 24 hours
      if (email === MASTER_DEV_EMAIL) {
          document.cookie = `nova-dev-session=1; path=/; max-age=${sessionExpiry}; SameSite=Lax`;
      } else {
          document.cookie = `nova-user-session=1; path=/; max-age=${sessionExpiry}; SameSite=Lax`;
      }
    } catch (e: any) {
      console.error("Login attempt failed:", e);
      if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم وكلمة المرور.');
      }
      throw e;
    }
  }, [masterAuth, masterFirestore]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
        if (masterAuth) await signOut(masterAuth);
        // تنظيف الكوكيز
        document.cookie = 'nova-dev-session=; max-age=0; path=/';
        document.cookie = 'nova-user-session=; max-age=0; path=/';
        setUser(null);
        setCurrentCompany(null);
        router.replace('/');
    } finally {
        setLoading(false);
    }
  }, [masterAuth, setCurrentCompany, router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
