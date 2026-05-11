'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, signInWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useCompany } from './company-context';
import type { AuthenticatedUser, Company as CompanyType } from '@/lib/types';

interface AuthContextType {
  user: AuthenticatedUser | null;
  company: CompanyType | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { auth: masterAuth, firestore: masterFirestore } = useFirebase();
  const { setCurrentCompany } = useCompany();
  
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [company, setCompany] = useState<CompanyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🛡️ محرك جلب الهوية السيادي: يبحث أولاً في الشركات لضمان توجيه المستخدمين لشركاتهم فوراً
  const fetchIdentity = useCallback(async (email: string, uid: string) => {
    if (!masterFirestore) return { profile: null, company: null };
    
    try {
        const lowerEmail = email.toLowerCase().trim();
        
        // 1. الأولوية المطلقة: البحث في الفهرس العالمي (Global Index)
        // هذا يضمن أن nova1@nova-erp.local يذهب لشركته فوراً
        const globalQuery = query(collection(masterFirestore, 'global_users'), where('email', '==', lowerEmail), limit(1));
        const globalSnap = await getDocs(globalQuery);

        if (!globalSnap.empty) {
            const indexData = globalSnap.docs[0].data();
            const tenantId = indexData.companyId;

            const userRef = doc(masterFirestore, `companies/${tenantId}/users`, uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const profile = userSnap.data() as AuthenticatedUser;
                const companySnap = await getDoc(doc(masterFirestore, 'companies', tenantId));
                const companyData = companySnap.exists() ? { id: companySnap.id, ...companySnap.data() } as CompanyType : null;

                return { 
                    profile: { ...profile, id: userSnap.id, uid, currentCompanyId: tenantId, companyName: companyData?.name || 'Nova Client' }, 
                    company: companyData 
                };
            }
        }

        // 2. إذا لم يوجد في الشركات، نفحص وضع المطور (Developer Mode)
        const devDoc = await getDoc(doc(masterFirestore, 'developers', uid));
        if (devDoc.exists()) {
            return {
                profile: { 
                    id: uid, uid, email: lowerEmail, role: 'Developer', isActive: true, 
                    fullName: devDoc.data().fullName || 'Sovereign Developer',
                    isSuperAdmin: true, currentCompanyId: null, companyName: 'Nova ERP' 
                } as AuthenticatedUser,
                company: null
            };
        }

        return { profile: null, company: null };
    } catch (e) {
        console.error("Auth Sync Failure:", e);
        return { profile: null, company: null };
    }
  }, [masterFirestore]);

  useEffect(() => {
    if (!masterAuth) return;

    const unsubscribe = onAuthStateChanged(masterAuth, async (firebaseUser) => {
      setLoading(true);
      try {
        if (firebaseUser?.email) {
          const { profile, company: companyData } = await fetchIdentity(firebaseUser.email, firebaseUser.uid);
          
          if (profile && profile.isActive) {
            // زرع الكوكيز فوراً لفتح أقفال الـ Middleware
            document.cookie = `nova-user-session=${firebaseUser.uid}; path=/; max-age=604800; SameSite=Lax`;
            if (profile.role === 'Developer') {
                document.cookie = `nova-dev-session=${firebaseUser.uid}; path=/; max-age=604800; SameSite=Lax`;
            }
            
            setUser(profile);
            setCompany(companyData);
            if (companyData) setCurrentCompany(companyData);
          } else {
            setUser(null);
            setCompany(null);
            setError(profile ? 'الحساب معطل حالياً.' : 'بيانات الدخول غير مسجلة.');
            await signOut(masterAuth);
          }
        } else {
          setUser(null);
          setCompany(null);
          setCurrentCompany(null);
          document.cookie = 'nova-user-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'nova-dev-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [masterAuth, fetchIdentity, setCurrentCompany]);

  const login = async (email: string, password: string) => {
    if (!masterAuth) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(masterAuth, email.toLowerCase().trim(), password);
    } catch (err: any) {
        setLoading(false);
        setError('خطأ في البريد الإلكتروني أو كلمة المرور.');
        throw err;
    }
  };

  const logout = async () => {
    if (!masterAuth) return;
    setLoading(true);
    try {
      await signOut(masterAuth);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({ user, company, loading, error, login, logout }), [user, company, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within <AuthProvider>');
  return context;
};
