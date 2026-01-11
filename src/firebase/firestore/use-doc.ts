'use client';

import { useMemo } from 'react';
import { useDocument as useFirebaseHooksDocument, type UseDocumentOptions } from 'react-firebase-hooks/firestore';
import { doc, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';


export function useDoc(path: string | undefined, options?: UseDocumentOptions) {
  const firestore = useFirestore();

  const docRef = useMemo(() => {
    if (!firestore || !path) return undefined;
    
    // Validate path to ensure it points to a document, not a collection.
    // A valid document path must have an even number of segments.
    const pathSegments = path.split('/').filter(p => p.trim() !== '');
    if (pathSegments.length % 2 !== 0) {
      console.warn(`Invalid Firestore document path provided to useDoc: "${path}". Path must have an even number of segments.`);
      return undefined;
    }
    
    return doc(firestore, path) as DocumentReference<DocumentData, DocumentData>;
  }, [firestore, path]); // Correctly depend on firestore and path
  
  const [snapshot, loading, error] = useFirebaseHooksDocument(docRef, { ...options, firestore });

  return [snapshot, loading, error];
}
