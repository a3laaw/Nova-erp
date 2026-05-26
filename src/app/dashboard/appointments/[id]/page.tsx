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
    updateDoc 
} from 'firebase/firestore';
import type { Appointment, Client, ClientTransaction, TransactionStage, Holiday } from '@/lib/types';
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
    Play
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { formatCurrency, getTenantPath, cleanFirestoreData, cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const stageStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-800 border-slate-200',
  'in-progress': 'bg-blue-50 text-blue-800 border-blue-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'بانتظار البدء',
  'in-progress': 'قيد العمل الميداني',
  completed: 'تم الإنجاز',
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

    const apptPath = useMemo(() => id && tenantId ? getTenantPath(`appointments/${id}`, tenantId) : null, [id, tenantId]);
    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, apptPath);
    
    const clientPath = useMemo(() => appointment?.clientId && tenantId ? getTenantPath(`clients/${appointment.clientId}`, tenantId) : null, [appointment?.clientId, tenantId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
    
    const transactionPath = useMemo(() => (appointment?.clientId && appointment?.transactionId && tenantId) ? getTenantPath(`clients/${appointment.clientId}/transactions/${appointment.transactionId}`, tenantId) : null, [appointment, tenantId]);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, transactionPath);

    const { data: clientTransactions = [] } = useSubscription<ClientTransaction>(firestore, appointment?.clientId ? `clients/${appointment.clientId}/transactions` : null, [where('status', 'in', ['new', 'in-progress'])]);
    const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

    const handleStageAction = async (stageId: string, action: 'start' | 'modify' | 'complete') => {
        if (!firestore || !currentUser || !transaction || !transactionPath || !tenantId) return;
        
        // 🛡️ درع الرقابة الإلزامي: لا إجراء بدون تعليق 🛡️
        if (!actionNote.trim()) {
            toast({ variant: 'destructive', title: 'تنبيه', description: 'يرجى كتابة ملاحظات العمل الميداني أولاً لتوثيق الإجراء.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            const stage = currentStages[stageIndex];
            const now = new Date();

            if (action === 'start') {
                stage.status = 'in-progress';
                stage.startDate = Timestamp.fromDate(now);
                if (stage.expectedDurationDays) {
                    stage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, stage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                }
            } else if (action === 'modify') {
                stage.currentCount = (stage.currentCount || 0) + 1;
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                
                const nextStage = currentStages.find(s => s.order === stage.order + 1);
                if (nextStage && nextStage.status === 'pending') {
                    nextStage.status = 'in-progress';
                    nextStage.startDate = Timestamp.fromDate(now);
                    if (nextStage.expectedDurationDays) {
                        nextStage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, nextStage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                    }
                }
            }

            batch.update(doc(firestore, transactionPath), cleanFirestoreData({ stages: currentStages, updatedAt: serverTimestamp() }));
            
            const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(timelineRef, {
                type: 'comment', // تحويله لتعليق لضمان الظهور في التايم لاين
                content: `**[إجراء ميداني: ${action === 'complete' ? 'إنهاء' : action === 'start' ? 'بدء' : 'تعديل'}]** في مرحلة: ${stage.name}.\nالملاحظات: ${actionNote}`,
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

                const contract = transaction.contract;
                if (contract?.clauses) {
                    const clauseIndex = contract.clauses.findIndex((c: any) => c.condition === stage.name);
                    if (clauseIndex !== -1 && contract.clauses[clauseIndex].status === 'غير مستحقة') {
                        const updatedClauses = [...contract.clauses];
                        updatedClauses[clauseIndex].status = 'مستحقة';
                        batch.update(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });

                        const appRef = doc(collection(firestore, getTenantPath('payment_applications', tenantId)!));
                        batch.set(appRef, cleanFirestoreData({
                            applicationNumber: `APP-AUTO-${now.getTime().toString().substring(7)}`,
                            date: serverTimestamp(),
                            projectId: transaction.id,
                            clientId: transaction.clientId,
                            clientName: client?.nameAr,
                            projectName: transaction.transactionType,
                            totalAmount: updatedClauses[clauseIndex].amount,
                            status: 'draft',
                            createdAt: serverTimestamp(),
                            createdBy: 'system-auto-chain',
                            companyId: tenantId
                        }));
                    }
                }
            }

            await batch.commit();
            toast({ title: 'تم حفظ المعلومات' });
            setActionNote('');
        } catch (e: any) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: transactionPath,
                operation: 'write'
            }));
        } finally { setIsSaving(false); }
    };

    const handleLinkTransaction = async (txId: string) => {
        if (!firestore || !apptPath || !tenantId) return;
        const apptRef = doc(firestore, apptPath);
        await updateDoc(apptRef, { transactionId: txId });
        toast({ title: 'تم ربط المسار الفني' });
    };

    if (apptLoading || clientLoading) return <div className="p-10"><Skeleton className="h-96 w-full rounded-[3rem]" /></div>;
    if (!appointment) return <div className="p-20 text-center font-black opacity-30">الموعد غير موجود.</div>;

    const apptDate = toFirestoreDate(appointment.appointmentDate);

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <Card className="rounded-[3rem] shadow-2xl border-none overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black">{appointment.clientName}</CardTitle>
                            <CardDescription className="font-bold flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" /> {apptDate ? format(apptDate, 'eeee, dd MMMM HH:mm', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white px-4 h-7 rounded-full font-black border-primary/20 text-primary shadow-sm">زيارة معمارية</Badge>
                    </div>
                </CardHeader>

                <CardContent className="p-10 space-y-10">
                    {!appointment.transactionId ? (
                        <div className="space-y-6 animate-in slide-in-from-top-4">
                            <Alert className="rounded-3xl border-2 border-orange-200 bg-orange-50">
                                <AlertCircle className="h-5 w-5 text-orange-600" />
                                <AlertTitle className="font-black text-orange-900">ربط المسار الفني</AlertTitle>
                                <AlertDescription className="text-orange-700 font-bold">يرجى ربط هذه الزيارة بإحدى المعاملات النشطة للتمكن من توثيق الإنجاز.</AlertDescription>
                            </Alert>
                            {!appointment.clientId ? (
                                <Button asChild className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName)}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}`}>تأسيس ملف عميل رسمي</Link>
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <Label className="font-black pr-2">اختر المعاملة للربط:</Label>
                                    <InlineSearchList 
                                        value={''} 
                                        onSelect={handleLinkTransaction} 
                                        options={clientTransactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                        placeholder="ابحث عن معاملة..."
                                    />
                                    <Button variant="ghost" onClick={() => setIsTxFormOpen(true)} className="w-full text-xs font-bold text-primary underline hover:bg-primary/5">فتح معاملة جديدة +</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-10">
                             <div className="flex items-center gap-3 bg-primary/5 p-6 rounded-[2.5rem] border-2 border-dashed border-primary/20">
                                <div className="p-3 bg-white rounded-2xl shadow-inner text-primary"><Target className="h-7 w-7" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">المسار الفني المرتبط</p>
                                    <p className="font-black text-xl text-slate-900">{transaction?.transactionType}</p>
                                </div>
                             </div>

                             <div className="space-y-6">
                                <h3 className="font-black text-lg border-r-8 border-primary pr-4 flex items-center gap-3">
                                    <Workflow className="h-6 w-6 text-primary" /> مراحل الإنجاز الميداني (WBS)
                                </h3>
                                
                                <div className="space-y-8">
                                    {(transaction?.stages || []).map((stage, idx) => {
                                        const isCompleted = stage.status === 'completed';
                                        const isCurrent = stage.status === 'in-progress';
                                        const isLockedRow = idx > 0 && transaction.stages![idx-1].status !== 'completed';

                                        if (isLockedRow && !isCurrent) return null;

                                        return (
                                            <div key={stage.stageId} className={cn(
                                                "p-8 border-2 rounded-[2.5rem] transition-all relative group",
                                                isCurrent ? "border-primary bg-primary/5 shadow-2xl scale-[1.02]" : "border-slate-100 opacity-60"
                                            )}>
                                                <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                                                    <div className="flex items-center gap-6">
                                                        <Badge variant="outline" className={cn("w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", stageStatusColors[stage.status])}>
                                                            {stageStatusTranslations[stage.status]}
                                                        </Badge>
                                                        <div className="space-y-1">
                                                            <span className="font-black text-xl text-slate-900">{stage.name}</span>
                                                            {isCurrent && stage.expectedEndDate && (
                                                                <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" /> التسليم المخطط: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    
                                                    {isCompleted && (
                                                        <div className="p-3 bg-green-100 rounded-full text-green-700 shadow-inner"><CheckCircle2 className="h-7 w-7"/></div>
                                                    )}
                                                </div>

                                                {isCurrent && (
                                                    <div className="mt-8 pt-8 border-t border-dashed border-primary/20 space-y-6">
                                                        <div className="space-y-3">
                                                            <Label className="font-black text-xs text-primary flex items-center gap-2 uppercase tracking-widest">
                                                                <MessageSquare className="h-4 w-4" /> محضر الأعمال الميدانية (إلزامي) *
                                                            </Label>
                                                            <Textarea 
                                                                value={actionNote} 
                                                                onChange={e => setActionNote(e.target.value)} 
                                                                placeholder="اكتب هنا ملخص الأعمال التي تمت لتمكين أزرار الإنجاز..." 
                                                                className="rounded-3xl border-none bg-white shadow-inner p-5 font-medium text-lg leading-relaxed min-h-[120px]"
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-3">
                                                            <Button 
                                                                onClick={() => handleStageAction(stage.stageId, 'modify')} 
                                                                disabled={isSaving || !actionNote.trim()} 
                                                                variant="outline" 
                                                                className="flex-1 h-12 rounded-2xl font-black gap-2 border-orange-200 text-orange-700 bg-white"
                                                            >
                                                                <Pencil className="h-4 w-4" /> تسجيل تعديل
                                                            </Button>
                                                            <Button 
                                                                onClick={() => handleStageAction(stage.stageId, 'complete')} 
                                                                disabled={isSaving || !actionNote.trim()} 
                                                                className="flex-[2] h-12 rounded-2xl font-black gap-2 bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-100"
                                                            >
                                                                <CheckCircle2 className="h-5 w-5" /> إنهاء المرحلة
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}

                                                {!isLocked && stage.status === 'pending' && (
                                                    <div className="mt-6 pt-6 border-t border-dashed border-slate-100 space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black text-slate-400">اكتب ملاحظة البدء لتفعيل المسار:</Label>
                                                            <Input 
                                                                value={actionNote} 
                                                                onChange={e => setActionNote(e.target.value)} 
                                                                placeholder="مثال: استلام الموقع وبدء الأعمال..."
                                                                className="h-10 rounded-xl bg-white border-dashed border-2"
                                                            />
                                                        </div>
                                                        <Button 
                                                            onClick={() => handleStageAction(stage.stageId, 'start')} 
                                                            disabled={isSaving || !actionNote.trim()} 
                                                            className="w-full h-11 rounded-2xl font-black gap-2"
                                                        >
                                                            <Play className="h-4 w-4" /> بدء العمل الميداني
                                                        </Button>
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
                <CardFooter className="bg-muted/10 p-8 flex justify-between border-t no-print">
                    <Button variant="ghost" onClick={() => router.back()} className="font-black gap-2 h-12 text-slate-500 rounded-2xl hover:bg-white"><ArrowRight className="h-5 w-5"/> العودة</Button>
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
