'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, type Firestore, type QueryConstraint } from 'firebase/firestore';
import { SmartCache } from '@/lib/cache/smart-cache';
import { useSyncStatus } from '@/context/sync-context';
import localforage from 'localforage';

interface CachedData<T> {
  timestamp: number;
  data: T;
}

export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null, 
  collectionPath: string, 
  constraints: QueryConstraint[] = []
): { data: T[], setData: React.Dispatch<React.SetStateAction<T[]>>, loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { signalUpdate } = useSyncStatus();

    const cacheKey = `${collectionPath}:${JSON.stringify(constraints)}`;

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setData([]);
            setIsInitialLoading(false);
            return;
        }

        let isMounted = true;
        let isFirstLoad = true;
        setIsInitialLoading(true);
        
        localforage.getItem<CachedData<T[]>>(cacheKey).then(cached => {
            if (isMounted && cached?.data) {
                setData(cached.data);
            }
        });

        const q = query(collection(firestore, collectionPath), ...constraints);
        
        const unsubscribe = onSnapshot(q, 
            (snapshot) => {
                const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                if (isMounted) {
                    setData(results);
                    setError(null);
                    
                    if (isFirstLoad) {
                        setIsInitialLoading(false);
                        isFirstLoad = false;
                    } else {
                        signalUpdate(); 
                    }
                    
                    SmartCache.set(cacheKey, results);
                }
            },
            (err) => {
                console.error(`Error subscribing to ${collectionPath}:`, err);
                if (isMounted) {
                    setError(err);
                    setIsInitialLoading(false);
                }
            }
        );

        return () => {
            isMounted = false;
            unsubscribe();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, collectionPath, JSON.stringify(constraints), signalUpdate]);

    return { data, setData, loading: isInitialLoading, error };
}
