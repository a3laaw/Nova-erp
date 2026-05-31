
/**
 * =====================================================================================
 * |                      NOVA ERP - UNIFIED CORE METADATA SCHEMA                      |
 * =====================================================================================
 * |            *** THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR THE UI ***             |
 * =====================================================================================
 * |                                                                                   |
 * | This schema dictates the structure of the sidebar, dashboard, and access         |
 * | control. All dynamic UI elements are generated based on this configuration and   |
 * | the current user's permission set.                                               |
 * |                                                                                   |
 * =====================================================================================
 */
import type { LucideIcon } from 'lucide-react';

// --- TYPE DEFINITIONS ---

interface ActionPermissions {
  create: string;
  edit: string;
  editOwn: string;
  delete: string;
}

interface DashboardMetric {
  permissionCode: string;
  metricType: 'count' | 'value' | 'list' | 'action';
  label: string;
  valuePrefix?: string;
  valueSuffix?: string;
  href: string;
  icon: string; // Lucide Icon Name
}

interface SubMenuItem {
  id: string;
  label:string;
  href: string;
  icon: string; // Lucide Icon Name
  viewPermission: string;
  actionPermissions?: ActionPermissions;
}

interface NovaModule {
  id: string;
  moduleKey: string;
  label: string;
  icon: string; // Lucide Icon Name
  globalMenuPermission: string;
  children: SubMenuItem[];
  dashboardMetrics: DashboardMetric[];
}

// --- THE CENTRAL SCHEMA ---

