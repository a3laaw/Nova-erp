
import { NovaSystemSchema } from './nova-system-schema';

/**
 * =====================================================================================
 * |                NOVA ERP - AI ROLE MATCHER & PERMISSION ENGINE                     |
 * =====================================================================================
 * |         *** THIS FILE IS THE BRAIN BEHIND THE CONTEXTUAL AI ASSISTANT ***         |
 * =====================================================================================
 * |                                                                                   |
 * | This engine parses Arabic job titles to infer department and seniority, then maps |
 * | them to a precise set of permissions based on the master NovaSystemSchema.       |
 * |                                                                                   |
 * =====================================================================================
 */

// --- TYPE DEFINITIONS ---
type Seniority = 'EXECUTIVE' | 'MANAGER' | 'SENIOR' | 'JUNIOR';
type Department = 'GENERAL_ADMIN' | 'PROJECTS' | 'FINANCE' | 'HR' | 'SALES' | 'UNKNOWN';

// --- KEYWORD DICTIONARIES ---
const SENIORITY_KEYWORDS: { [key in Seniority]: string[] } = {
  EXECUTIVE: ['مدير عام', 'رئيس تنفيذي', 'المالك', 'شريك', 'ceo', 'general manager', 'owner'],
  MANAGER: ['مدير', 'رئيس قسم', 'مشرف', 'مسؤول', 'manager', 'supervisor', 'head of'],
  SENIOR: ['أول', 'كبير', 'senior'],
  JUNIOR: [], // Default
};

const DEPARTMENT_KEYWORDS: { [key in Department]: string[] } = {
  GENERAL_ADMIN: ['إداري', 'سكرتير', 'مكتب', 'admin'],
  PROJECTS: ['مشاريع', 'موقع', 'تنفيذ', 'إنشاءات', 'هندسة', 'معماري', 'project', 'site', 'engineer'],
  FINANCE: ['محاسب', 'مالية', 'حسابات', 'تكاليف', 'financial', 'accountant'],
  HR: ['موارد بشرية', 'شؤون موظفين', 'توظيف', 'hr'],
  SALES: ['مبيعات', 'عملاء', 'تطوير أعمال', 'sales', 'crm'],
  UNKNOWN: [], // Default
};

// --- HELPER FUNCTIONS ---

/**
 * Extracts a specific module's permissions from the master schema.
 * @param moduleKey - The key of the module (e.g., 'construction').
 * @param levels - The permissions to grant (e.g., ['view', 'add', 'editOwn']).
 * @returns An array of permission strings.
 */
const getModulePermissions = (moduleKey: string, levels: ('view' | 'add' | 'edit' | 'editOwn' | 'delete')[]): string[] => {
  const permissions = new Set<string>();
  const module = NovaSystemSchema.find(m => m.moduleKey === moduleKey);
  if (!module) return [];

  // Grant menu access
  permissions.add(module.globalMenuPermission);

  // Grant permissions for children
  module.children.forEach(child => {
    if (levels.includes('view')) {
      permissions.add(child.viewPermission);
    }
    if (child.actionPermissions) {
      if (levels.includes('add')) permissions.add(child.actionPermissions.create);
      if (levels.includes('edit')) permissions.add(child.actionPermissions.edit);
      if (levels.includes('editOwn')) permissions.add(child.actionPermissions.editOwn);
      if (levels.includes('delete')) permissions.add(child.actionPermissions.delete);
    }
  });

  return Array.from(permissions);
};

/**
 * Gets all permissions in the system.
 * @returns A complete array of every defined permission string.
 */
const getAllPermissions = (): string[] => {
  const allPermissions = new Set<string>();
  NovaSystemSchema.forEach(module => {
    allPermissions.add(module.globalMenuPermission);
    module.children.forEach(child => {
      allPermissions.add(child.viewPermission);
      if (child.actionPermissions) {
        Object.values(child.actionPermissions).forEach(perm => allPermissions.add(perm));
      }
    });
  });
  return Array.from(allPermissions);
};


