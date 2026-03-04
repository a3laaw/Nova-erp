
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/language-context';
import { ChevronLeft } from 'lucide-react';

const breadcrumbNameMap: Record<string, Record<string, string>> = {
  ar: {
    dashboard: 'الرئيسية',
    projects: 'المشاريع',
    clients: 'العملاء',
    appointments: 'المواعيد',
    accounting: 'المحاسبة',
    warehouse: 'المستودع',
    hr: 'الموارد البشرية',
    settings: 'الإعدادات',
    notifications: 'التنبيهات',
    new: 'إضافة',
    edit: 'تعديل',
    transactions: 'المعاملات',
    contract: 'العقد',
    'cash-receipts': 'سندات القبض',
    'payment-vouchers': 'سندات الصرف',
    'journal-entries': 'قيود اليومية',
    'chart-of-accounts': 'شجرة الحسابات',
    invoices: 'الفواتير',
    assistant: 'المساعد الذكي',
    employees: 'الموظفين',
    leaves: 'الإجازات',
    permissions: 'الاستئذانات',
    payroll: 'كشوف الرواتب',
    'gratuity-calculator': 'حاسبة نهاية الخدمة',
    reports: 'التقارير',
    general: 'تقرير الموظفين العام',
    'leave-balance': 'أرصدة الإجازات',
    attendance: 'الحضور والغياب',
    advances: 'السلف والاستقطاعات',
    gratuity: 'مكافأة نهاية الخدمة',
    'workflow': 'تقارير سير العمل',
    'leave-reports': 'تقارير الإجازات',
    'balance-sheet': 'قائمة المركز المالي',
    'income-statement': 'قائمة الدخل',
    'cash-flow': 'قائمة التدفقات النقدية',
    'equity-statement': 'قائمة التغير في حقوق الملكية',
    'financial-statement-notes': 'الإيضاحات المتممة',
    'trial-balance': 'ميزان المراجعة',
    'general-ledger': 'دفتر الأستاذ العام',
    statement: 'كشف حساب',
    'bank-reconciliation': 'التسوية البنكية',
    'classifications': 'الفئات',
    'balances': 'أرصدة الأصناف',
    'item-movement': 'بطاقة حركة الصنف',
    'item-cost': 'تحليل التكلفة والبيع',
    'stagnant-items': 'الأصناف الراكدة',
    'best-sellers': 'الأكثر طلباً',
    'vendor-statements': 'كشوفات الموردين',
    'client-statements': 'كشوفات العملاء',
    'purchase-orders': 'أوامر الشراء',
    'rfqs': 'طلبات التسعير',
    'vendors': 'الموردون',
    'grns': 'أذونات الاستلام',
    'material-issue': 'صرف مواد المشاريع',
    'sales-deliveries': 'مبيعات المعرض',
    'transfers': 'التحويلات',
    'warehouses': 'المستودعات',
    'delayed-stages': 'المهام المتأخرة',
    'stalled-stages': 'المراحل الخاملة',
    'prospective-clients': 'تحليل المحتملين',
    'upsell-opportunities': 'فرص بيع إضافية',
    'construction': 'المقاولات',
    'subcontractors': 'المقاولين',
    'certificates': 'شهادات الإنجاز',
    'payment-applications': 'المستخلصات',
    'reconciliation': 'التسويات البنكية',
    'sales': 'المبيعات',
    'schedules': 'مراجعة الجداول الزمنية',
    'field-visits': 'الزيارات الميدانية',
    'contracts': 'عروض الأسعار والعقود',
  },
  en: {
    dashboard: 'Dashboard',
    projects: 'Projects',
    clients: 'Clients',
    appointments: 'Appointments',
    accounting: 'Accounting',
    warehouse: 'Warehouse',
    hr: 'Human Resources',
    settings: 'Settings',
    notifications: 'Notifications',
    new: 'New',
    edit: 'Edit',
    transactions: 'Transactions',
    contract: 'Contract',
    'cash-receipts': 'Cash Receipts',
    'payment-vouchers': 'Payment Vouchers',
    'journal-entries': 'Journal Entries',
    'chart-of-accounts': 'Chart of Accounts',
    invoices: 'Invoices',
    assistant: 'AI Assistant',
    employees: 'Employees',
    leaves: 'Leave Requests',
    permissions: 'Permission Requests',
    payroll: 'Payroll',
    'gratuity-calculator': 'Gratuity Calculator',
    reports: 'Reports',
    general: 'General Employee Report',
    'leave-balance': 'Leave Balances',
    attendance: 'Attendance',
    advances: 'Advances & Deductions',
    gratuity: 'Gratuity',
    'workflow': 'Workflow Reports',
    'leave-reports': 'Leave Reports',
    'balance-sheet': 'Balance Sheet',
    'income-statement': 'Income Statement',
    'cash-flow': 'Cash Flow Statement',
    'equity-statement': 'Statement of Equity',
    'financial-statement-notes': 'Notes to Financial Statements',
    'trial-balance': 'Trial Balance',
    'general-ledger': 'General Ledger',
    statement: 'Statement',
    'bank-reconciliation': 'Bank Reconciliation',
    'classifications': 'Categories',
    'balances': 'Stock Balances',
    'item-movement': 'Item Movement Card',
    'item-cost': 'Cost & Sales Analysis',
    'stagnant-items': 'Stagnant Items',
    'best-sellers': 'Most Requested',
    'vendor-statements': 'Vendor Statements',
    'client-statements': 'Client Statements',
    'schedules': 'Review Timelines',
    'field-visits': 'Field Visits',
    'contracts': 'Quotations & Contracts',
  },
};

