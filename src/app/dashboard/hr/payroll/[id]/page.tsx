'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Payslip, Employee } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Printer, ArrowRight } from 'lucide-react';
import { formatCurrency, numberToArabicWords } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';

const InfoRow = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex justify-between items-center py-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
    </div>
);

const AmountRow = ({ label, value, isDeduction = false }: { label: string, value: number, isDeduction?: boolean }) => (
     <div className="flex justify-between items-center py-1.5">
        <span>{label}</span>
        <span className={`font-mono ${isDeduction ? 'text-red-600' : ''}`}>
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

    const payslipRef = useMemo(() => firestore && id ? doc(firestore, 'payroll', id) : null, [firestore, id]);
    const { data: payslip, loading: payslipLoading } = useDocument<Payslip>(firestore, payslipRef?.path || null);
    
    const employeeRef = useMemo(() => firestore && payslip?.employeeId ? doc(firestore, 'employees', payslip.employeeId) : null, [firestore, payslip?.employeeId]);
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
        return <div className="max-w-2xl mx-auto p-8"><Skeleton className="h-[600px] w-full" /></div>;
    }
    
    if (!payslip || !employee) {
        return <div className="text-center p-10">تعذر تحميل كشف الراتب.</div>;
    }

    return (
        <div className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 print:p-0 print:bg-white" dir="rtl">
            <div className="max-w-2xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg print:shadow-none print:border-none">
                <div id="printable-area" className="p-8">
                     <header className="flex justify-between items-start pb-4 border-b-2">
                         <div className="text-right">
                             <h2 className="text-2xl font-bold">كشف راتب</h2>
                             <p className="text-muted-foreground">راتب شهر {payslip.month} / {payslip.year}</p>
                             <Badge variant="outline" className="mt-2 bg-primary/5 text-primary border-primary/20">
                                {payslip.type === 'Leave' ? 'راتب إجازة' : 'راتب شهري'}
                             </Badge>
                         </div>
                         <div className="flex items-center gap-4">
                            <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                             <div>
                                <h1 className="font-bold text-lg">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-sm text-muted-foreground">{branding?.address}</p>
                             </div>
                         </div>
                    </header>
                    <main className="py-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                           <InfoRow label="اسم الموظف" value={payslip.employeeName} />
                           <InfoRow label="الرقم الوظيفي" value={employee.employeeNumber} />
                           <InfoRow label="القسم" value={employee.department} />
                           <InfoRow label="المسمى الوظيفي" value={employee.jobTitle} />
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-2 p-4 border rounded-lg">
                                <h3 className="font-bold border-b pb-2 mb-2 text-primary flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> الاستحقاقات
                                </h3>
                                <AmountRow label="الراتب الأساسي" value={payslip.earnings.basicSalary} />
                                {payslip.earnings.housingAllowance > 0 && <AmountRow label="بدل السكن" value={payslip.earnings.housingAllowance} />}
                                {payslip.earnings.transportAllowance > 0 && <AmountRow label="بدل المواصلات" value={payslip.earnings.transportAllowance} />}
                                {payslip.earnings.commission > 0 && <AmountRow label="عمولات" value={payslip.earnings.commission} />}
                                <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                                    <span>إجمالي الاستحقاقات</span>
                                    <span className="font-mono">{formatCurrency(totalEarnings)}</span>
                                </div>
                            </div>
                            <div className="space-y-2 p-4 border rounded-lg bg-red-50/10">
                                <h3 className="font-bold border-b pb-2 mb-2 text-red-700 flex items-center gap-2">
                                    <Ban className="h-4 w-4" /> الاستقطاعات
                                </h3>
                                {payslip.deductions.absenceDeduction > 0 && (
                                    <AmountRow label="خصم غياب (أيام انقطاع)" value={payslip.deductions.absenceDeduction} isDeduction />
                                )}
                                {payslip.deductions.lateDeduction > 0 && (
                                    <AmountRow label="خصم تأخير (دقائق مخالفة)" value={payslip.deductions.lateDeduction} isDeduction />
                                )}
                                {payslip.deductions.otherDeductions > 0 && (
                                    <AmountRow label="خصومات أخرى" value={payslip.deductions.otherDeductions} isDeduction />
                                )}
                                <div className="border-t pt-2 mt-2 flex justify-between items-center font-bold">
                                    <span>إجمالي الاستقطاعات</span>
                                    <span className="font-mono">{formatCurrency(totalDeductions)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-primary/10 text-primary-foreground p-6 rounded-3xl text-center border-2 border-primary/20 shadow-inner">
                            <p className="font-black text-lg text-primary uppercase tracking-widest mb-1">صافي الراتب المستحق للصرف</p>
                            <p className="font-extrabold text-4xl text-primary font-mono tabular-nums">{formatCurrency(payslip.netSalary)}</p>
                            <p className="text-sm text-primary/80 mt-3 font-bold italic">{numberToArabicWords(payslip.netSalary)}</p>
                        </div>
                    </main>
                     <footer className="pt-16 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <p>هذا كشف راتب تم إنشاؤه آلياً بواسطة نظام Nova ERP ولا يتطلب توقيعاً يدوياً للاعتماد المحاسبي.</p>
                     </footer>
                </div>
                 <div className="p-6 bg-muted/50 rounded-b-lg flex justify-between items-center no-print">
                    <Button variant="outline" onClick={() => router.back()} className="rounded-xl font-bold">
                        <ArrowRight className="ml-2 h-4 w-4" />
                        العودة
                    </Button>
                    <Button onClick={handlePrint} className="rounded-xl font-black px-10 shadow-lg shadow-primary/20">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة الكشف
                    </Button>
                </div>
            </div>
        </div>
    );
}

import { CheckCircle2, Ban } from 'lucide-react';
