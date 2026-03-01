/**
 * @fileOverview المحرك البرمجي للأدوات المساعدة (Utils).
 * يحتوي على الدوال الجوهرية التي تضمن دقة العمليات المالية وتنسيق البيانات وتوليد الأرقام.
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

    // خوارزمية بسيطة للتحويل (يمكن توسيعها بمكتبات خارجية للتعقيدات اللغوية)
    let result = `${dinars} دينار كويتي`;
    if (fils > 0) result += ` و ${fils} فلس`;
    
    return `فقط ${result} لا غير`;
}

/**
 * منظف بيانات Firebase (cleanFirestoreData):
 * يقوم بحذف أي قيم "undefined" من الكائنات قبل حفظها لمنع أخطاء Firebase الشهيرة.
 * كما يقوم بمعالجة الكائنات المتداخلة والمصفوفات.
 */
export function cleanFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (Array.isArray(data)) return data.map(item => cleanFirestoreData(item));
  if (data && typeof data === 'object') {
    // لا تنظف كائنات الـ Date أو Timestamp الخاصة بـ Firebase
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
 * يولد ID عشوائي بطول 20 خانة لربط العناصر في الواجهة الأمامية (مثل بنود العقد) قبل الحفظ.
 */
export const generateStableId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};
