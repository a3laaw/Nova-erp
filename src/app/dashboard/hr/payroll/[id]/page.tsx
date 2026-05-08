'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Payslip, Employee } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight, CheckCircle2, Ban } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';

const InfoRow = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex justify-between items-center py-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-black text-slate-900">{value}</span>
    </div>
);

const AmountRow = ({ label, value, isDeduction = false }: { label: string, value: number, isDeduction?: boolean }) => (
     <div className="flex justify-between items-center py-1.5">
        <span className="font-bold text-slate-700">{label}</span>
        <span className={cn("font-mono font-black", isDeduction ? 'text-red-600' : 'text-slate-900')}>
             {isDeduction ? `(${formatCurrency(value)})` : formatCurrency(value)}
        </span>
    </div>
);

export default function PayslipPage() {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const payslipRef = useMemo(() => (firestore && id ? doc(firestore, 'payroll', id) : null), [firestore, id]);
    const { data: payslip, loading: payslipLoading } = useDocument<Payslip>(firestore, payslipRef?.path || null);
    
    const employeeRef = useMemo(() => (firestore && payslip?.employeeId ? doc(firestore, 'employees', payslip.employeeId) : null), [firestore, payslip?.employeeId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);
    
    const loading = payslipLoading || employeeLoading || brandingLoading;

    const totalEarnings = useMemo(() => {
        if (!payslip?.earnings) return 0;
        return Object.values(payslip.earnings).reduce((sum, val) => sum + (val || 0), 0);
    }, [payslip]);

    const totalDeductions = useMemo(() => {
        if (!payslip?.deductions) return 0;
        return Object.values(payslip.deductions).reduce((sum, val) => sum + (val || 0), 0);
    }, [payslip]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="max-w-2xl mx-auto p-8"><Skeleton className="h-[600px] w-full rounded-[2.5rem]" /></div>;
    }
    
    if (!payslip || !employee) {
        return <div className="text-center p-10 font-black">تعذر تحميل كشف الراتب السيادي.</div>;
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 print:p-0 print:bg-white" dir="rtl">
            <div className="max-w-2xl mx-auto bg-white dark:bg-card shadow-2xl rounded-[2.5rem] print:shadow-none print:border-none border overflow-hidden">
                <div id="printable-area" className="p-8 sm:p-12">
                     <header className="flex justify-between items-start pb-6 border-b-4 border-primary/20">
                         <div className="text-right">
                             <h2 className="text-3xl font-black text-slate-900 tracking-tighter">قسيمة راتب</h2>
                             <p className="text-muted-foreground font-bold">راتب شهر {payslip.month} / {payslip.year}</p>
                             <Badge variant="outline" className="mt-3 px-4 py-1 bg-primary/5 text-primary border-primary/20 font-black">
                                {payslip.type === 'Leave' ? 'راتب إجازة' : 'راتب شهري رسمي'}
                             </Badge>
                         </div>
                         <div className="flex items-center gap-4">
                            <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                             <div>
                                <h1 className="font-black text-xl text-slate-900">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-xs text-muted-foreground font-medium">{branding?.address}</p>
                             </div>
                         </div>
                    </header>
                    <main className="py-10 space-y-10">
                        <div className="grid grid-cols-2 gap-x-10 gap-y-4 p-6 bg-muted/20 rounded-3xl border border-dashed">
                           <InfoRow label="اسم الموظف" value={payslip.employeeName} />
                           <InfoRow label="الرقم الوظيفي" value={employee.employeeNumber} />
                           <InfoRow label="القسم الإداري" value={employee.department} />
                           <InfoRow label="المسمى الوظيفي" value={employee.jobTitle} />
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="space-y-4 p-6 border rounded-3xl bg-white shadow-sm">
                                <h3 className="font-black text-lg border-r-4 border-green-600 pr-3 mb-4 text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5" /> الاستحقاقات (Earnings)
                                </h3>
                                <AmountRow label="الراتب الأساسي" value={payslip.earnings.basicSalary} />
                                {payslip.earnings.housingAllowance > 0 && <AmountRow label="بدل السكن" value={payslip.earnings.housingAllowance} />}
                                {payslip.earnings.transportAllowance > 0 && <AmountRow label="بدل المواصلات" value={payslip.earnings.transportAllowance} />}
                                {payslip.earnings.commission > 0 && <AmountRow label="العمولات" value={payslip.earnings.commission} />}
                                <div className="border-t-2 border-dashed pt-4 mt-4 flex justify-between items-center font-black text-green-700">
                                    <span>إجمالي الاستحقاقات</span>
                                    <span className="font-mono text-xl">{formatCurrency(totalEarnings)}</span>
                                </div>
                            </div>
                            <div className="space-y-4 p-6 border rounded-3xl bg-white shadow-sm">
                                <h3 className="font-black text-lg border-r-4 border-red-600 pr-3 mb-4 text-red-700 flex items-center gap-2">
                                    <Ban className="h-5 w-5" /> الاستقطاعات (Deductions)
                                </h3>
                                {payslip.deductions.absenceDeduction > 0 && (
                                    <AmountRow label="خصم غياب (أيام)" value={payslip.deductions.absenceDeduction} isDeduction />
                                )}
                                {payslip.deductions.lateDeduction > 0 && (
                                    <AmountRow label="خصم تأخير (دقائق)" value={payslip.deductions.lateDeduction} isDeduction />
                                )}
                                {payslip.deductions.otherDeductions > 0 && (
                                    <AmountRow label="خصومات إدارية أخرى" value={payslip.deductions.otherDeductions} isDeduction />
                                )}
                                <div className="border-t-2 border-dashed pt-4 mt-4 flex justify-between items-center font-black text-red-700">
                                    <span>إجمالي الاستقطاعات</span>
                                    <span className="font-mono text-xl">{formatCurrency(totalDeductions)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary/5 p-8 rounded-[2.5rem] text-center border-4 border-primary/10 shadow-inner">
                            <p className="font-black text-lg text-primary uppercase tracking-widest mb-2">صافي الراتب المستحق للصرف</p>
                            <p className="font-black text-5xl text-primary font-mono tabular-nums tracking-tighter">{formatCurrency(payslip.netSalary)}</p>
                            <Separator className="my-4 bg-primary/10" />
                            <p className="text-sm text-slate-500 font-black italic">{numberToArabicWords(payslip.netSalary)}</p>
                        </div>
                    </main>
                     <footer className="pt-20 text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.4em]">
                        <p>Nova ERP Sovereign Payroll System — Generated Document</p>
                     </footer>
                </div>
                 <div className="p-8 bg-muted/10 rounded-b-[2.5rem] flex justify-between items-center no-print border-t">
                    <Button variant="ghost" onClick={() => router.back()} className="rounded-2xl font-black gap-2 h-12 text-slate-500">
                        <ArrowRight className="h-4 w-4" /> العودة
                    </Button>
                    <Button onClick={handlePrint} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3">
                        <Printer className="h-6 w-6" /> طباعة القسيمة الرسمية
                    </Button>
                </div>
            </div>
        </div>
    );
}