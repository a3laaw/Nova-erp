'use client';

/**
 * @fileOverview سياق المصادقة السيادي المطور (Smart Identity Discovery).
 * تم تحديثه لمعالجة خطأ (operation-not-allowed) وإرشاد المستخدم لتفعيل الإعدادات.
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

  useEffect(() => {
    if (!masterAuth || !masterFirestore) return;

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
        if (firebaseUser) {
            // أولاً: فحص إذا كان مطوراً (Super Admin)
            const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
            if (devDoc.exists()) {
                setUser({ ...devDoc.data() as UserProfile, uid: firebaseUser.uid });
                setLoading(false);
                return;
            }

            // ثانياً: إذا كان مستخدماً عادياً، نبحث عنه في الفهرس العالمي
            const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', firebaseUser.email)));
            
            if (!userIndexSnap.empty) {
                const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
                const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
                
                if (companyDoc.exists()) {
                    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
                    const { auth: companyAuth, firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, company.id!);
                    
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

  const handleAuthError = (error: any) => {
    console.error("Auth Error Code:", error.code);
    if (error.code === 'auth/operation-not-allowed') {
        throw new Error('⚠️ خطأ إعدادات: يجب تفعيل Email/Password في منصة Firebase لهذا المشروع.');
    }
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    throw new Error(error.message || 'فشل تسجيل الدخول. يرجى المحاولة لاحقاً.');
  };

  const login = async (email: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("Connection Error");

    const cleanEmail = email.toLowerCase().trim();

    // 1. الاكتشاف الذكي للهوية
    const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', cleanEmail)));
    
    // A) حالة المطور الرئيسي (Root Access)
    if (cleanEmail === process.env.NEXT_PUBLIC_DEV_EMAIL || cleanEmail === 'dev@nova-erp.local') {
        try {
            await signInWithEmailAndPassword(masterAuth, cleanEmail, password);
            const devDoc = await getDoc(doc(masterFirestore, 'developers', masterAuth.currentUser!.uid));
            if (!devDoc.exists()) throw new Error('حساب المطور غير موجود في قاعدة البيانات الرئيسية.');
            
            setUser({ ...devDoc.data() as UserProfile, uid: masterAuth.currentUser!.uid });
            document.cookie = 'nova-dev-session=1; path=/; max-age=86400';
            router.push('/developer');
            return;
        } catch (e) {
            handleAuthError(e);
        }
    }

    if (userIndexSnap.empty) throw new Error('عذراً، هذا الحساب غير مسجل في أي منشأة تابعة لـ Nova ERP.');

    const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
    
    // 2. جلب بيانات الشركة
    const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
    if (!companyDoc.exists()) throw new Error('الشركة التابع لها هذا الحساب غير موجودة.');
    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

    if (!company.isActive) throw new Error('هذه المنشأة معطلة حالياً. يرجى مراجعة إدارة Nova ERP.');

    // 3. التوجيه والمصادقة في مشروع الشركة المعزول
    const { auth: companyAuth, firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, company.id!);

    try {
        await signInWithEmailAndPassword(companyAuth, cleanEmail, password);
        const tenantUserQuery = query(collection(companyFirestore, 'users'), where('email', '==', cleanEmail));
        const tenantUserSnap = await getDocs(tenantUserQuery);
        
        if (tenantUserSnap.empty) throw new Error('فشل الوصول لبيانات الملف الشخصي في قاعدة بيانات الشركة.');
        const userData = tenantUserSnap.docs[0].data() as UserProfile;
        
        if (!userData.isActive) throw new Error('حساب الموظف معطّل بقرار إداري داخلي.');

        setCurrentCompany(company);
        setUser({ ...userData, uid: companyAuth.currentUser!.uid });
        document.cookie = 'nova-user-session=1; path=/; max-age=86400';
        router.push('/dashboard');
    } catch (e: any) {
        handleAuthError(e);
    }
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
