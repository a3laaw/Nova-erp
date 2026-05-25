/**
 * @fileOverview المحرك البرمجي للأدوات المساعدة (Utils).
 * تم تحديثه لفرض العزل التام للمنشآت ومنع أخطاء الصلاحيات.
 * تم إضافة محرك التفقيط العربي الكامل (الكلمات بدلاً من الأرقام).
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * دالة دمج التنسيقات (CN):
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * تنسيق العملة الكويتية (formatCurrency):
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
 * ✨ محرك التفقيط العربي المطور (Arabic Number to Words Engine) ✨
 * يحول الأرقام إلى كلمات عربية فصيحة بالكامل.
 */
export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num) || num === 0) return 'صفر دينار كويتي لا غير';

    const dinars = Math.floor(num);
    const fils = Math.round((num - dinars) * 1000);

    const convertToWords = (n: number): string => {
        const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
        const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
        const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعة مائة"];

        if (n === 0) return "";
        if (n < 20) return units[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " و" + units[n % 10] : "");
        if (n < 1000) return hundreds[Math.floor(n / 100)] + (n % 100 !== 0 ? " و" + convertToWords(n % 100) : "");
        if (n < 2000) return "ألف" + (n % 1000 !== 0 ? " و" + convertToWords(n % 1000) : "");
        if (n < 3000) return "ألفان" + (n % 1000 !== 0 ? " و" + convertToWords(n % 1000) : "");
        if (n < 11000) return units[Math.floor(n / 1000)] + " آلاف" + (n % 1000 !== 0 ? " و" + convertToWords(n % 1000) : "");
        if (n < 1000000) return convertToWords(Math.floor(n / 1000)) + " ألف" + (n % 1000 !== 0 ? " و" + convertToWords(n % 1000) : "");
        return String(n); // Fallback for very large numbers
    };

    let dinarPart = convertToWords(dinars);
    let filsPart = convertToWords(fils);

    let result = `فقط ${dinarPart} دينار كويتي`;
    if (fils > 0) {
        result += ` و ${filsPart} فلس`;
    }
    result += " لا غير";

    return result;
}

/**
 * محرك توجيه المسارات المعتمد (Tenant Router V2.0):
 * تم تحرير 'counters' و 'hub_posts' من المسارات العالمية لضمان سيادة المنشأة عليها.
 */
export function getTenantPath(path: string | null | undefined, tenantId: string | null | undefined): string | null {
  if (!path) return null;
  const masterCollections = [
      'companies', 
      'developers', 
      'global_users', 
      'company_requests', 
      'holidays', 
      // 'counters', // 🛡️ تم التحرير: العدادات تتبع المنشأة الآن
      // 'hub_posts', // 🛡️ تم التحرير: الحائط يتبع المنشأة الآن
      'system_lexicon',
      'framework_config'
  ];
  const isMaster = masterCollections.some(mc => path.startsWith(mc));
  if (isMaster) return path;
  if (path.startsWith('companies/')) return path;
  if (!tenantId) return null;
  return `companies/${tenantId}/${path}`;
}

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

export const generateStableId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};
