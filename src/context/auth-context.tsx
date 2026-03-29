'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
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
  
  const MASTER_DEV_EMAIL = 'dev@nova-erp.local';

  // 🛡️ صمام الأمان السيادي: يمنع التعليق للأبد ويضمن إطلاق الواجهة تحت أي ظرف
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn("🛡️ Auth Shield: Safety timeout reached. Releasing UI state.");
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  // دالة ضبط الكوكيز السيادية لخدمة الـ Middleware
  const setSovereignCookies = (email: string) => {
    const expiry = 86400; // 24 hours
    const cookieName = email === MASTER_DEV_EMAIL ? 'nova-dev-session' : 'nova-user-session';
    document.cookie = `${cookieName}=1; path=/; max-age=${expiry}; SameSite=Lax`;
  };

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

        const userEmail = firebaseUser.email?.toLowerCase();
        
        // 1. معالجة حالة المطور السيادي (Master Developer)
        if (userEmail === MASTER_DEV_EMAIL) {
          setSovereignCookies(userEmail);
          const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
          
          const devData: AuthenticatedUser = {
            id: firebaseUser.uid,
            uid: firebaseUser.uid,
            email: firebaseUser.email!,
            username: 'root',
            role: 'Developer',
            isActive: true,
            fullName: devDoc.exists() ? devDoc.data().fullName : 'Master Developer',
            isSuperAdmin: true,
          };

          setUser(devData);
          setLoading(false);
          return;
        }

        // 2. معالجة مستخدم المنشأة (SaaS Tenant User)
        if (userEmail) {
          setSovereignCookies(userEmail);
          
          // البحث السريع في الفهرس العالمي (Global Index Lookup)
          const userIndexSnap = await getDocs(query(
            collection(masterFirestore, 'global_users'), 
            where('email', '==', userEmail),
            limit(1)
          ));
          
          if (!userIndexSnap.empty) {
            const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
            const companyId = userIndex.companyId;
            
            // جلب ملف المستخدم من المجلد المعزول
            const tenantUserDoc = await getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid));

            if (tenantUserDoc.exists()) {
              const userData = tenantUserDoc.data() as UserProfile;
              
              setUser({ 
                ...userData, 
                uid: firebaseUser.uid, 
                id: tenantUserDoc.id,
                currentCompanyId: companyId,
                companyName: userIndex.companyId // Fallback
              });

              // جلب بيانات الشركة لتغذية السياق
              getDoc(doc(masterFirestore, 'companies', companyId)).then(companyDoc => {
                if (companyDoc.exists()) {
                  setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("Critical Auth Sync Error:", error);
      } finally {
        // نضمن دائماً إنهاء حالة التحميل
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (identifier: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بخادم الأمان.");

    let email = identifier.toLowerCase().trim();

    // دعم الدخول باسم المستخدم المباشر (Direct SaaS Username Support)
    if (!email.includes('@')) {
      const userIndexSnap = await getDocs(query(
        collection(masterFirestore, 'global_users'), 
        where('username', '==', email),
        limit(1)
      ));
      if (userIndexSnap.empty) throw new Error('اسم المستخدم هذا غير مسجل في أي منشأة.');
      email = userIndexSnap.docs[0].data().email;
    }

    try {
      // 🛡️ زرع الكوكيز بشكل استباقي لمنع طرد الـ Middleware
      setSovereignCookies(email);
      
      await signInWithEmailAndPassword(masterAuth, email, password);
    } catch (e: any) {
      console.error("Login attempt failed:", e);
      // تنظيف الكوكيز في حال فشل الدخول
      document.cookie = 'nova-dev-session=; max-age=0; path=/';
      document.cookie = 'nova-user-session=; max-age=0; path=/';
      
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
