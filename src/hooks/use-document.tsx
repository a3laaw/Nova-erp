'use client';
import { useState, useEffect } from 'react';
import { doc, onSnapshot, type Firestore, type DocumentSnapshot } from 'firebase/firestore';
import { SmartCache } from '@/lib/cache/smart-cache';
import { useSyncStatus } from '@/context/sync-context';
import localforage from 'localforage';

interface CachedData<T> {
  timestamp: number;
  data: T;
}

export function useDocument<T extends { id?: string }>(
  firestore: Firestore | null,
  docPath: string | null
): { data: T | null, loading: boolean, error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { signalUpdate } = useSyncStatus();

  const cacheKey = docPath;

  useEffect(() => {
    if (!firestore || !docPath) {
      setData(null);
      setIsInitialLoading(false);
      return;
    }

    let isMounted = true;
    let isFirstLoad = true;
    setIsInitialLoading(true);

    localforage.getItem<CachedData<T>>(cacheKey!).then(cached => {
      if (isMounted && cached?.data) {
        setData(cached.data);
      }
    });

    const docRef = doc(firestore, docPath);

    const unsubscribe = onSnapshot(docRef,
      (snapshot) => {
        if (isMounted) {
          if (snapshot.exists()) {
            const result = { id: snapshot.id, ...snapshot.data() } as T;
            setData(result);
            SmartCache.set(cacheKey!, result);
          } else {
            setData(null);
            localforage.removeItem(cacheKey!).catch(err => console.error("Failed to remove item from cache", err));
          }
          setError(null);
          
          if (isFirstLoad) {
            setIsInitialLoading(false);
            isFirstLoad = false;
          } else {
            signalUpdate();
          }
        }
      },
      (err) => {
        console.error(`Error subscribing to document ${docPath}:`, err);
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
  }, [firestore, docPath, cacheKey, signalUpdate]);

  return { data, loading: isInitialLoading, error };
}
