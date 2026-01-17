'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import type { Employee, LeaveRequest, Holiday, AuditLog } from '@/lib/types';
import { collection, doc, getDoc, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { format, differenceInYears, eachDayOfInterval, isFriday, intervalToDuration } from 'date-fns';
import { Logo } from '../layout/logo';
import { formatCurrency } from '@/lib/utils';
import { AlertCircle, Banknote, Briefcase, Calendar, Contact, FileText, Gift, Home, User, Wallet } from 'lucide-react';
import { Button } from '../ui/button';

interface ReportProps {
  employeeId: string;
  reportDate: Date;
}

const toDate = (timestampOrString: any): Date | null => {
  if (!timestampOrString) return null;
  const date = timestampOrString.toDate ? timestampOrString.toDate() : new Date(timestampOrString);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (date: Date | null, fallback = '-') => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat('ar-KW', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    numberingSystem: 'latn',
  }).format(date);
};

// --- Data Reconstruction Logic ---
function findValueAsOf(logs: AuditLog[], field: string, asOfDate: Date, initialValue: any) {
    const relevantLog = logs
        .filter(log => (log.field === field || (Array.isArray(log.field) && log.field.includes(field))) && toDate(log.effectiveDate)! <= asOfDate)
        .sort((a, b) => toDate(b.effectiveDate)!.getTime() - toDate(a.effectiveDate)!.getTime())[0];
    
    if (relevantLog) {
         if (typeof initialValue === 'object' && initialValue !== null && !Array.isArray(initialValue)) {
            return relevantLog.newValue?.[field] ?? initialValue;
        }
        return relevantLog.newValue;
    }
    return initialValue;
}

