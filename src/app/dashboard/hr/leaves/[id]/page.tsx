// ADDED: نظام إجازات إلكتروني هجين مع طباعة نموذج ورقي للتوقيع اليدوي
// IMPROVED: إضافة بطاقة "سياق القرار الذكي" لعرض آخر إجازة للموظف
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Calendar, User, FileText, CheckCircle, XCircle, Sparkles, History, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};
const statusTranslations: Record<LeaveRequest['status'], string> = {
  pending: 'تحت المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
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
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const [lastApprovedLeave, setLastApprovedLeave] = useState<LeaveRequest | null>(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const leaveRequestRef = useMemo(() => firestore && id ? doc(firestore, 'leaveRequests', id) : null, [firestore, id]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leaveRequestRef?.path || null);
    
    const employeeRef = useMemo(() => firestore && leaveRequest?.employeeId ? doc(firestore, 'employees', leaveRequest.employeeId) : null, [firestore, leaveRequest?.employeeId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);

    // ✨ محرك جلب "آخر إجازة معتمدة" لتوفير سياق القرار للـ HR
    useEffect(() => {
        if (!firestore || !leaveRequest?.employeeId) return;

        const fetchLastLeave = async () => {
            setLoadingHistory(true);
            try {
                const q = query(
                    collection(firestore, 'leaveRequests'),
                    where('employeeId', '==', leaveRequest.employeeId),
                    where('status', '==', 'approved'),
                    orderBy('endDate', 'desc'),
                    limit(2) // نأخذ 2 للتأكد أننا لا نعرض الطلب الحالي إذا كان معتمداً بالفعل
                );
                const snap = await getDocs(q);
                const filtered = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
                    .filter(l => l.id !== id); // استبعاد الطلب الحالي

                if (filtered.length > 0) {
                    setLastApprovedLeave(filtered[0]);
                }
            } catch (e) {
                console.error("Error fetching leave history:", e);
            } finally {
                setLoadingHistory(false);
            }
        };

        fetchLastLeave();
    }, [firestore, leaveRequest?.employeeId, id]);

    const handlePrint = () => {
        const element = document.getElementById('printable-leave-form');
        if (!element || !leaveRequest) return;
        
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const opt = {
                margin: 0.5,
                filename: `leave_request_${leaveRequest.employeeName}_${leaveRequest.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    const loading = leaveLoading || employeeLoading || brandingLoading;

    if (loading) {
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
            <div className="no-print flex justify-between items-center bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner">
                 <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2 rounded-xl">
                    <ArrowRight className="h-4 w-4"/> عودة للقائمة
                </Button>
                {leaveRequest.status === 'approved' && (
                    <Button onClick={handlePrint} className="bg-primary shadow-lg shadow-primary/20 rounded-xl font-bold gap-2">
                        <Printer className="h-4 w-4"/> طباعة النموذج للتوقيع
                    </Button>
                )}
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
                            <Badge variant="outline" className="mt-2 px-4 py-1 border-2 border-primary/20 font-black">
                                ID: {leaveRequest.id?.substring(0,8).toUpperCase()}
                            </Badge>
                        </div>
                    </header>

                    <main className="py-10 space-y-10">
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-8 rounded-3xl border">
                            <div className="space-y-4">
                                <InfoRow label="اسم الموظف" value={<span className="font-black text-lg">{leaveRequest.employeeName}</span>} icon={<User className="h-5 w-5 text-primary"/>}/>
                                <InfoRow label="الرقم الوظيفي" value={<span className="font-mono font-bold">{employee.employeeNumber || '-'}</span>} icon={<Badge variant="secondary" className="h-4">#</Badge>}/>
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
                        
                        <div className="space-y-3">
                            <h4 className="font-black text-gray-700 flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/> مبررات طلب الإجازة:</h4>
                            <p className="p-6 border-2 border-dashed rounded-3xl bg-muted/10 min-h-[100px] leading-relaxed">
                                {leaveRequest.notes || 'لم يتم إدخال ملاحظات إضافية.'}
                            </p>
                        </div>
                        
                        <section className="p-8 bg-primary/5 rounded-[2.5rem] border-2 border-primary/10 shadow-inner">
                            <h4 className="font-black text-primary mb-6 text-center text-lg">تحليل رصيد الإجازة السنوية</h4>
                            <div className="flex flex-col sm:flex-row justify-around items-center gap-8 text-center">
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">الرصيد قبل الطلب</p>
                                    <p className="font-black text-4xl text-foreground font-mono">{calculateAnnualLeaveBalance(employee, new Date())}</p>
                                </div>
                                <div className="h-12 w-px bg-primary/20 hidden sm:block"></div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-primary uppercase tracking-widest">الرصيد المتبقي المتوقع</p>
                                    <p className="font-black text-4xl text-primary font-mono">
                                        {calculateAnnualLeaveBalance(employee, new Date()) - (leaveRequest.leaveType === 'Annual' ? leaveRequest.workingDays || 0 : 0)}
                                    </p>
                                </div>
                            </div>
                        </section>
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
        </div>
    );
}
