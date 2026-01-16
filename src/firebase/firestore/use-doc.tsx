'use client';

import { useState, useEffect } from 'react';
import type { DocumentReference, DocumentSnapshot, DocumentData, FirestoreError } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';

export function useDoc(ref: DocumentReference | null) {
  const [snapshot, setSnapshot] = useState<DocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (ref === null) {
        setSnapshot(null);
        setLoading(false);
        setError(null);
        return;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
        ref,
        (docSnapshot) => {
            setSnapshot(docSnapshot);
            setLoading(false);
            setError(null);
        },
        (err) => {
            console.error(`useDoc error: `, err);
            setError(err);
            setLoading(false);
        }
    );

    return () => unsubscribe();
  }, [ref]);

  return [snapshot, loading, error] as const;
}
