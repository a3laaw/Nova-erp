/**
 * @fileOverview التعريفات السيادية للهوية والأدوار.
 */

export type UserRole = 'Admin' | 'Manager' | 'Engineer' | 'Accountant' | 'Viewer' | 'Developer';

export interface UserProfile {
  email: string;
  role: UserRole;
  isActive: boolean;
  fullName: string;
  department?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  permissions?: string[];
}

export interface AuthenticatedUser extends UserProfile {
  uid: string;
  id: string;
  currentCompanyId: string | null;
  companyName: string;
  isSuperAdmin?: boolean;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  settings?: Record<string, any>;
  [key: string]: any;
}
