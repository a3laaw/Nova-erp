'use client';

/**
 * @fileOverview سياق المصادقة الذكي الموحد (The Sovereign Auth Gateway).
 * بوابة دخول واحدة تكتشف المطور والشركات آلياً.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, Company, GlobalUserIndex } from '@/lib/types';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useCompany } from './company-context';

export interface AuthenticatedUser extends UserProfile {
  uid: string;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
    if (!masterAuth || !masterFirestore) return;

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
        if (firebaseUser) {
            // 1. تحقق أولاً إذا كان المطور السيادي في مشروع الماستر
            const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
            if (devDoc.exists()) {
                setUser({ ...devDoc.data() as UserProfile, uid: firebaseUser.uid });
                setLoading(false);
                return;
            }

            // 2. البحث في الفهرس العالمي للموظفين
            const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', firebaseUser.email)));
            
            if (!userIndexSnap.empty) {
                const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
                const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
                
                if (companyDoc.exists()) {
                    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
                    // تهيئة محرك الشركة ديناميكياً
                    const { firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, company.id!);
                    
                    const tenantUserQuery = query(collection(companyFirestore, 'users'), where('email', '==', firebaseUser.email));
                    const tenantUserSnap = await getDocs(tenantUserQuery);
                    
                    if (!tenantUserSnap.empty) {
                        const userData = tenantUserSnap.docs[0].data() as UserProfile;
                        setCurrentCompany(company);
                        setUser({ ...userData, uid: firebaseUser.uid });
                    }
                }
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = async (email: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بالخادم الرئيسي.");

    const cleanEmail = email.toLowerCase().trim();

    // --- المسار السيادي: دخول المطور ---
    if (cleanEmail === MASTER_DEV_EMAIL) {
        try {
            const userCredential = await signInWithEmailAndPassword(masterAuth, cleanEmail, password);
            const devDoc = await getDoc(doc(masterFirestore, 'developers', userCredential.user.uid));
            
            if (devDoc.exists()) {
                const devData = devDoc.data() as UserProfile;
                setUser({ ...devData, uid: userCredential.user.uid });
                document.cookie = 'nova-dev-session=1; path=/; max-age=86400';
                router.push('/developer');
                return;
            } else {
                await signOut(masterAuth);
                throw new Error('تم التعرف على البريد ولكن لم يتم العثور على وثيقة المطور. يرجى تشغيل npm run setup:developer');
            }
        } catch (e: any) {
            console.error(e);
            if (e.code === 'auth/operation-not-allowed') {
                throw new Error('يجب تفعيل خيار الدخول بالبريد (Email/Password) من لوحة تحكم Firebase.');
            }
            throw new Error('بيانات الدخول السيادية غير صحيحة.');
        }
    }

    // --- المسار العام: دخول موظفي الشركات ---
    const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', cleanEmail)));
    
    if (!userIndexSnap.empty) {
        const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
        const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
        
        if (!companyDoc.exists()) throw new Error('بيانات الشركة غير موجودة.');
        const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
        
        if (!company.isActive) throw new Error('حساب الشركة معطل حالياً.');

        const { auth: companyAuth, firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, company.id!);

        try {
            await signInWithEmailAndPassword(companyAuth, cleanEmail, password);
            const tenantUserQuery = query(collection(companyFirestore, 'users'), where('email', '==', cleanEmail));
            const tenantUserSnap = await getDocs(tenantUserQuery);
            
            if (tenantUserSnap.empty) throw new Error('فشل الوصول لملف المستخدم في الشركة.');
            const userData = tenantUserSnap.docs[0].data() as UserProfile;
            
            if (!userData.isActive) throw new Error('حسابك معطل بقرار إداري.');

            setCurrentCompany(company);
            setUser({ ...userData, uid: companyAuth.currentUser!.uid });
            document.cookie = 'nova-user-session=1; path=/; max-age=86400';
            router.push('/dashboard');
            return;
        } catch (e: any) {
            throw new Error('البريد أو كلمة المرور غير صحيحة.');
        }
    }

    throw new Error('هذا الحساب غير مسجل في أي شركة تابعة للمنصة.');
  };

  const logout = async () => {
    if (masterAuth) await signOut(masterAuth);
    document.cookie = 'nova-dev-session=; max-age=0; path=/';
    document.cookie = 'nova-user-session=; max-age=0; path=/';
    setUser(null);
    setCurrentCompany(null);
    router.push('/');
  };

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
