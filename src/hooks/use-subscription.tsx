'use client';

import { useState, useEffect, useRef } from 'react';
import {
  type Firestore,
  query,
  collection,
  collectionGroup,
  onSnapshot,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خطاف اشتراك لحظي محصن (V75.0):
 * تم تحويله ليعتمد على tenantId الجلسة مباشرة لضمان ظهور البيانات فوراً.
 * تم تحصين معالجة الأخطاء لمنع ظهور الشاشة الحمراء خلال ثواني التحميل الأولى.
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
    const { user, loading: authLoading } = useAuth();

    const constraintsHash = JSON.stringify(constraints.map(c => c.toString()));
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraintsHash]);

    useEffect(() => {
        // 🛡️ الحماية: لا تطلب البيانات إذا لم تتوفر الجلسة أو المعرف
        if (!firestore || !collectionPath || authLoading || !user?.currentCompanyId) {
            setLoading(true);
            return;
        }

        const tenantId = user.currentCompanyId;
        const finalPath = getTenantPath(collectionPath, tenantId);
        
        if (!finalPath) {
            setLoading(true); 
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalConstraints = [...constraintsRef.current];
        
        if (isGroup) {
            const collectionName = collectionPath.split('/').pop() || collectionPath;
            // فرض فلترة المنشأة برمجياً لضمان عبور جدار الحماية
            finalConstraints.push(where('companyId', '==', tenantId));
            
            try {
                const q = query(collectionGroup(firestore, collectionName), ...finalConstraints);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                    setData(newData);
                    setLoading(false);
                    setError(null);
                }, (err) => {
                    // رصد أخطاء الصلاحيات الحقيقية فقط بعد استقرار الجلسة
                    if (!authLoading && err.message?.includes('permission-denied')) {
                        const permissionError = new FirestorePermissionError({
                            path: `[GROUP] ${collectionName}`,
                            operation: 'list'
                        });
                        errorEmitter.emit('permission-error', permissionError);
                        setError(permissionError);
                    }
                    setLoading(false);
                });
                return () => unsubscribe();
            } catch (e: any) { setError(e); setLoading(false); }
            return;
        }

        try {
            const q = query(collection(firestore, finalPath), ...finalConstraints);
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(newData);
                setLoading(false);
                setError(null);
            }, (err) => {
                if (!authLoading && err.message?.includes('permission-denied')) {
                    const permissionError = new FirestorePermissionError({
                        path: finalPath,
                        operation: 'list'
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    setError(permissionError);
                }
                setLoading(false);
            });

            return () => unsubscribe();
        } catch (err: any) {
            setError(err);
            setLoading(false);
        }
    }, [firestore, collectionPath, isGroup, user?.currentCompanyId, authLoading, constraintsHash]);

    return { data, loading, error };
}