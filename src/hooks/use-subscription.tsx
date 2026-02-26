'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  type Firestore,
  query,
  collection,
  onSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

/**
 * خطاف مطور ومستقر لجلب البيانات من Firestore في الوقت الفعلي.
 * تم تحسينه لمنع عمليات التحميل المتكررة (Flickering) وضمان استقرار الواجهة.
 */
export function useSubscription<T extends { id?: string }>(
  firestore: Firestore | null,
  collectionPath: string | null, 
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
): { data: T[], loading: boolean, error: Error | null } {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    
    // استخدام مراجع داخلية لتجنب إعادة التحميل عند تغير مراجع المصفوفات المتطابقة
    const lastPath = useRef<string | null>(null);

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        // فقط قم بتعيين حالة التحميل إلى true إذا تغير المسار الأساسي للمجموعة
        if (lastPath.current !== collectionPath) {
            setLoading(true);
            lastPath.current = collectionPath;
        }

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
                console.error(`Firestore Subscription Error [${collectionPath}]:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, collectionPath, constraints]);

    return { data, loading, error };
}
