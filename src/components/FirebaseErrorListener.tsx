'use client';

import { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';

/**
 * مستمع أخطاء النظام:
 * يقوم بالتقاط أي رفض من قواعد الأمان وعرضه بوضوح لتسهيل المعالجة.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    const handlePermissionError = (err: Error) => {
      console.warn("🛡️ Nova Monitor: Access Denied", err);
      setError(err);
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}
