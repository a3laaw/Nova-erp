'use client';

import { useMemo } from 'react';
import { useCollection as useFirebaseHooksCollection, type UseCollectionOptions } from 'react-firebase-hooks/firestore';
import type { Query, DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';

export function useCollection(query: Query<DocumentData, DocumentData> | null, options?: UseCollectionOptions) {
  const firestore = useFirestore();
  
  // The query is memoized in the component that calls this hook.
  // We pass the firestore instance from our context to the hook.
  // This ensures we are always using the correctly initialized firestore instance.
  const [snapshot, loading, error] = useFirebaseHooksCollection(query, { ...options, firestore });

  return [snapshot, loading, error];
}
