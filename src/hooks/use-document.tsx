
'use client';
import { useState, useEffect } from 'react';
import {
  type Firestore,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { useAuth } from '@/context/auth-context';

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
    let finalPath = docPath;
    const tenantId = user?.currentCompanyId;
    
    // استثناء مسارات مشروع الماستر
    const masterPaths = ['companies/', 'developers/', 'global_', 'company_settings/'];
    const isMasterPath = masterPaths.some(mp => docPath.startsWith(mc));

    if (tenantId && !isMasterPath) {
        finalPath = `companies/${tenantId}/${docPath}`;
    }

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
