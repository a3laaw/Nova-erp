'use client';

import { useState, useEffect, useMemo } from 'react';
import { type QueryConstraint } from 'firebase/firestore';
import { cache } from '@/lib/cache/smart-cache';
import { useSyncStatus } from '@/context/sync-context';

export function useSubscription<T extends { id?: string }>(
  firestore: any, // No longer used, but kept for API compatibility for now
  collectionPath: string, 
  constraints: QueryConstraint[] = []
): { data: T[], setData: React.Dispatch<React.SetStateAction<T[]>>, loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { signalUpdate } = useSyncStatus();

    const cacheKey = useMemo(() => `${collectionPath}:${JSON.stringify(constraints)}`, [collectionPath, constraints]);

    useEffect(() => {
        if (!collectionPath) {
            setData([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        let isFirstLoad = true;
        setLoading(true);
        
        // Load initial data from cache
        cache.getFromStorage<T[]>(cacheKey).then(cached => {
            if (isMounted && cached?.data) {
                setData(cached.data);
            }
        });

        const unsubscribe = cache.subscribe<T>(
            collectionPath,
            (newData) => {
                if (isMounted) {
                    setData(newData);
                    setError(null);
                    cache.set(cacheKey, newData); // Update cache on new data
                    if (isFirstLoad) {
                        setLoading(false);
                        isFirstLoad = false;
                    } else {
                        signalUpdate();
                    }
                }
            },
            (err) => {
                if (isMounted) {
                    setError(err);
                    setLoading(false);
                }
            },
            constraints
        );
        
        return () => { isMounted = false; unsubscribe(); };
    }, [collectionPath, cacheKey, signalUpdate, constraints]);

    return { data, setData, loading, error };
}
