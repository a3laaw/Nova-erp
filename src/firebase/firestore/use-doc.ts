'use client';

import { useMemo } from 'react';
import { useDocument as useFirebaseHooksDocument, type UseDocumentOptions } from 'react-firebase-hooks/firestore';
import { doc, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';


export function useDoc(path: string | undefined, options?: UseDocumentOptions) {
  const firestore = useFirestore();

  const memoizedRef = useMemo(() => {
    if (!firestore || !path) return undefined;
    return doc(firestore, path) as DocumentReference<DocumentData, DocumentData>;
  }, [firestore, path]);
  
  const [snapshot, loading, error] = useFirebaseHooksDocument(memoizedRef, { ...options, firestore });

  return [snapshot, loading, error];
}
