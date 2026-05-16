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
    const { user, loading: authLoading } = useAuth();

    const constraintsHash = JSON.stringify(constraints.map(c => c.toString()));
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraintsHash]);

    useEffect(() => {
        // 🛡️ صمام أمان: لا تبدأ الاشتراك إذا لم يكن المحرك أو المسار جاهزاً أو إذا كان الـ Auth قيد التحميل
        if (!firestore || !collectionPath || authLoading) {
            setLoading(!firestore || !collectionPath ? false : true);
            setData([]);
            return;
        }

        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'counters'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));
        const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);
        
        // 🛡️ منع جلب أي بيانات غير "ماستر" إلا بعد استقرار هوية المنشأة (Tenant ID) في الجلسة
        if (!isMasterCollection && !tenantId) {
            setLoading(true); 
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalPath = getTenantPath(collectionPath, tenantId);
        let finalConstraints = [...constraintsRef.current];
        
        // في استعلامات الـ Group Queries، يجب فرض فلتر الـ companyId لضمان عزل البيانات برمجياً وسحابياً
        if (isGroup && tenantId) {
            const collectionName = collectionPath.split('/').pop() || collectionPath;
            finalPath = collectionName;
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
                (err: any) => {
                    // في حال خطأ الصلاحيات، لا تقتل الواجهة، بل سجل الخطأ وحاول الحفاظ على الحالة
                    console.error(`Sovereign Subscription Denied [${finalPath}]:`, err.message);
                    setError(err);
                    setLoading(false);
                }
            );

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Critical hook execution error:", err);
            setError(err);
            setLoading(false);
            setData([]);
        }
    }, [firestore, collectionPath, isGroup, user?.currentCompanyId, authLoading, constraintsHash]);

    return { data, loading, error };
}