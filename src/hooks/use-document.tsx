'use client';
import { useState, useEffect } from 'react';
import {
  type Firestore,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * خطاف استماع لوثيقة واحدة محصن (V15.0):
 * تم تحسين "رادار المطور" للسماح بجلب الوثائق العالمية دون الحاجة لمعرّف شركة.
 */
export function useDocument<T extends { id?: string }>(
  firestore: Firestore | null,
  docPath: string | null
): { data: T | null, loading: boolean, error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!firestore || !docPath || authLoading) {
      setLoading(!firestore || !docPath ? false : true);
      setData(null);
      return;
    }

    const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'counters'];
    const isMasterCollection = masterCollections.some(mc => docPath.startsWith(mc));
    const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);

    const finalPath = getTenantPath(docPath, tenantId);
    
    if (!finalPath) {
        setLoading(true);
        return;
    }

    setLoading(true);
    try {
        const unsubscribe = onSnapshot(
          doc(firestore, finalPath),
          (snapshot) => {
            if (snapshot.exists()) {
              setData({ id: snapshot.id, ...snapshot.data() } as T);
            } else {
              setData(null);
            }
            setLoading(false);
            setError(null);
          },
          (err) => {
            if (tenantId && !authLoading) {
                const permissionError = new FirestorePermissionError({
                    path: finalPath,
                    operation: 'get'
                });
                errorEmitter.emit('permission-error', permissionError);
                setError(permissionError);
            }
            setLoading(false);
          }
        );

        return () => unsubscribe();
    } catch (err: any) {
        setLoading(false);
        setError(err);
    }
  }, [firestore, docPath, user?.currentCompanyId, authLoading]);

  return { data, loading, error };
}
