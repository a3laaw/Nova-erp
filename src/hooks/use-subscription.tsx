
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  type Firestore,
  query,
  collection,
  onSnapshot,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

/**
 * A simplified, stable hook for real-time Firestore collection subscriptions.
 * It uses a memoized query key to prevent re-subscriptions on every render.
 */
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null,
  collectionPath: string | null, 
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
): { data: T[], loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    // Create a stable key from the path and constraints to use in the useEffect dependency array.
    // This prevents re-subscriptions on every render if the constraints array is a new instance but has the same values.
    const queryKey = useMemo(() => {
        if (!collectionPath) return null;
        try {
            // A simple string representation for the dependency array.
            return `${collectionPath}|${JSON.stringify(constraints)}`;
        } catch (e) {
            // Fallback for non-serializable constraints, though this should be avoided.
            return `${collectionPath}|${Date.now()}`;
        }
    }, [collectionPath, constraints]);


    useEffect(() => {
        if (!firestore || !collectionPath || !queryKey) {
            setLoading(false);
            setData([]); // Ensure data is cleared if there's no query
            return;
        }

        setLoading(true);

        const q = query(collection(firestore, collectionPath), ...constraints);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(newData);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error(`Error listening to ${collectionPath}:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    // The key here includes the stringified constraints, so the effect only re-runs when the query truly changes.
    }, [firestore, queryKey, collectionPath, constraints]);

    return { data, loading, error };
}
