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

/**
 * خطاف اشتراك لحظي مطور ومعزز:
 * تم تحسين الأداء عبر منع إعادة الرندرة غير الضرورية وتثبيت حالة التحميل.
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

    // نستخدم useRef للحفاظ على استقرار الفلاتر ومنع الحلقات اللانهائية
    const constraintsRef = useRef(constraints);
    const prevPathRef = useRef<string | null>(null);
    const prevTenantRef = useRef<string | null>(null);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraints]);

    useEffect(() => {
        const tenantId = user?.currentCompanyId || null;
        
        // منع إعادة التشغيل إذا لم يتغير المسار أو المنشأة
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        if (prevPathRef.current === collectionPath && prevTenantRef.current === tenantId) {
            return; // لم يتغير شيء جوهري
        }

        prevPathRef.current = collectionPath;
        prevTenantRef.current = tenantId;
        setLoading(true);
        
        // --- 🛡️ منطق العزل السيادي (Tenant Path & Group Resolution) ---
        let finalPath = collectionPath;
        let finalConstraints = [...constraintsRef.current];
        
        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'company_settings'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));

        if (tenantId && !isMasterCollection) {
            if (isGroup) {
                finalPath = collectionPath.split('/').pop() || collectionPath;
                finalConstraints.push(where('companyId', '==', tenantId));
            } else {
                finalPath = `companies/${tenantId}/${collectionPath}`;
            }
        }

        try {
            const baseRef = isGroup
                ? collectionGroup(firestore, finalPath)
                : collection(firestore, finalPath);

            const q = query(baseRef, ...finalConstraints);

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
        } catch (err: any) {
            console.error("Critical hook execution error:", err);
            setError(err);
            setLoading(false);
        }
    }, [firestore, collectionPath, isGroup, user?.currentCompanyId]);

    return { data, loading, error };
}
