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

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

/**
 * خطاف مطور ومستقر لجلب البيانات من Firestore في الوقت الفعلي.
 * يدعم الآن الـ Collection Group لضمان شمولية البيانات في لوحة التحكم.
 */
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null,
  collectionPath: string | null, 
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS,
  isGroup: boolean = false
): { data: T[], loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    const lastPath = useRef<string | null>(null);

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        if (lastPath.current !== collectionPath) {
            setLoading(true);
            lastPath.current = collectionPath;
        }

        // تحديد ما إذا كان البحث في مجموعة محددة أم في كل المجموعات التي تحمل نفس الاسم (Group)
        const baseRef = isGroup 
            ? collectionGroup(firestore, collectionPath) 
            : collection(firestore, collectionPath);

        const q = query(baseRef, ...constraints);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
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
    }, [firestore, collectionPath, constraints, isGroup]);

    return { data, loading, error };
}
