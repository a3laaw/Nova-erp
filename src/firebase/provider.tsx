'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore, Query } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { onSnapshot, query, collection, orderBy as fbOrderBy, doc, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { getFirebaseServices } from './init';
import { getStorage } from 'firebase/storage';

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const services = useMemo(() => getFirebaseServices(), []);
  return (
    <FirebaseContext.Provider value={services ?? { app: null, auth: null, firestore: null, storage: null }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) throw new Error('useFirebase must be used within a FirebaseProvider');
  return {
    ...context,
    db: context.firestore, // Alias for backward compatibility
  };
}

export function useStorage() {
  const { app } = useFirebase();
  return app ? getStorage(app) : null;
}

export function useDocument<T>(path: string, disabled: boolean = false): { data: T | null; loading: boolean; error: Error | null } {
    const { firestore } = useFirebase();
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (disabled || !firestore || !path) {
            setData(null);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const docRef = doc(firestore, path);

        const unsubscribe = onDocSnapshot(docRef, (docSnap) => {
            if (isMounted) {
                if (docSnap.exists()) {
                    setData({ id: docSnap.id, ...docSnap.data() } as T);
                } else {
                    setData(null);
                }
                setError(null);
                setLoading(false);
            }
        }, (err) => {
            if (isMounted) {
                console.error(`🚨 Document Snapshot Error for ${path}:`, err);
                setError(err);
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [firestore, path, disabled]);

    return { data, loading, error };
}

/**
 * 🛡️ The Sovereign Real-time Engine for fetching both legacy and new data instantly.
 * (Anti-Filtering Safe Subscription Engine)
 * Now upgraded to handle both string paths and full Query objects.
 */
export function useSubscription<T>(
    customFirestore: Firestore | null,
    pathOrQuery: string | Query | null | undefined,
    orderByField: string | null = null,
    disabled: boolean = false
): { data: T[]; loading: boolean; error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const context = useContext(FirebaseContext);
    const activeFirestore = customFirestore || context?.firestore || null;

    useEffect(() => {
        if (disabled || !activeFirestore || !pathOrQuery) {
            setData([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);

        let q: Query;
        let loggingPath: string;

        try {
            if (typeof pathOrQuery === 'string') {
                let currentPath = pathOrQuery;
                // Automatic path cleaning
                if (currentPath.includes('//')) {
                    currentPath = currentPath.replace(/\/\//g, '/'); // Replace all double slashes
                }
                loggingPath = currentPath;

                const collRef = collection(activeFirestore, currentPath);
                q = orderByField ? query(collRef, fbOrderBy(orderByField)) : query(collRef);

            } else {
                // It's already a Query object
                q = pathOrQuery as Query;
                loggingPath = `custom query`;
            }

            const unsubscribe = onSnapshot(
                q,
                (querySnapshot) => {
                    if (!isMounted) return;
                    
                    const fetchedData: T[] = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data(),
                    } as T));
                    
                    console.log(`⚡ Nova ERP Subscriptions Success from [${loggingPath}]:`, fetchedData.length, "items found.");
                    setData(fetchedData);
                    setError(null);
                    setLoading(false);
                },
                (err) => {
                    if (!isMounted) return;
                    console.error(`🚨 Subscription Error from [${loggingPath}]:`, err);
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
                const errorPath = typeof pathOrQuery === 'string' ? pathOrQuery : 'custom query';
                console.error(`🚨 Fatal Subscription Error for ${errorPath}:`, err);
                setError(err);
                setLoading(false);
            }
        }
    }, [activeFirestore, pathOrQuery, orderByField, disabled]); // Correct dependency array

    return { data, loading, error };
}
