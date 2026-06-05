import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTenantPath(relativePath: string | null, tenantId: string | undefined): string | null {
  if (!relativePath || !tenantId) {
    return null;
  }
  return `tenants/${tenantId}/${relativePath}`;
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
