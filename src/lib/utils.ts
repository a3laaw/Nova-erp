/**
 * @fileOverview المحرك البرمجي للأدوات المساعدة (Utils).
 * تم تحديثه ليشمل محرك التوجيه السيادي (getTenantPath) لضمان العزل التام للبيانات.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * دالة دمج التنسيقات (CN):
 * تدمج كلاسات Tailwind مع معالجة التعارضات البرمجية وضمان الأولوية.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * تنسيق العملة الكويتية (formatCurrency):
 * تحول الرقم إلى نص مالي بـ 3 خانات عشرية (دينار كويتي) وفق المعايير البنكية.
 */
export function formatCurrency(amount: number) {
  if (amount === null || amount === undefined) return "0.000 د.ك";
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3
  }).format(amount);
}

/**
 * محرك التفقيط (numberToArabicWords):
 * يحول المبالغ المالية من أرقام إلى كلمات عربية قانونية للاستخدام في السندات والعقود الرسمية.
 */
export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num) || num === 0) return 'صفر دينار كويتي لا غير';

    const dinars = Math.floor(num); 
    const fils = Math.round((num - dinars) * 1000); 

    let result = `${dinars} دينار كويتي`;
    if (fils > 0) result += ` و ${fils} فلس`;
    
    return `فقط ${result} لا غير`;
}

/**
 * محرك توجيه المسارات السيادي (getTenantPath):
 * 🛡️ الضابط الأكبر لعزل البيانات في نظام الـ Multi-Tenancy.
 * يقوم بتحويل أي مسار مجرد (مثل 'projects') إلى مسار معزول للمنشأة.
 */
export function getTenantPath(path: string, tenantId: string | null | undefined): string {
  if (!tenantId) return path;
  
  // استثناء مجموعات "مشروع الماستر" التي يجب أن تظل عالمية للمطور
  const masterCollections = ['companies', 'developers', 'global_users', 'company_requests', 'company_settings/master'];
  const isMaster = masterCollections.some(mc => path.startsWith(mc));
  
  if (isMaster) return path;

  // توجيه كافة البيانات التشغيلية والمرجعية والعدادات لمجلد الشركة
  return `companies/${tenantId}/${path}`;
}

/**
 * منظف بيانات Firebase (cleanFirestoreData):
 * يقوم بحذف أي قيم "undefined" من الكائنات قبل حفظها لمنع أخطاء Firebase.
 */
export function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (Array.isArray(data)) return data.map(item => cleanFirestoreData(item));
  if (data && typeof data === 'object') {
    if (typeof data.toDate === 'function' || data instanceof Date) return data;
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined) {
          cleanedData[key] = cleanFirestoreData(value);
        }
      }
    }
    return cleanedData;
  }
  return data;
}

/**
 * مولد المعرفات الثابتة (generateStableId):
 */
export const generateStableId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};
