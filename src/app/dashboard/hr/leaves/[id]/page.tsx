
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, getDocs, updateDoc, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Calendar, User, FileText, CheckCircle, XCircle, Sparkles, History, Clock, PlaneTakeoff, Home, Briefcase, Badge as BadgeIcon, Loader2, ArrowDownCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  'on-leave': 'bg-blue-100 text-blue-800 border-blue-200',
  'returned': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};
const statusTranslations: Record<LeaveRequest['status'], string> = {
  pending: 'تحت المراجعة',
  approved: 'موافق عليه (بانتظار المغادرة)',
  rejected: 'مرفوض',
  'on-leave': 'في إجازة حالياً',
  'returned': 'عاد للعمل',
};
const leaveTypeTranslations: Record<LeaveRequest['leaveType'], string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};


function InfoRow({ label, value, icon }: { label: string, value: string | React.ReactNode, icon: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <div className="text-muted-foreground">{icon}</div>
            <div className="font-semibold">{label}:</div>
            <div>{value}</div>
        </div>
    )
}

export default function LeaveRequestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const [lastApprovedLeave, setLastApprovedLeave] = useState<LeaveRequest | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [isStartDialogOpen, setIsStartDialogOpen] = useState(false);
    const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
    const [actualDate, setActualDate] = useState<Date | undefined>(new Date());

    const leaveRequestRef = useMemo(() => firestore && id ? doc(firestore, 'leaveRequests', id) : null, [firestore, id]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leaveRequestRef?.path || null);
    
    const employeeRef = useMemo(() => firestore && leaveRequest?.employeeId ? doc(firestore, 'employees', leaveRequest.employeeId) : null, [firestore, leaveRequest?.employeeId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);

    // ✨ محرك جلب "آخر إجازة معتمدة" لتوفير سياق القرار للـ HR
    useEffect(() => {
        if (!firestore || !leaveRequest?.employeeId) return;

        const fetchContext = async () => {
            setLoadingHistory(true);
            try {
                const q = query(
                    collection(firestore, 'leaveRequests'),
                    where('employeeId', '==', leaveRequest.employeeId),
                    where('status', 'in', ['approved', 'on-leave', 'returned']),
                    orderBy('endDate', 'desc'),
                    limit(5)
                );
                const snap = await getDocs(q);
                const filtered = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
                    .filter(l => l.id !== id);

                if (filtered.length > 0) {
                    setLastApprovedLeave(filtered[0]);
                }
            } catch (e) {
                console.error("Error fetching leave history:", e);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchContext();
    }, [firestore, leaveRequest?.employeeId, id]);

    const handlePrint = () => {
        window.print();
    };

    const handleStartLeave = async () => {
        if (!leaveRequest || !firestore || !actualDate || !leaveRequest.id) {
            toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'تأكد من اختيار التاريخ وتوفر بيانات الموظف.' });
            return;
        }
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const empRef = doc(firestore, 'employees', leaveRequest.employeeId);
            batch.update(doc(firestore, 'leaveRequests', leaveRequest.id), { 
                status: 'on-leave',
                actualStartDate: Timestamp.fromDate(actualDate)
            });
            batch.update(empRef, { status: 'on-leave' });
            await batch.commit();
            toast({ title: 'بدأت الإجازة', description: 'تم تسجيل مغادرة الموظف.' });
            setIsStartDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل بدء الإجازة.' });
        } finally { setIsProcessing(false); }
    };

    const handleReturnToWork = async () => {
        if (!leaveRequest || !firestore || !actualDate || !leaveRequest.id) {
            toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'البيانات المطلوبة للعودة غير متوفرة.' });
            return;
        }
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'leaveRequests', leaveRequest.id), { 
                status: 'returned',
                actualReturnDate: Timestamp.fromDate(actualDate)
            });
            batch.update(doc(firestore, 'employees', leaveRequest.employeeId), { status: 'active' });
            await batch.commit();
            toast({ title: 'تمت المباشرة', description: 'تم تسجيل عودة الموظف للعمل وإغلاق الملف.' });
            setIsReturnDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل العودة للعمل.' });
        } finally { setIsProcessing(false); }
    };

    const loadingStatus = leaveLoading || employeeLoading || brandingLoading;

    if (loadingStatus) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-64 w-full rounded-[2.5rem]" />
            </div>
        );
    }

    if (!leaveRequest || !employee) {
        return <div className="text-center p-10" dir="rtl">تعذر تحميل تفاصيل طلب الإجازة.</div>;
    }
    
    const startDate = toFirestoreDate(leaveRequest.startDate);
    const endDate = toFirestoreDate(leaveRequest.endDate);

    return (
        <div className="space-y-6" dir="rtl">
            <div className="no-print flex flex-col md:flex-row justify-between items-center bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner gap-4">
                 <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2 rounded-xl">
                    <ArrowRight className="h-4 w-4"/> عودة للقائمة
                </Button>
                
                <div className="flex gap-3">
                    {leaveRequest.status === 'approved' && (
                        <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.startDate) || new Date()); setIsStartDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 rounded-xl font-black gap-2">
                            <PlaneTakeoff className="h-4 w-4"/> تسجيل مغادرة الموظف
                        </Button>
                    )}
                    {leaveRequest.status === 'on-leave' && (
                        <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.endDate) || new Date()); setIsReturnDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 rounded-xl font-black gap-2">
                            <Home className="h-4 w-4"/> إشعار عودة للعمل
                        </Button>
                    )}
                    <Button onClick={handlePrint} variant="outline" className="bg-white shadow-sm rounded-xl font-bold gap-2">
                        <Printer className="h-4 w-4"/> طباعة النموذج للتوقيع
                    </Button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-6">
                {/* ✨ بطاقة سياق القرار الذكي (HR Context Card) */}
                {lastApprovedLeave && (
                    <Alert className="rounded-[2rem] border-2 border-primary/20 bg-primary/5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <AlertTitle className="text-primary font-black text-lg">سياق القرار الذكي (HR Assistant)</AlertTitle>
                        <AlertDescription className="mt-2 text-foreground/80 leading-relaxed">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                                <p className="font-medium">
                                    كان الموظف في إجازة <strong>{leaveTypeTranslations[lastApprovedLeave.leaveType]}</strong> 
                                    انتهت بتاريخ <strong>{format(toFirestoreDate(lastApprovedLeave.endDate)!, 'dd/MM/yyyy')}</strong>.
                                </p>
                                <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border shadow-sm">
                                    <Clock className="h-3 w-3 text-primary" />
                                    <span className="text-xs font-black text-primary">
                                        منذ {formatDistanceToNow(toFirestoreDate(lastApprovedLeave.endDate)!, { locale: ar })}
                                    </span>
                                </div>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                <div id="printable-leave-form" className="bg-white dark:bg-card p-8 sm:p-12 rounded-[2.5rem] shadow-xl print:shadow-none print:border-none border">
                    <header className="flex justify-between items-start pb-6 border-b-4 border-primary">
                        <div className="flex items-center gap-5">
                            <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                                <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-xs text-muted-foreground mt-1">{branding?.address}</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <h2 className="text-3xl font-black text-primary tracking-tighter">طلب إجازة رسمي</h2>
                            <p className="text-muted-foreground font-mono text-sm mt-1 uppercase tracking-widest">Leave Request Form</p>
                            <Badge variant="outline" className={cn("mt-2 px-4 py-1 border-2 font-black", statusColors[leaveRequest.status])}>
                                {statusTranslations[leaveRequest.status]}
                            </Badge>
                        </div>
                    </header>

                    <main className="py-10 space-y-10">
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-8 rounded-3xl border">
                            <div className="space-y-4">
                                <InfoRow label="اسم الموظف" value={<span className="font-black text-lg">{leaveRequest.employeeName}</span>} icon={<User className="h-5 w-5 text-primary"/>}/>
                                <InfoRow label="الرقم الوظيفي" value={<span className="font-mono font-bold">{employee.employeeNumber || '-'}</span>} icon={<BadgeIcon className="h-4 w-4 text-primary"/>}/>
                            </div>
                            <div className="space-y-4">
                                <InfoRow label="القسم" value={<span className="font-bold">{employee.department}</span>} icon={<Briefcase className="h-5 w-5 text-primary"/>}/>
                                <InfoRow label="المسمى الوظيفي" value={<span className="font-bold">{employee.jobTitle}</span>} icon={<FileText className="h-5 w-5 text-primary"/>}/>
                            </div>
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-dashed pb-2">
                                    <span className="text-muted-foreground font-bold flex items-center gap-2"><Calendar className="h-4 w-4"/> تاريخ التقديم:</span>
                                    <span className="font-bold">{format(toFirestoreDate(leaveRequest.createdAt)!, 'dd/MM/yyyy')}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed pb-2">
                                    <span className="text-muted-foreground font-bold flex items-center gap-2"><Sparkles className="h-4 w-4"/> نوع الإجازة:</span>
                                    <Badge variant="secondary" className="bg-primary/10 text-primary font-black px-4">{leaveTypeTranslations[leaveRequest.leaveType]}</Badge>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed pb-2">
                                    <span className="text-muted-foreground font-bold flex items-center gap-2"><History className="h-4 w-4"/> إجمالي الأيام:</span>
                                    <span className="font-black text-lg">{leaveRequest.days} يوم</span>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-dashed pb-2">
                                    <span className="text-muted-foreground font-bold">بداية الإجازة:</span>
                                    <span className="font-bold text-primary">{startDate ? format(startDate, 'dd/MM/yyyy') : '-'}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed pb-2">
                                    <span className="text-muted-foreground font-bold">نهاية الإجازة:</span>
                                    <span className="font-bold text-primary">{endDate ? format(endDate, 'dd/MM/yyyy') : '-'}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed pb-2 bg-green-50/50 p-1 px-3 rounded-lg">
                                    <span className="text-green-800 font-black">أيام العمل الفعلية:</span>
                                    <span className="font-black text-xl text-green-700">{leaveRequest.workingDays} يوم</span>
                                </div>
                            </div>
                        </section>

                        {/* ✨ تفصيل التقسيم المرن في النموذج المطبوع */}
                        {leaveRequest.leaveType === 'Annual' && (leaveRequest.unpaidDays || 0) > 0 && (
                            <section className="bg-orange-50 border-2 border-orange-200 p-6 rounded-3xl space-y-3">
                                <h4 className="font-black text-orange-800 flex items-center gap-2">
                                    <Calculator className="h-5 w-5" /> تفصيل خصم الأيام (عجز رصيد):
                                </h4>
                                <div className="grid grid-cols-2 gap-8 text-center">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-orange-700 uppercase">مخصوم من الرصيد السنوي</p>
                                        <p className="text-2xl font-black text-orange-900">{(leaveRequest.workingDays || 0) - (leaveRequest.unpaidDays || 0)} <span className="text-sm">يوم</span></p>
                                    </div>
                                    <div className="space-y-1 border-r border-orange-200">
                                        <p className="text-[10px] font-bold text-red-700 uppercase">إجازة بدون راتب</p>
                                        <p className="text-2xl font-black text-red-800">{leaveRequest.unpaidDays} <span className="text-sm">يوم</span></p>
                                    </div>
                                </div>
                            </section>
                        )}
                        
                        <div className="space-y-3">
                            <h4 className="font-black text-gray-700 flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/> مبررات طلب الإجازة:</h4>
                            <p className="p-6 border-2 border-dashed rounded-3xl bg-muted/10 min-h-[100px] leading-relaxed">
                                {leaveRequest.notes || 'لم يتم إدخل ملاحظات إضافية.'}
                            </p>
                        </div>
                    </main>
                    
                    <footer className="pt-20 space-y-16">
                        <div className="grid grid-cols-3 gap-8 text-center text-[10px] font-black uppercase text-muted-foreground">
                            <div className="space-y-12">
                                <p className="text-foreground border-b-2 border-foreground pb-2">توقيع الموظف</p>
                                <div className="pt-2 border-t border-dashed">التاريخ والاعتماد</div>
                            </div>
                            <div className="space-y-12">
                                <p className="text-foreground border-b-2 border-foreground pb-2">المدير المباشر</p>
                                <div className="pt-2 border-t border-dashed">الموافقة الفنية</div>
                            </div>
                            <div className="space-y-12">
                                <p className="text-foreground border-b-2 border-foreground pb-2">الموارد البشرية</p>
                                <div className="pt-2 border-t border-dashed">التدقيق المالي</div>
                            </div>
                        </div>
                        <div className="border-t-4 border-double pt-8 text-center">
                            <p className="font-black text-sm text-foreground">اعتماد المدير العام / المفوض بالتوقيع</p>
                            <div className="mt-12 w-1/3 mx-auto border-t-2 border-dashed border-primary pt-2 text-muted-foreground font-bold">
                                الختم الرسمي للشركة
                            </div>
                        </div>
                    </footer>
                </div>
            </div>

            <AlertDialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 shadow-inner">
                                <PlaneTakeoff className="h-6 w-6" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-black">تسجيل مغادرة الموظف</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-base font-medium">
                            يرجى تحديد التاريخ الذي غادر فيه الموظف العمل فعلياً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label className="font-bold pr-1">تاريخ المغادرة الفعلي:</Label>
                        <DateInput value={actualDate} onChange={setActualDate} />
                    </div>
                    <AlertDialogFooter className="mt-2 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleStartLeave} disabled={isProcessing || !actualDate} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-black px-10 shadow-lg shadow-blue-100">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد المغادرة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
                                <Home className="h-6 w-6" />
                            </div>
                            <AlertDialogTitle className="text-2xl font-black">إشعار مباشرة العمل</AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-base font-medium">
                            يرجى تحديد التاريخ الذي باشر فيه الموظف عمله فعلياً.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label className="font-bold pr-1">تاريخ المباشرة الفعلي:</Label>
                        <DateInput value={actualDate} onChange={setActualDate} />
                    </div>
                    <AlertDialogFooter className="mt-2 gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReturnToWork} disabled={isProcessing || !actualDate} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black px-10 shadow-lg shadow-indigo-100">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد العودة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
