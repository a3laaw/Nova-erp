'use client';

import { useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';

/**
 * @fileOverview خطاف جلب إعدادات الطباعة السيادية (Branding).
 * يقوم بجلب بيانات الهوية البصرية للمنشأة الحالية من المسار المعزول.
 */
export function usePrintSettings() {
  const { firestore } = useFirebase();
  const { user } = useAuth();

  // تحديد مسار الإعدادات بناءً على الشركة الحالية (يدعم التقمص السيادي)
  const brandingPath = useMemo(() => {
    if (!user?.currentCompanyId) return null;
    return `companies/${user.currentCompanyId}/settings/branding`;
  }, [user?.currentCompanyId]);

  const { data: brandingData, loading, error } = useSubscription<any>(firestore, brandingPath);
  const branding = useMemo(() => (brandingData && brandingData.length > 0) ? brandingData[0] : null, [brandingData]);

  return { 
    branding, 
    loading, 
    error,
    companyId: user?.currentCompanyId 
  };
}
