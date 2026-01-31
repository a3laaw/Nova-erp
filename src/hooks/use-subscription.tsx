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

    // Create a stable and unique key from the constraints array.
    // JSON.stringify doesn't work on complex objects like Firestore constraints.
    // This manual serialization is safer and ensures query uniqueness for caching.
    const serializedConstraints = useMemo(() => {
        if (!constraints || constraints.length === 0) return 'all';
        return constraints.map(c => {
            const internal = c as any;
            try {
                if (internal._type === 'where') {
                    // Example: "where:clientId:==:someClientId"
                    const value = internal._getFilters()[0].value.stringValue || internal._getFilters()[0].value.integerValue || 'unknown';
                    return `where:${internal._getFilters()[0].field.segments.join('.')}:${internal._getFilters()[0].op}:${value}`;
                }
                if (internal._type === 'orderBy') {
                    // Example: "orderBy:date:desc"
                    const field = internal._query.orderBy[0].field.segments.join('.');
                    const dir = internal._query.orderBy[0].dir;
                    return `orderBy:${field}:${dir}`;
                }
            } catch {
                // Fallback for safety
                return 'unknown_constraint';
            }
            return 'unknown_constraint';
        }).join('|');
    }, [constraints]);

    const cacheKey = useMemo(() => {
        return `${collectionPath}:${serializedConstraints}`;
    }, [collectionPath, serializedConstraints]);

    useEffect(() => {
        if (!collectionPath) {
            setData([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        let isFirstLoad = true;
        setLoading(true);
        
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey, collectionPath, signalUpdate]);

    return { data, setData, loading, error };
}
