
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { 
    doc, 
    collection, 
    query, 
    where, 
    orderBy, 
    writeBatch, 
    serverTimestamp, 
    Timestamp, 
    getDoc,
    updateDoc,
    increment,
    limit,
    getDocs
} from 'firebase/firestore';
import type { Appointment, Client, ClientTransaction, TransactionStage, Holiday, Account, PaymentApplication } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
    AlertCircle, ArrowRight, Calendar, Workflow, 
    Check, Loader2, Target, Clock, Pencil, 
    CheckCircle2, Ban, ShieldCheck, Calculator,
    Undo2,
    MessageSquare,
    Play,
    Edit3,
    X,
    Save,
    Zap,
    Coins,
    FileText
} from 'lucide-center';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { formatCurrency, getTenantPath, cleanFirestoreData, cn } from '@/lib/utils';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';

const stageStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-800 border-slate-200',
  'in-progress': 'bg-blue-50 text-blue-800 border-blue-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'بانتظار البدء',
  'in-progress': 'قيد التنفيذ',
  completed: 'منجزة',
};

export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding } = useBranding();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const tenantId = currentUser?.currentCompanyId;

    const [isSaving, setIsSaving] = useState(false);
    const [actionNote, setActionNote] = useState('');
    const [isTxFormOpen, setIsTxFormOpen] = useState(false);
    
    const [activeAction, setActiveAction] = useState<{ stageId: string, type: 'start' | 'modify' | 'complete' } | null>(null);

    const isPrivileged = useMemo(() => 
        ['Admin', 'HR', 'Secretary', 'Developer'].includes(currentUser?.role || '')
    , [currentUser?.role]);

    const apptPath = useMemo(() => id && tenantId ? getTenantPath(`appointments/${id}`, tenantId) : null, [id, tenantId]);
    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, apptPath);
    
    const clientPath = useMemo(() => appointment?.clientId && tenantId ? getTenantPath(`clients/${appointment.clientId}`, tenantId) : null, [appointment?.clientId, tenantId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
    
    const transactionPath = useMemo(() => (appointment?.clientId && appointment?.transactionId && tenantId) ? getTenantPath(`clients/${appointment.clientId}/transactions/${appointment.transactionId}`, tenantId) : null, [appointment, tenantId]);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, transactionPath);

    const { data: clientTransactions = [] } = useSubscription<ClientTransaction>(firestore, appointment?.clientId ? `clients/${appointment.clientId}/transactions` : null, [where('status', 'in', ['new', 'in-progress'])]);
    const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

    const isLocked = useMemo(() => {
        return transaction?.status === 'cancelled' || transaction?.status === 'on-hold';
    }, [transaction?.status]);

    const handleStageAction = async () => {
        if (!activeAction || !firestore || !currentUser || !transaction || !transactionPath || !tenantId || isLocked) return;
        
        if (!actionNote.trim()) {
            toast({ variant: 'destructive', title: 'توثيق مطلوب', description: 'يرجى كتابة ملاحظات العمل الميداني أولاً.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const { stageId, type: action } = activeAction;
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            const stage = currentStages[stageIndex];
            const now = new Date();

            let logLabel = '';

            if (action === 'start') {
                stage.status = 'in-progress';
                stage.startDate = Timestamp.fromDate(now);
                logLabel = 'بدء الزيارة الميدانية';
                if (stage.expectedDurationDays) {
                    stage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, stage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                }
            } else if (action === 'modify') {
                stage.currentCount = (stage.currentCount || 0) + 1;
                logLabel = `تعديل ميداني (رقم ${stage.currentCount})`;
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                logLabel = 'إغلاق المرحلة ميدانياً';

                const userPath = getTenantPath(`users/${currentUser.id}`, tenantId);
                batch.update(doc(firestore, userPath!), { totalPoints: increment(10) });
                
                const nextStage = currentStages.find(s => s.order === stage.order + 1);
                if (nextStage && nextStage.status === 'pending') {
                    nextStage.status = 'in-progress';
                    nextStage.startDate = Timestamp.fromDate(now);
                }

                const contract = transaction.contract;
                if (contract?.clauses) {
                    const clauseIndex = contract.clauses.findIndex((c: any) => c.condition === stage.name);
                    if (clauseIndex !== -1) {
                        const targetClause = contract.clauses[clauseIndex];
                        const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));

                        const receiptsPath = getTenantPath('cashReceipts', tenantId);
                        const receiptsSnap = await getDocs(query(collection(firestore, receiptsPath!), where('projectId', '==', transaction.id)));
                        const totalCollected = receiptsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
                        
                        const previousMilestonesSum = contract.clauses
                            .slice(0, clauseIndex)
                            .reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
                        
                        const availableCredit = Math.max(0, totalCollected - previousMilestonesSum);
                        const stageValue = targetClause.amount || 0;
                        const netDue = Math.max(0, stageValue - availableCredit);
                        const paidFromPrevious = Math.min(stageValue, availableCredit);

                        if (targetClause.status === 'غير مستحقة') {
                            const updatedClauses = [...contract.clauses];
                            updatedClauses[clauseIndex].status = netDue === 0 ? 'مدفوعة' : 'مستحقة';
                            batch.update(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });

                            const appRef = doc(collection(firestore, getTenantPath('payment_applications', tenantId)!));
                            batch.set(appRef, cleanFirestoreData({
                                applicationNumber: `APP-SITE-${now.getTime().toString().substring(7)}`,
                                date: serverTimestamp(),
                                projectId: transaction.id,
                                clientId: transaction.clientId,
                                clientName: client?.nameAr,
                                projectName: transaction.transactionType,
                                totalAmount: stageValue,
                                currentMilestone: stage.name, 
                                status: 'draft',
                                createdAt: serverTimestamp(),
                                createdBy: currentUser.id,
                                companyId: tenantId
                            }));

                            batch.set(timelineRef, {
                                type: 'comment',
                                content: `**[بيان استحقاق مالي تفصيلي]**\nتم إنجاز مرحلة **"${stage.name}"**.\n\n• قيمة المرحلة: **${formatCurrency(stageValue)}**\n• مسدد سابقاً (رصيد متاح): **${formatCurrency(paidFromPrevious)}**\n• المطلوب سداده حالياً: **${formatCurrency(netDue)}**\n\n*ملاحظة: تم رفع مطالبة مالية لمراجعة المحاسب.*`,
                                userId: currentUser.id,
                                userName: currentUser.fullName,
                                userAvatar: currentUser.avatarUrl,
                                createdAt: serverTimestamp(),
                                companyId: tenantId
                            });

                            logLabel += netDue === 0 ? ' (تمت التسوية من الرصيد)' : ' (بانتظار التحصيل)';
                        }
                    }
                }
            }

            batch.update(doc(firestore, transactionPath), cleanFirestoreData({ stages: currentStages, updatedAt: serverTimestamp() }));
            
            const mainTimelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(mainTimelineRef, {
                type: 'comment',
                content: `**[محضر زيارة ميدانية: ${logLabel}]** للمرحلة: ${stage.name}.\nالملاحظات: ${actionNote}`,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            if (action === 'complete') {
                batch.update(doc(firestore, apptPath!), { 
                    workStageUpdated: true, 
                    status: 'confirmed',
                    actualCompletionDate: serverTimestamp() 
                });
            }

            await batch.commit();
            toast({ title: '✅ تم توثيق الإنجاز والمزامنة المالية' });
            setActionNote('');
            setActiveAction(null);
        } catch (e: any) { 
            console.error(e); 
            toast({ variant: 'destructive', title: 'عائق رقابي', description: 'فشل إتمام المزامنة المالية.' });
        } finally { setIsSaving(false); }
    };

    /**
     * 🛡️ محرك التراجع السيادي المتسلسل (Sovereign Sequential Rollback V139.0) 🛡️
     * - يمنع التراجع إلا عن آخر مرحلة مكتملة لضمان سلامة المسار.
     * - يقوم بتصفير كافة المراحل اللاحقة (Reset Subsequent to Pending).
     * - يسحب المطالبات المالية المرتبطة بالعقد.
     */
    const handleUndoStage = async (stageId: string) => {
        if (!firestore || !transaction || !transactionPath || !tenantId || isLocked) return;
        
        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
        const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
        const stage = currentStages[stageIndex];
        
        // 🛡️ درع التحقق من التسلسل العكسي 🛡️
        const hasLaterCompletedStage = currentStages.some((s, idx) => idx > stageIndex && s.status === 'completed');
        if (hasLaterCompletedStage) {
            toast({ 
                variant: 'destructive', 
                title: 'خرق قانون التتابع', 
                description: 'لا يمكن التراجع عن هذه المرحلة لوجود مراحل لاحقة مكتملة. يجب التراجع خطوة بخطوة من الأحدث للأقدم.' 
            });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            
            // 1. إعادة المرحلة الحالية لـ قيد التنفيذ
            stage.status = 'in-progress';
            stage.endDate = null;

            // 2. 🛡️ تصفير كافة المراحل اللاحقة (Cascade Reset) لضمان مسار واحد نشط 🛡️
            for (let i = stageIndex + 1; i < currentStages.length; i++) {
                currentStages[i].status = 'pending';
                currentStages[i].startDate = null;
                currentStages[i].endDate = null;
                currentStages[i].expectedEndDate = null;
            }

            // 3. التراجع المالي والرقابي
            const appsPath = getTenantPath('payment_applications', tenantId);
            const appsQuery = query(
                collection(firestore, appsPath!), 
                where('projectId', '==', transaction.id),
                where('currentMilestone', '==', stage.name),
                where('status', '==', 'draft') 
            );
            const appsSnap = await getDocs(appsQuery);
            appsSnap.forEach(d => {
                batch.update(d.ref, { 
                    status: 'cancelled', 
                    notes: `تم الإلغاء آلياً بسبب التراجع عن إغلاق المرحلة الميدانية بواسطة ${currentUser?.fullName}` 
                });
            });

            // 4. تصفير حالة الدفعة في العقد
            const contract = transaction.contract;
            if (contract?.clauses) {
                const updatedClauses = contract.clauses.map((c: any) => {
                    if (c.condition === stage.name) return { ...c, status: 'غير مستحقة' };
                    return c;
                });
                batch.update(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });
            }

            // 5. تحديث مستند المعاملة النهائي
            batch.update(doc(firestore, transactionPath), { 
                stages: currentStages, 
                updatedAt: serverTimestamp() 
            });

            // 6. إعادة فتح الموعد إذا كان مرتبطاً
            if (appointment && appointment.workStageUpdated) {
                batch.update(doc(firestore, apptPath!), { workStageUpdated: false, status: 'scheduled' });
            }

            // 7. توثيق التراجع في التايم لاين
            const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(timelineRef, {
                type: 'comment',
                content: `**[تراجع تقني ومالي متسلسل]**\nتم التراجع عن إغلاق مرحلة **"${stage.name}"**.\n\n• تمت إعادة المرحلة لحالة قيد التنفيذ.\n• تم تصفير كافة المراحل اللاحقة لضمان سلامة المسار.\n• تم إلغاء المطالبة المالية المرتبطة وتصفير استحقاق العقد.`,
                userId: currentUser?.id,
                userName: currentUser?.fullName,
                userAvatar: currentUser?.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            toast({ title: '✅ تم التراجع التقني والمالي المتسلسل' });
        } catch (e) { 
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ في التراجع' }); 
        } finally { setIsSaving(false); }
    };

    const handleLinkTransaction = async (txId: string) => {
        if (!firestore || !apptPath || !tenantId) return;
        const apptRef = doc(firestore, apptPath);
        await updateDoc(apptRef, { transactionId: txId }).then(() => {
            toast({ title: '✅ تم ربط المسار الفني بالزيارة' });
        }).catch(async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: apptPath, operation: 'update', requestResourceData: { transactionId: txId } }));
        });
    };

    if (apptLoading || clientLoading) return <div className="p-10"><Skeleton className="h-96 w-full rounded-[3rem]" /></div>;
    if (!appointment) return <div className="p-20 text-center font-black opacity-30">الموعد غير موجود.</div>;

    const apptDate = toFirestoreDate(appointment.appointmentDate);

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20" dir="rtl">
            <Card className="rounded-[3rem] shadow-2xl border-none overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-2xl font-black">{appointment.clientName}</CardTitle>
                                {appointment.clientId && (
                                    <UniversalActionTrigger 
                                        title={appointment.clientName}
                                        clientId={appointment.clientId} 
                                        sourceModule="المواعيد"
                                        sourceId={appointment.id!}
                                    />
                                )}
                            </div>
                            <CardDescription className="font-bold flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" /> {apptDate ? format(apptDate, 'eeee, dd MMMM HH:mm', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white px-6 h-8 rounded-full font-black border-primary/20 text-primary shadow-sm uppercase tracking-widest text-[10px]">Site Visit Center</Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-10 space-y-12">
                    {!appointment.transactionId ? (
                        <div className="space-y-6 animate-in slide-in-from-top-4">
                            <Alert className="rounded-[2rem] border-2 border-orange-200 bg-orange-50 p-6 shadow-md">
                                <AlertCircle className="h-6 w-6 text-orange-600" />
                                <AlertTitle className="font-black text-orange-900 text-lg">ارتباط فني مفقود</AlertTitle>
                                <AlertDescription className="text-orange-700 font-bold mt-1">يرجى ربط هذه الزيارة بإحدى المعاملات النشطة للتمكن من توثيق الإنجاز وتحديث مراحل الـ WBS.</AlertDescription>
                            </Alert>
                            {!appointment.clientId ? (
                                <Button asChild className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName)}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}`}>تأسيس ملف عميل رسمي</Link>
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <Label className="font-black pr-2 text-slate-500">اختر المعاملة المستهدفة بالزيارة:</Label>
                                    <InlineSearchList 
                                        value={''} 
                                        onSelect={handleLinkTransaction} 
                                        options={clientTransactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                        placeholder="ابحث عن مسار فني (تصميم، تراخيص...)"
                                        className="h-12 border-2 rounded-xl"
                                    />
                                    <Button variant="ghost" onClick={() => setIsTxFormOpen(true)} className="w-full text-xs font-bold text-primary underline hover:bg-primary/5">فتح معاملة جديدة لهذا العميل +</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-12">
                             <div className="flex items-center gap-4 bg-primary/5 p-8 rounded-[3rem] border-2 border-dashed border-primary/20 shadow-inner group">
                                <div className="p-4 bg-white rounded-[2rem] shadow-xl text-primary group-hover:scale-110 transition-transform"><Target className="h-8 w-8" /></div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">المسار الفني المرتبط</p>
                                    <p className="font-black text-2xl text-[#1e1b4b]">{transaction?.transactionType}</p>
                                </div>
                             </div>

                             <div className="space-y-8">
                                <h3 className="font-black text-xl border-r-8 border-primary pr-4 flex items-center gap-3 text-[#1e1b4b]">
                                    <Workflow className="h-7 w-7 text-primary" /> مراحل الإنجاز الميداني (WBS)
                                </h3>
                                
                                <div className="space-y-8">
                                    {(transaction?.stages || []).map((stage, idx) => {
                                        const isCompleted = stage.status === 'completed';
                                        const isCurrent = stage.status === 'in-progress';
                                        const isLockedRow = idx > 0 && transaction.stages![idx-1].status !== 'completed';
                                        const isActionActive = activeAction?.stageId === stage.stageId;

                                        // 🛡️ درع التراجع السيادي: لا يسمح بالتراجع إلا عن آخر مرحلة مكتملة 🛡️
                                        const isLastCompleted = isCompleted && !transaction.stages!.some((s, sIdx) => s.status === 'completed' && sIdx > idx);

                                        if (isLockedRow && !isCurrent) return null;

                                        return (
                                            <div key={stage.stageId} className={cn(
                                                "p-10 border-2 rounded-[3.5rem] transition-all relative group",
                                                isCurrent ? "border-primary bg-primary/[0.02] shadow-2xl scale-[1.01]" : "border-slate-100 opacity-60"
                                            )}>
                                                <div className="flex flex-col sm:flex-row justify-between items-center gap-8">
                                                    <div className="flex items-center gap-8">
                                                        <div className="relative">
                                                            <Badge variant="outline" className={cn("w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", stageStatusColors[stage.status])}>
                                                                {stageStatusTranslations[stage.status]}
                                                            </Badge>
                                                            <div className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-white rounded-full border-2 border-primary flex items-center justify-center font-mono font-black text-[8px] text-primary shadow-sm">{idx + 1}</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-3">
                                                                <span className="font-black text-2xl text-slate-900">{stage.name}</span>
                                                                {appointment.clientId && !isLocked && (
                                                                    <UniversalActionTrigger 
                                                                        title={transaction?.transactionType || 'زيارة ميدانية'}
                                                                        subItemName={stage.name}
                                                                        clientId={appointment.clientId} 
                                                                        sourceModule="مراحل العمل"
                                                                        sourceId={transaction?.id || ''}
                                                                        sourceSubId={stage.stageId}
                                                                    />
                                                                )}
                                                            </div>
                                                            {isCurrent && stage.expectedEndDate && (
                                                                <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5 uppercase tracking-widest">
                                                                    <Clock className="h-3 w-3" /> التسليم المخطط: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}
                                                                </p>
                                                            )}
                                                            {isCompleted && stage.endDate && (
                                                                <p className="text-[10px] font-bold text-green-600 flex items-center gap-1.5 uppercase tracking-widest">
                                                                    <CheckCircle2 className="h-3 w-3" /> تم الإنجاز بتاريخ: {format(toFirestoreDate(stage.endDate)!, 'dd/MM/yyyy')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-4 no-print">
                                                        {isCurrent && !isActionActive && (
                                                            <div className="flex gap-2 animate-in zoom-in-95">
                                                                <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'modify' })} variant="outline" className="h-12 px-6 rounded-2xl font-black text-xs gap-2 border-orange-200 text-orange-700 bg-white hover:bg-orange-50 transition-all"><Edit3 className="h-4 w-4" /> تسجيل تعديل</Button>
                                                                <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'complete' })} className="h-12 px-8 rounded-2xl font-black text-xs gap-2 bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-100"><CheckCircle2 className="h-4 w-4" /> إنهاء المرحلة</Button>
                                                            </div>
                                                        )}
                                                        {stage.status === 'pending' && !isActionActive && !isLocked && (
                                                            <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'start' })} className="h-12 px-10 rounded-2xl font-black gap-3 shadow-xl shadow-primary/20"><Play className="h-4 w-4" /> بدء الزيارة</Button>
                                                        )}
                                                        {isCompleted && (
                                                            <div className="flex items-center gap-2">
                                                                {isPrivileged && isLastCompleted && (
                                                                    <Button 
                                                                        variant="ghost" 
                                                                        size="sm" 
                                                                        onClick={() => handleUndoStage(stage.stageId)}
                                                                        className="h-9 px-4 rounded-xl text-orange-600 hover:bg-orange-50 font-black gap-1.5 border border-orange-100"
                                                                    >
                                                                        <Undo2 className="h-4 w-4" /> تراجع متسلسل
                                                                    </Button>
                                                                )}
                                                                <div className="p-3 bg-green-100 rounded-full text-green-700 shadow-inner"><CheckCircle2 className="h-7 w-7"/></div>
                                                            </div>
                                                        )}
                                                        {isActionActive && <Button variant="ghost" size="icon" onClick={() => setActiveAction(null)} className="h-10 w-10 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-5 w-5"/></Button>}
                                                    </div>
                                                </div>

                                                {isActionActive && (
                                                    <div className="mt-10 pt-10 border-t-2 border-dashed border-primary/20 space-y-6 animate-in slide-in-from-top-4 duration-500">
                                                        <div className="space-y-4">
                                                            <div className="flex justify-between items-center pr-1">
                                                                <Label className="font-black text-xs text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
                                                                    <MessageSquare className="h-4 w-4 text-primary" /> محضر الأعمال الميدانية (إلزامي) *
                                                                </Label>
                                                                <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase flex items-center gap-1">
                                                                    <Zap className="h-2.5 w-2.5 fill-primary" /> {activeAction.type === 'complete' ? '+10 XP Points' : '+2 XP Points'}
                                                                </Badge>
                                                            </div>
                                                            <MentionTextarea 
                                                                autoFocus
                                                                value={actionNote} 
                                                                onValueChange={setActionNote} 
                                                                placeholder="اشرح ما تم إنجازه اليوم لتمكين الحفظ... استخدم @ للمنشن" 
                                                                className="rounded-[2.5rem] border-none bg-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] p-8 font-medium text-xl leading-relaxed min-h-[160px] focus-visible:ring-2 focus-visible:ring-primary/20"
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex justify-end">
                                                            <Button 
                                                                onClick={handleStageAction} 
                                                                disabled={isSaving || !actionNote.trim()} 
                                                                className={cn(
                                                                    "h-14 px-20 rounded-[2rem] font-black text-xl shadow-2xl gap-4 min-w-[300px]",
                                                                    activeAction.type === 'complete' ? "bg-green-600 hover:bg-green-700 shadow-green-200" : 
                                                                    activeAction.type === 'start' ? "bg-primary shadow-primary/30" : "bg-orange-600 hover:bg-orange-700 shadow-orange-200"
                                                                )}
                                                            >
                                                                {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                                                                تأكيد وحفظ الإنجاز
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                             </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/10 p-10 flex justify-between border-t no-print">
                    <Button variant="ghost" onClick={() => router.back()} className="font-black gap-3 h-14 text-slate-500 rounded-3xl hover:bg-white px-10 transition-all"><ArrowRight className="h-6 w-6"/> العودة للجدول</Button>
                </CardFooter>
            </Card>

            {isTxFormOpen && (
                <ClientTransactionForm 
                    isOpen={isTxFormOpen} 
                    onClose={() => setIsTxFormOpen(false)} 
                    clientId={appointment.clientId!} 
                    clientName={client?.nameAr || ''}
                    fromAppointmentId={appointment.id}
                />
            )}
        </div>
    );
}
