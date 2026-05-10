'use client';
import { useAuth } from '@/context/auth-context';
import { useMemo } from 'react';

/**
 * خطاف جلب بيانات المنشأة الحالية
 */
export const useCurrentCompany = () => {
  const { company } = useAuth();
  return company;
};

/**
 * خطاف فحص الصلاحيات السيادي
 */
export const usePermission = (required: string | string[]): boolean => {
  const { user, loading } = useAuth();
  return useMemo(() => {
    if (loading || !user) return false;
    const roles = Array.isArray(required) ? required : [required];
    return roles.includes(user.role) || user.role === 'Developer';
  }, [user, loading, required]);
};

/**
 * خطاف إدارة أخطاء الجلسة
 */
export const useAuthError = () => {
  const { error, logout } = useAuth();
  return { 
      error, 
      clear: logout 
  };
};
