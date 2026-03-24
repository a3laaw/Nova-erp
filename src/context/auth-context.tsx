'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, Company, Employee } from '@/lib/types';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useCompany } from './company-context';

export interface AuthenticatedUser extends UserProfile {
  uid: string;
}

interface AuthContextType {
  user: AuthenticatedUser | null;
  loading: boolean;
  login: (email: string, password: string, companyId?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);

  // مراقبة حالة الجلسة عند بدء التشغيل
  useEffect(() => {
    const restoreSession = async () => {
        setLoading(true);
        // التحقق من وجود مستخدم في Master (Developer)
        if (masterAuth?.currentUser) {
            const devDoc = await getDoc(doc(masterFirestore!, 'developers', masterAuth.currentUser.uid));
            if (devDoc.exists()) {
                setUser({ ...devDoc.data() as UserProfile, uid: masterAuth.currentUser.uid });
                setLoading(false);
                return;
            }
        }
        setLoading(false);
    };
    restoreSession();
  }, [masterAuth, masterFirestore]);

  const login = async (email: string, password: string, companyId?: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("Connection Error");

    // A) دخول المطور (Developer Login)
    if (email === process.env.NEXT_PUBLIC_DEV_EMAIL) {
      await signInWithEmailAndPassword(masterAuth, email, password);
      const userRecord = masterAuth.currentUser!;
      const idTokenResult = await userRecord.getIdTokenResult();
      
      if (idTokenResult.claims.role !== 'Developer') {
        await signOut(masterAuth);
        throw new Error('غير مصرح لك بالدخول كمنور');
      }

      const devDoc = await getDoc(doc(masterFirestore, 'developers', userRecord.uid));
      setUser({ ...devDoc.data() as UserProfile, uid: userRecord.uid });
      document.cookie = 'nova-dev-session=1; path=/; max-age=86400';
      router.push('/developer');
      return;
    }

    // B) دخول موظف شركة (Tenant Login)
    if (!companyId) throw new Error('يرجى اختيار الشركة أولاً');

    const companyDoc = await getDoc(doc(masterFirestore, 'companies', companyId));
    if (!companyDoc.exists()) throw new Error('الشركة غير موجودة');
    const company = { id: companyDoc.id, ...companyDoc.data() } as Company;

    if (!company.isActive) throw new Error('هذه الشركة غير مفعّلة حالياً. يرجى مراجعة الإدارة.');

    const { auth: companyAuth, firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, companyId);

    try {
        await signInWithEmailAndPassword(companyAuth, email, password);
        const userQuery = query(collection(companyFirestore, 'users'), where('email', '==', email));
        const userSnap = await getDocs(userQuery);
        
        if (userSnap.empty) throw new Error('لا يوجد حساب مستخدم مرتبط بهذا البريد في هذه الشركة.');
        const userData = userSnap.docs[0].data() as UserProfile;
        
        if (!userData.isActive) throw new Error('حساب الموظف معطّل.');

        setCurrentCompany(company);
        setUser({ ...userData, uid: companyAuth.currentUser!.uid });
        document.cookie = 'nova-user-session=1; path=/; max-age=86400';
        router.push('/dashboard');
    } catch (e: any) {
        throw new Error(e.message);
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
