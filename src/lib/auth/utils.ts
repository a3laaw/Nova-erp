/**
 * @fileOverview الأدوات المساعدة للمصادقة والأمان السيادي.
 */

import { User } from 'firebase/auth';
import type { UserProfile } from '@/lib/types';

/** ترجمة أخطاء Firebase لرسائل عربية واضحة */
export const mapFirebaseAuthError = (errorCode: string): string => {
  const map: Record<string, string> = {
    'auth/invalid-credential': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    'auth/user-disabled': 'هذا الحساب معطل، يرجى التواصل مع الدعم الفني',
    'auth/too-many-requests': 'تم تعطيل الحساب مؤقتاً لكثرة المحاولات، حاول لاحقاً',
    'auth/invalid-email': 'صيغة البريد الإلكتروني غير صحيحة',
    'auth/user-not-found': 'لا يوجد حساب مرتبط بهذا البريد',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/network-request-failed': 'فشل الاتصال بالخادم، تحقق من الإنترنت',
  };
  return map[errorCode] || 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً';
};

/** التحقق من صحة بيانات المستخدم قبل التحويل */
export const validateUserProfile = (data: any): Partial<UserProfile> => {
  const required = ['email', 'role', 'isActive', 'fullName'];
  const missing = required.filter((k) => !(k in data));
  if (missing.length > 0) throw new Error(`بيانات المستخدم ناقصة: ${missing.join(', ')}`);
  
  return {
    email: String(data.email).toLowerCase(),
    role: data.role,
    isActive: Boolean(data.isActive),
    fullName: String(data.fullName),
    department: data.department || null,
    jobTitle: data.jobTitle || null,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
};

/** الحصول على الدور بكفاءة (CustomClaims أولاً) */
export const getUserRole = async (user: User): Promise<string> => {
  const token = await user.getIdTokenResult();
  return String(token.claims.role || 'user');
};

/** تسجيل أحداث المصادقة (Audit Log) */
export const logAuthEvent = (event: string, payload: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[AUTH_AUDIT] ${event}`, { timestamp: new Date().toISOString(), ...payload });
  }
};

/** إعداد مؤشرات جلسة آمنة (بدون بيانات حساسة) */
export const setSessionIndicators = (uid: string, role: string) => {
  const expiry = 60 * 60 * 24 * 7;
  const secure = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
  try {
    document.cookie = `nova-user-session=${uid}; path=/; max-age=${expiry}; ${secure}SameSite=Lax`;
    if (role === 'Developer') {
      document.cookie = `nova-dev-session=${uid}; path=/; max-age=${expiry}; ${secure}SameSite=Lax`;
    }
  } catch (e) { console.warn('Cookie set failed:', e); }
};

export const clearSessionIndicators = () => {
  try {
    document.cookie = 'nova-user-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'nova-dev-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  } catch (e) { console.warn('Cookie clear failed:', e); }
};
