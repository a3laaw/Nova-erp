import { User } from 'firebase/auth';
import { UserProfile } from '../types/auth';

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
    'auth/internal-error': 'حدث خطأ داخلي في نظام المصادقة',
  };
  return map[errorCode] || 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً';
};

/** التحقق من صحة بيانات المستخدم قبل التحويل لضمان سلامة المنظومة */
export const validateUserProfile = (data: any): UserProfile => {
  const required = ['email', 'role', 'isActive', 'fullName'];
  const missing = required.filter((k) => !(k in data));
  
  if (missing.length > 0) {
    throw new Error(`بيانات المستخدم ناقصة في القاعدة السيادية: ${missing.join(', ')}`);
  }
  
  return {
    email: String(data.email).toLowerCase(),
    role: data.role as any,
    isActive: Boolean(data.isActive),
    fullName: String(data.fullName),
    department: data.department || null,
    phone: data.phone || null,
    jobTitle: data.jobTitle || null,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
};

/** الحصول على الدور بكفاءة (CustomClaims أولاً) */
export const getUserRole = async (user: User): Promise<string> => {
  const token = await user.getIdTokenResult();
  return String(token.claims.role || 'user');
};

/** تسجيل أحداث المصادقة (Audit Log) للتتبع الاستخباري */
export const logAuthEvent = (event: string, payload: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`%c[AUTH_AUDIT] ${event}`, 'color: #7209B7; font-weight: bold', { 
        timestamp: new Date().toISOString(), 
        ...payload 
    });
  }
};

/** إعداد مؤشرات جلسة آمنة لفتح أقفال الـ Middleware */
export const setSessionIndicators = (uid: string, role: string) => {
  const expiry = 60 * 60 * 24 * 7; // 7 days
  const secure = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
  try {
    document.cookie = `nova-auth-active=true; path=/; max-age=${expiry}; ${secure}SameSite=Lax`;
    if (role === 'Developer') {
      document.cookie = `nova-dev-mode=true; path=/; max-age=${expiry}; ${secure}SameSite=Lax`;
    }
    // كوكيز الجلسة القديمة للتوافق مع الـ Middleware الحالي
    document.cookie = `nova-user-session=${uid}; path=/; max-age=${expiry}; ${secure}SameSite=Lax`;
  } catch (e) { 
    console.warn('Cookie set failed:', e); 
  }
};

/** مسح مؤشرات الجلسة عند الخروج */
export const clearSessionIndicators = () => {
  try {
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `nova-auth-active=; path=/; expires=${past}`;
    document.cookie = `nova-dev-mode=; path=/; expires=${past}`;
    document.cookie = `nova-user-session=; path=/; expires=${past}`;
    document.cookie = `nova-dev-session=; path=/; expires=${past}`;
  } catch (e) { 
    console.warn('Cookie clear failed:', e); 
  }
};
