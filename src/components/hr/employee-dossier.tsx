
'use client';

import React, { useState, useEffect } from 'react';
import type { Employee, AuditLog } from '@/lib/types';
import { format, intervalToDuration } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Banknote, Briefcase, Calendar, Contact, FileText, Gift, Home, User, Wallet, UserCheck, Phone, Mail, History } from 'lucide-react';
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
  // fromFirestoreDate returns yyyy-MM-dd, so we reformat to dd/MM/yyyy
  try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
  } catch(e) {
      return dateStr; // fallback to original string if split fails
  }
};


function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4 print:border-none print:p-2">
            <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2 print:text-base print:mb-2">
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
        <div className={`flex justify-between items-center py-1 print:py-0.5 ${className}`}>
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-semibold text-right">{value || '-'}</span>
        </div>
    );
}


export function EmployeeDossier({ employee, reportDate }: DossierProps) {
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const { branding } = useBranding();

  useEffect(() => {
    // Set the date on the client side to avoid hydration mismatch.
    setCurrentDate(new Date());
  }, []);
  
  const hireDate = fromFirestoreDate(employee.hireDate) ? new Date(fromFirestoreDate(employee.hireDate)) : null;
  const serviceDuration = employee.serviceDuration;
  const totalSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

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
  
  const currentStatus = employee.status || 'active';
  const toDate = (val: any) => val ? new Date(val) : null;


  return (
    <div className="p-4 md:p-6 bg-background font-body print:p-0 printable-content" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-4 bg-card p-0 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:bg-transparent">
            {branding?.letterhead_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                    src={branding.letterhead_image_url} 
                    alt="Letterhead"
                    className="w-full h-auto"
                />
            )}
            <div className="p-6 md:p-8">
                {/* Header */}
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
                            {currentDate && <p className="print:hidden">تاريخ الطباعة: {formatDate(currentDate)}</p>}
                        </div>
                    </div>
                </header>

                <main className="space-y-4 pt-8">
                    <Section title="المعلومات الشخصية والأساسية" icon={<User />}>
                        <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                        <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                        <InfoItem label="الرقم المدني" value={employee.civilId} />
                        <InfoItem label="تاريخ الميلاد" value={formatDate(toDate(employee.dob))} />
                        <InfoItem label="النوع" value={employee.gender === 'male' ? 'ذكر' : 'أنثى'} />
                        <InfoItem 
                            label="حالة الموظف" 
                            value={<Badge className={statusColors[currentStatus]}>{statusTranslations[currentStatus] || 'غير معروف'}</Badge>} 
                        />
                    </Section>
                    
                    <Section title="معلومات الاتصال" icon={<Phone />}>
                        <InfoItem label="رقم الجوال" value={employee.mobile} />
                        <InfoItem label="رقم الطوارئ" value={employee.emergencyContact} />
                        <InfoItem label="البريد الإلكتروني" value={employee.email} className="md:col-span-2" />
                    </Section>
                    
                    <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                        <InfoItem label="القسم" value={employee.department} />
                        <InfoItem label="المسمى الوظيفي" value={employee.jobTitle} />
                        <InfoItem label="المنصب" value={employee.position} />
                        <InfoItem label="تاريخ التعيين" value={formatDate(hireDate)} />
                        <InfoItem label="نوع العقد" value={employee.contractType} />
                        <InfoItem label="تاريخ انتهاء العقد" value={formatDate(toDate(employee.contractExpiry))} />
                        <InfoItem label="الجنسية" value={employee.nationality} />
                        {employee.nationality !== 'كويتي' && <InfoItem label="تاريخ انتهاء الإقامة" value={formatDate(toDate(employee.residencyExpiry))} />}
                        {employee.status === 'terminated' && (
                            <>
                            <InfoItem label="تاريخ إنهاء الخدمة" value={formatDate(toDate(employee.terminationDate))} />
                            <InfoItem label="سبب إنهاء الخدمة" value={employee.terminationReason === 'resignation' ? 'استقالة' : 'إنهاء من صاحب العمل'} />
                            </>
                        )}
                    </Section>

                    <Section title="البيانات المالية" icon={<Wallet />}>
                        <InfoItem label="الراتب الأساسي" value={formatCurrency(employee.basicSalary || 0)} />
                        <InfoItem label="بدل السكن" value={formatCurrency(employee.housingAllowance || 0)} />
                        <InfoItem label="بدل النقل" value={formatCurrency(employee.transportAllowance || 0)} />
                        <InfoItem label="الإجمالي" value={formatCurrency((employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0))} className="font-bold border-t pt-2" />
                        <Separator className='md:col-span-2 my-1' />
                        <InfoItem label="طريقة دفع الراتب" value={employee.salaryPaymentType} />
                        {employee.salaryPaymentType === 'transfer' && (
                            <>
                                <InfoItem label="اسم البنك" value={employee.bankName} />
                                <InfoItem label="IBAN" value={employee.iban} className="md:col-span-2" />
                            </>
                        )}
                    </Section>

                    {employee.auditLogs && employee.auditLogs.length > 0 && (
                        <Section title="السجل الزمني للتغييرات" icon={<History />}>
                            <div className='md:col-span-2 space-y-2'>
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
                            <Separator className='my-2 bg-blue-200 dark:bg-blue-700'/>
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
                    <p className="text-xs text-muted-foreground">
                        هذا التقرير تم إنشاؤه بواسطة نظام {branding?.company_name || 'Nova ERP'}. جميع الحقوق محفوظة © {currentDate ? currentDate.getFullYear() : '...'}
                    </p>
                </footer>
            </div>
        </div>
    );
}
