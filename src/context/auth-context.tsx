'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, Company, GlobalUserIndex, AuthenticatedUser } from '@/lib/types';
import { getCompanyFirebase } from '@/firebase/multi-tenant';
import { useCompany } from './company-context';

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
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!masterAuth || !masterFirestore) {
        console.warn("Firebase Auth or Firestore not available yet.");
        setLoading(false);
        return;
    }

    // 🛡️ صمام أمان زمني لضمان عدم بقاء شاشة التحميل عالقة للأبد
    const fallbackTimer = setTimeout(() => {
        if (loading && !isInitialized.current) {
            console.warn("Auth initialization timed out. Forcing load completion.");
            setLoading(false);
        }
    }, 8000);

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
        try {
            if (firebaseUser) {
                const idTokenResult = await firebaseUser.getIdTokenResult();
                const claims = idTokenResult.claims as any;

                // 1. حالة المطور السيادي
                if (firebaseUser.email === MASTER_DEV_EMAIL) {
                    const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
                    if (devDoc.exists()) {
                        const devData = devDoc.data();
                        const activeCompanyId = claims.currentCompanyId || null;
                        
                        setUser({ 
                            ...devData as UserProfile, 
                            uid: firebaseUser.uid,
                            id: firebaseUser.uid,
                            isSuperAdmin: true,
                            currentCompanyId: activeCompanyId,
                            companyName: claims.companyName || null
                        });
                        
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

                // 2. حالة المستخدم العادي (Tenant)
                const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', firebaseUser.email)));
                
                if (!userIndexSnap.empty) {
                    const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
                    const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
                    
                    if (companyDoc.exists()) {
                        const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
                        const { firestore: companyFirestore } = getCompanyFirebase(company.firebaseConfig, company.id!);
                        
                        const tenantUserQuery = query(collection(companyFirestore, 'users'), where('email', '==', firebaseUser.email));
                        const tenantUserSnap = await getDocs(tenantUserQuery);
                        
                        if (!tenantUserSnap.empty) {
                            const userData = tenantUserSnap.docs[0].data() as UserProfile;
                            setCurrentCompany(company);
                            setUser({ ...userData, uid: firebaseUser.uid, id: tenantUserSnap.docs[0].id });
                        }
                    }
                }
            } else {
                setUser(null);
                setCurrentCompany(null);
            }
        } catch (error) {
            console.error("Auth Critical Error:", error);
            setUser(null);
        } finally {
            setLoading(false);
            isInitialized.current = true;
            clearTimeout(fallbackTimer);
        }
    });

    return () => {
        unsubscribe();
        clearTimeout(fallbackTimer);
    };
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (email: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بالخادم الرئيسي.");

    const cleanEmail = email.toLowerCase().trim();

    if (cleanEmail === MASTER_DEV_EMAIL) {
        try {
            const userCredential = await signInWithEmailAndPassword(masterAuth, cleanEmail, password);
            const devDoc = await getDoc(doc(masterFirestore, 'developers', userCredential.user.uid));
            
            if (devDoc.exists()) {
                document.cookie = 'nova-dev-session=1; path=/; max-age=86400';
                return;
            } else {
                await signOut(masterAuth);
                throw new Error('حساب المطور غير مفعل سيادياً.');
            }
        } catch (e: any) {
            throw new Error(e.message || 'بيانات الدخول السيادية غير صحيحة.');
        }
    }

    try {
        const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', cleanEmail)));
        
        if (!userIndexSnap.empty) {
            const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
            const companyDoc = await getDoc(doc(masterFirestore, 'companies', userIndex.companyId));
            
            if (!companyDoc.exists()) throw new Error('بيانات الشركة غير موجودة.');
            const company = { id: companyDoc.id, ...companyDoc.data() } as Company;
            
            if (!company.isActive) throw new Error('حساب الشركة معطل حالياً.');

            const { auth: companyAuth } = getCompanyFirebase(company.firebaseConfig, company.id!);
            await signInWithEmailAndPassword(companyAuth, cleanEmail, password);

            document.cookie = 'nova-user-session=1; path=/; max-age=86400';
        } else {
            throw new Error('هذا البريد غير مسجل في أي منشأة.');
        }
    } catch (e: any) {
        throw new Error(e.message || 'بيانات الدخول غير صحيحة.');
    }
  }, [masterAuth, masterFirestore]);

  const logout = useCallback(async () => {
    if (masterAuth) await signOut(masterAuth);
    document.cookie = 'nova-dev-session=; max-age=0; path=/';
    document.cookie = 'nova-user-session=; max-age=0; path=/';
    setUser(null);
    setCurrentCompany(null);
    router.push('/');
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
