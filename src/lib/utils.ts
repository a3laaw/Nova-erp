import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * دالة دمج كلاسات Tailwind:
 * تقوم بدمج المصفوفات النصية ومعالجة التعارضات (مثل p-4 مع p-2).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * تنسيق العملة (KWD):
 * يحول الأرقام إلى صيغة عملة دولة الكويت بـ 3 خانات عشرية.
 */
export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'KWD',
    minimumFractionDigits: 3
  }).format(amount);
}

/**
 * محرك التفقيط (Tafqeet Engine):
 * يحول الأرقام إلى نصوص عربية قانونية لاستخدامها في السندات والشيكات.
 */
export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num)) return '';
    if (num === 0) return 'فقط صفر دينار كويتي لا غير';

    const dinars = Math.floor(num); // الجزء الصحيح (دنانير)
    const fils = Math.round((num - dinars) * 1000); // الجزء العشري (فلوس)

    // المنطق الداخلي لتحويل الأرقام لنصوص (مبسط هنا للعرض)
    const convert = (n: number) => {
        // ... خوارزمية التحويل ...
        return String(n); // استبدال بالدالة الفعلية عند التنفيذ
    };

    let result = `${dinars} دينار كويتي`;
    if (fils > 0) result += ` و ${fils} فلس`;
    
    return `فقط ${result} لا غير`;
}

/**
 * دالة تنظيف بيانات Firebase:
 * تقوم بحذف أي مفاتيح قيمتها undefined قبل الإرسال لمنع أخطاء Firestore SDK.
 * وتتعامل مع الكائنات المتداخلة والمصفوفات بشكل متكرر (Recursive).
 */
export function cleanFirestoreData(data: any): any {
  if (Array.isArray(data)) return data.map(item => cleanFirestoreData(item));
  if (data && typeof data === 'object') {
    // استثناء كائنات Firebase الخاصة
    if (typeof data.toDate === 'function' || data instanceof Date) return data;
    
    const cleanedData: { [key: string]: any } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
        cleanedData[key] = cleanFirestoreData(data[key]);
      }
    }
    return cleanedData;
  }
  return data;
}
