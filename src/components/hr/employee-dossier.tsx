
'use client';

import React from 'react';
import type { Employee, AuditLog } from '@/lib/types';
import { format, intervalToDuration } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Banknote, Briefcase, Calendar, Contact, FileText, Gift, Home, User, Wallet, UserCheck, Phone, Mail, History } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

interface DossierProps {
  employee: Partial<Employee>;
  reportDate: Date;
}

const toDate = (timestampOrString: any): Date | null => {
  if (!timestampOrString) return null;
  const date = timestampOrString.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date | null | undefined, fallback = '-') => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat('ar-KW', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
};

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4">
            <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2">
                {icon}
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {children}
            </div>
        </div>
    );
}

function InfoItem({ label, value, className = '' }: { label: string, value: React.ReactNode | string | number | null | undefined, className?: string }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className={`flex justify-between items-center ${className}`}>
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-semibold text-right">{value || '-'}</span>
        </div>
    );
}


export function EmployeeDossier({ employee, reportDate }: DossierProps) {
  const hireDate = toDate(employee.hireDate);
  const serviceDuration = hireDate ? employee.serviceDuration : null;
  const totalSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

  return (
    <div className="p-4 md:p-8 bg-background font-body print:p-0" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-6 bg-card p-6 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:p-0">
            {/* Header */}
            <header className="flex justify-between items-start pb-4 border-b">
                <div className='flex items-center gap-4'>
                    <Logo className="h-16 w-16 !p-3 print:hidden" />
                    <div>
                        <h1 className="text-2xl font-bold font-headline">ملف الموظف الشامل</h1>
                        <p className="text-muted-foreground">EmaratiScope Engineering</p>
                    </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                    <p>تاريخ التقرير: {formatDate(reportDate)}</p>
                    <p className="print:hidden">تاريخ الطباعة: {formatDate(new Date())}</p>
                </div>
            </header>

            <main className="space-y-6">
                 <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                    <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                    <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoItem label="الرقم المدني" value={employee.civilId} />
                    <InfoItem label="تاريخ الميلاد" value={formatDate(toDate(employee.dob))} />
                    {/*<InfoItem label="الجنسية" value={employee.nationality} />*/}
                    <InfoItem label="النوع" value={employee.gender === 'male' ? 'ذكر' : 'أنثى'} />
                </Section>
                
                 <Section title="معلومات الاتصال" icon={<Phone />}>
                    <InfoItem label="رقم الجوال" value={employee.mobile} />
                    <InfoItem label="رقم الطوارئ" value={employee.emergencyContact} />
                    <InfoItem label="البريد الإلكتروني" value={employee.email} className="md:col-span-2" />
                    <InfoItem label="IBAN" value={employee.iban} className="md:col-span-2" />
                </Section>
                
                <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                    <InfoItem label="القسم" value={employee.department} />
                    <InfoItem label="المسمى الوظيفي" value={employee.jobTitle} />
                    <InfoItem label="المنصب" value={employee.position} />
                    <InfoItem label="حالة الموظف" value={<Badge variant={employee.status === 'active' ? 'default' : 'secondary'} className={employee.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{employee.status === 'active' ? 'نشط' : 'غير نشط'}</Badge>} />
                    <InfoItem label="نوع العقد" value={employee.contractType} />
                    <InfoItem label="تاريخ التعيين" value={formatDate(hireDate)} />
                    <InfoItem label="نوع الإقامة" value={employee.visaType} />
                    <InfoItem label="تاريخ انتهاء الإقامة" value={formatDate(toDate(employee.residencyExpiry))} />
                </Section>

                <Section title="البيانات المالية" icon={<Wallet />}>
                    <InfoItem label="الراتب الأساسي" value={formatCurrency(employee.basicSalary || 0)} />
                    <InfoItem label="بدل السكن" value={formatCurrency(employee.housingAllowance || 0)} />
                    <InfoItem label="بدل النقل" value={formatCurrency(employee.transportAllowance || 0)} />
                    <InfoItem label="إجمالي الراتب" value={formatCurrency(totalSalary)} className="font-bold border-t pt-2" />
                    <InfoItem label="طريقة دفع الراتب" value={employee.salaryPaymentType} />
                    <InfoItem label="اسم البنك" value={employee.bankName} />
                </Section>

                 {employee.auditLogs && employee.auditLogs.length > 0 && (
                     <Section title="السجل الزمني للتغييرات" icon={<History />}>
                        <div className='md:col-span-2 space-y-3'>
                            {employee.auditLogs.map((log: any, index: number) => (
                                <div key={log.id || index} className="text-xs p-2 rounded-md bg-muted/50">
                                    <span className="font-semibold text-primary">{formatDate(toDate(log.effectiveDate))}</span>: 
                                    تغيير في <span className='font-semibold'>"{log.field}"</span> من <span className='font-mono text-muted-foreground'>{log.oldValue !== null ? String(log.oldValue) : '-'}</span> إلى <span className='font-mono'>{log.newValue !== null ? String(log.newValue) : '-'}</span>
                                    {log.changeType === 'Creation' && <span>(إنشاء ملف)</span>}
                                </div>
                            ))}
                        </div>
                    </Section>
                 )}


                 <Section title="حالة الإجازات" icon={<Calendar />}>
                     <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                        <p className="text-muted-foreground">رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                        <p className="text-2xl font-bold text-primary">{employee.leaveBalance?.toFixed(0) ?? 0} يوم</p>
                    </div>

                    {employee.lastLeave && (
                        <div className='md:col-span-2 border-t pt-4'>
                            <p className='font-semibold mb-2'>آخر عودة من إجازة:</p>
                             <InfoItem label="نوع الإجازة" value={(employee.lastLeave as any).leaveType} />
                             <InfoItem label="تاريخ العودة الفعلي" value={formatDate(toDate((employee.lastLeave as any).actualReturnDate))} />
                        </div>
                    )}
                </Section>

                <Section title="استحقاق نهاية الخدمة" icon={<Gift />}>
                     <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                        {serviceDuration && (
                             <InfoItem label="مدة الخدمة حتى تاريخ التقرير" value={`${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`} />
                        )}
                        <Separator className='my-2 bg-blue-200 dark:bg-blue-800'/>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-muted-foreground">قيمة نهاية الخدمة المستحقة:</span>
                            <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(employee.eosb || 0)}</span>
                        </div>
                    </div>
                     <p className="text-xs text-muted-foreground md:col-span-2">
                        * تم الحساب وفقًا للمادة 44 من قانون العمل الكويتي رقم 6 لسنة 2010. هذا تقدير تقريبي بناءً على البيانات المسجلة حتى تاريخ التقرير.
                    </p>
                </Section>
            </main>

            <footer className="text-center pt-4 mt-4 border-t print:mt-8">
                <p className="text-xs text-muted-foreground">هذا التقرير تم إنشاؤه بواسطة نظام EmaratiScope. جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
            </footer>
        </div>
    </div>
  );
}

    