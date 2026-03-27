'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useDocument } from '@/hooks/use-document';

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

  const { data: branding, loading, error } = useDocument<any>(firestore, brandingPath);

  return { 
    branding, 
    loading, 
    error,
    companyId: user?.currentCompanyId 
  };
}