// --- THE MAIN EXPORTED ENGINE ---

/**
 * Parses a job title to intelligently assign a list of permissions.
 * @param jobTitle - The user's full job title in Arabic.
 * @returns A JSON array of permission strings.
 */
export function getPermissionsForRole(jobTitle: string): string[] {
  const normalizedTitle = jobTitle.toLowerCase();
  const permissions = new Set<string>();

  // 1. Determine Seniority
  let seniority: Seniority = 'JUNIOR';
  for (const level in SENIORITY_KEYWORDS) {
    if (SENIORITY_KEYWORDS[level as Seniority].some(kw => normalizedTitle.includes(kw))) {
      seniority = level as Seniority;
      break;
    }
  }

  // Handle EXECUTIVE level - Grant all permissions
  if (seniority === 'EXECUTIVE') {
    return getAllPermissions();
  }

  // 2. Determine Department
  let department: Department = 'UNKNOWN';
  for (const dept in DEPARTMENT_KEYWORDS) {
    if (DEPARTMENT_KEYWORDS[dept as Department].some(kw => normalizedTitle.includes(kw))) {
      department = dept as Department;
      break;
    }
  }
  
  // Always grant dashboard access
  permissions.add('view_dashboard');

  // 3. Map Permissions based on Department and Seniority
  switch (department) {
    case 'PROJECTS':
      if (seniority === 'MANAGER') {
        getModulePermissions('construction', ['view', 'add', 'edit', 'delete']).forEach(p => permissions.add(p));
        getModulePermissions('clients', ['view']).forEach(p => permissions.add(p)); // Managers can view clients
      } else if (seniority === 'SENIOR') {
        getModulePermissions('construction', ['view', 'add', 'editOwn']).forEach(p => permissions.add(p));
      } else { // JUNIOR
        getModulePermissions('construction', ['view', 'add', 'editOwn']).forEach(p => {
            // Juniors can only add/edit certain things
            if(p.includes('field_visits') || p.includes('boq')) permissions.add(p);
        });
        permissions.add('view_projects');
        permissions.add('view_contracts');
      }
      break;

    case 'FINANCE':
      if (seniority === 'MANAGER') {
        getModulePermissions('accounting', ['view', 'add', 'edit', 'delete']).forEach(p => permissions.add(p));
        getModulePermissions('clients', ['view']).forEach(p => permissions.add(p)); // View clients
        permissions.add('view_payroll'); // Finance head can see payroll
      } else { // SENIOR or JUNIOR Accountant
        getModulePermissions('accounting', ['view', 'add', 'editOwn']).forEach(p => permissions.add(p));
      }
      break;

    case 'HR':
      if (seniority === 'MANAGER' || seniority === 'SENIOR') {
        getModulePermissions('hr', ['view', 'add', 'edit', 'delete']).forEach(p => permissions.add(p));
      } else { // JUNIOR
        getModulePermissions('hr', ['view', 'add', 'editOwn']).forEach(p => permissions.add(p));
      }
      break;

    case 'SALES':
      if (seniority === 'MANAGER' || seniority === 'SENIOR') {
        getModulePermissions('clients', ['view', 'add', 'edit', 'delete']).forEach(p => permissions.add(p));
      } else { // JUNIOR
        getModulePermissions('clients', ['view', 'add', 'editOwn']).forEach(p => permissions.add(p));
      }
      break;

    case 'GENERAL_ADMIN':
        getModulePermissions('clients', ['view', 'add']).forEach(p => permissions.add(p));
        getModulePermissions('hr', ['view']).forEach(p => permissions.add(p));
      break;
  }
  
  // Grant settings access only to managers of specific departments or as needed
  if (seniority === 'MANAGER' && (department === 'FINANCE' || department === 'HR')) {
      permissions.add('menu_settings');
      permissions.add('manage_users');
  }

  return Array.from(permissions);
}
