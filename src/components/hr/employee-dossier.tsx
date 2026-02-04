
'use client';

import React, { useEffect, useState } from 'react';
import type { Employee, AuditLog, LeaveRequest } from '@/lib/types';
import { parseISO } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Banknote, Briefcase, Calendar, Gift, History, Phone, User, Wallet, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { useBranding } from '@/context/branding-context';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

// Props accept a serializable version of the employee
interface DossierProps {
  employee: Partial<Employee & { hireDate: string | null; lastLeave: any; serviceDuration: any; auditLogs: any[] }>;
  reportDate: Date;
}

const formatDate = (dateValue: string | null | undefined, fallback = '-') => {
  if (!dateValue) return fallback;
  try {
    const date = parseISO(dateValue);
    return new Intl.DateTimeFormat('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(date);
  } catch (e) {
    return dateValue; // return the string if parsing fails
  }
};

const typeTranslations: { [key: string]: string } = {
  'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون راتب',
};

const statusTranslations: Record<string, string> = {
  active: 'نشط', 'on-leave': 'في إجازة', terminated: 'منتهية خدمته',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800', 'on-leave': 'bg-yellow-100 text-yellow-800', terminated: 'bg-red-100 text-red-800',
};

function InfoItem({ label, value, className }: { label: string, value: string | number | null | undefined | React.ReactNode, className?: string }) {
  return (
      <div className="flex justify-between items-center py-1 print:py-0.5">
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-semibold text-right">{value ?? '-'}</span>
      </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4 print:border-none print:p-2">
            <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2">{icon}{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {children}
            </div>
        </div>
    );
}

export function EmployeeDossier({ employee, reportDate }: DossierProps) {
  const [currentDate, setCurrentDate] = useState<string | null>(null);
  const { branding } = useBranding();

  useEffect(() => {
    setCurrentDate(new Date().toISOString());
  }, []);

  if (!employee) {
    return (
      <Alert variant="destructive" dir="rtl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>خطأ في البيانات</AlertTitle>
        <AlertDescription>لا يمكن عرض ملف الموظف لأن البيانات غير متوفرة.</AlertDescription>
      </Alert>
    );
  }
  
  const serviceDuration = employee.serviceDuration;
  const currentStatus = employee.status ?? 'active';
  const lastLeave = employee.lastLeave;

  return (
    <div className="p-4 md:p-6 bg-background font-body print:p-0 printable-content" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-4 bg-card p-0 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:bg-transparent">
        {branding?.letterhead_image_url && (
          <img src={branding.letterhead_image_url} alt="Letterhead" className="w-full h-auto" />
        )}
        <div className="p-6 md:p-8">
            <header className="flex justify-between items-start pb-4 border-b">
                <div className="w-full">
                    <div className='flex items-center gap-4'>
                        <Logo className="h-16 w-16 !p-3 print:hidden" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-bold font-headline print:text-xl">{branding?.company_name ?? 'ملف الموظف الشامل'}</h1>
                            <p className="text-muted-foreground print:text-sm">{branding?.letterhead_text ?? 'Nova ERP'}</p>
                        </div>
                    </div>
                    <div className="text-left text-xs text-muted-foreground mt-4">
                        <p>تاريخ التقرير: {formatDate(reportDate.toISOString())}</p>
                        {currentDate && <p className="print:hidden">تاريخ الطباعة: {formatDate(currentDate)}</p>}
                    </div>
                </div>
            </header>

            <main className="space-y-4 pt-8">
                <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                    <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                    <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoItem label="الرقم المدني" value={employee.civilId} />
                    <InfoItem label="تاريخ الميلاد" value={formatDate(employee.dob)} />
                    <InfoItem label="النوع" value={employee.gender === 'male' ? 'ذكر' : employee.gender === 'female' ? 'أنثى' : '-'} />
                    <InfoItem label="حالة الموظف" value={<Badge className={statusColors[currentStatus]}>{statusTranslations[currentStatus] ?? 'غير معروف'}</Badge>} />
                </Section>
                
                <Section title="معلومات الاتصال" icon={<Phone />}>
                    <InfoItem label="رقم الجوال" value={employee.mobile} />
                    <InfoItem label="رقم الطوارئ" value={employee.emergencyContact} />
                    <InfoItem label="البريد الإلكتروني" value={employee.email} />
                </Section>
                
                <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                    <InfoItem label="القسم" value={employee.department} />
                    <InfoItem label="المسمى الوظيفي" value={employee.jobTitle} />
                    <InfoItem label="تاريخ التعيين" value={formatDate(employee.hireDate)} />
                    <InfoItem label="نوع العقد" value={employee.contractType} />
                    {employee.contractType !== 'permanent' && <InfoItem label="انتهاء العقد" value={formatDate(employee.contractExpiry)} />}
                    {employee.nationality !== 'كويتي' && <InfoItem label="انتهاء الإقامة" value={formatDate(employee.residencyExpiry)} />}
                </Section>

                <Section title="البيانات المالية" icon={<Wallet />}>
                    <InfoItem label="الراتب الأساسي" value={formatCurrency(employee.basicSalary || 0)} />
                    <InfoItem label="بدل السكن" value={formatCurrency(employee.housingAllowance || 0)} />
                    <InfoItem label="بدل النقل" value={formatCurrency(employee.transportAllowance || 0)} />
                    <InfoItem label="الإجمالي" value={formatCurrency((employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0))} className="font-bold border-t pt-2" />
                </Section>

                {employee.auditLogs && employee.auditLogs.length > 0 && (
                    <div className="border rounded-lg p-4 print:border-none print:p-2 page-break-before">
                        <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2"><History />السجل الزمني للتغييرات</h3>
                        <div className='space-y-2 max-h-48 overflow-y-auto'>
                            {employee.auditLogs.map((log: any, index: number) => (
                                <div key={log.id || index} className="text-xs p-2 rounded-md bg-muted/50">
                                    <span className="font-semibold text-primary">{formatDate(log.effectiveDate)}</span>: 
                                    تغيير في <span className='font-semibold'>"{log.field}"</span> من <span className='font-mono text-muted-foreground'>{String(log.oldValue ?? '-')}</span> إلى <span className='font-mono'>{String(log.newValue ?? '-')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <Section title="حالة الإجازات" icon={<Calendar />}>
                    <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                        <p className="text-muted-foreground">رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                        <p className="text-2xl font-bold text-primary">{(employee.leaveBalance ?? 0).toFixed(0)} يوم</p>
                    </div>
                    {lastLeave && (
                        <div className='md:col-span-2 border-t pt-4'>
                            <p className='font-semibold mb-2'>آخر عودة من إجازة:</p>
                            <InfoItem label="نوع الإجازة" value={typeTranslations[lastLeave.leaveType] || lastLeave.leaveType} />
                            <InfoItem label="تاريخ العودة الفعلي" value={formatDate(lastLeave.actualReturnDate)} />
                            <InfoItem label="عدد الأيام" value={`${lastLeave.workingDays ?? lastLeave.days ?? 0} أيام`} />
                        </div>
                    )}
                </Section>

                <Section title="استحقاق نهاية الخدمة" icon={<Gift />}>
                    <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                        {serviceDuration && (
                             <InfoItem label="مدة الخدمة حتى تاريخ التقرير" value={`${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`} />
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                            <span className="text-muted-foreground">قيمة نهاية الخدمة المستحقة:</span>
                            <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(employee.eosb || 0)}</span>
                        </div>
                    </div>
                </Section>
            </main>
        </div>
      </div>
    </div>
  );
}
