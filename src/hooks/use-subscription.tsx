
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
import { useAuth } from '@/context/auth-context';

/**
 * خطاف اشتراك لحظي مطور:
 * تم تحديثه ليدعم التبديل السيادي (Super Admin Switcher)؛ حيث يقوم آلياً بتوجيه 
 * المسارات للمسار المعزول للشركة `/companies/{companyId}/...` عند التبديل.
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
    const { user } = useAuth();

    const constraintsRef = useRef(constraints);
    const lastPathRef = useRef<string | null>(null);

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

        setLoading(true);
        
        // --- 🛡️ منطق العزل السيادي (Tenant Path Resolution) ---
        let finalPath = collectionPath;
        const tenantId = user?.currentCompanyId;
        
        // استثناء المجموعات "الكونية" التي تخص مشروع الماستر من التحويل
        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));

        if (tenantId && !isMasterCollection) {
            finalPath = `companies/${tenantId}/${collectionPath}`;
        }
        
        lastPathRef.current = finalPath;

        const baseRef = isGroup
            ? collectionGroup(firestore, finalPath)
            : collection(firestore, finalPath);

        const q = query(baseRef, ...constraintsRef.current);

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const newData = snapshot.docs.map(doc => {
                    const docData = doc.data() as any;
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
                console.error(`Firestore Subscription Error [${finalPath}]:`, err);
                setError(err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [firestore, collectionPath, isGroup, constraintsKey, user?.currentCompanyId]);

    return { data, loading, error };
}
