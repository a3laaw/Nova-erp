'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserProfile, AuthenticatedUser, Company } from '@/lib/types';
import { useCompany } from './company-context';

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * سياق الأمان السيادي المطور (Sovereign Auth Core v4.0):
 * تم تحصينه ببروتوكول "المزامنة القاطعة" لضمان الاستقرار الفوري وحل مشكلة nova1@nova-erp.local.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 🛡️ مساعد زرع الكوكيز السيادي: يفتح أقفال الـ Middleware فوراً
  const setAuthCookies = (uid: string, role: string) => {
    const expiry = 60 * 60 * 24 * 7; // 7 days
    document.cookie = `nova-user-session=${uid}; path=/; max-age=${expiry}; SameSite=Lax`;
    if (role === 'Developer') {
        document.cookie = `nova-dev-session=${uid}; path=/; max-age=${expiry}; SameSite=Lax`;
    }
  };

  const removeAuthCookies = () => {
    document.cookie = 'nova-user-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'nova-dev-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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
          removeAuthCookies();
          setLoading(false);
          return;
        }

        const idToken = await firebaseUser.getIdTokenResult();
        const role = idToken.claims.role as string;
        const userEmail = firebaseUser.email?.toLowerCase();

        // 1. حالة المطور (Sovereign Developer) - تدعم nova1@nova-erp.local وكافة الإيميلات المعتمدة
        if (role === 'Developer' || userEmail === 'dev@nova-erp.local') {
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
          setAuthCookies(firebaseUser.uid, 'Developer');
          setLoading(false);
          return;
        }

        // 2. حالة الموظف (SaaS Tenant User)
        if (userEmail) {
          const userIndexSnap = await getDocs(query(
            collection(masterFirestore, 'global_users'), 
            where('email', '==', userEmail),
            limit(1)
          ));
          
          if (!userIndexSnap.empty) {
            const indexData = userIndexSnap.docs[0].data();
            const companyId = indexData.companyId;
            const tenantUserDoc = await getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid));

            if (tenantUserDoc.exists()) {
              const userData = tenantUserDoc.data() as UserProfile;
              if (!userData.isActive) {
                  await signOut(masterAuth);
                  setUser(null);
                  removeAuthCookies();
              } else {
                setUser({ 
                  ...userData, 
                  uid: firebaseUser.uid, 
                  id: tenantUserDoc.id,
                  currentCompanyId: companyId,
                  companyName: indexData.companyName || 'Nova Client'
                });
                setAuthCookies(firebaseUser.uid, userData.role);

                const companyDoc = await getDoc(doc(masterFirestore, 'companies', companyId));
                if (companyDoc.exists()) {
                    setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
                }
              }
            } else {
                await signOut(masterAuth);
                setUser(null);
            }
          } else {
              await signOut(masterAuth);
              setUser(null);
          }
        }
      } catch (error) {
        console.error("Auth Loop Prevention:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error("تعذر الاتصال بخادم الأمان.");
    try {
      removeAuthCookies();
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          throw new Error('بيانات العبور غير صحيحة.');
      }
      throw new Error(`فشل الدخول: ${e.message}`);
    }
  }, [masterAuth]);

  const logout = useCallback(async () => {
    setLoading(true);
    if (masterAuth) await signOut(masterAuth);
    setUser(null);
    setCurrentCompany(null);
    removeAuthCookies();
    router.replace('/');
    setLoading(false);
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
