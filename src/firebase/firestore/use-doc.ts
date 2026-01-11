'use client';

import { useMemo } from 'react';
import { useDocument as useFirebaseHooksDocument, type UseDocumentOptions } from 'react-firebase-hooks/firestore';
import { doc, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';


export function useDoc(path: string | undefined, options?: UseDocumentOptions) {
  const firestore = useFirestore();

  const docRef = useMemo(() => {
    if (!firestore || !path) return undefined;
    
    // A valid document path must have an even number of segments.
    // e.g., 'collection/document' has 2 segments. 'collection' has 1.
    const pathSegments = path.split('/').filter(Boolean);
    if (pathSegments.length % 2 !== 0) {
      console.warn(`[useDoc] Invalid path: "${path}". A document path must have an even number of segments.`);
      return undefined;
    }
    
    return doc(firestore, path) as DocumentReference<DocumentData, DocumentData>;
  }, [firestore, path]);
  
  const [snapshot, loading, error] = useFirebaseHooksDocument(docRef, { ...options, firestore });

  return [snapshot, loading, error];
}
