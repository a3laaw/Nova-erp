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
 * تم تحصينه لمنع التحميل اللانهائي وتكرار الاتصالات غير الضرورية مع دعم كامل للـ Multi-tenancy.
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

    // نستخدم Hash للقيود لمنع إعادة التشغيل اللانهائية عند الرندرة
    const constraintsHash = JSON.stringify(constraints.map(c => c.toString()));
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraintsHash]);

    useEffect(() => {
        if (!firestore || !collectionPath) {
            setLoading(false);
            setData([]);
            return;
        }

        // تحديد ما إذا كانت المجموعة عالمية (Master) أم تابعة لمنشأة (Tenant)
        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));
        const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);
        
        // 🛡️ منع التشغيل إذا لم يستقر معرّف الشركة للمجموعات التابعة (حل مشكلة الـ Permissions)
        if (!isMasterCollection && !tenantId) {
            setLoading(true); 
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalPath = getTenantPath(collectionPath, tenantId);
        let finalConstraints = [...constraintsRef.current];
        
        // دعم الـ Collection Group بفلترة الشركة إجبارياً للامتثال لقواعد الحماية
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
                },
                (err) => {
                    console.error(`Firestore Subscription Error [${finalPath}]:`, err);
                    setError(err);
                    setLoading(false); 
                    // إذا فشل بسبب الصلاحيات، نعيد مصفوفة فارغة لفك جمود الواجهة
                    setData([]);
                }
            );

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Critical hook execution error:", err);
            setError(err);
            setLoading(false);
            setData([]);
        }
    }, [firestore, collectionPath, isGroup, user?.currentCompanyId, constraintsHash]);

    return { data, loading, error };
}