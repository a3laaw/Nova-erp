'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * مستمع أخطاء Firebase العالمي:
 * يقوم بالاستماع لقناة "permission-error" وإطلاق الخطأ في الواجهة ليتم التقاطه 
 * من قبل Error Boundary الخاص بـ Next.js، مما يسهل عملية تصحيح قواعد الأمان.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<Error | null>(null);

  // إذا تم رصد خطأ، نقوم بإطلاقه أثناء الرندر ليظهر في شاشة الخطأ
  if (error) {
    throw error;
  }

  useEffect(() => {
    const handlePermissionError = (err: Error) => {
      console.warn("🛡️ Nova Radar: Permission Error Captured", err);
      setError(err);
    };

    // الاشتراك في باعث الأخطاء
    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}
