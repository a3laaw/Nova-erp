
import {
    LayoutDashboard,
    Users,
    Workflow,
    Calculator,
    FileSignature,
    Briefcase,
    MapPin,
    ListTree,
    Coins,
    BookOpen,
    Landmark,
    TrendingUp,
    Banknote,
    Clock,
    Settings2,
} from 'lucide-react';

/**
 * =====================================================================================
 * |                       NOVA ERP - CENTRAL MODULE DEFINITIONS                       |
 * =====================================================================================
 * |      *** THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR SYSTEM MODULES ***           |
 * =====================================================================================
 * |                                                                                   |
 * | This schema defines all possible modules in the system, their icons, labels,      |
 * | and default navigation paths. It is consumed by both the permissions matrix       |
 * | and the dynamic sidebar to ensure consistency.                                    |
 * |                                                                                   |
 * =====================================================================================
 */

export const SystemModules = [
    { id: 'dashboard', name: 'لوحة التحكم', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'clients', name: 'إدارة العملاء', icon: Users, href: '/dashboard/clients' },
    { id: 'transactions', name: 'المعاملات', icon: Workflow, href: '/dashboard/transactions' },
    { id: 'quotations', name: 'عروض الأسعار', icon: Calculator, href: '/dashboard/quotations' },
    { id: 'contracts', name: 'العقود', icon: FileSignature, href: '/dashboard/contracts' },
    { id: 'projects', name: 'المشاريع', icon: Briefcase, href: '/dashboard/projects' },
    { id: 'field_visits', name: 'الزيارات الميدانية', icon: MapPin, href: '/dashboard/field-visits' },
    { id: 'boq', name: 'جداول الكميات', icon: ListTree, href: '/dashboard/boq' },
    { id: 'payment_applications', name: 'المستخلصات', icon: Coins, href: '/dashboard/payment-applications' },
    { id: 'journal_entries', name: 'القيود المحاسبية', icon: BookOpen, href: '/dashboard/journal-entries' },
    { id: 'vouchers', name: 'سندات القبض والصرف', icon: Landmark, href: '/dashboard/vouchers' },
    { id: 'chart_of_accounts', name: 'شجرة الحسابات', icon: ListTree, href: '/dashboard/chart-of-accounts' },
    { id: 'accounting_reports', name: 'التقارير المالية', icon: TrendingUp, href: '/dashboard/accounting-reports' },
    { id: 'employees', name: 'إدارة الموظفين', icon: Users, href: '/dashboard/employees' },
    { id: 'payroll', name: 'الرواتب', icon: Banknote, href: '/dashboard/payroll' },
    { id: 'hr_permissions', name: 'الاستئذانات', icon: Clock, href: '/dashboard/hr-permissions' },
    { id: 'settings', name: 'إعدادات النظام', icon: Settings2, href: '/dashboard/settings' },
];
