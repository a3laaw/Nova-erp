'use client';

import { useState, useEffect, useRef } from 'react';
import {
  type Firestore,
  query,
  collection,
  collectionGroup,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

/**
 * خطاف اشتراك لحظي مطور:
 * يقوم آلياً بإلحاق معرف الأب (parentId) عند استخدام collectionGroup،
 * مما يحل مشكلة ربط الوظائف بالأقسام والمناطق بالمحافظات.
 */
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null,
  collectionPath: string | null,
  constraints: QueryConstraint[] = [],
  isGroup: boolean = false
): { data: T[], loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const constraintsRef = useRef(constraints);
    const lastPathRef = useRef<string | null>(null);

    useEffect(() => {
        constraintsRef.current = constraints;
    });

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        if (lastPathRef.current !== collectionPath) {
            setLoading(true);
            lastPathRef.current = collectionPath;
        }

        const baseRef = isGroup
            ? collectionGroup(firestore, collectionPath)
            : collection(firestore, collectionPath);

        const q = query(baseRef, ...constraintsRef.current);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newData = snapshot.docs.map(doc => {
                    const docData = doc.data() as any;
                    // استخراج معرف الأب في حال كانت المجموعة فرعية (مثل الوظائف تحت الأقسام)
                    const parentId = doc.ref.parent.parent?.id || null;
                    return { 
                        id: doc.id, 
                        parentId, 
                        ...docData 
                    } as T;
                });
                setData(newData);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error(`Firestore Subscription Error [${collectionPath}]:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, collectionPath, isGroup]);

    return { data, loading, error };
}
