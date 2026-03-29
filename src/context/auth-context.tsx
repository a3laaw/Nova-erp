'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { UserProfile, Company, GlobalUserIndex, AuthenticatedUser } from '@/lib/types';
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
    if (!masterAuth || !masterFirestore) return;

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
        try {
            if (firebaseUser) {
                const idTokenResult = await firebaseUser.getIdTokenResult();
                const claims = idTokenResult.claims as any;

                // 1. حالة المطور السيادي (Root)
                if (firebaseUser.email === MASTER_DEV_EMAIL) {
                    const devDoc = await getDoc(doc(masterFirestore, 'developers', firebaseUser.uid));
                    if (devDoc.exists()) {
                        const activeCompanyId = claims.currentCompanyId || null;
                        setUser({ 
                            ...devDoc.data() as UserProfile, 
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

                // 2. حالة مستخدم الـ SaaS (Tenant)
                // جلب الميتا-داتا للمستخدم من الفهرس العالمي
                const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('email', '==', firebaseUser.email)));
                
                if (!userIndexSnap.empty) {
                    const userIndex = userIndexSnap.docs[0].data() as GlobalUserIndex;
                    const companyId = userIndex.companyId;
                    
                    const companyDoc = await getDoc(doc(masterFirestore, 'companies', companyId));
                    if (companyDoc.exists()) {
                        const companyData = { id: companyDoc.id, ...companyDoc.data() } as Company;
                        
                        // جلب بيانات المستخدم من داخل مجلد الشركة (المسار المعزول)
                        const tenantUserDoc = await getDoc(doc(masterFirestore, `companies/${companyId}/users`, firebaseUser.uid));
                        
                        if (tenantUserDoc.exists()) {
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
            } else {
                setUser(null);
                setCurrentCompany(null);
            }
        } catch (error) {
            console.error("Auth Critical Error:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    });

    return () => unsubscribe();
  }, [masterAuth, masterFirestore, setCurrentCompany]);

  const login = useCallback(async (identifier: string, password: string) => {
    if (!masterAuth || !masterFirestore) throw new Error("فشل الاتصال بخادم الأمان.");

    let email = identifier.toLowerCase().trim();

    // إذا كان المطور يدخل بحسابه الصريح
    if (email === MASTER_DEV_EMAIL) {
        await signInWithEmailAndPassword(masterAuth, email, password);
        document.cookie = 'nova-dev-session=1; path=/; max-age=86400';
        return;
    }

    // 🛡️ ذكاء الدخول السيادي:
    // إذا لم يكتب المستخدم إيميل كامل، نبحث عنه كـ "اسم مستخدم" عالمي
    if (!email.includes('@')) {
        const userIndexSnap = await getDocs(query(collection(masterFirestore, 'global_users'), where('username', '==', email)));
        if (userIndexSnap.empty) throw new Error('اسم المستخدم هذا غير مسجل لدينا.');
        email = userIndexSnap.docs[0].data().email;
    }

    try {
        await signInWithEmailAndPassword(masterAuth, email, password);
        document.cookie = 'nova-user-session=1; path=/; max-age=86400';
    } catch (e: any) {
        throw new Error('خطأ في كلمة المرور أو اسم المستخدم.');
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
