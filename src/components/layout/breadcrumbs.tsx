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
    'leave-requests': 'طلبات الإجازة',
    attendance: 'الحضور والرواتب',
    reports: 'التقارير',
    'leave-reports': 'تقارير الإجازات',
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
    'leave-requests': 'Leave Requests',
    attendance: 'Attendance & Payroll',
    reports: 'Reports',
    'leave-reports': 'Leave Reports',
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
            default: return 'تفاصيل';
        }
    }
    // Fallback for English or other languages
    switch (parentSegment) {
        case 'clients': return 'Client Details';
        case 'employees': return 'Employee Profile';
        case 'transactions': return 'Transaction Details';
        case 'appointments': return 'Appointment Details';
        case 'journal-entries': return 'Entry Details';
        case 'cash-receipts': return 'Receipt Details';
        default: return 'Details';
    }
}


export function Breadcrumbs() {
  const pathname = usePathname();
  const { language, direction } = useLanguage();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length <= 1 || !pathname.startsWith('/dashboard')) {
    return null; 
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
    <nav aria-label="Breadcrumb" className="mb-6 no-print" dir={direction}>
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
