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
 * سياق الأمان السيادي المستقر:
 * تم تعديله ليعطي الأولوية القصوى للفهرس العالمي (الشركات) 
 * لضمان دخول حسابات مثل nova1 لشركاتهم مباشرة وتجنب اللوب.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setAuthCookies = (uid: string, role: string) => {
    const expiry = 60 * 60 * 24 * 7;
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

        const userEmail = firebaseUser.email?.toLowerCase();
        if (!userEmail) {
            setLoading(false);
            return;
        }

        // 🛡️ 1. البحث في الفهرس العالمي أولاً (الأولوية لدخول الشركات)
        // هذا يحل مشكلة حسابات .local التي تتبع لشركة محددة
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
                const authUser = { 
                    ...userData, 
                    uid: firebaseUser.uid, 
                    id: tenantUserDoc.id,
                    currentCompanyId: companyId,
                    companyName: indexData.companyName || 'Nova Client'
                };
                
                // زرع الكوكيز قبل تحديث الحالة لضمان عبور الـ Middleware
                setAuthCookies(firebaseUser.uid, userData.role);
                setUser(authUser);
                
                const companyDoc = await getDoc(doc(masterFirestore, 'companies', companyId));
                if (companyDoc.exists()) {
                    setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
                }
                setLoading(false);
                return;
            }
        }

        // 🛡️ 2. فحص صلاحية المطور (فقط إذا لم يكن مرتبطاً بشركة)
        const idToken = await firebaseUser.getIdTokenResult();
        if (idToken.claims.role === 'Developer' || userEmail === 'dev@nova-erp.local') {
            const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
            setUser({
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                username: 'root',
                role: 'Developer',
                isActive: true,
                fullName: devDoc.exists() ? devDoc.data().fullName : 'Master Developer',
                isSuperAdmin: true,
            });
            setAuthCookies(firebaseUser.uid, 'Developer');
            setLoading(false);
            return;
        }

        // إذا وصلنا هنا، يعني المستخدم دخل بيانات صحيحة لكن ليس له سجل في القاعدة
        console.warn("User authenticated but not found in indexes.");
        setUser(null);
        setLoading(false);
      } catch (error) {
        console.error("Auth Loop Protection Error:", error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth) throw new Error("تعذر الاتصال بخادم الأمان.");
    setLoading(true);
    await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
  }, [masterAuth]);

  const logout = useCallback(async () => {
    if (masterAuth) await signOut(masterAuth);
    setUser(null);
    setCurrentCompany(null);
    removeAuthCookies();
    router.replace('/');
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
