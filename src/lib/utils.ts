/**
 * @fileOverview المحرك البرمجي للأدوات المساعدة (Utils).
 * تم تحديثه لفرض العزل التام للمنشآت (SaaS Multi-tenancy).
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
 * محرك التفقيط (numberToArabicWords):
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
 * محرك توجيه المسارات السيادي المطور (SaaS Tenant Routing):
 * 🛡️ الضابط الأكبر لعزل البيانات. 
 * يضمن بقاء كل شركة داخل "صندوقها" الخاص.
 */
export function getTenantPath(path: string, tenantId: string | null | undefined): string {
  if (!tenantId) return path;
  
  // مجموعات مشروع الماستر (لا يتم عزلها لأنها عالمية للإدارة والمطور)
  const masterCollections = ['companies', 'developers', 'global_users', 'company_requests'];
  
  const isMaster = masterCollections.some(mc => path.startsWith(mc));
  if (isMaster) return path;

  // توجيه كافة البيانات إلى: companies/{tenantId}/{collectionName}
  // إذا كان المسار يبدأ بـ companies بالفعل، نتركه كما هو لخدمة المطور
  if (path.startsWith('companies/')) return path;

  return `companies/${tenantId}/${path}`;
}

/**
 * منظف بيانات Firebase (cleanFirestoreData):
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
