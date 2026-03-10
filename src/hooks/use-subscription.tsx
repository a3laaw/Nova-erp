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
 * تم تحديثه ليدعم مراقبة التغيرات في فلاتر الاستعلام (Constraints) بشكل لحظي،
 * مع الحفاظ على ميزة إلحاق معرف الأب (parentId) تلقائياً.
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

    // توليد مفتاح فريد للقيود لضمان تفعيل useEffect عند تغيير قيم الفلتر (مثل السنة والشهر)
    const constraintsKey = JSON.stringify(constraints.map(c => c.toString()));

    useEffect(() => {
        constraintsRef.current = constraints;
    });

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        // إظهار حالة التحميل عند تغيير المسار أو الفلاتر
        setLoading(true);
        lastPathRef.current = collectionPath;

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
                    // هذا الجزء جوهري لعمل شجرة البيانات المرجعية في النظام
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
    }, [firestore, collectionPath, isGroup, constraintsKey]);

    return { data, loading, error };
}
