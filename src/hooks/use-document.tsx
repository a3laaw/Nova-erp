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
 * يدعم التبديل السيادي وتوجيه المسار آلياً لمسار الشركة المختارة.
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

    setLoading(true);

    // --- 🛡️ Tenant Path Resolution ---
    const tenantId = user?.currentCompanyId || null;
    const finalPath = getTenantPath(docPath, tenantId);

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
        console.error(`Error listening to doc ${finalPath}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, docPath, user?.currentCompanyId]);

  return { data, loading, error };
}
