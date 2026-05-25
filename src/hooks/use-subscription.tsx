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
 * خطاف اشتراك لحظي محصن (V81.0):
 * تم تحرير محرك الجلب للسماح بجلب البيانات العالمية للمطور (Master Collections).
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
            setLoading(true);
            return;
        }

        // 🛡️ تحديد ما إذا كان المسار عالمياً (Master) لتجاوز حاجز الـ tenantId
        const isMaster = [
            'companies', 
            'developers', 
            'global_users', 
            'company_requests', 
            'holidays', 
            'counters'
        ].some(mc => collectionPath.startsWith(mc));

        const tenantId = user?.currentCompanyId || null;
        const finalPath = getTenantPath(collectionPath, tenantId);
        
        // منع الجلب إذا لم نصل لمسار نهائي (لغير المطورين)
        if (!finalPath && !isMaster) {
            setLoading(true); 
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalConstraints = [...constraintsRef.current];
        
        if (isGroup) {
            const collectionName = collectionPath.split('/').pop() || collectionPath;
            if (tenantId) finalConstraints.push(where('companyId', '==', tenantId));
            
            try {
                const q = query(collectionGroup(firestore, collectionName), ...finalConstraints);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                    setData(newData);
                    setLoading(false);
                    setError(null);
                }, (err) => {
                    if (err.message?.includes('permission-denied')) {
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
            const q = query(collection(firestore, finalPath!), ...finalConstraints);
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(newData);
                setLoading(false);
                setError(null);
            }, (err) => {
                if (err.message?.includes('permission-denied') && tenantId && !authLoading) {
                    const permissionError = new FirestorePermissionError({
                        path: finalPath!,
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
