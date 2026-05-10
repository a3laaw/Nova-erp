'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';

interface AuthContextType {
  user: AuthenticatedUser | null;
  company: Company | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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

  // 🛡️ محرك جلب سياق المستخدم السيادي
  const fetchUserWithContext = useCallback(async (email: string, uid: string) => {
    if (!masterFirestore) return { userProfile: null, companyData: null };
    
    try {
        // 1. البحث في الفهرس العالمي
        const globalQuery = query(collection(masterFirestore, 'global_users'), where('email', '==', email.toLowerCase()), limit(1));
        const globalSnap = await getDocs(globalQuery);

        if (!globalSnap.empty) {
            const indexData = globalSnap.docs[0].data();
            const tenantId = indexData.companyId;

            // 2. جلب ملف المستخدم المعزول داخل المنشأة
            const userRef = doc(masterFirestore, `companies/${tenantId}/users`, uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const profile = userSnap.data() as AuthenticatedUser;
                
                // 3. جلب بيانات المنشأة للبراندينج
                const companySnap = await getDoc(doc(masterFirestore, 'companies', tenantId));
                const companyData = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } as Company : null;

                return { 
                    userProfile: { ...profile, id: userSnap.id, uid, currentCompanyId: tenantId, companyName: companyData?.name || 'Nova Client' }, 
                    companyData 
                };
            }
        }

        // 🛠️ فحص وضع المطور (Root Access)
        const devDoc = await getDoc(doc(masterFirestore, 'developers', uid));
        if (devDoc.exists()) {
            return {
                userProfile: { 
                    id: uid, uid, email, role: 'Developer', isActive: true, 
                    fullName: devDoc.data().fullName || 'Sovereign Developer',
                    isSuperAdmin: true, currentCompanyId: null, companyName: 'Nova ERP' 
                } as AuthenticatedUser,
                companyData: null
            };
        }

        return { userProfile: null, companyData: null };
    } catch (e) {
        console.error("Context Fetch Error:", e);
        return { userProfile: null, companyData: null };
    }
  }, [masterFirestore]);

  useEffect(() => {
    if (!masterAuth) return;

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser?.email) {
          const { userProfile, companyData } = await fetchUserWithContext(firebaseUser.email, firebaseUser.uid);
          
          if (userProfile && userProfile.isActive) {
            setUser(userProfile);
            setCompany(companyData);
            if (companyData) setCurrentCompany(companyData);
            
            // زرع كوكيز الجلسة لفتح أقفال الـ Middleware
            document.cookie = `nova-user-session=${firebaseUser.uid}; path=/; max-age=604800; SameSite=Lax`;
            if (userProfile.role === 'Developer') {
                document.cookie = `nova-dev-session=${firebaseUser.uid}; path=/; max-age=604800; SameSite=Lax`;
            }
          } else {
            await signOut(masterAuth);
          }
        } else {
          setUser(null);
          setCompany(null);
          setCurrentCompany(null);
        }
      } catch (err) {
        console.error("Auth Loop Error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, fetchUserWithContext, setCurrentCompany]);

  const login = async (email: string, password: string) => {
    if (!masterAuth) return;
    setError(null);
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
        let msg = 'فشل الدخول. تأكد من البريد الفني وكلمة المرور.';
        if (err.code === 'auth/user-not-found') msg = 'لا يوجد حساب مرتبط بهذا البريد.';
        else if (err.code === 'auth/wrong-password') msg = 'كلمة المرور غير صحيحة.';
        setError(msg);
        throw new Error(msg);
    }
  };

  const logout = async () => {
    if (!masterAuth) return;
    await signOut(masterAuth);
    document.cookie = 'nova-user-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'nova-dev-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.replace('/');
  };

  const refreshUserData = async () => {
      if(user) await fetchUserWithContext(user.email, user.uid);
  };

  const value = useMemo(() => ({ user, company, loading, error, login, logout, refreshUserData }), [user, company, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
};
