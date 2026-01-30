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

    // This is the key change. By stringifying the constraints first,
    // we get a stable primitive value that React's dependency arrays can correctly compare.
    const stringifiedConstraints = JSON.stringify(constraints);

    const cacheKey = useMemo(() => {
        return `${collectionPath}:${stringifiedConstraints}`;
    }, [collectionPath, stringifiedConstraints]);

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
            // The original `constraints` object is still needed here.
            // It's safe to use because this effect only re-runs when the stringified version changes.
            constraints
        );
        
        return () => { isMounted = false; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionPath, cacheKey, signalUpdate, stringifiedConstraints]);

    return { data, setData, loading, error };
}
