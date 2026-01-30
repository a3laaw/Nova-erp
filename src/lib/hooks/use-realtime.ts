'use client';

import { useState, useEffect, useCallback } from 'react';
import { cache } from '@/lib/cache/smart-cache';
import type { QueryConstraint } from 'firebase/firestore';

export function useRealtime<T extends { id?: string }>(
  collectionPath: string,
  queryConstraints?: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = `realtime:${collectionPath}:${JSON.stringify(queryConstraints)}`;

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      // 1. Try to load from cache immediately for instant UI
      const cached = await cache.getFromStorage<T[]>(cacheKey);
      if (isMounted && cached?.data) {
        setData(cached.data);
        setLoading(false); // We have data, so stop initial full-screen loading
      }
    };

    loadInitialData();
    
    // 2. Set up the real-time listener
    const unsubscribe = cache.subscribe<T>(
      collectionPath,
      (freshData) => {
        if (isMounted) {
          setData(freshData);
          setLoading(false);
          setError(null);
          // 3. Update the cache in the background
          cache.set(cacheKey, freshData);
        }
      },
      (err) => {
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      },
      queryConstraints
    );

    // 4. Cleanup on unmount
    return () => {
      isMounted = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, JSON.stringify(queryConstraints), cacheKey]);

  return {
    data,
    loading,
    error,
  };
}
