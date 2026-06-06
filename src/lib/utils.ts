import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 🛡️ دالة بناء المسار السيادية المعدلة
 * تم تحويل المسار من tenants إلى companies لربط الواجهات بالخزنة التاريخية الحية للشركة مباشرة.
 */
export function getTenantPath(relativePath: string | null, tenantId: string | undefined): string | null {
  if (!relativePath || !tenantId) {
    return null;
  }
  // 🔥 التعديل هنا: جلب البيانات من المجلد الأصلي الحقيقي للشركة
  return `companies/${tenantId}/${relativePath}`;
}

// The original, simple, and stable version of the function.
export const cleanFirestoreData = (data: any): any => {
  const cleanedData: { [key: string]: any } = {};
  for (const key in data) {
    const value = data[key];
    if (value === undefined || value === null) {
      continue; 
    }
    if (key === 'id' || key === 'createdAt') {
        continue;
    }
    cleanedData[key] = value;
  }
  return cleanedData;
};