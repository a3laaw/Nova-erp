'use client';

import { useState, useEffect } from 'react';
import type { Query, QuerySnapshot, DocumentData, FirestoreError } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';

export function useCollection(query: Query | null) {
  const [snapshot, setSnapshot] = useState<QuerySnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (query === null) {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      return;
    }
    
    setLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (querySnapshot) => {
        setSnapshot(querySnapshot);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`useCollection error: `, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]); // The hook should re-run if the query object changes.

  return [snapshot, loading, error] as const;
}
