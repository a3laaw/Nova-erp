'use client';

import { useMemo } from 'react';
import { useDocument as useFirebaseHooksDocument, type UseDocumentOptions } from 'react-firebase-hooks/firestore';
import { doc, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';


export function useDoc(path: string | undefined, options?: UseDocumentOptions) {
  const firestore = useFirestore();

  const docRef = useMemo(() => {
    if (!firestore || !path) return undefined;
    // Ensure the path is valid before creating a reference
    const pathSegments = path.split('/').filter(p => !!p);
    if (pathSegments.length % 2 !== 0) {
      console.warn(`Invalid Firestore document path: ${path}. Paths must have an even number of segments.`);
      return undefined;
    }
    return doc(firestore, path) as DocumentReference<DocumentData, DocumentData>;
  }, [firestore, path]);
  
  const [snapshot, loading, error] = useFirebaseHooksDocument(docRef, { ...options, firestore });

  return [snapshot, loading, error];
}
