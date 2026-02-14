
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  type Firestore,
  doc,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';

/**
 * A simplified, stable hook for real-time Firestore document subscriptions.
 */
export function useDocument<T extends { id?: string }>(
  firestore: Firestore | null,
  docPath: string | null
): { data: T | null, loading: boolean, error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!firestore || !docPath) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      doc(firestore, docPath),
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error listening to doc ${docPath}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, docPath]);

  return { data, loading, error };
}
