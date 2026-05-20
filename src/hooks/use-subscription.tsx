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
 * تم تحصينه بـ "رادار الانتظار" لضمان عدم حدوث أخطاء صلاحيات عند تبديل الجلسات.
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

    // 🛡️ استخدام مرجع للقيود لضمان ثبات الاستعلام ومنع حلقات التكرار
    const constraintsHash = JSON.stringify(constraints.map(c => c.toString()));
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraintsHash]);

    useEffect(() => {
        // 1. انتظار تهيئة النظام وهوية المستخدم تماماً
        if (!firestore || !collectionPath || authLoading) {
            setLoading(!firestore || !collectionPath ? false : true);
            return;
        }

        const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'counters', 'holidays'];
        const isMasterCollection = masterCollections.some(mc => collectionPath.startsWith(mc));
        const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);
        
        const finalPath = getTenantPath(collectionPath, tenantId);
        
        // 🛡️ صمام أمان راداري: إذا لم يتم استنتاج المسار النهائي المعزول، نتوقف عن المحاولة
        if (!finalPath) {
            setLoading(true); 
            return;
        }

        setLoading(true);
        setError(null);
        
        let finalConstraints = [...constraintsRef.current];
        
        // 2. محرك الاستعلام المجمع (Collection Group) مع فرض عزل المنشأة
        if (isGroup && tenantId) {
            const collectionName = collectionPath.split('/').pop() || collectionPath;
            // 🛡️ فرض فلتر الهوية في الاستعلام المجمع لمطابقة قواعد الأمان
            finalConstraints.push(where('companyId', '==', tenantId));
            
            try {
                const q = query(collectionGroup(firestore, collectionName), ...finalConstraints);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                    setData(newData);
                    setLoading(false);
                }, (err) => {
                    console.warn(`[Permission Guard] CG Access Deferred: ${collectionName}`);
                    setError(err);
                    setLoading(false);
                });
                return () => unsubscribe();
            } catch (e: any) { setError(e); setLoading(false); }
            return;
        }

        // 3. محرك الاشتراك المباشر المحصن
        try {
            const q = query(collection(firestore, finalPath), ...finalConstraints);
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                setData(newData);
                setLoading(false);
            }, (err) => {
                // 🛡️ التطهير: تسجيل الرفض كتحذير داخلي بدلاً من كراش للواجهة
                console.warn(`[Permission Guard] Access Deferred: ${finalPath}`);
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
