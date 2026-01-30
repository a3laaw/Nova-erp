'use client';
import { useState, useEffect, useCallback } from 'react';
import { cache } from '@/lib/cache/smart-cache';

export function useSmartCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 30 * 60 * 1000
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await cache.get(key, fetchFn, ttl);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetchFn, ttl]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    refresh: loadData,
    setData
  };
}
