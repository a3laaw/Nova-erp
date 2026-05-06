
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
 * خطاف اشتراك لحظي مطور (Sovereign Real-time Hook):
 * تم تحصينه لمنع التحميل اللانهائي عبر معالجة دقيقة لمسارات المنشآت (Tenant Pathing).
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

    // نستخدم useRef للحفاظ على مرجع القيود ومنع إعادة التشغيل اللانهائي بسبب مصفوفات القيود
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraints]);

    useEffect(() => {
        // التأكد من أن المنشأة المتقمصة لا تؤثر على قراءة الجداول السيادية (مثل قائمة المنشآت)
        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests'];
        const isMasterCollection = collectionPath && masterCollections.includes(collectionPath);
        
        const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);
        
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        setLoading(true);
        setError(null);
        
        // --- 🛡️ محرك التوجيه السيادي (Tenant Routing) ---
        let finalPath = getTenantPath(collectionPath, tenantId);
        let finalConstraints = [...constraintsRef.current];
        
        // إذا كان الاستعلام مجمعاً (collectionGroup) ومعزولاً بـ tenantId
        if (isGroup && tenantId) {
            finalPath = collectionPath.split('/').pop() || collectionPath;
            finalConstraints.push(where('companyId', '==', tenantId));
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
