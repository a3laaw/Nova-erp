'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc, collection, query, where, getDocs, writeBatch, Timestamp, serverTimestamp } from 'firebase/firestore';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Calendar, User, FileText, CheckCircle, XCircle, Sparkles, History, Clock, PlaneTakeoff, Home, Briefcase, Badge as BadgeIcon, Loader2, ArrowDownCircle, Calculator, FileCheck } from 'lucide-react';
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
import { cn, formatCurrency, getTenantPath } from '@/lib/utils';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
        <div className="flex gap-4 text-sm">
            <div className="text-muted-foreground shrink-0">{icon}</div>
            <div className="font-semibold w-24 shrink-0">{label}:</div>
            <div className="break-words">{value}</div>
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

    const leavePath = useMemo(() => getTenantPath(`leaveRequests/${id}`, tenantId), [id, tenantId]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leavePath);
    
    const employeePath = useMemo(() => leaveRequest?.employeeId ? getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId) : null, [leaveRequest?.employeeId, tenantId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeePath);

    const handleStartLeave = async () => {
        if (!leaveRequest || !firestore || !actualDate || !tenantId) return;
        setIsProcessing(true);
        const reqPath = getTenantPath(`leaveRequests/${leaveRequest.id}`, tenantId);
        const empPath = getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId);

        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, reqPath), { status: 'on-leave', actualStartDate: Timestamp.fromDate(actualDate) });
            batch.update(doc(firestore, empPath), { status: 'on-leave' });
            await batch.commit().catch(async (e) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reqPath, operation: 'write' }));
                throw e;
            });
            toast({ title: 'تم تسجيل المغادرة' });
            setIsStartDialogOpen(false);
        } catch (e) { setIsProcessing(false); }
    };

    const handleReturnToWork = async () => {
        if (!leaveRequest || !firestore || !actualDate || !tenantId) return;
        setIsProcessing(true);
        const reqPath = getTenantPath(`leaveRequests/${leaveRequest.id}`, tenantId);
        const empPath = getTenantPath(`employees/${leaveRequest.employeeId}`, tenantId);

        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, reqPath), { status: 'returned', actualReturnDate: Timestamp.fromDate(actualDate) });
            batch.update(doc(firestore, empPath), { status: 'active' });
            await batch.commit().catch(async (e) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: reqPath, operation: 'write' }));
                throw e;
            });
            toast({ title: 'تمت المباشرة' });
            setIsReturnDialogOpen(false);
        } catch (e) { setIsProcessing(false); }
    };

    if (leaveLoading || employeeLoading || brandingLoading) return <div className="p-8 max-w-4xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
    if (!leaveRequest || !employee) return <div className="text-center p-10">تعذر تحميل تفاصيل طلب الإجازة.</div>;

    const startDate = toFirestoreDate(leaveRequest.startDate);
    const endDate = toFirestoreDate(leaveRequest.endDate);

    return (
        <div className="space-y-6" dir="rtl">
            <div className="no-print flex justify-between items-center bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner">
                 <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2">
                    <ArrowRight className="h-4 w-4"/> عودة للقائمة
                </Button>
                <div className="flex gap-3">
                    {leaveRequest.status === 'approved' && (
                        <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.startDate) || new Date()); setIsStartDialogOpen(true); }} className="bg-blue-600 font-black gap-2 rounded-xl">
                            <PlaneTakeoff className="h-4 w-4"/> تسجيل المغادرة
                        </Button>
                    )}
                    {leaveRequest.status === 'on-leave' && (
                        <Button onClick={() => { setActualDate(toFirestoreDate(leaveRequest.endDate) || new Date()); setIsReturnDialogOpen(true); }} className="bg-indigo-600 font-black gap-2 rounded-xl">
                            <Home className="h-4 w-4"/> إشعار مباشرة العمل
                        </Button>
                    )}
                    <Button onClick={() => window.print()} variant="outline" className="rounded-xl font-bold gap-2"><Printer className="h-4 w-4"/> طباعة</Button>
                </div>
            </div>

            <Card className="max-w-4xl mx-auto rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-white p-12">
                <header className="flex justify-between items-start pb-6 border-b-4 border-primary">
                    <div className="flex items-center gap-5">
                        <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} />
                        <div>
                            <h1 className="text-2xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground mt-1">{branding?.address}</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-3xl font-black text-primary tracking-tighter">طلب إجازة رسمي</h2>
                        <Badge variant="outline" className={cn("mt-2 px-4 py-1 border-2 font-black", statusColors[leaveRequest.status])}>{statusTranslations[leaveRequest.status]}</Badge>
                    </div>
                </header>

                <main className="py-10 space-y-10">
                    <section className="grid grid-cols-2 gap-8 bg-muted/20 p-8 rounded-3xl border">
                        <div className="space-y-4">
                            <InfoRow label="اسم الموظف" value={<span className="font-black text-lg">{leaveRequest.employeeName}</span>} icon={<User className="h-5 w-5 text-primary"/>}/>
                            <InfoRow label="الرقم الوظيفي" value={<span className="font-mono font-bold">{employee.employeeNumber}</span>} icon={<BadgeIcon className="h-4 w-4 text-primary"/>}/>
                        </div>
                        <div className="space-y-4">
                            <InfoRow label="القسم" value={<span className="font-bold">{employee.department}</span>} icon={<Briefcase className="h-5 w-5 text-primary"/>}/>
                            <InfoRow label="المسمى الوظيفي" value={<span className="font-bold">{employee.jobTitle}</span>} icon={<FileText className="h-5 w-5 text-primary"/>}/>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-x-12 gap-y-6 text-sm">
                        <div className="space-y-6">
                            <div className="flex justify-between border-b border-dashed pb-2"><span>نوع الإجازة:</span> <Badge className="bg-primary/10 text-primary font-black px-4">{leaveTypeTranslations[leaveRequest.leaveType]}</Badge></div>
                            <div className="flex justify-between border-b border-dashed pb-2"><span>إجمالي الأيام:</span> <span className="font-black">{leaveRequest.days} يوم</span></div>
                        </div>
                        <div className="space-y-6">
                            <div className="flex justify-between border-b border-dashed pb-2"><span>بداية الإجازة:</span> <span className="font-bold">{startDate ? format(startDate, 'dd/MM/yyyy') : '-'}</span></div>
                            <div className="flex justify-between border-b border-dashed pb-2"><span>نهاية الإجازة:</span> <span className="font-bold">{endDate ? format(endDate, 'dd/MM/yyyy') : '-'}</span></div>
                        </div>
                    </section>

                    <div className="space-y-3">
                        <h4 className="font-black text-gray-700">مبررات طلب الإجازة:</h4>
                        <p className="p-6 border-2 border-dashed rounded-3xl bg-muted/10 min-h-[100px]">{leaveRequest.notes || '-'}</p>
                    </div>
                </main>
            </Card>

            <AlertDialog open={isStartDialogOpen} onOpenChange={setIsStartDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle>تسجيل مغادرة الموظف</AlertDialogTitle></AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>تاريخ المغادرة الفعلي:</Label>
                        <DateInput value={actualDate} onChange={setActualDate} />
                    </div>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleStartLeave} className="bg-blue-600 rounded-xl font-black px-8">تأكيد المغادرة</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle>إشعار عودة للعمل</AlertDialogTitle></AlertDialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>تاريخ المباشرة الفعلي:</Label>
                        <DateInput value={actualDate} onChange={setActualDate} />
                    </div>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReturnToWork} className="bg-indigo-600 rounded-xl font-black px-8">تأكيد العودة</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

import { Badge as BadgeIcon } from 'lucide-react';
