'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, getDocs, collection, query, where } from 'firebase/firestore';
import type { LeaveRequest, Employee, Holiday } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Printer, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { Logo } from '@/components/layout/logo';

const typeTranslations: Record<string, string> = {
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون راتب',
};

const statusTranslations: Record<string, string> = {
    'pending': 'معلقة',
    'approved': 'مقبولة',
    'rejected': 'مرفوضة',
};

function InfoRow({ label, value }: { label: string, value?: string | number | null }) {
    return (
        <div className="flex items-baseline border-b py-2">
            <span className="w-48 font-semibold text-gray-600 dark:text-gray-400">{label}:</span>
            <span className="flex-1 text-gray-800 dark:text-gray-200">{value || '---'}</span>
        </div>
    );
}

export default function LeaveRequestPrintPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { branding, loading: brandingLoading } = useBranding();

    const requestRef = useMemo(() => firestore && id ? doc(firestore, 'leaveRequests', id) : null, [firestore, id]);
    const { data: leaveRequest, loading: requestLoading } = useDocument<LeaveRequest>(firestore, requestRef?.path || null);

    const employeeRef = useMemo(() => {
        if (!firestore || !leaveRequest?.employeeId) return null;
        return doc(firestore, 'employees', leaveRequest.employeeId);
    }, [firestore, leaveRequest]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);

    const loading = requestLoading || employeeLoading || brandingLoading;

    const handlePrint = () => window.print();

    const leaveBalanceDetails = useMemo(() => {
        if (!employee || !leaveRequest || leaveRequest.leaveType !== 'Annual') return null;

        const asOfDate = toFirestoreDate(leaveRequest.startDate) || new Date();
        
        // To get the balance *before* this request, we calculate it up to the start date
        // and if the request was already approved, we add back its days.
        let balanceBeforeRequest = calculateAnnualLeaveBalance(employee, asOfDate);
        if (leaveRequest.status === 'approved' && leaveRequest.workingDays) {
            balanceBeforeRequest += leaveRequest.workingDays;
        }

        const requestedDays = leaveRequest.workingDays || 0;
        const deductedFromBalance = Math.min(balanceBeforeRequest, requestedDays);
        const unpaidDays = Math.max(0, requestedDays - balanceBeforeRequest);
        const balanceAfterRequest = balanceBeforeRequest - deductedFromBalance;

        return {
            balanceBeforeRequest: Math.floor(balanceBeforeRequest),
            requestedDays,
            deductedFromBalance,
            unpaidDays,
            balanceAfterRequest: Math.floor(balanceAfterRequest),
        };
    }, [employee, leaveRequest]);

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto bg-white space-y-8" dir="rtl">
                <header className="flex justify-between items-center pb-4 border-b">
                    <Skeleton className="h-20 w-1/3" />
                    <Skeleton className="h-20 w-1/4" />
                </header>
                <main className="space-y-8 mt-8">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-32 w-full" />
                </main>
            </div>
        );
    }
    
    if (!leaveRequest || !employee) {
        return <div className="text-center p-10">لم يتم العثور على الطلب أو الموظف.</div>
    }

    const startDate = toFirestoreDate(leaveRequest.startDate);
    const endDate = toFirestoreDate(leaveRequest.endDate);

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg print:shadow-none print:border-none">
                <div id="printable-area" className="printable-content">
                    {branding?.letterhead_image_url && (
                        <img 
                            src={branding.letterhead_image_url} 
                            alt="Letterhead"
                            className="w-full h-auto block"
                        />
                    )}
                    <div className="p-8 md:p-12">
                        <header className="pb-4 mb-8">
                            <div className="flex justify-between items-start">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">نموذج طلب إجازة</h2>
                                    <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Leave Request Form</p>
                                </div>
                                <div className="flex items-center gap-4">
                                   <Logo className="h-20 w-20 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                    <div>
                                       <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                                       <p className="text-sm text-muted-foreground">{branding?.nameEn}</p>
                                    </div>
                                </div>
                            </div>
                        </header>

                        <main className="space-y-8">
                            <section>
                                <h3 className="font-bold text-lg border-b mb-4 pb-2">بيانات الموظف</h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-base">
                                    <InfoRow label="الاسم" value={employee.fullName} />
                                    <InfoRow label="الرقم الوظيفي" value={employee.employeeNumber} />
                                    <InfoRow label="القسم" value={employee.department} />
                                    <InfoRow label="المسمى الوظيفي" value={employee.jobTitle} />
                                </div>
                            </section>

                             <section>
                                <h3 className="font-bold text-lg border-b mb-4 pb-2">تفاصيل الإجازة</h3>
                                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-base">
                                    <InfoRow label="نوع الإجازة" value={typeTranslations[leaveRequest.leaveType] || leaveRequest.leaveType} />
                                    <InfoRow label="حالة الطلب" value={statusTranslations[leaveRequest.status] || leaveRequest.status} />
                                    <InfoRow label="من تاريخ" value={startDate ? format(startDate, 'yyyy/MM/dd') : '-'} />
                                    <InfoRow label="إلى تاريخ" value={endDate ? format(endDate, 'yyyy/MM/dd') : '-'} />
                                    <InfoRow label="مجموع أيام الإجازة" value={`${leaveRequest.days} أيام`} />
                                    <InfoRow label="أيام العمل الفعلية" value={`${leaveRequest.workingDays} أيام`} />
                                     <div className="col-span-2">
                                        <InfoRow label="السبب / ملاحظات" value={leaveRequest.notes} />
                                     </div>
                                </div>
                            </section>
                            
                            {leaveBalanceDetails && (
                                <section>
                                    <h3 className="font-bold text-lg border-b mb-4 pb-2">تفاصيل الخصم من الرصيد</h3>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-base bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                        <InfoRow label="الرصيد السنوي قبل الطلب" value={`${leaveBalanceDetails.balanceBeforeRequest} يوم`} />
                                        <InfoRow label="أيام العمل المطلوبة" value={`${leaveBalanceDetails.requestedDays} يوم`} />
                                        <InfoRow label="الأيام المخصومة من الرصيد" value={`${leaveBalanceDetails.deductedFromBalance} يوم`} />
                                        <InfoRow label="أيام بدون راتب" value={`${leaveBalanceDetails.unpaidDays} يوم`} />
                                        <div className="col-span-2 pt-2 border-t mt-2">
                                            <InfoRow label="الرصيد المتبقي المتوقع" value={`${leaveBalanceDetails.balanceAfterRequest} يوم`} />
                                        </div>
                                    </div>
                                </section>
                            )}
                            
                            <footer className="pt-24">
                                <div className="grid grid-cols-3 gap-8">
                                    <div className="text-center">
                                        <div className="border-t-2 pt-2">
                                            <p className="font-semibold">توقيع الموظف</p>
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t-2 pt-2">
                                            <p className="font-semibold">مدير الموارد البشرية</p>
                                        </div>
                                    </div>
                                     <div className="text-center">
                                        <div className="border-t-2 pt-2">
                                            <p className="font-semibold">المدير العام</p>
                                        </div>
                                    </div>
                                </div>
                            </footer>
                        </main>
                    </div>
                </div>
                <div className="p-6 bg-muted/50 rounded-b-lg flex justify-end gap-2 no-print">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        عودة
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة
                    </Button>
                </div>
            </div>
        </div>
    );
}
