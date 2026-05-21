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
import { getIdTokenResult } from 'firebase/auth';

/**
 * خطاف اشتراك لحظي محصن (Protected Real-time Hook):
 * تم تحديثه بنظام "رادار التوكن" لضمان عدم إطلاق طلبات مجموعة (Group) 
 * إلا بعد التأكد من وجود Claim الشركة في التوكن لتجنب الرفض الأمني.
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
    const [isTokenReady, setIsTokenReady] = useState(false);

    const constraintsHash = JSON.stringify(constraints.map(c => c.toString()));
    const constraintsRef = useRef(constraints);
    
    useEffect(() => {
        constraintsRef.current = constraints;
    }, [constraintsHash]);

    // 🛡️ رادار التحقق من جاهزية التوكن (Sovereign Token Radar)
    useEffect(() => {
        if (!user?.id || !isGroup) {
            setIsTokenReady(true);
            return;
        }

        let isMounted = true;
        const checkToken = async () => {
            try {
                const { auth } = await import('@/firebase');
                if (auth?.currentUser) {
                    const tokenResult = await getIdTokenResult(auth.currentUser, true);
                    // ننتظر حتى نجد رقم الشركة داخل التوكن نفسه وليس فقط في الكود
                    if (tokenResult.claims.companyId && isMounted) {
                        setIsTokenReady(true);
                    } else if (isMounted) {
                        // إذا لم يتوفر بعد، ننتظر ثانية ونحاول مرة أخرى
                        setTimeout(checkToken, 1500);
                    }
                }
            } catch (e) {
                if (isMounted) setIsTokenReady(true); // Fallback
            }
        };

        checkToken();
        return () => { isMounted = false; };
    }, [user?.id, isGroup]);

    useEffect(() => {
        // 🛡️ الحماية القصوى: لا تطلب البيانات إذا كان التوكن لم يجهز بعد (للمجموعات)
        if (!firestore || !collectionPath || authLoading || !user?.currentCompanyId || (isGroup && !isTokenReady)) {
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
            // فرض فلترة المنشأة في الاستعلام المجمع لضمان العبور من جدار الحماية
            finalConstraints.push(where('companyId', '==', tenantId));
            
            try {
                const q = query(collectionGroup(firestore, collectionName), ...finalConstraints);
                const unsubscribe = onSnapshot(q, (snapshot) => {
                    const newData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
                    setData(newData);
                    setLoading(false);
                    setError(null);
                }, (err) => {
                    // لا تطلق الخطأ في الواجهة إلا إذا كان الطلب حقيقياً ومرفوضاً بعد استقرار الجلسة والتوكن
                    if (!authLoading && isTokenReady) {
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
                if (!authLoading) {
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
    }, [firestore, collectionPath, isGroup, user?.currentCompanyId, authLoading, constraintsHash, isTokenReady]);

    return { data, loading, error };
}
