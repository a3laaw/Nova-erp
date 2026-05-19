'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc, updateDoc, Timestamp, serverTimestamp, writeBatch, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import type { LeaveRequest, Employee, Payslip, Account } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
    ArrowRight, 
    Printer, 
    Calendar, 
    User, 
    FileText, 
    CheckCircle, 
    XCircle, 
    Sparkles, 
    Clock, 
    PlaneTakeoff, 
    Home, 
    Briefcase, 
    Loader2, 
    Calculator, 
    FileCheck, 
    AlertCircle,
    Banknote,
    ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { cn, getTenantPath, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  'on-leave': 'bg-blue-100 text-blue-800 border-blue-200',
  'returned': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'تحت المراجعة',
  approved: 'موافق عليه (بانتظار المغادرة)',
  rejected: 'مرفوض',
  'on-leave': 'في إجازة حالياً',
  'returned': 'عاد للعمل',
};

const leaveTypeTranslations: Record<string, string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};

function InfoRow({ label, value, icon }: { label: string, value: string | React.ReactNode, icon: React.ReactNode }) {
    return (
        <div className="flex gap-4 text-sm">
            <div className="text-muted-foreground shrink-0">{icon}</div>
            <div className="font-semibold w-24 shrink-0">{label}:</div>
            <div className="break-words text-slate-900">{value}</div>
        </div>
    )
}

