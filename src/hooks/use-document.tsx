'use client';
import { useState, useEffect } from 'react';
import {
  type Firestore,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';
import { getTenantPath } from '@/lib/utils';

/**
 * خطاف استماع لوثيقة واحدة:
 * يدعم التبديل السيادي وتوجيه المسار آلياً لمسار الشركة المختارة وحل مشكلة الـ Deadlock.
 */
export function useDocument<T extends { id?: string }>(
  firestore: Firestore | null,
  docPath: string | null
): { data: T | null, loading: boolean, error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!firestore || !docPath) {
      setLoading(false);
      setData(null);
      return;
    }

    const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'counters'];
    const isMasterCollection = masterCollections.some(mc => docPath.startsWith(mc));
    const tenantId = isMasterCollection ? null : (user?.currentCompanyId || null);

    if (!isMasterCollection && !tenantId) {
        setLoading(true);
        return;
    }

    setLoading(true);
    const finalPath = getTenantPath(docPath, tenantId);

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
            console.error(`Error listening to doc [${finalPath}]:`, err);
            setError(err);
            setLoading(false);
          }
        );

        return () => unsubscribe();
    } catch (err: any) {
        setLoading(false);
        setError(err);
    }
  }, [firestore, docPath, user?.currentCompanyId]);

  return { data, loading, error };
}
