'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import Fuse from 'fuse.js';

const navLinks = [
  { name: 'Dashboard', path: '/dashboard', keywords: ['home', 'main', 'dashboard', 'الرئيسية'] },
  { name: 'Notifications', path: '/dashboard/notifications', keywords: ['notifications', 'alerts', 'تنبيهات', 'إشعارات'] },
  { name: 'Delayed Stages Report', path: '/dashboard/reports/delayed-stages', keywords: ['reports', 'delayed', 'late', 'تقارير', 'متأخر'] },
  { name: 'Stalled Stages Report', path: '/dashboard/reports/stalled-stages', keywords: ['reports', 'stalled', 'idle', 'خامل', 'متوقف'] },
  { name: 'Prospective Clients Report', path: '/dashboard/reports/prospective-clients', keywords: ['reports', 'prospective', 'leads', 'عملاء محتملون'] },
  { name: 'Upsell Opportunities Report', path: '/dashboard/reports/upsell-opportunities', keywords: ['reports', 'upsell', 'opportunities', 'فرص بيع'] },
  { name: 'Projects', path: '/dashboard/projects', keywords: ['projects', 'مشاريع'] },
  { name: 'Clients', path: '/dashboard/clients', keywords: ['clients', 'customers', 'عملاء'] },
  { name: 'New Client', path: '/dashboard/clients/new', keywords: ['new client', 'add client', 'عميل جديد', 'إضافة عميل'] },
  { name: 'Contracts', path: '/dashboard/contracts', keywords: ['contracts', 'عقود'] },
  { name: 'Accounting', path: '/dashboard/accounting', keywords: ['accounting', 'finance', 'محاسبة', 'مالية'] },
  { name: 'Quotations', path: '/dashboard/accounting/quotations', keywords: ['quotations', 'quotes', 'عروض أسعار'] },
  { name: 'New Quotation', path: '/dashboard/accounting/quotations/new', keywords: ['new quote', 'create quotation', 'عرض سعر جديد'] },
  { name: 'Chart of Accounts', path: '/dashboard/accounting/chart-of-accounts', keywords: ['chart of accounts', 'coa', 'شجرة الحسابات'] },
  { name: 'Accounting Assistant', path: '/dashboard/accounting/assistant', keywords: ['ai assistant', 'accounting ai', 'مساعد محاسبي'] },
  { name: 'Journal Entries', path: '/dashboard/accounting/journal-entries', keywords: ['journal entries', 'jv', 'قيود اليومية'] },
  { name: 'New Journal Entry', path: '/dashboard/accounting/journal-entries/new', keywords: ['new journal entry', 'create jv', 'قيد جديد'] },
  { name: 'Cash Receipts', path: '/dashboard/accounting/cash-receipts', keywords: ['cash receipts', 'receipts', 'سندات قبض'] },
  { name: 'Payment Vouchers', path: '/dashboard/accounting/payment-vouchers', keywords: ['payment vouchers', 'payments', 'سندات صرف'] },
  { name: 'Financial Statements', path: '/dashboard/accounting/income-statement', keywords: ['financial statements', 'p&l', 'balance sheet', 'قوائم مالية'] },
  { name: 'Human Resources', path: '/dashboard/hr', keywords: ['hr', 'human resources', 'موارد بشرية'] },
  { name: 'Employees', path: '/dashboard/hr/employees', keywords: ['employees', 'staff', 'موظفين'] },
  { name: 'New Employee', path: '/dashboard/hr/employees/new', keywords: ['new employee', 'add employee', 'إضافة موظف'] },
  { name: 'Leave Requests', path: '/dashboard/hr/leaves', keywords: ['leave', 'vacation', 'إجازات'] },
  { name: 'Payroll', path: '/dashboard/hr/payroll', keywords: ['payroll', 'salaries', 'رواتب'] },
  { name: 'Purchasing', path: '/dashboard/purchasing', keywords: ['purchasing', 'purchase orders', 'مشتريات'] },
  { name: 'Appointments', path: '/dashboard/appointments', keywords: ['appointments', 'calendar', 'مواعيد', 'تقويم'] },
  { name: 'New Appointment', path: '/dashboard/appointments/new', keywords: ['new appointment', 'book meeting', 'حجز موعد'] },
  { name: 'Settings', path: '/dashboard/settings', keywords: ['settings', 'configuration', 'إعدادات'] },
];

const fuse = new Fuse(navLinks, {
  keys: ['name', 'keywords'],
  includeScore: true,
  threshold: 0.4,
});

export const findNavigationTool = ai.defineTool(
  {
    name: 'findNavigation',
    description: 'Finds the most relevant navigation link within the ERP system based on a user\'s query or intent.',
    inputSchema: z.object({
      query: z.string().describe('The user\'s request, like "create a new invoice" or "show me the dashboard".'),
    }),
    outputSchema: z.object({
      path: z.string().describe('The absolute URL path for the destination, e.g., "/dashboard/clients/new".'),
      name: z.string().describe('The name of the destination page, e.g., "New Client".'),
    }),
  },
  async ({ query }) => {
    const results = fuse.search(query);
    if (results.length > 0) {
      return {
        path: results[0].item.path,
        name: results[0].item.name,
      };
    }
    // If no good match is found, we can decide what to do.
    // For now, let's indicate no path was found by returning an empty object,
    // and the main flow can handle this case.
    throw new Error('No relevant navigation link found.');
  }
);
