
/**
 * =====================================================================================
 * |         NOVA ERP - PREDICTIVE AI ROLE & PERMISSION FILLER (ENGINE v2.0)         |
 * =====================================================================================
 * |     *** THIS IS THE INTELLIGENCE ENGINE FOR THE PREDICTIVE ASSISTANT ***          |
 * =====================================================================================
 * |                                                                                   |
 * | This engine parses compound Arabic job titles to infer department and seniority.  |
 * | v2.0 uses a scoring-based system to handle multiple departments and professional  |
 * | gravity, addressing the weakness of the previous winner-takes-all model.          |
 * |                                                                                   |
 * =====================================================================================
 */

// --- DICTIONARIES (v2) ---
type Seniority = 'EXECUTIVE' | 'MANAGER' | 'SENIOR' | 'JUNIOR';
type Department = 'GENERAL_ADMIN' | 'PROJECTS' | 'FINANCE' | 'HR' | 'SALES' | 'UNKNOWN';

const SENIORITY_KEYWORDS: { [key in Seniority]: string[] } = {
  EXECUTIVE: ['مدير عام', 'رئيس تنفيذي', 'المالك', 'شريك', 'ceo', 'general manager', 'owner'],
  MANAGER: ['مدير', 'رئيس قسم', 'مشرف', 'مسؤول', 'manager', 'supervisor', 'head of'],
  SENIOR: ['أول', 'كبير', 'senior'],
  JUNIOR: ['مهندس', 'محاسب', 'سكرتير', 'مندوب', 'موظف'], // More specific junior roles
};

const DEPARTMENT_KEYWORDS: { [key in Department]: { weight: number, keywords: string[] } } = {
  PROJECTS: { weight: 10, keywords: ['مشاريع', 'موقع', 'تنفيذ', 'إنشاءات', 'هندسة', 'معماري', 'project', 'site', 'engineer', 'boq', 'كميات'] },
  FINANCE: { weight: 10, keywords: ['محاسب', 'مالية', 'حسابات', 'تكاليف', 'financial', 'accountant', 'مالي', 'موازنة'] },
  HR: { weight: 10, keywords: ['موارد بشرية', 'شؤون موظفين', 'شؤون عاملين', 'رواتب', 'توظيف', 'hr', 'payroll', 'موظفين'] },
  SALES: { weight: 8, keywords: ['مبيعات', 'عملاء', 'تطوير أعمال', 'sales', 'crm'] },
  GENERAL_ADMIN: { weight: 5, keywords: ['إداري', 'سكرتير', 'مكتب', 'admin', 'منسق'] },
  UNKNOWN: { weight: 0, keywords: [] },
};

const BASE_PERMISSIONS = {
    MANAGER: { core: 'edit_all', secondary: 'view', default: 'none' },
    SENIOR: { core: 'edit_own', secondary: 'view', default: 'none' },
    JUNIOR: { core: 'add_view', secondary: 'none', default: 'none' },
};

/**
 * The main AI engine function (v2.0).
 * Analyzes a job title using a scoring system and generates a permission map.
 * @param jobTitle The compound Arabic job title.
 * @param allModuleIds An array of all available module IDs.
 * @returns A key-value map of `moduleId: permissionLevel`.
 */
export function generatePredictivePermissions(jobTitle: string, allModuleIds: string[]): Record<string, string> {
  const normalizedTitle = ` ${jobTitle.toLowerCase()} `;
  const generatedMap: Record<string, string> = {};

  // 1. Determine Seniority (with fallback)
  let seniority: Seniority = 'JUNIOR'; // Default to Junior
  if (SENIORITY_KEYWORDS.EXECUTIVE.some(kw => normalizedTitle.includes(` ${kw} `))) seniority = 'EXECUTIVE';
  else if (SENIORITY_KEYWORDS.MANAGER.some(kw => normalizedTitle.includes(` ${kw} `))) seniority = 'MANAGER';
  else if (SENIORITY_KEYWORDS.SENIOR.some(kw => normalizedTitle.includes(` ${kw} `))) seniority = 'SENIOR';

  // Handle EXECUTIVE level - Grant all permissions
  if (seniority === 'EXECUTIVE') {
      allModuleIds.forEach(id => generatedMap[id] = 'full');
      return generatedMap;
  }
  
  // 2. Score Departments based on keywords (v2.0 logic)
  const departmentScores: Partial<Record<Department, number>> = {};
  for (const [dept, { weight, keywords }] of Object.entries(DEPARTMENT_KEYWORDS)) {
      const score = keywords.reduce((acc, kw) => acc + (normalizedTitle.match(new RegExp(` ${kw} `, 'g')) || []).length, 0);
      if (score > 0) {
          departmentScores[dept as Department] = (departmentScores[dept as Department] || 0) + (score * weight);
      }
  }

  const sortedDepartments = Object.keys(departmentScores).sort((a, b) => departmentScores[b as Department]! - departmentScores[a as Department]!) as Department[];
  const primaryDepartment = sortedDepartments[0] || 'UNKNOWN';

  // 3. Define Core Modules for each Department
  const coreModules: Record<Department, string[]> = {
      PROJECTS: ['contracts', 'projects', 'field_visits', 'boq', 'payment_applications', 'quotations'],
      FINANCE: ['journal_entries', 'vouchers', 'chart_of_accounts', 'accounting_reports', 'transactions', 'payroll'],
      HR: ['employees', 'payroll', 'hr_permissions'],
      SALES: ['clients', 'quotations', 'transactions'],
      GENERAL_ADMIN: ['clients', 'employees', 'transactions'],
      UNKNOWN: []
  };

  // 4. Generate the map based on the new scoring logic (v2.0)
  const basePerms = BASE_PERMISSIONS[seniority];
  const primaryCore = coreModules[primaryDepartment] || [];

  allModuleIds.forEach(moduleId => {
      if (primaryCore.includes(moduleId)) {
          // Grant core permission for primary department
          generatedMap[moduleId] = basePerms.core;
      } else {
          // Check if it's a core module for a secondary department
          const secondaryOwner = sortedDepartments.slice(1).find(dept => coreModules[dept].includes(moduleId));
          if (secondaryOwner) {
              generatedMap[moduleId] = basePerms.secondary;
          } else {
              generatedMap[moduleId] = basePerms.default;
          }
      }
  });

  // 5. Apply Global Overrides & Special Cases
  generatedMap['dashboard'] = 'view'; // Everyone can view the dashboard by default
  
  // If the user is a manager, they should at least be able to view clients and employees
  if (seniority === 'MANAGER') {
      if (generatedMap['clients'] === 'none') generatedMap['clients'] = 'view';
      if (generatedMap['employees'] === 'none') generatedMap['employees'] = 'view';
  }

  // Override settings for specific high-level managers
  if (seniority === 'MANAGER' && (primaryDepartment === 'FINANCE' || primaryDepartment === 'HR')) {
      generatedMap['settings'] = 'edit_own'; 
  }

  // If no specific permissions were assigned at all, it's a generic role, give them basic access.
  if (Object.values(generatedMap).every(val => val === 'none' || val === 'view')) {
      if(generatedMap['clients']) generatedMap['clients'] = 'add_view';
      if(generatedMap['projects']) generatedMap['projects'] = 'add_view';
  }

  return generatedMap;
}
