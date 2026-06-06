'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { onSnapshot, query, collection, orderBy as fbOrderBy } from 'firebase/firestore';
import { getFirebaseServices } from './init';

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const services = useMemo(() => getFirebaseServices(), []);
  const value = services ?? { app: null, auth: null, firestore: null, storage: null };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

/**
 * Custom hook to access full Firebase Context
 * 🛡️ تم تحصينها هنا بالكامل لتدعم المسميات القديمة والجديدة (db و firestore) معاً
 * هذا السيرفر المزدوج يضمن ربط الجداول بالبيانات الحية فوراً ويمنع تعليق المتصفح
 */
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return {
    ...context,
    app: context.app,
    firebaseApp: context.app,
    firestore: context.firestore,
    db: context.firestore, // الجسر السحري لربط الاستعلامات القديمة بقاعدة البيانات الحية
    auth: context.auth,
    storage: context.storage
  };
}

export function useFirebaseApp() {
    const context = useContext(FirebaseContext);
    if (context === undefined) {
        throw new Error('useFirebaseApp must be used within a FirebaseProvider');
    }
    return context.app;
}

export function useAuth() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context.auth;
}

export function useFirestore() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context.firestore;
}

export function useStorage() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useStorage must be used within a FirebaseProvider');
  }
  return context.storage;
}

/**
 * 🛡️ محرك البث الحي السيادي المطور لعرض الداتا القديمة والجديدة فوراً وبشكل قاطع
 * (Anti-Filtering Safe Subscription Engine)
 */
export function useSubscription<T>(
    customFirestore: Firestore | null,
    path: string | null,
    orderByField: string | null = null
): { data: T[]; loading: boolean; error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const context = useContext(FirebaseContext);
    const activeFirestore = customFirestore || context?.firestore || null;

    const pathRef = useRef(path);
    const dbRef = useRef(activeFirestore);
    
    useEffect(() => {
        pathRef.current = path;
        dbRef.current = activeFirestore;
    }, [path, activeFirestore]);

    useEffect(() => {
        let currentPath = pathRef.current;
        const currentDb = dbRef.current;

        if (!currentDb || !currentPath) {
            setData([]);
            setLoading(false);
            return;
        }

        // 💡 تنظيف المسار التلقائي: إذا كان الكود يستدعي مساراً متبوعاً بشرطة مائلة مزدوجة أو تالفة،
        // نقوم بتطهيره فوراً ليقرأ المجلد الرئيسي للشركة مباشرة دون حجب الداتا القديمة
        if (currentPath.includes('//')) {
            currentPath = currentPath.replace('//', '/');
        }

        let isMounted = true;
        setLoading(true);

        try {
            // جلب مباشر ومستقر للمجموعة لضمان سحب كل الموظفين والعملاء القدامى المخزنين
            let q = query(collection(currentDb, currentPath));
            
            if (orderByField) {
                q = query(collection(currentDb, currentPath), fbOrderBy(orderByField));
            }
            
            const unsubscribe = onSnapshot(
                q,
                (querySnapshot) => {
                    if (!isMounted) return;
                    
                    const fetchedData: T[] = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    } as T));
                    
                    console.log(`⚡ Nova ERP Subscriptions Success from path [${currentPath}]:`, fetchedData.length, "items found.");
                    setData(fetchedData);
                    setLoading(false);
                },
                (err) => {
                    if (!isMounted) return;
                    console.error(`🚨 Subscription Error from path [${currentPath}]:`, err);
                    setError(err);
                    setLoading(false);
                }
            );

            return () => {
                isMounted = false;
                unsubscribe();
            };
        } catch (err: any) {
            if (isMounted) {
                console.error(`🚨 Fatal Subscription Error for ${currentPath}:`, err);
                setError(err);
                setLoading(false);
            }
        }
    }, [path]);

    return { data, loading, error };
}

export default useFirebase;