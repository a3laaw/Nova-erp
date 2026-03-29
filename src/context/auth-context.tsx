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
  
  const MASTER_DEV_EMAIL = 'dev@nova-erp.local';

  // 🛡️ صمام الأمان السيادي لضمان عدم تعليق الواجهة
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn("Auth safety timeout triggered. Forcing loading to false.");
        setLoading(false);
      }
    }, 5000);
    return () => clearTimeout(safetyTimer);
  }, [loading]);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      // 1. إذا لم يكن هناك مستخدم مسجل الدخول، نتوقف فوراً
      if (!firebaseUser) {
        setUser(null);
        setCurrentCompany(null);
        setLoading(false);
        return;
      }

      try {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const claims = idTokenResult.claims as any;

        // 2. حالة المطور السيادي
        if (firebaseUser.email === MASTER_DEV_EMAIL) {
          const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
          if (devDoc.exists()) {
            const activeCompanyId = claims.currentCompanyId || null;
            const userData = { 
              ...devDoc.data() as UserProfile, 
              uid: firebaseUser.uid,
              id: firebaseUser.uid,
              isSuperAdmin: true,
              currentCompanyId: activeCompanyId,
              companyName: claims.companyName || null
            };
            setUser(userData);
            
            if (activeCompanyId) {
              const companyDoc = await getDoc(doc(masterFirestore, 'companies', activeCompanyId));
              if (companyDoc.exists()) {
                setCurrentCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
              }
            }
            setLoading(false);
            return;
          }
        }

        // 3. حالة مستخدم المنشأة (Tenant User)
        const userEmail = firebaseUser.email?.toLowerCase();
        if (userEmail) {
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
        console.error("Auth profile fetch error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (identifier: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بخادم الأمان.");

    let email = identifier.toLowerCase().trim();

    if (!email.includes('@')) {
      const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('username', '==', email)));
      if (userIndexSnap.empty) throw new Error('اسم المستخدم هذا غير مسجل.');
      email = userIndexSnap.docs[0].data().email;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(masterAuth, email, password);
      document.cookie = `nova-user-session=1; path=/; max-age=86400; SameSite=Lax`;
    } catch (e: any) {
      setLoading(false);
      throw e;
    }
  }, [masterAuth, masterFirestore]);

  const logout = useCallback(async () => {
    setLoading(true);
    if (masterAuth) await signOut(masterAuth);
    document.cookie = 'nova-dev-session=; max-age=0; path=/';
    document.cookie = 'nova-user-session=; max-age=0; path=/';
    setUser(null);
    setCurrentCompany(null);
    setLoading(false);
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
