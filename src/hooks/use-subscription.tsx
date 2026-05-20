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

/**
 * خطاف اشتراك لحظي محصن (Protected Real-time Hook):
 * يضمن عدم محاولة قراءة البيانات قبل استقرار هوية المنشأة لمنع Permission Errors.
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
        if (!firestore || !collectionPath || authLoading) {
            setLoading(!firestore || !collectionPath ? false : true);
            return;
        }

        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'counters'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));
        const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);
        
        // 🛡️ صمام أمان: إذا لم يكن مسار ماستر ولم تتوفر هوية الشركة بعد، ننتظر
        if (!isMasterCollection && !tenantId) {
            setLoading(true); 
            return;
        }

        const finalPath = getTenantPath(collectionPath, tenantId);
        
        // منع محاولة قراءة مسارات غير مكتملة
        if (finalPath.startsWith('_WAITING_FOR_TENANT_')) {
            setLoading(true);
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalConstraints = [...constraintsRef.current];
        
        // في حال استعلام المجموعات (Collection Group)، نفرض عزل الشركة يدوياً
        if (isGroup && tenantId) {
            const collectionName = collectionPath.split('/').pop() || collectionPath;
            finalConstraints.push(where('companyId', '==', tenantId));
            try {
                const q = query(collectionGroup(firestore, collectionName), ...finalConstraints);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                    setData(newData);
                    setLoading(false);
                }, (err) => {
                    console.error(`Group Subscription Error [${collectionName}]:`, err.message);
                    setError(err);
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
            }, (err) => {
                console.error(`Subscription Error [${finalPath}]:`, err.message);
                setError(err);
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
