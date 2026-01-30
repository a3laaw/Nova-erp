'use client';
import { useState, useEffect, useMemo } from 'react';
import { cache } from '@/lib/cache/smart-cache';
import { useSyncStatus } from '@/context/sync-context';

export function useDocument<T extends { id?: string }>(
  firestore: any, // No longer used
  docPath: string | null
): { data: T | null, loading: boolean, error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { signalUpdate } = useSyncStatus();

  const cacheKey = useMemo(() => docPath, [docPath]);

  useEffect(() => {
    if (!cacheKey) {
      setData(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let isFirstLoad = true;
    setLoading(true);

    cache.getFromStorage<T>(cacheKey).then(cached => {
      if (isMounted && cached?.data) {
        setData(cached.data);
      }
    });

    const unsubscribe = cache.subscribeDoc<T>(
      cacheKey,
      (newData) => {
        if (isMounted) {
          setData(newData);
          setError(null);
          cache.set(cacheKey, newData); // Update cache
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
      }
    );

    return () => { isMounted = false; unsubscribe(); };
  }, [cacheKey, signalUpdate]);

  return { data, loading, error };
}
