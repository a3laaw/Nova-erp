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
} from 'lucide-react';
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
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  'in-progress': 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
};

const stageBorderColors: Record<string, string> = {
  pending: 'border-r-slate-300',
  'in-progress': 'border-r-blue-500',
  completed: 'border-r-green-500',
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

    const handleUndoStage = async (stageId: string) => {
        if (!firestore || !transaction || !transactionPath || !tenantId || isLocked) return;
        
        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
        const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
        
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
            
            for (let i = stageIndex; i < currentStages.length; i++) {
                currentStages[i].status = i === stageIndex ? 'in-progress' : 'pending';
                currentStages[i].endDate = null;
                if (i > stageIndex) {
                    currentStages[i].startDate = null;
                    currentStages[i].expectedEndDate = null;
                }
            }

            const stage = currentStages[stageIndex];
            
            let cancelledAmount = 0;
            const contract = transaction.contract;
            if (contract?.clauses) {
                const clause = contract.clauses.find((c: any) => c.condition === stage.name);
                if (clause) cancelledAmount = clause.amount || 0;
            }

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

            if (contract?.clauses) {
                const updatedClauses = contract.clauses.map((c: any) => {
                    if (c.condition === stage.name) return { ...c, status: 'غير مستحقة' };
                    return c;
                });
                batch.update(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });
            }

            batch.update(doc(firestore, transactionPath), { 
                stages: currentStages, 
                updatedAt: serverTimestamp() 
            });

            if (appointment && appointment.workStageUpdated) {
                batch.update(doc(firestore, apptPath!), { workStageUpdated: false, status: 'scheduled' });
            }

            const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(timelineRef, {
                type: 'comment',
                content: `**[تراجع تقني ومالي متسلسل وقسري]**\nتم التراجع عن إغلاق مرحلة **"${stage.name}"**.\n\n• تمت إعادة المرحلة لحالة قيد التنفيذ.\n• تم تصفير كافة المراحل اللاحقة قسرياً لضمان سلامة المسار.\n• تم إلغاء المطالبة المالية المرتبطة بقيمة **${formatCurrency(cancelledAmount)}** وتصفير استحقاق العقد.`,
                userId: currentUser?.id,
                userName: currentUser?.fullName,
                userAvatar: currentUser?.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            toast({ title: '✅ تم التراجع والتصفير المتسلسل' });
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

    if (apptLoading || clientLoading) return <div className="p-10"><Skeleton className="h-96 w-full rounded-2xl" /></div>;
    if (!appointment) return <div className="p-20 text-center font-black opacity-30">الموعد غير موجود.</div>;

    const apptDate = toFirestoreDate(appointment.appointmentDate);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20" dir="rtl">
            <Card className="rounded-2xl shadow-lg border-slate-200 overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                {/* تم تكبير خط العميل ليكون بارزاً */}
                                <CardTitle className="text-2xl font-bold text-slate-900">{appointment.clientName}</CardTitle>
                                {appointment.clientId && (
                                    <UniversalActionTrigger 
                                        title={appointment.clientName}
                                        clientId={appointment.clientId} 
                                        sourceModule="المواعيد"
                                        sourceId={appointment.id!}
                                    />
                                )}
                            </div>
                            <CardDescription className="font-semibold flex items-center gap-2 text-slate-500 text-sm">
                                <Calendar className="h-4 w-4 text-primary" /> {apptDate ? format(apptDate, 'eeee, dd MMMM yyyy - HH:mm', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white px-4 h-7 rounded-lg font-bold border-slate-200 text-primary shadow-sm uppercase tracking-wider text-[10px]">Site Visit</Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-8">
                    {!appointment.transactionId ? (
                        <div className="space-y-4 animate-in slide-in-from-top-4">
                            <Alert className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                <AlertTitle className="font-bold text-orange-900 text-sm">ارتباط فني مفقود</AlertTitle>
                                <AlertDescription className="text-orange-700 text-sm mt-1">يرجى ربط هذه الزيارة بإحدى المعاملات النشطة للتمكن من توثيق الإنجاز.</AlertDescription>
                            </Alert>
                            {!appointment.clientId ? (
                                <Button asChild className="w-full h-12 rounded-xl font-bold text-base shadow-md shadow-primary/20">
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName)}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}`}>تأسيس ملف عميل رسمي</Link>
                                </Button>
                            ) : (
                                <div className="space-y-3 p-4 bg-white rounded-xl border border-slate-200">
                                    <Label className="font-bold text-slate-600 text-sm">اختر المعاملة المستهدفة:</Label>
                                    <InlineSearchList 
                                        value={''} 
                                        onSelect={handleLinkTransaction} 
                                        options={clientTransactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                        placeholder="ابحث عن مسار فني (تصميم، تراخيص...)"
                                        className="h-11 border-slate-200 rounded-lg"
                                    />
                                    <Button variant="ghost" onClick={() => setIsTxFormOpen(true)} className="w-full text-xs font-bold text-primary underline hover:bg-primary/5">فتح معاملة جديدة لهذا العميل +</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                             <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10 group">
                                <div className="p-3 bg-white rounded-lg shadow-sm text-primary"><Target className="h-5 w-5" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">المسار الفني المرتبط</p>
                                    {/* تم تكبير خط المعاملة ليكون واضحاً */}
                                    <p className="font-bold text-xl text-slate-900">{transaction?.transactionType}</p>
                                </div>
                             </div>

                             <div className="space-y-4">
                                <h3 className="font-bold text-lg border-r-4 border-primary pr-3 flex items-center gap-2 text-slate-900">
                                    <Workflow className="h-5 w-5 text-primary" /> مراحل الإنجاز الميداني (WBS)
                                </h3>
                                
                                <div className="space-y-3">
                                    {(transaction?.stages || []).map((stage, idx) => {
                                        const isCompleted = stage.status === 'completed';
                                        const isCurrent = stage.status === 'in-progress';
                                        const isPending = stage.status === 'pending';
                                        
                                        const isLockedRow = idx > 0 && transaction.stages![idx-1].status !== 'completed';
                                        const isActionActive = activeAction?.stageId === stage.stageId;
                                        const isLastCompleted = isCompleted && !transaction.stages!.some((s, sIdx) => s.status === 'completed' && sIdx > idx);

                                        return (
                                            <div key={stage.stageId} className={cn(
                                                "relative bg-white rounded-xl border shadow-sm transition-all overflow-hidden",
                                                stageBorderColors[stage.status],
                                                isCurrent ? "border-blue-100 shadow-blue-50" : "border-slate-100",
                                                isCompleted && "bg-green-50/30 opacity-90",
                                                isLockedRow && "opacity-50"
                                            )}>
                                                <div className="p-5 pr-6">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-center">
                                                                <div className="text-[10px] font-bold text-slate-400 mb-1">مرحلة</div>
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">{idx + 1}</div>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    {/* حجم خط المراحل: كبير ومريح (text-lg) بدل الصغير جداً أو الكبير المنتفخ */}
                                                                    <span className="text-lg font-bold text-slate-900">{stage.name}</span>
                                                                    <Badge variant="outline" className={cn("h-5 px-2 justify-center rounded-md font-bold text-[10px] border", stageStatusColors[stage.status])}>
                                                                        {stageStatusTranslations[stage.status]}
                                                                    </Badge>
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
                                                                    <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                                                                        <Clock className="h-3 w-3" /> التسليم: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}
                                                                    </p>
                                                                )}
                                                                {isCompleted && stage.endDate && (
                                                                    <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                                                        <CheckCircle2 className="h-3 w-3" /> تم الإنجاز: {format(toFirestoreDate(stage.endDate)!, 'dd/MM/yyyy')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 no-print">
                                                            {isCurrent && !isActionActive && (
                                                                <div className="flex gap-2">
                                                                    <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'modify' })} variant="outline" size="sm" className="h-9 px-3 rounded-lg font-bold text-xs gap-1.5 border-orange-200 text-orange-700 bg-white hover:bg-orange-50"><Edit3 className="h-3.5 w-3.5" /> تعديل</Button>
                                                                    <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'complete' })} size="sm" className="h-9 px-4 rounded-lg font-bold text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white shadow-sm"><CheckCircle2 className="h-3.5 w-3.5" /> إنهاء</Button>
                                                                </div>
                                                            )}
                                                            {isPending && !isLockedRow && !isActionActive && !isLocked && (
                                                                <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'start' })} size="sm" className="h-9 px-4 rounded-lg font-bold text-xs gap-1.5 shadow-sm"><Play className="h-3.5 w-3.5" /> بدء الزيارة</Button>
                                                            )}
                                                            {isCompleted && (
                                                                <div className="flex items-center gap-2">
                                                                    {isPrivileged && isLastCompleted && (
                                                                        <Button variant="ghost" size="sm" onClick={() => handleUndoStage(stage.stageId)} className="h-7 px-2 rounded-md text-orange-600 hover:bg-orange-50 font-bold gap-1 text-[10px]">
                                                                            <Undo2 className="h-3 w-3" /> تراجع
                                                                        </Button>
                                                                    )}
                                                                    <div className="p-1.5 bg-green-100 rounded-md text-green-700"><CheckCircle2 className="h-4 w-4"/></div>
                                                                </div>
                                                            )}
                                                            {isActionActive && <Button variant="ghost" size="icon" onClick={() => setActiveAction(null)} className="h-8 w-8 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-4 w-4"/></Button>}
                                                        </div>
                                                    </div>

                                                    {isActionActive && (
                                                        <div className="mt-5 pt-5 border-t border-dashed border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center">
                                                                    <Label className="font-bold text-sm text-slate-600 flex items-center gap-1.5">
                                                                        <MessageSquare className="h-3.5 w-3.5 text-primary" /> محضر الأعمال (إلزامي) *
                                                                    </Label>
                                                                    <Badge className="bg-primary/10 text-primary border-none text-[8px] font-bold uppercase flex items-center gap-1 py-0.5">
                                                                        <Zap className="h-2.5 w-2.5 fill-primary" /> {activeAction.type === 'complete' ? '+10 XP' : '+2 XP'}
                                                                    </Badge>
                                                                </div>
                                                                <MentionTextarea 
                                                                    autoFocus
                                                                    value={actionNote} 
                                                                    onValueChange={setActionNote} 
                                                                    placeholder="اشرح ما تم إنجازه اليوم لتمكين الحفظ... استخدم @ للمنشن" 
                                                                    className="rounded-xl border-slate-200 bg-white shadow-sm p-4 font-medium text-sm leading-relaxed min-h-[120px] focus-visible:ring-1 focus-visible:ring-primary/30"
                                                                />
                                                            </div>
                                                            
                                                            <div className="flex justify-end">
                                                                <Button 
                                                                    onClick={handleStageAction} 
                                                                    disabled={isSaving || !actionNote.trim()} 
                                                                    className={cn(
                                                                        "h-10 px-8 rounded-xl font-bold text-sm shadow-md gap-2",
                                                                        activeAction.type === 'complete' ? "bg-green-600 hover:bg-green-700" : 
                                                                        activeAction.type === 'start' ? "bg-primary" : "bg-orange-600 hover:bg-orange-700"
                                                                    )}
                                                                >
                                                                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                                                                    تأكيد وحفظ
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                             </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-slate-50 p-4 flex justify-between border-t border-slate-100 no-print">
                    <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2 h-10 text-slate-500 rounded-xl hover:bg-white px-6"><ArrowRight className="h-5 w-5"/> العودة للجدول</Button>
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