function Section({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4">
            <h3 className="flex items-center gap-2 font-bold text-lg mb-4 text-primary border-b pb-2">
                {icon}
                {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {children}
            </div>
        </div>
    );
}

function InfoItem({ label, value, className = '' }: { label: string, value: string | number | null | undefined, className?: string }) {
    return (
        <div className={`flex justify-between items-center ${className}`}>
            <span className="text-muted-foreground">{label}:</span>
            <span className="font-semibold">{value || '-'}</span>
        </div>
    );
}


export function EmployeeSnapshotReport({ employeeId, reportDate }: ReportProps) {
  const firestore = useFirestore();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reportData, setReportData] = useState<Partial<Employee>>({});
  const [leaveData, setLeaveData] = useState({ balance: 0, lastReturn: null as LeaveRequest | null, upcoming: [] as LeaveRequest[] });
  const [eosb, setEosb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
      // Set date on client-side to avoid hydration mismatch
      setCurrentDate(new Date());
  }, []);

  useEffect(() => {
    if (!firestore || !employeeId) {
      setError('معلومات غير كافية لتوليد التقرير.');
      setLoading(false);
      return;
    }

    const generateReport = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Fetch all necessary data in parallel
        const empDocRef = doc(firestore, 'employees', employeeId);
        const [empSnap, auditLogsSnap, leaveRequestsSnap, holidaysSnap] = await Promise.all([
          getDoc(empDocRef),
          getDocs(query(collection(firestore, `employees/${employeeId}/auditLogs`))),
          getDocs(query(collection(firestore, 'leaveRequests'), where('employeeId', '==', employeeId))),
          getDocs(collection(firestore, 'holidays'))
        ]);

        if (!empSnap.exists()) {
          throw new Error('لم يتم العثور على الموظف.');
        }

        const baseEmployee = { id: empSnap.id, ...empSnap.data() } as Employee;
        setEmployee(baseEmployee);

        const auditLogs = auditLogsSnap.docs.map(d => d.data() as AuditLog);
        const allLeaveRequests = leaveRequestsSnap.docs.map(d => ({id: d.id, ...d.data()} as LeaveRequest));
        const holidays = new Set(holidaysSnap.docs.map(d => formatDate(toDate(d.data().date))));
        
        const hireDate = toDate(baseEmployee.hireDate);
        if (!hireDate) throw new Error('تاريخ التعيين غير صالح.');

        // 2. Reconstruct historical state
        const reconstructedState: Partial<Employee> = {
            jobTitle: findValueAsOf(auditLogs, 'jobTitle', reportDate, baseEmployee.jobTitle),
            department: findValueAsOf(auditLogs, 'department', reportDate, baseEmployee.department),
            position: findValueAsOf(auditLogs, 'position', reportDate, baseEmployee.position),
            basicSalary: findValueAsOf(auditLogs, 'basicSalary', reportDate, baseEmployee.basicSalary),
            housingAllowance: findValueAsOf(auditLogs, 'housingAllowance', reportDate, baseEmployee.housingAllowance),
            transportAllowance: findValueAsOf(auditLogs, 'transportAllowance', reportDate, baseEmployee.transportAllowance),
            residencyExpiry: findValueAsOf(auditLogs, 'residencyExpiry', reportDate, baseEmployee.residencyExpiry),
            contractExpiry: findValueAsOf(auditLogs, 'contractExpiry', reportDate, baseEmployee.contractExpiry),
        };
        setReportData(reconstructedState);

        // 3. Calculate Leave Balance
        const yearsOfService = differenceInYears(reportDate, hireDate);
        let leaveBalance = 0;
        if (yearsOfService >= 1) {
            const accruedDays = Math.floor(yearsOfService) * 30;
            const consumedLeaves = allLeaveRequests.filter(lr => lr.status === 'approved' && lr.leaveType === 'Annual' && toDate(lr.startDate)! <= reportDate);
            let consumedDays = 0;
            consumedLeaves.forEach(leave => {
                const leaveStart = toDate(leave.startDate)!;
                const leaveEnd = toDate(leave.endDate)! > reportDate ? reportDate : toDate(leave.endDate)!;
                if(leaveStart > leaveEnd) return;
                eachDayOfInterval({ start: leaveStart, end: leaveEnd }).forEach(day => {
                    if (!isFriday(day) && !holidays.has(formatDate(day))) {
                        consumedDays++;
                    }
                });
            });
            leaveBalance = accruedDays - consumedDays + (baseEmployee.carriedLeaveDays || 0);
        }
        
        const lastReturn = allLeaveRequests
            .filter(lr => lr.isBackFromLeave && toDate(lr.actualReturnDate)! <= reportDate)
            .sort((a,b) => toDate(b.actualReturnDate)!.getTime() - toDate(a.actualReturnDate)!.getTime())[0] || null;

        const upcoming = allLeaveRequests.filter(lr => lr.status === 'approved' && toDate(lr.startDate)! > reportDate);

        setLeaveData({ balance: leaveBalance, lastReturn, upcoming });

        // 4. Calculate EOSB
        const serviceDuration = intervalToDuration({ start: hireDate, end: reportDate });
        const serviceInYears = (reportDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        let calculatedEosb = 0;
        if (serviceInYears > 0 && reconstructedState.basicSalary && reconstructedState.basicSalary > 0) {
            if (serviceInYears <= 5) {
                calculatedEosb = (15 / 26) * reconstructedState.basicSalary * serviceInYears;
            } else {
                calculatedEosb += (15 / 26) * reconstructedState.basicSalary * 5;
                calculatedEosb += reconstructedState.basicSalary * (serviceInYears - 5);
            }
        }
        setEosb(calculatedEosb);


      } catch (e: any) {
        setError(e.message || 'حدث خطأ غير متوقع أثناء توليد التقرير.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [employeeId, reportDate, firestore]);

  if (loading || !employee) {
    return (
      <div className="p-8 space-y-6" dir="rtl">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-destructive" dir="rtl">
        <h2 className="text-xl font-bold">فشل إنشاء التقرير</h2>
        <p>{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">إعادة المحاولة</Button>
      </div>
    );
  }
  
  const hireDate = toDate(employee.hireDate);
  const serviceDuration = hireDate ? intervalToDuration({ start: hireDate, end: reportDate }) : null;

  return (
    <div className="p-4 md:p-8 bg-background font-body print:p-0" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-6 bg-card p-6 rounded-lg shadow-lg print:shadow-none print:rounded-none print:border-none print:p-0">
            {/* Header */}
            <header className="flex justify-between items-start pb-4 border-b">
                <div className='flex items-center gap-4'>
                    <Logo className="h-16 w-16 !p-3" />
                    <div>
                        <h1 className="text-2xl font-bold font-headline">بطاقة الموظف</h1>
                        <p className="text-muted-foreground">EmaratiScope Engineering</p>
                    </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                    <p>تاريخ التقرير: {formatDate(reportDate)}</p>
                    {currentDate && <p>تاريخ الطباعة: {formatDate(currentDate)}</p>}
                </div>
            </header>

            <main className="space-y-6">
                {/* Personal & Contact Info */}
                 <Section title="المعلومات الشخصية والاتصال" icon={<User />}>
                    <InfoItem label="الاسم بالعربية" value={employee.fullName} />
                    <InfoItem label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoItem label="الرقم المدني" value={employee.civilId} />
                    <InfoItem label="تاريخ الميلاد" value={formatDate(toDate(employee.dob))} />
                    {/*<InfoItem label="الجنسية" value={employee.nationality} />*/}
                    <InfoItem label="النوع" value={employee.gender === 'male' ? 'ذكر' : 'أنثى'} />
                    <InfoItem label="رقم الجوال" value={employee.mobile} />
                    <InfoItem label="رقم الطوارئ" value={employee.emergencyContact} />
                    <InfoItem label="البريد الإلكتروني" value={employee.email} />
                    <InfoItem label="IBAN" value={employee.iban} className="md:col-span-2" />
                </Section>
                
                {/* Job & Contract Info */}
                <Section title="البيانات الوظيفية والعقد" icon={<Briefcase />}>
                    <InfoItem label="القسم" value={reportData.department} />
                    <InfoItem label="المسمى الوظيفي" value={reportData.jobTitle} />
                    <InfoItem label="المنصب" value={reportData.position} />
                    <InfoItem label="حالة الموظف" value={employee.status === 'active' ? 'نشط' : employee.status === 'on-leave' ? 'في إجازة' : 'منتهية خدمته'} />
                    <InfoItem label="نوع العقد" value={employee.contractType} />
                    <InfoItem label="تاريخ التعيين" value={formatDate(hireDate)} />
                    <InfoItem label="نوع الإقامة" value={employee.visaType} />
                    <InfoItem label="تاريخ انتهاء الإقامة" value={formatDate(toDate(reportData.residencyExpiry))} />
                </Section>

                {/* Financial Info */}
                <Section title="البيانات المالية" icon={<Wallet />}>
                    <InfoItem label="الراتب الأساسي" value={formatCurrency(reportData.basicSalary || 0)} />
                    <InfoItem label="بدل السكن" value={formatCurrency(reportData.housingAllowance || 0)} />
                    <InfoItem label="بدل النقل" value={formatCurrency(reportData.transportAllowance || 0)} />
                    <InfoItem label="الإجمالي" value={formatCurrency((reportData.basicSalary || 0) + (reportData.housingAllowance || 0) + (reportData.transportAllowance || 0))} className="font-bold border-t pt-2" />
                    <InfoItem label="طريقة دفع الراتب" value={employee.salaryPaymentType} />
                    <InfoItem label="اسم البنك" value={employee.bankName} />
                </Section>

                 {/* Leave Status */}
                <Section title="حالة الإجازات" icon={<Calendar />}>
                     <div className="md:col-span-2 bg-muted/50 p-3 rounded-md text-center">
                        <p className="text-muted-foreground">رصيد الإجازات السنوية المتاح حتى تاريخ التقرير</p>
                        <p className="text-2xl font-bold text-primary">{leaveData.balance} يوم</p>
                    </div>

                    {leaveData.lastReturn && (
                        <div className='md:col-span-2 border-t pt-4'>
                            <p className='font-semibold mb-2'>آخر عودة من إجازة:</p>
                             <InfoItem label="نوع الإجازة" value={leaveData.lastReturn.leaveType} />
                             <InfoItem label="تاريخ العودة الفعلي" value={formatDate(toDate(leaveData.lastReturn.actualReturnDate))} />
                             <InfoItem label="عدد الأيام" value={`${leaveData.lastReturn.workingDays || leaveData.lastReturn.days} أيام`} />
                        </div>
                    )}
                     {leaveData.upcoming.length > 0 && (
                        <div className='md:col-span-2 border-t pt-4'>
                            <p className='font-semibold mb-2'>إجازات قادمة معتمدة:</p>
                            {leaveData.upcoming.map(leave => (
                                <div key={leave.id} className="text-xs text-muted-foreground">
                                    <p>من {formatDate(toDate(leave.startDate))} إلى {formatDate(toDate(leave.endDate))} ({leave.workingDays || leave.days} أيام)</p>
                                </div>
                            ))}
                        </div>
                    )}

                </Section>

                {/* EOSB */}
                <Section title="استحقاق نهاية الخدمة" icon={<Gift />}>
                     <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                        {serviceDuration && (
                             <InfoItem label="مدة الخدمة حتى تاريخ التقرير" value={`${serviceDuration.years || 0} سنة, ${serviceDuration.months || 0} شهر, ${serviceDuration.days || 0} يوم`} />
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                            <span className="text-muted-foreground">قيمة نهاية الخدمة المستحقة:</span>
                            <span className="font-bold text-lg text-blue-600 dark:text-blue-400">{formatCurrency(eosb)}</span>
                        </div>
                    </div>
                     <p className="text-xs text-muted-foreground md:col-span-2">
                        * محسوبة وفق المادة 44 من قانون العمل الكويتي رقم 6 لسنة 2010. هذا تقدير تقريبي ويعتمد على صحة البيانات المدخلة.
                    </p>
                </Section>
            </main>

            {/* Footer */}
            <footer className="text-center pt-4 mt-4 border-t">
                 <p className="text-xs text-muted-foreground">
                    هذا التقرير تم إنشاؤه بواسطة نظام EmaratiScope. جميع الحقوق محفوظة © {currentDate ? currentDate.getFullYear() : '...'}
                </p>
            </footer>
        </div>
    </div>
  );
}
