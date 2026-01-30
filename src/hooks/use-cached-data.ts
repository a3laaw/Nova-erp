import { useState, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { SmartCache } from '@/lib/cache/smart-cache';
import { useToast } from './use-toast';

type FetcherFunction<T> = (db: any) => Promise<T>;

export function useCachedData<T>(cacheKey: string, fetcher: FetcherFunction<T>) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!firestore) {
      setError("Firestore is not available.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (forceRefresh) {
        await SmartCache.invalidate(cacheKey);
      }
      const result = await SmartCache.get(cacheKey, () => fetcher(firestore));
      setData(result);
    } catch (e: any) {
      console.error(`useCachedData error for key "${cacheKey}":`, e);
      setError(e.message || "Failed to fetch data.");
      toast({
        variant: 'destructive',
        title: 'Data Fetch Error',
        description: `Could not load data for ${cacheKey}.`,
      });
    } finally {
      setLoading(false);
    }
  }, [firestore, cacheKey, fetcher, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = () => {
    fetchData(true);
  };

  return { data, loading, error, refreshData };
}
