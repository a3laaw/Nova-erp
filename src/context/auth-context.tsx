
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
        
        // 1. حالة المطور (Root Access)
        if (userEmail === MASTER_DEV_EMAIL) {
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

        // 2. حالة مستخدم المنشأة (SaaS User)
        if (userEmail) {
          const userIndexSnap = await getDocs(query(
            collection(masterFirestore, 'global_users'), 
            where('email', '==', userEmail),
            limit(1)
          ));
          
          if (!userIndexSnap.empty) {
            const companyId = userIndexSnap.docs[0].data().companyId;
            const tenantUserDoc = await getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid));

            if (tenantUserDoc.exists()) {
              const userData = tenantUserDoc.data() as UserProfile;
              if (!userData.isActive) {
                  await signOut(masterAuth);
                  throw new Error("هذا الحساب معلق حالياً.");
              }
              setUser({ 
                ...userData, 
                uid: firebaseUser.uid, 
                id: tenantUserDoc.id,
                currentCompanyId: companyId,
              });

              const companyDoc = await getDoc(doc(masterFirestore, 'companies', companyId));
              if (companyDoc.exists()) {
                  setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
              }
            } else {
                await signOut(masterAuth);
                throw new Error("لم يتم العثور على ملف الموظف.");
            }
          } else {
              // إذا لم نجد الفهرس، نحاول جلب ملف الموظف عبر الـ UID مباشرة كخيار أمان أخير
              // لكن لضمان العزل، نفضل تسجيل الخروج وطلب الإصلاح
              await signOut(masterAuth);
          }
        }
      } catch (error: any) {
        console.error("Auth Sync Error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (identifier: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("تعذر الاتصال بخادم الأمان.");

    let loginEmail = identifier.toLowerCase().trim();

    // 🛡️ جسر الهوية: تحويل الاسم البسيط إلى إيميل فني عبر الفهرس العالمي
    if (!loginEmail.includes('@')) {
      const userIndexSnap = await getDocs(query(
        collection(masterFirestore, 'global_users'), 
        where('username', '==', loginEmail),
        limit(1)
      ));
      
      if (userIndexSnap.empty) {
          throw new Error('اسم المستخدم هذا غير مسجل أو يحتاج لمزامنة من غرفة التحكم.');
      }
      loginEmail = userIndexSnap.docs[0].data().email;
    }

    try {
      await signInWithEmailAndPassword(masterAuth, loginEmail, password);
    } catch (e: any) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password') {
          throw new Error('بيانات الدخول غير صحيحة.');
      }
      throw new Error('فشل تسجيل الدخول. يرجى التأكد من اتصال الإنترنت أو مزامنة الحساب.');
    }
  }, [masterAuth, masterFirestore]);

  const logout = useCallback(async () => {
    if (masterAuth) await signOut(masterAuth);
    setUser(null);
    setCurrentCompany(null);
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
