
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Appointment, Client, ClientTransaction, TransactionStage, Holiday } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
    AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Link2, ShieldCheck, UserPlus, 
    FileText, Target, History, RotateCcw, IterationCcw, CheckCircle2, Lock, Ban, ChevronLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { formatCurrency, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';

const stageStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'معلقة',
  'in-progress': 'قيد العمل',
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
                stage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, stage.expectedDurationDays || 7, branding?.work_hours?.holidays || [], publicHolidays));
            } else if (action === 'modify') {
                stage.currentCount = (stage.currentCount || 0) + 1;
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                // تفعيل المرحلة التالية تلقائياً
                const nextStage = currentStages.find(s => s.order === stage.order + 1);
                if (nextStage && nextStage.status === 'pending') {
                    nextStage.status = 'in-progress';
                    nextStage.startDate = Timestamp.fromDate(now);
                    nextStage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, nextStage.expectedDurationDays || 7, branding?.work_hours?.holidays || [], publicHolidays));
                }
            }

            batch.update(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            
            const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(timelineRef, {
                type: 'comment',
                content: `تم تسجيل ${action === 'complete' ? 'إنجاز' : action === 'start' ? 'بدء عمل' : 'تعديل'} في مرحلة ${stage.name}. ${actionNote ? `\nملاحظة: ${actionNote}` : ''}`,
                userId: currentUser.id,
                userName: currentUser.fullName,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            if (action === 'complete') {
                batch.update(doc(firestore, apptPath!), { workStageUpdated: true, actualCompletionDate: serverTimestamp() });
            }

            await batch.commit();
            toast({ title: 'تم حفظ المعلومات' });
            setActionNote('');
        } finally { setIsSaving(false); }
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
                                <Calendar className="h-4 w-4" /> {apptDate ? format(apptDate, 'eeee, dd MMMM HH:mm', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white px-4 h-7 rounded-full font-black border-primary/20 text-primary">زيارة معمارية</Badge>
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
                                <Button asChild className="w-full h-14 rounded-2xl font-black text-lg bg-orange-600 hover:bg-orange-700">
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName)}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}`}>تأسيس ملف عميل رسمي</Link>
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <Label className="font-black pr-2">اختر المعاملة للربط:</Label>
                                    <InlineSearchList 
                                        value={''} 
                                        onSelect={async (v) => {
                                            await updateDoc(doc(firestore!, apptPath!), { transactionId: v });
                                            toast({ title: 'تم ربط المسار الفني' });
                                        }} 
                                        options={clientTransactions.map(t => ({ value: t.id!, label: t.transactionType }))} 
                                        placeholder="ابحث عن معاملة..."
                                    />
                                    <Button variant="ghost" onClick={() => setIsTxFormOpen(true)} className="w-full text-xs font-bold text-primary underline">فتح معاملة جديدة +</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8">
                             <div className="flex items-center gap-3 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                <Target className="h-5 w-5 text-primary" />
                                <div><p className="text-[10px] font-black text-primary uppercase">المسار الفني المرتبط</p><p className="font-black text-lg text-[#1e1b4b]">{transaction?.transactionType}</p></div>
                             </div>

                             <div className="space-y-6">
                                <h3 className="font-black text-lg border-r-4 border-primary pr-3">المراحل التنفيذية المتاحة</h3>
                                <div className="space-y-4">
                                    {(transaction?.stages || []).map((stage, idx) => {
                                        const isCompleted = stage.status === 'completed';
                                        const isCurrent = stage.status === 'in-progress';
                                        const isLocked = idx > 0 && transaction.stages![idx-1].status !== 'completed';

                                        // إظهار المراحل تدريجياً: فقط المرحلة الحالية أو المرحلة التالية القابلة للفتح
                                        if (isLocked && !isCurrent) return null;

                                        return (
                                            <div key={stage.stageId} className={cn(
                                                "p-6 border-2 rounded-[2rem] transition-all",
                                                isCurrent ? "border-primary bg-primary/5 shadow-lg" : "border-slate-100 opacity-60"
                                            )}>
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="space-y-1">
                                                        <span className="font-black text-lg block">{stage.name}</span>
                                                        <Badge variant="outline" className={cn("text-[9px] font-black", stageStatusColors[stage.status])}>{stageStatusTranslations[stage.status]}</Badge>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {stage.status === 'pending' && !isLocked && (
                                                            <Button size="sm" onClick={() => handleStageAction(stage.stageId, 'start')} className="rounded-xl font-black px-6 h-9">بدء</Button>
                                                        )}
                                                        {isCurrent && (
                                                            <>
                                                                <Button variant="outline" size="sm" onClick={() => handleStageAction(stage.stageId, 'modify')} className="rounded-xl font-black px-6 h-9 border-orange-200 text-orange-700">تعديل</Button>
                                                                <Button size="sm" onClick={() => handleStageAction(stage.stageId, 'complete')} className="rounded-xl font-black px-6 h-9 bg-green-600 hover:bg-green-700 text-white">إنهاء</Button>
                                                            </>
                                                        )}
                                                        {isCompleted && <div className="p-2 bg-green-100 rounded-full text-green-700"><Check className="h-4 w-4"/></div>}
                                                    </div>
                                                </div>
                                                {isCurrent && (
                                                    <Textarea 
                                                        value={actionNote} 
                                                        onChange={e => setActionNote(e.target.value)} 
                                                        placeholder="أدخل ملاحظات العمل لهذا الإجراء (اختياري)..." 
                                                        className="mt-4 rounded-xl border-none shadow-inner bg-white/50 text-sm"
                                                    />
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
