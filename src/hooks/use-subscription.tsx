'use client';

import { useState, useEffect, useMemo } from 'react';
import { type QueryConstraint } from 'firebase/firestore';
import { cache } from '@/lib/cache/smart-cache';
import { useSyncStatus } from '@/context/sync-context';
import { cleanFirestoreData } from '@/lib/utils';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useSubscription<T extends { id?: string }>(
  firestore: any,
  collectionPath: string | null, 
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
): { data: T[], setData: React.Dispatch<React.SetStateAction<T[]>>, loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { signalUpdate } = useSyncStatus();

    // Create a stable and unique key from the constraints array.
    const serializedConstraints = useMemo(() => {
        if (!constraints || constraints.length === 0) return 'all';
        return constraints.map(c => {
            const internal = c as any;
            try {
                if (internal._type === 'where') {
                    const filter = internal._getFilters()[0];
                    const op = filter.op;
                    const fieldPath = filter.field.segments.join('.');
                    
                    const valueObject = filter.value;
                    let value = 'unknown';

                    if (valueObject?.stringValue !== undefined) value = valueObject.stringValue;
                    else if (valueObject?.integerValue !== undefined) value = valueObject.integerValue;
                    else if (valueObject?.doubleValue !== undefined) value = valueObject.doubleValue;
                    else if (valueObject?.booleanValue !== undefined) value = String(valueObject.booleanValue);
                    else if (valueObject?.arrayValue) return `where:${fieldPath}:${op}:[${valueObject.arrayValue.values.map((v:any) => v.stringValue).join(',')}]`
                    else if (valueObject?.geoPointValue !== undefined) value = `${valueObject.geoPointValue.latitude},${valueObject.geoPointValue.longitude}`;
                    else if (valueObject?.timestampValue !== undefined) value = `${valueObject.timestampValue.seconds}_${valueObject.timestampValue.nanoseconds}`;
                    else if (valueObject?.nullValue !== undefined) value = 'null';
                    
                    return `where:${fieldPath}:${op}:${value}`;
                }
                if (internal._type === 'orderBy') {
                    const field = internal._query.orderBy[0].field.segments.join('.');
                    const dir = internal._query.orderBy[0].dir;
                    return `orderBy:${field}:${dir}`;
                }
                 if (internal._type === 'limit') {
                    return `limit:${internal._query.limit}`;
                }
            } catch {
                return 'unknown_constraint';
            }
            return 'unknown_constraint';
        }).join('|');
    }, [constraints]);

    const cacheKey = useMemo(() => {
        return `${collectionPath}:${serializedConstraints}`;
    }, [collectionPath, serializedConstraints]);

    useEffect(() => {
        if (!collectionPath || !firestore) {
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
            firestore,
            collectionPath,
            (newData) => {
                if (isMounted) {
                    setData(newData);
                    setError(null);
                    const plainData = cleanFirestoreData(newData); // Update cache on new data
                    cache.set(cacheKey, plainData);
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
    }, [firestore, cacheKey, collectionPath, signalUpdate, JSON.stringify(constraints)]);

    return { data, setData, loading, error };
}
