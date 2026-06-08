import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * دمج فئات Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * بناء مسار البيانات الخاص بالشركة (Tenant)
 */
export function getTenantPath(relativePath: string | null, tenantId: string | undefined): string | null {
  if (!relativePath || !tenantId) return null;
  return `companies/${tenantId}/${relativePath}`;
}

/**
 * تنظيف بيانات Firestore من القيم الفارغة أو الحقول الممنوعة
 */
export const cleanFirestoreData = (data: any): any => {
  const cleanedData: { [key: string]: any } = {};
  for (const key in data) {
    const value = data[key];
    if (value === undefined || value === null) continue;
    if (key === 'id' || key === 'createdAt') continue;
    cleanedData[key] = value;
  }
  return cleanedData;
};

/**
 * تنسيق العملة (دينار كويتي KWD)
 * يعرض الأرقام بالإنجليزية مع 3 خانات عشرية
 */
export function formatCurrency(amount: number | bigint | undefined): string {
  if (amount === undefined || amount === null) return '0.000 KWD';
  
  return new Intl.NumberFormat('en-KW', { 
    style: 'currency', 
    currency: 'KWD',
    minimumFractionDigits: 3,
    maximumFractionDigits: 3 
  }).format(amount);
}

/**
 * تحويل الأرقام إلى كلمات (يمكنك تحديث منطق التحويل لاحقاً)
 */
export function numberToArabicWords(num: number): string {
  return num.toString(); 
}

/**
 * استخراج الإشارات (@mentions) من النصوص
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@(\w+)/g);
  return matches ? matches.map(m => m.substring(1)) : [];
}

/**
 * توليد معرف فريد ومستقر
 */
export function generateStableId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}