export default function LeaveRequestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    const tenantId = currentUser?.currentCompanyId;

    const [isProcessing, setIsProcessing] = useState(false);
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [actualDate, setActualDate] = useState<Date | undefined>(new Date());
    
    const [hasLeaveSalary, setHasLeaveSalary] = useState<boolean | null>(null);
    const [isCheckingSalary, setIsCheckingSalary] = useState(false);

    const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'HR' || currentUser?.role === 'Developer';

    const leavePath = useMemo(() => getTenantPath(`leaveRequests/${id}`, tenantId), [id, tenantId]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leavePath);
    
    const employeePath = useMemo(() => leaveRequest?.employeeId ? getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId) : null, [leaveRequest?.employeeId, tenantId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeePath);

    // ✨ ذكاء الرقابة: فحص وجود قيد راتب إجازة عند العودة
    useEffect(() => {
        if (!leaveRequest || !firestore || !tenantId || leaveRequest.status !== 'on-leave') return;

        const checkLeaveSalary = async () => {
            setIsCheckingSalary(true);
            try {
                const payrollPath = getTenantPath('payroll', tenantId);
                const q = query(
                    collection(firestore, payrollPath),
                    where('employeeId', '==', leaveRequest.employeeId),
                    where('type', '==', 'Leave'),
                    where('status', '==', 'paid')
                );
                const snap = await getDocs(q);
                setHasLeaveSalary(!snap.empty);
            } catch (e) {
                console.error("Salary check failed:", e);
            } finally {
                setIsCheckingSalary(false);
            }
        };
        checkLeaveSalary();
    }, [leaveRequest, firestore, tenantId]);

    const handleStartLeave = async () => {
        if (!leaveRequest || !firestore || !actualDate || !tenantId) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const reqPath = getTenantPath(`leaveRequests/${leaveRequest.id}`, tenantId);
            const empPath = getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId);

            batch.update(doc(firestore, reqPath), { status: 'on-leave', actualStartDate: Timestamp.fromDate(actualDate) });
            batch.update(doc(firestore, empPath), { status: 'on-leave' });
            await batch.commit();
            toast({ title: '✅ تم توثيق المغادرة' });
            setIsStartDialogOpen(false);
        } catch (e) { setIsProcessing(false); }
    };

    const handleReturnToWork = async (withSalaryGen: boolean = false) => {
        if (!leaveRequest || !employee || !firestore || !actualDate || !tenantId) return;
        setIsProcessing(true);
        
        try {
            const batch = writeBatch(firestore);
            const reqPath = getTenantPath(`leaveRequests/${leaveRequest.id}`, tenantId);
            const empPath = getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId);

            // 1. تحديث الحالة الوظيفية
            batch.update(doc(firestore, reqPath), { status: 'returned', actualReturnDate: Timestamp.fromDate(actualDate) });
            batch.update(doc(firestore, empPath), { status: 'active' });

            // 2. إذا طلب المستخدم توليد راتب الإجازة آلياً
            if (withSalaryGen) {
                const payrollPath = getTenantPath('payroll', tenantId);
                const jePath = getTenantPath('journalEntries', tenantId);
                const dailyRate = (employee.basicSalary + (employee.housingAllowance || 0) + (employee.transportAllowance || 0)) / 26;
                const totalLeavePay = dailyRate * leaveRequest.workingDays;

                const newPayrollRef = doc(collection(firestore, payrollPath));
                batch.set(newPayrollRef, cleanFirestoreData({
                    employeeId: employee.id,
                    employeeName: employee.fullName,
                    year: actualDate.getFullYear(),
                    month: actualDate.getMonth() + 1,
                    type: 'Leave',
                    netSalary: totalLeavePay,
                    earnings: { basicSalary: totalLeavePay, housingAllowance: 0, transportAllowance: 0 },
                    status: 'paid',
                    paidAt: serverTimestamp(),
                    companyId: tenantId
                }));

                const newJeRef = doc(collection(firestore, jePath));
                batch.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JV-LVE-${leaveRequest.id?.substring(0,4)}`,
                    date: serverTimestamp(),
                    narration: `إثبات وصرف راتب إجازة دورية للموظف: ${employee.fullName}`,
                    status: 'posted',
                    totalDebit: totalLeavePay,
                    totalCredit: totalLeavePay,
                    lines: [
                        { accountId: '5201', accountName: 'مصروف رواتب', debit: totalLeavePay, credit: 0 },
                        { accountId: '110102', accountName: 'البنك', debit: 0, credit: totalLeavePay }
                    ],
                    companyId: tenantId
                }));
            }

            await batch.commit();
            toast({ title: '✅ تمت المباشرة والعودة' });
            setIsReturnDialogOpen(false);
        } catch (e) { 
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ في معالجة العودة' });
        } finally { 
            setIsProcessing(false); 
        }
    };

    if (leaveLoading || employeeLoading || brandingLoading) return <div className="p-8 max-w-4xl mx-auto" dir="rtl"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
    if (!leaveRequest || !employee) return <div className="text-center p-10" dir="rtl">تعذر تحميل تفاصيل طلب الإجازة.</div>;

    const startDate = toFirestoreDate(leaveRequest.startDate);
    const endDate = toFirestoreDate(leaveRequest.endDate);

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20" dir="rtl">
            <div className="no-print flex justify-between items-center bg-white/60 backdrop-blur-md p-4 rounded-[2rem] border-2 border-white/80 shadow-sm mb-4">
                 <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2 rounded-xl">
                    <ArrowRight className="h-4 w-4"/> العودة للقائمة
                </Button>
                <div className="flex gap-3">
                    {isAdmin && (
                        <>
                            {leaveRequest.status === 'approved' && (
                                <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.startDate) || new Date()); setIsStartDialogOpen(true); }} className="bg-blue-600 font-black gap-2 rounded-xl text-white shadow-lg">
                                    <PlaneTakeoff className="h-4 w-4"/> تسجيل المغادرة
                                </Button>
                            )}
                            {leaveRequest.status === 'on-leave' && (
                                <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.endDate) || new Date()); setIsReturnDialogOpen(true); }} className="bg-indigo-600 font-black gap-2 rounded-xl text-white shadow-lg">
                                    <Home className="h-4 w-4"/> إشعار مباشرة العمل
                                </Button>
                            )}
                        </>
                    )}
                    <Button onClick={() => window.print()} variant="outline" className="rounded-xl font-bold gap-2 border-2"><Printer className="h-4 w-4"/> طباعة</Button>
                </div>
            </div>

            <Card className="rounded-[3rem] shadow-2xl border-none overflow-hidden bg-white p-12">
                <header className="flex justify-between items-start pb-8 border-b-4 border-primary/20">
                    <div className="flex items-center gap-6">
                        <Logo className="h-24 w-24 !p-4 shadow-inner border rounded-3xl" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div className="space-y-1">
                            <h1 className="text-3xl font-black text-slate-900">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground font-bold">{branding?.address}</p>
                        </div>
                    </div>
                    <div className="text-left space-y-2">
                        <h2 className="text-3xl font-black text-primary tracking-tighter">طلب إجازة رسمي</h2>
                        <div className="pt-2">
                            <Badge variant="outline" className={cn("px-6 py-1.5 border-2 font-black text-sm rounded-full", statusColors[leaveRequest.status])}>
                                {statusTranslations[leaveRequest.status]}
                            </Badge>
                        </div>
                    </div>
                </header>

                <main className="py-12 space-y-12">
                    {(leaveRequest.status === 'rejected' || leaveRequest.status === 'approved' || leaveRequest.adminComment) && (
                        <Alert 
                            variant={leaveRequest.status === 'rejected' ? 'destructive' : 'default'} 
                            className={cn(
                                "rounded-[2rem] border-2 shadow-xl p-8 animate-in zoom-in-95 duration-500",
                                leaveRequest.status === 'rejected' ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                            )}
                        >
                            {leaveRequest.status === 'rejected' ? <XCircle className="h-8 w-8 text-red-600" /> : <CheckCircle className="h-8 w-8 text-green-600" />}
                            <AlertTitle className="text-xl font-black mb-4">قرار الإدارة</AlertTitle>
                            <AlertDescription className="text-lg leading-relaxed font-bold border-t-2 border-dashed pt-4 mt-2">
                                {leaveRequest.adminComment || (leaveRequest.status === 'approved' ? 'تمت الموافقة، نتمنى لك إجازة سعيدة.' : 'بانتظار القرار.')}
                            </AlertDescription>
                        </Alert>
                    )}

                    <section className="grid grid-cols-2 gap-10 bg-muted/20 p-10 rounded-[2.5rem] border-2 border-dashed border-primary/10 shadow-inner">
                        <div className="space-y-6">
                            <InfoRow label="اسم الموظف" value={<span className="font-black text-xl text-slate-900">{leaveRequest.employeeName}</span>} icon={<User className="h-5 w-5 text-primary opacity-40"/>}/>
                            <InfoRow label="الرقم الوظيفي" value={<span className="font-mono font-black text-primary">{employee.employeeNumber}</span>} icon={<FileCheck className="h-5 w-5 text-primary opacity-40"/>}/>
                        </div>
                        <div className="space-y-6">
                            <InfoRow label="القسم الإداري" value={<span className="font-black">{employee.department}</span>} icon={<Briefcase className="h-5 w-5 text-primary opacity-40"/>}/>
                            <InfoRow label="المسمى الوظيفي" value={<span className="font-black">{employee.jobTitle}</span>} icon={<FileText className="h-5 w-5 text-primary opacity-40"/>}/>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-2 gap-12 text-sm">
                        <div className="space-y-6 p-6 bg-slate-50 rounded-3xl border">
                            <h3 className="font-black text-primary border-b pb-2 mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                                <Calculator className="h-4 w-4"/> تفاصيل الإجازة
                            </h3>
                            <div className="flex justify-between border-b border-dashed pb-3">
                                <span className="font-bold text-muted-foreground">نوع الإجازة:</span> 
                                <Badge className="bg-primary/10 text-primary font-black px-6 border-primary/20">{leaveTypeTranslations[leaveRequest.leaveType]}</Badge>
                            </div>
                            <div className="flex justify-between border-b border-dashed pb-3">
                                <span className="font-bold text-muted-foreground">أيام العمل المحتسبة:</span> 
                                <span className="font-black text-lg text-primary">{leaveRequest.workingDays} <span className="text-xs">يوم</span></span>
                            </div>
                        </div>
                        
                        <div className="space-y-6 p-6 bg-slate-50 rounded-3xl border">
                            <h3 className="font-black text-primary border-b pb-2 mb-4 flex items-center gap-2 uppercase tracking-widest text-[10px]">
                                <Clock className="h-4 w-4"/> الجدولة الزمنية
                            </h3>
                            <div className="flex justify-between border-b border-dashed pb-3">
                                <span className="font-bold text-muted-foreground">تاريخ البدء المخطط:</span> 
                                <span className="font-black">{startDate ? format(startDate, 'dd/MM/yyyy') : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold text-muted-foreground">تاريخ العودة المخطط:</span> 
                                <span className="font-black text-indigo-600">{endDate ? format(endDate, 'dd/MM/yyyy') : '-'}</span>
                            </div>
                        </div>
                    </section>
                </main>
            </Card>

            <AlertDialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl p-10 bg-white">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-blue-900">توثيق مغادرة الموظف</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-bold text-slate-600 mt-2">أنت على وشك تسجيل البدء الفعلي لإجازة الموظف وتغيير حالته لـ "في إجازة".</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-6 space-y-3">
                        <Label className="font-black text-slate-700 pr-1">تاريخ المغادرة الفعلي:</Label>
                        <DateInput value={actualDate} onChange={setActualDate} className="h-12 rounded-xl border-2" />
                    </div>
                    <AlertDialogFooter className="gap-3 pt-6 border-t">
                        <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleStartLeave} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-blue-100">تأكيد المغادرة</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl p-10 bg-white max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-indigo-900">إشعار عودة ومباشرة عمل</AlertDialogTitle>
                        <AlertDialogDescription className="text-base font-bold text-slate-600 mt-2">تأكيد عودة الموظف لمزاولة مهامه رسمياً وإغلاق ملف الإجازة.</AlertDialogDescription>
                    </AlertDialogHeader>
                    
                    <div className="py-8 space-y-6">
                        <div className="grid gap-3">
                            <Label className="font-black text-slate-700 pr-1">تاريخ المباشرة الفعلي:</Label>
                            <DateInput value={actualDate} onChange={setActualDate} className="h-12 rounded-xl border-2" />
                        </div>

                        {/* 🛡️ محرك التدقيق المالي الذكي (Payroll Check Logic) 🛡️ */}
                        {!isCheckingSalary && hasLeaveSalary === false && leaveRequest.leaveType === 'Annual' && (
                            <Alert className="bg-orange-50 border-orange-200 rounded-[2rem] p-6 animate-in zoom-in-95">
                                <ShieldAlert className="h-8 w-8 text-orange-600" />
                                <AlertTitle className="text-xl font-black text-orange-900 mb-2">تنبيه رقابي: لم يتم صرف راتب الإجازة!</AlertTitle>
                                <AlertDescription className="text-sm font-bold text-orange-800 leading-relaxed">
                                    عذراً، لم يجد النظام أي قيد مالي يثبت صرف راتب هذه الإجازة السنوية للموظف. 
                                    <br/><br/>
                                    <strong>هل تود توليد قيد الرواتب وصرف المستحقات تلقائياً الآن قبل المباشرة؟</strong>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <AlertDialogFooter className="gap-3 pt-6 border-t flex flex-col sm:flex-row w-full">
                        <div className="flex gap-2 w-full">
                            <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 flex-1">إلغاء</AlertDialogCancel>
                            
                            {hasLeaveSalary === false && leaveRequest.leaveType === 'Annual' ? (
                                <>
                                    <Button onClick={() => handleReturnToWork(false)} variant="outline" className="rounded-xl font-black h-12 flex-1 border-orange-200 text-orange-700">تخطى وصرف لاحقاً</Button>
                                    <Button onClick={() => handleReturnToWork(true)} className="bg-green-600 hover:bg-green-700 rounded-xl font-black h-12 flex-[2] gap-2 shadow-lg shadow-green-100">
                                        <Banknote className="h-5 w-5" /> صرف الراتب والمباشرة
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => handleReturnToWork(false)} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black h-12 flex-1 shadow-xl shadow-indigo-100">تأكيد المباشرة</Button>
                            )}
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
