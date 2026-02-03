'use client';

import React, { useState, useEffect } from 'react';
import type { Employee, AuditLog, LeaveRequest } from '@/lib/types';
import { format, intervalToDuration } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency, cn } from '@/lib/utils';
import { Banknote, Briefcase, Calendar, Gift, History, Phone, User, Wallet } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { fromFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';

interface DossierProps {
  employee: Partial<Employee>;
  reportDate: Date;
}

const formatDate = (dateValue: any, fallback = '-') => {
  const dateStr = fromFirestoreDate(dateValue);
  if (!dateStr) return fallback;
  try {
    const [year, month, day] = dateStr.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
};

const typeTranslations: { [key: string]: string } = {
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون راتب',
};

const statusTranslations: Record<string, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدمته',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  'on-leave': 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800',
};


export function EmployeeDossier({ employee, reportDate }: DossierProps) {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const { branding } = useBranding();

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const hireDate = fromFirestoreDate(employee.hireDate) ? new Date(fromFirestoreDate(employee.hireDate)) : null;
  const serviceDuration = employee.serviceDuration;
  const currentStatus = employee.status || 'active';
  const lastLeave = employee.lastLeave as LeaveRequest | null;

  return (
    <div className="p-4 md:p-6 bg-background font-body print:p-0 printable-content" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4 bg-card p-0 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:bg-transparent">
        {branding?.letterhead_image_url ? (
            <img
                src={branding.letterhead_image_url}
                alt="Letterhead"
                className="w-full h-auto"
            />
        ) : null}
        <div className="p-6 md:p-8">
            <header className="flex justify-between items-start pb-4 border-b">
                <div className="w-full">
                    <div className='flex items-center gap-4'>
                        <Logo className="h-16 w-16 !p-3 print:hidden" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-bold font-headline print:text-xl">{branding?.company_name || 'ملف الموظف الشامل'}</h1>
                            <p className="text-muted-foreground print:text-sm">{branding?.letterhead_text || 'Nova ERP'}</p>
                        </div>
                    </div>
                    <div className="text-left text-xs text-muted-foreground mt-4">
                        <p>تاريخ التقرير: {formatDate(reportDate)}</p>
                        {currentDate ? <p className="print:hidden">تاريخ الطباعة: {formatDate(currentDate)}</p> : null}
                    </div>
                </div>
            </header>

            <main className="space-y-4 pt-8">
                {/* Personal Info */}
                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><User />المعلومات الشخصية والأساسية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الاسم بالعربية:</span><span className="font-semibold text-right">{employee.fullName || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الاسم بالإنجليزية:</span><span className="font-semibold text-right">{employee.nameEn || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الرقم المدني:</span><span className="font-semibold text-right">{employee.civilId || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ الميلاد:</span><span className="font-semibold text-right">{formatDate(employee.dob)}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">النوع:</span><span className="font-semibold text-right">{employee.gender === 'male' ? 'ذكر' : 'أنثى'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">حالة الموظف:</span><span className="font-semibold text-right"><Badge className={statusColors[currentStatus]}>{statusTranslations[currentStatus] || 'غير معروف'}</Badge></span></div>
                    </div>
                </div>

                {/* Contact Info */}
                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><Phone />معلومات الاتصال</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">رقم الجوال:</span><span className="font-semibold text-right">{employee.mobile || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">رقم الطوارئ:</span><span className="font-semibold text-right">{employee.emergencyContact || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5 md:col-span-2"><span className="text-muted-foreground">البريد الإلكتروني:</span><span className="font-semibold text-right">{employee.email || '-'}</span></div>
                    </div>
                </div>
                
                 {/* Job & Contract Info */}
                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><Briefcase />البيانات الوظيفية والعقد</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">القسم:</span><span className="font-semibold text-right">{employee.department || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">المسمى الوظيفي:</span><span className="font-semibold text-right">{employee.jobTitle || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">المنصب:</span><span className="font-semibold text-right">{employee.position || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ التعيين:</span><span className="font-semibold text-right">{formatDate(hireDate)}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">نوع العقد:</span><span className="font-semibold text-right">{employee.contractType || '-'}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ انتهاء العقد:</span><span className="font-semibold text-right">{formatDate(employee.contractExpiry)}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الجنسية:</span><span className="font-semibold text-right">{employee.nationality || '-'}</span></div>
                        {employee.nationality !== 'كويتي' ? <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ انتهاء الإقامة:</span><span className="font-semibold text-right">{formatDate(employee.residencyExpiry)}</span></div> : null}
                        {employee.status === 'terminated' ? (
                            <>
                                <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ إنهاء الخدمة:</span><span className="font-semibold text-right">{formatDate(employee.terminationDate)}</span></div>
                                <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">سبب إنهاء الخدمة:</span><span className="font-semibold text-right">{employee.terminationReason === 'resignation' ? 'استقالة' : 'إنهاء من صاحب العمل'}</span></div>
                            </>
                        ) : null}
                    </div>
                </div>

                {/* Financial Info */}
                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><Wallet />البيانات المالية</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الراتب الأساسي:</span><span className="font-semibold text-right">{formatCurrency(employee.basicSalary || 0)}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">بدل السكن:</span><span className="font-semibold text-right">{formatCurrency(employee.housingAllowance || 0)}</span></div>
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">بدل النقل:</span><span className="font-semibold text-right">{formatCurrency(employee.transportAllowance || 0)}</span></div>
                        <div className="font-bold border-t pt-2 flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">الإجمالي:</span><span className="font-semibold text-right">{formatCurrency((employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0))}</span></div>
                        <Separator className='md:col-span-2 my-1' />
                        <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">طريقة دفع الراتب:</span><span className="font-semibold text-right">{employee.salaryPaymentType || '-'}</span></div>
                        {employee.salaryPaymentType === 'transfer' ? (
                          <>
                            <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">اسم البنك:</span><span className="font-semibold text-right">{employee.bankName || '-'}</span></div>
                            <div className="flex justify-between items-center py-1 print:py-0.5 md:col-span-2"><span className="text-muted-foreground">IBAN:</span><span className="font-semibold text-right">{employee.iban || '-'}</span></div>
                          </>
                        ) : null}
                    </div>
                </div>

                {employee.auditLogs && employee.auditLogs.length > 0 ? (
                    <div className="border rounded-lg p-4 print:border-none print:p-2">
                        <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><History />السجل الزمني للتغييرات</h3>
                        <div className='md:col-span-2 space-y-2'>
                            {employee.auditLogs.map((log: any, index: number) => (
                                <div key={log.id || index} className="text-xs p-2 rounded-md bg-muted/50">
                                    <span className="font-semibold text-primary">{formatDate(log.effectiveDate)}</span>: 
                                    تغيير في <span className='font-semibold'>"{log.field}"</span> من <span className='font-mono text-muted-foreground'>{log.oldValue !== null ? String(log.oldValue) : '-'}</span> إلى <span className='font-mono'>{log.newValue !== null ? String(log.newValue) : '-'}</span>
                                    {log.changeType === 'Creation' ? <span>(إنشاء ملف)</span> : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}
                
                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><Calendar />حالة الإجازات</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                            <p className="text-muted-foreground">رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                            <p className="text-2xl font-bold text-primary">{employee.leaveBalance?.toFixed(0) ?? 0} يوم</p>
                        </div>
                        {lastLeave ? (
                            <div className='md:col-span-2 border-t pt-4'>
                                <p className='font-semibold mb-2'>آخر عودة من إجازة:</p>
                                <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">نوع الإجازة:</span><span className="font-semibold text-right">{typeTranslations[lastLeave.leaveType] || lastLeave.leaveType}</span></div>
                                <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">تاريخ العودة الفعلي:</span><span className="font-semibold text-right">{formatDate(lastLeave.actualReturnDate)}</span></div>
                                <div className="flex justify-between items-center py-1 print:py-0.5"><span className="text-muted-foreground">عدد الأيام:</span><span className="font-semibold text-right">{`${lastLeave.workingDays ?? lastLeave.days ?? 0} أيام`}</span></div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="border rounded-lg p-4 print:border-none print:p-2">
                    <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><Gift />استحقاق نهاية الخدمة</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                        <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                            {serviceDuration ? (
                                <div className="flex justify-between items-center py-1 print:py-0.5">
                                    <span className="text-muted-foreground">مدة الخدمة حتى تاريخ التقرير:</span>
                                    <span className="font-semibold text-right">{`${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`}</span>
                                </div>
                            ) : null}
                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                                <span className="text-muted-foreground">قيمة نهاية الخدمة المستحقة:</span>
                                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(employee.eosb || 0)}</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground md:col-span-2">
                            * تم الحساب وفقًا للمادة 44 من قانون العمل الكويتي رقم 6 لسنة 2010. هذا تقدير تقريبي بناءً على البيانات المسجلة حتى تاريخ التقرير.
                        </p>
                    </div>
                </div>
            </main>
            <footer className="text-center pt-4 mt-4 border-t print:mt-8">
                <p className="text-xs text-muted-foreground">
                    هذا التقرير تم إنشاؤه بواسطة نظام {branding?.company_name || 'Nova ERP'}. جميع الحقوق محفوظة © {currentDate ? currentDate.getFullYear() : '...'}
                </p>
            </footer>
        </div>
      </div>
    </div>
  );
}