export const NovaSystemSchema: NovaModule[] = [
  // 1. CRM / Clients Module
  {
    id: 'clients',
    moduleKey: 'clients',
    label: 'العملاء',
    icon: 'Users',
    globalMenuPermission: 'menu_clients',
    children: [
      {
        id: 'view_clients_registered',
        label: 'ملفات العملاء',
        href: '/dashboard/clients?view=registered',
        icon: 'Users',
        viewPermission: 'view_clients',
        actionPermissions: { create: 'add_clients', edit: 'edit_clients', editOwn: 'edit_own_clients', delete: 'delete_clients' }
      },
      {
        id: 'view_clients_prospective',
        label: 'العملاء المحتملون',
        href: '/dashboard/clients?view=prospective',
        icon: 'Search',
        viewPermission: 'view_prospects',
      }
    ],
    dashboardMetrics: [
      { permissionCode: 'view_clients', metricType: 'count', label: 'العملاء المسجلون', href: '/dashboard/clients?view=registered', icon: 'Users' },
      { permissionCode: 'view_prospects', metricType: 'count', label: 'العملاء المحتملون', href: '/dashboard/clients?view=prospective', icon: 'Search' },
      { permissionCode: 'add_clients', metricType: 'action', label: 'إضافة عميل جديد', href: '/dashboard/clients/new', icon: 'UserPlus' },
    ]
  },
  
  // 2. Construction Module
  {
    id: 'construction',
    moduleKey: 'construction',
    label: 'المقاولات',
    icon: 'Construction',
    globalMenuPermission: 'menu_construction',
    children: [
      {
        id: 'contracts',
        label: 'عروض الأسعار والعقود',
        href: '/dashboard/contracts',
        icon: 'FileSignature',
        viewPermission: 'view_contracts',
        actionPermissions: { create: 'add_contracts', edit: 'edit_contracts', editOwn: 'edit_own_contracts', delete: 'delete_contracts' }
      },
      {
        id: 'projects',
        label: 'المشاريع التنفيذية',
        href: '/dashboard/construction/projects',
        icon: 'Briefcase',
        viewPermission: 'view_projects',
        actionPermissions: { create: 'add_projects', edit: 'edit_projects', editOwn: 'edit_own_projects', delete: 'delete_projects' }
      },
      {
        id: 'field_visits',
        label: 'الزيارات الميدانية',
        href: '/dashboard/construction/field-visits',
        icon: 'MapPin',
        viewPermission: 'view_field_visits',
        actionPermissions: { create: 'add_field_visits', edit: 'edit_field_visits', editOwn: 'edit_own_field_visits', delete: 'delete_field_visits' }
      },
      {
        id: 'boq',
        label: 'جداول الكميات (BOQ)',
        href: '/dashboard/construction/boq',
        icon: 'ListTree',
        viewPermission: 'view_boq',
        actionPermissions: { create: 'add_boq', edit: 'edit_boq', editOwn: 'edit_own_boq', delete: 'delete_boq' }
      },
      {
        id: 'payment_applications',
        label: 'المستخلصات المالية',
        href: '/dashboard/construction/payment-applications',
        icon: 'Coins',
        viewPermission: 'view_payment_applications',
        actionPermissions: { create: 'add_payment_applications', edit: 'edit_payment_applications', editOwn: 'edit_own_payment_applications', delete: 'delete_payment_applications' }
      }
    ],
    dashboardMetrics: [
      { permissionCode: 'view_projects', metricType: 'count', label: 'مشاريع تحت التنفيذ', href: '/dashboard/construction/projects', icon: 'Briefcase' },
      { permissionCode: 'view_contracts', metricType: 'count', label: 'عقود بانتظار التوقيع', href: '/dashboard/contracts', icon: 'FileSignature' },
      { permissionCode: 'view_payment_applications', metricType: 'value', label: 'مستخلصات مستحقة', valuePrefix: 'SAR ', href: '/dashboard/construction/payment-applications', icon: 'Coins' }
    ]
  },

  // 3. Accounting Module
  {
    id: 'accounting',
    moduleKey: 'accounting',
    label: 'الإدارة المالية',
    icon: 'Wallet',
    globalMenuPermission: 'menu_accounting',
    children: [
      {
        id: 'chart_of_accounts',
        label: 'شجرة الحسابات',
        href: '/dashboard/accounting/chart-of-accounts',
        icon: 'Layers',
        viewPermission: 'view_chart_of_accounts',
        actionPermissions: { create: 'add_chart_of_accounts', edit: 'edit_chart_of_accounts', editOwn: 'edit_own_chart_of_accounts', delete: 'delete_chart_of_accounts' }
      },
      {
        id: 'journal_entries',
        label: 'قيود اليومية',
        href: '/dashboard/accounting/journal-entries',
        icon: 'BookOpen',
        viewPermission: 'view_journal_entries',
        actionPermissions: { create: 'add_journal_entries', edit: 'edit_journal_entries', editOwn: 'edit_own_journal_entries', delete: 'delete_journal_entries' }
      },
      {
        id: 'cash_receipts',
        label: 'سندات القبض',
        href: '/dashboard/accounting/cash-receipts',
        icon: 'ArrowDownLeft',
        viewPermission: 'view_cash_receipts',
        actionPermissions: { create: 'add_cash_receipt', edit: 'edit_vouchers', editOwn: 'edit_own_vouchers', delete: 'delete_vouchers' }
      },
      {
        id: 'payment_vouchers',
        label: 'سندات الصرف',
        href: '/dashboard/accounting/payment-vouchers',
        icon: 'ArrowUpRight',
        viewPermission: 'view_payment_vouchers',
        actionPermissions: { create: 'add_payment_voucher', edit: 'edit_vouchers', editOwn: 'edit_own_vouchers', delete: 'delete_vouchers' }
      }
    ],
    dashboardMetrics: [
      { permissionCode: 'view_journal_entries', metricType: 'action', label: 'تسجيل قيد يومية', href: '/dashboard/accounting/journal-entries/new', icon: 'BookOpen' },
      { permissionCode: 'add_cash_receipt', metricType: 'action', label: 'إصدار سند قبض', href: '/dashboard/accounting/cash-receipts/new', icon: 'ArrowDownLeft' },
      { permissionCode: 'add_payment_voucher', metricType: 'action', label: 'إصدار سند صرف', href: '/dashboard/accounting/payment-vouchers/new', icon: 'ArrowUpRight' },
    ]
  },

  // 4. HR Module
  {
    id: 'hr',
    moduleKey: 'hr',
    label: 'الموارد البشرية',
    icon: 'UserCheck',
    globalMenuPermission: 'menu_hr',
    children: [
      {
        id: 'employees',
        label: 'الموظفين',
        href: '/dashboard/hr/employees',
        icon: 'UserCheck',
        viewPermission: 'view_employees',
        actionPermissions: { create: 'add_employees', edit: 'edit_employees', editOwn: 'edit_own_employees', delete: 'delete_employees' }
      },
      {
        id: 'payroll',
        label: 'الرواتب',
        href: '/dashboard/hr/payroll',
        icon: 'Banknote',
        viewPermission: 'view_payroll',
        actionPermissions: { create: 'add_payroll', edit: 'edit_payroll', editOwn: 'edit_own_payroll', delete: 'delete_payroll' }
      }
    ],
    dashboardMetrics: [
      { permissionCode: 'view_employees', metricType: 'count', label: 'إجمالي الموظفين', href: '/dashboard/hr/employees', icon: 'Users' },
      { permissionCode: 'add_employees', metricType: 'action', label: 'إضافة موظف جديد', href: '/dashboard/hr/employees/new', icon: 'UserPlus' }
    ]
  },

  // 5. Settings Module
  {
    id: 'settings',
    moduleKey: 'settings',
    label: 'الإعدادات',
    icon: 'Settings2',
    globalMenuPermission: 'menu_settings',
    children: [
        { id: 'manage_permissions', label: 'الصلاحيات والرتب', href: '/dashboard/settings/roles', icon: 'Lock', viewPermission: 'manage_permissions' },
        { id: 'manage_users', label: 'مستخدمو النظام', href: '/dashboard/settings/users', icon: 'Users', viewPermission: 'manage_users' },
        { id: 'manage_branding', label: 'هوية الشركة', href: '/dashboard/settings/branding', icon: 'Palette', viewPermission: 'manage_branding' },
    ],
    dashboardMetrics: [
      { permissionCode: 'manage_users', metricType: 'action', label: 'إدارة المستخدمين', href: '/dashboard/settings/users', icon: 'Users' },
    ]
  }
];
