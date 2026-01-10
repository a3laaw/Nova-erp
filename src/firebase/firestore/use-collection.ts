'use client';
import { useMemo } from 'react';
import { useCollection as useFirebaseHooksCollection, type UseCollectionOptions } from 'react-firebase-hooks/firestore';
import type { Query, DocumentData } from 'firebase/firestore';
import { useFirestore } from '../provider';

export function useCollection(query: Query<DocumentData, DocumentData> | null, options?: UseCollectionOptions) {
  const firestore = useFirestore();
  
  // Memoize the query to prevent re-renders if the query object itself is recreated
  // but logically the same. This is a common pattern in React with complex objects.
  const memoizedQuery = useMemo(() => query, [query]);

  // Pass the firestore instance from our context to the hook.
  // This ensures we are always using the correctly initialized firestore instance.
  const [snapshot, loading, error] = useFirebaseHooksCollection(memoizedQuery, { ...options, firestore });

  return [snapshot, loading, error];
}