const getDynamicSegmentLabel = (parentSegment: string | undefined, lang: 'ar' | 'en'): string => {
    if (lang === 'ar') {
        switch (parentSegment) {
            case 'clients': return 'تفاصيل العميل';
            case 'employees': return 'ملف الموظف';
            case 'transactions': return 'تفاصيل المعاملة';
            case 'appointments': return 'تفاصيل الموعد';
            case 'journal-entries': return 'تفاصيل القيد';
            case 'cash-receipts': return 'تفاصيل السند';
            case 'vendors': return 'ملف المورد';
            case 'purchase-orders': return 'تفاصيل الأمر';
            case 'rfqs': return 'تفاصيل الطلب';
            case 'grns': return 'إذن استلام';
            case 'material-issue': return 'إذن صرف';
            case 'adjustments': return 'إذن تسوية';
            case 'payment-applications': return 'تفاصيل المستخلص';
            case 'field-visits': return 'تفاصيل الزيارة الميدانية';
            default: return 'تفاصيل';
        }
    }
    switch (parentSegment) {
        case 'clients': return 'Client Details';
        case 'employees': return 'Employee Profile';
        case 'transactions': return 'Transaction Details';
        case 'appointments': return 'Appointment Details';
        case 'journal-entries': return 'Entry Details';
        case 'cash-receipts': return 'Receipt Details';
        case 'vendors': return 'Vendor Profile';
        case 'field-visits': return 'Field Visit Details';
        default: return 'Details';
    }
}


export function Breadcrumbs() {
  const pathname = usePathname();
  const { language, direction } = useLanguage();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1 || !pathname.startsWith('/dashboard')) {
    return <h1 className="text-xl font-semibold">{breadcrumbNameMap[language].dashboard}</h1>; 
  }

  const dashboardSegments = segments.slice(1);

  const breadcrumbs = dashboardSegments.map((segment, index) => {
    const path = `/dashboard/${dashboardSegments.slice(0, index + 1).join('/')}`;
    const isLast = index === dashboardSegments.length - 1;
    
    const isDynamic = !breadcrumbNameMap[language][segment];
    const parentSegment = index > 0 ? dashboardSegments[index-1] : undefined;

    const label = isDynamic
      ? getDynamicSegmentLabel(parentSegment, language)
      : breadcrumbNameMap[language][segment];

    return {
      label,
      href: isLast ? null : path,
    };
  });

  const homeBreadcrumb = { label: breadcrumbNameMap[language].dashboard, href: '/dashboard' };

  return (
    <nav aria-label="Breadcrumb" className="no-print" dir={direction}>
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link href={homeBreadcrumb.href} className="hover:text-primary transition-colors">
            {homeBreadcrumb.label}
          </Link>
        </li>
        {breadcrumbs.map((breadcrumb, index) => (
          <li key={breadcrumb.href || index} className="flex items-center gap-1.5">
            <ChevronLeft className="h-4 w-4 transform rtl:rotate-180" />
            {breadcrumb.href ? (
              <Link href={breadcrumb.href} className="hover:text-primary transition-colors">
                {breadcrumb.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{breadcrumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
