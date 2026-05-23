'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
import type { Appointment, Client, WorkStage, ClientTransaction, AppointmentAuditLog, TransactionStage, Holiday } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Link2, Plus, ShieldCheck, UserPlus, FileText, Target, History, RotateCcw } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';

export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding } = useBranding();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const tenantId = currentUser?.currentCompanyId;

    const apptPath = useMemo(() => id && tenantId ? getTenantPath(`appointments/${id}`, tenantId) : null, [id, tenantId]);
    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, apptPath);
    
    const auditPath = useMemo(() => id && tenantId ? getTenantPath(`appointments/${id}/auditLogs`, tenantId) : null, [id, tenantId]);
    const { data: auditLogs, loading: auditLoading } = useSubscription<AppointmentAuditLog>(
        firestore, 
        auditPath, 
        [orderBy('createdAt', 'desc')]
    );

    const clientPath = useMemo(() => appointment?.clientId && tenantId ? getTenantPath(`clients/${appointment.clientId}`, tenantId) : null, [appointment?.clientId, tenantId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
    
    const transactionPath = useMemo(() => (appointment?.clientId && appointment?.transactionId && tenantId) ? getTenantPath(`clients/${appointment.clientId}/transactions/${appointment.transactionId}`, tenantId) : null, [appointment, tenantId]);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, transactionPath);

    const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

    const [selectedStageId, setSelectedStageId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');

    const enrichedStages = useMemo(() => {
        if (!transaction?.stages) return [];
        return transaction.stages.filter(s => s.status !== 'completed');
    }, [transaction?.stages]);

    const handleUpdateVisitStatus = async () => {
        if (!firestore || !currentUser || !tenantId || !appointment || !selectedStageId || !transaction) return;
        setIsSaving(true);
        const stageToUpdate = transaction.stages?.find(s => s.stageId === selectedStageId);
        
        try {
            const batch = writeBatch(firestore);
            const txPath = getTenantPath(`clients/${appointment.clientId}/transactions/${appointment.transactionId}`, tenantId);
            const finalApptPath = getTenantPath(`appointments/${appointment.id}`, tenantId);
            const txRef = doc(firestore, txPath!);
            
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIdx = currentStages.findIndex(s => s.stageId === selectedStageId);
            
            if (stageIdx > -1) {
                const stage = currentStages[stageIdx];
                const now = new Date();

                // ✨ محرك التحديث الهجين / المتعدد ✨
                if (stage.trackingType === 'occurrence' || stage.trackingType === 'hybrid') {
                    const newCount = (stage.currentCount || 0) + 1;
                    stage.currentCount = newCount;
                    
                    if (stage.trackingType === 'occurrence' && stage.maxOccurrences && newCount >= stage.maxOccurrences) {
                        stage.status = 'completed';
                        stage.endDate = now;
                    } else {
                        stage.status = 'in-progress';
                    }
                } else {
                    stage.status = 'completed';
                    stage.endDate = now;
                }
                
                // ✨ ذكاء التبعية الموحد: البحث عن المرحلة التالية المبرمجة يدوياً ✨
                if (stage.status === 'completed') {
                    let nextStage = null;
                    if (stage.nextStageId) {
                        nextStage = currentStages.find(s => s.stageId === stage.nextStageId);
                    } else {
                        nextStage = currentStages.find(s => s.order === stage.order + 1);
                    }

                    if (nextStage && nextStage.status === 'pending') {
                        nextStage.status = 'in-progress';
                        nextStage.startDate = now;
                        if (nextStage.expectedDurationDays) {
                            const expEnd = addWorkingDays(
                                now, 
                                nextStage.expectedDurationDays, 
                                branding?.work_hours?.holidays || [], 
                                publicHolidays
                            );
                            nextStage.expectedEndDate = expEnd;
                        }
                    }
                }

                let financeComment = "";
                if (transaction.contract?.clauses) {
                    const updatedClauses = transaction.contract.clauses.map((clause: any) => {
                        if (clause.condition === stage.name && clause.status === 'غير مستحقة') {
                            financeComment = `\n\n**[إشعار مالي]** استحقت دفعة "${clause.name}" بقيمة **${formatCurrency(clause.amount)}**.`;
                            return { ...clause, status: 'مستحقة' };
                        }
                        return clause;
                    });
                    batch.update(txRef, { 'contract.clauses': updatedClauses });
                }

                batch.update(txRef, { stages: currentStages, updatedAt: serverTimestamp() });
                
                const timelineRef = doc(collection(txRef, 'timelineEvents'));
                batch.set(timelineRef, {
                    type: 'comment', 
                    content: `**[محضر زيارة]**\nتم تسجيل إنجاز في مرحلة: ${stage.name}${stage.trackingType === 'occurrence' ? ` (المرة رقم ${stage.currentCount})` : ''}\n\n**ملاحظات المهندس:**\n${notes}${financeComment}`, 
                    userId: currentUser.id, 
                    userName: currentUser.fullName, 
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            }

            const apptRef = doc(firestore, finalApptPath!);
            batch.update(apptRef, { 
                workStageUpdated: true, 
                notes, 
                actualCompletionDate: serverTimestamp(),
                updatedBy: currentUser.id,
                updatedAt: serverTimestamp()
            });

            const auditRef = doc(collection(apptRef, 'auditLogs'));
            batch.set(auditRef, {
                action: 'confirmed',
                details: `قام المهندس ${currentUser.fullName} بتوثيق إنجاز مرحلة "${stageToUpdate?.name}" وإغلاق الزيارة.`,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            toast({ title: 'تم توثيق الإنجاز', description: 'تم تحديث سير العمل آلياً بناءً على قواعد التبعية المعتمدة.' });
            router.push('/dashboard/appointments');
        } catch (e) { 
            toast({ variant: 'destructive', title: 'خطأ في التوثيق' }); 
        } finally { setIsSaving(false); }
    };

    if (apptLoading || clientLoading) return <div className="p-8 max-w-2xl mx-auto"><Skeleton className="h-[500px] w-full rounded-[3.5rem]" /></div>;
    if (!appointment) return <div className="p-20 text-center font-black opacity-30">الزيارة غير موجودة.</div>;

    const apptDate = toFirestoreDate(appointment.appointmentDate);
    const isProspective = !appointment.clientId;

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <Card className="rounded-[3.5rem] shadow-2xl border-none overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-10 px-10 border-b">
                    <div className="flex justify-between items-start">
                        <div className="space-y-2">
                            <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black px-4">مركز تحكم الزيارة الموحد</Badge>
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">
                                {appointment.clientId ? (
                                    <Link href={`/dashboard/clients/${appointment.clientId}`} className='hover:underline'>
                                        {client?.nameAr || appointment.clientName}
                                    </Link>
                                ) : (
                                    appointment.clientName
                                )}
                                {isProspective && <Badge className="mr-3 bg-orange-100 text-orange-700 font-black border-none text-[10px]">عميل محتمل</Badge>}
                            </CardTitle>
                            <CardDescription className="font-bold flex items-center gap-2 text-lg opacity-60">
                                <FileText className="h-4 w-4" />
                                {appointment.title}
                            </CardDescription>
                        </div>
                        <div className="text-left font-mono text-sm opacity-40">
                            {client?.fileId || '---'}
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <Tabs defaultValue="actions" dir="rtl">
                        <TabsList className="w-full h-14 bg-muted/20 border-b p-0 rounded-none">
                            <TabsTrigger value="actions" className="flex-1 h-full font-black text-xs gap-2 rounded-none data-[state=active]:bg-white">
                                <Save className="h-4 w-4" /> تنفيذ الإجراءات المعتمدة
                            </TabsTrigger>
                            <TabsTrigger value="audit" className="flex-1 h-full font-black text-xs gap-2 rounded-none data-[state=active]:bg-white">
                                <History className="h-4 w-4" /> سجل التدقيق والأرشفة
                            </TabsTrigger>
                        </TabsList>

                        <div className="p-10 space-y-10">
                            <TabsContent value="actions" className="m-0 space-y-10">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <Label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">تاريخ الموعد المخطط</Label>
                                        <p className="font-black text-lg text-slate-800 flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            {apptDate ? format(apptDate, 'eeee, dd MMMM', { locale: ar }) : '-'}
                                        </p>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                        <Label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">وقت الزيارة المعتمد</Label>
                                        <p className="font-black text-2xl font-mono text-primary flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            {apptDate ? format(apptDate, 'HH:mm', { locale: ar }) : '-'}
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                {!appointment.workStageUpdated && appointment.transactionId ? (
                                    <div className="p-8 border-4 border-dashed border-primary/20 bg-primary/5 rounded-[2.5rem] space-y-6 animate-in zoom-in-95 duration-500">
                                        <h3 className="font-black text-primary flex items-center gap-3 text-xl">
                                            <Workflow className="h-6 w-6 animate-pulse"/> 
                                            توثيق إنجاز الأعمال الميدانية
                                        </h3>
                                        <div className="grid gap-3">
                                            <Label className="font-black text-slate-700 pr-2">ما هي المرحلة التي تم إنجازها اليوم؟ *</Label>
                                            <InlineSearchList 
                                                value={selectedStageId} 
                                                onSelect={setSelectedStageId} 
                                                options={enrichedStages.map(s => ({ 
                                                    value: s.stageId, 
                                                    label: `${s.name} ${s.trackingType === 'occurrence' ? `(المرة ${ (s.currentCount || 0) + 1 })` : ''}` 
                                                }))} 
                                                placeholder="ابحث عن مرحلة الإنجاز المخططة..." 
                                                className="h-12 bg-white rounded-2xl border-2"
                                            />
                                        </div>
                                        <div className="grid gap-3">
                                            <Label className="font-black text-slate-700 pr-2">محضر الاجتماع المعتمد / الملاحظات</Label>
                                            <Textarea 
                                                value={notes} 
                                                onChange={e => setNotes(e.target.value)} 
                                                placeholder="اكتب هنا ما تم الاتفاق عليه ليتم إدراجه في سجل العميل الموحد..." 
                                                rows={5}
                                                className="rounded-3xl border-2 bg-white p-6 shadow-inner"
                                            />
                                        </div>
                                        <Button 
                                            onClick={handleUpdateVisitStatus} 
                                            disabled={isSaving || !selectedStageId} 
                                            className="w-full h-14 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-primary/30"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                                            اعتماد الإنجاز وإغلاق الزيارة
                                        </Button>
                                    </div>
                                ) : appointment.workStageUpdated ? (
                                    <Alert className="bg-green-50 border-green-200 rounded-[2rem] py-8 shadow-xl">
                                        <Check className="h-8 w-8 text-green-600"/>
                                        <AlertTitle className="text-green-800 font-black text-2xl mb-2">تم توثيق الزيارة بنجاح</AlertTitle>
                                        <AlertDescription className="text-green-700 font-bold text-lg">
                                            تم إغلاق ملف الزيارة وتحديث مسار الـ WBS بنجاح.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="space-y-6">
                                        <Alert variant="destructive" className="rounded-[2rem] border-4 border-dashed border-red-200 py-8 bg-red-50/50">
                                            <AlertCircle className="h-8 w-8 text-red-600"/>
                                            <AlertTitle className="text-red-900 font-black text-2xl mb-2">إجراء مطلوب لربط البيانات</AlertTitle>
                                            <AlertDescription className="text-red-800 font-bold text-lg leading-relaxed">
                                                {isProspective 
                                                    ? "هذا الشخص (عميل محتمل)؛ يجب تحويله لملف رسمي لتمكين إدارة معاملاته."
                                                    : "يرجى ربط هذه الزيارة بإحدى المعاملات المفتوحة لهذا العميل لتتمكن من تحديث مراحل الإنجاز."}
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="audit" className="m-0 space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                                        <History className="h-5 w-5 text-primary" /> سجل حركات الموعد والأرشفة الرسمية
                                    </h3>
                                    
                                    {auditLoading ? (
                                        <div className="space-y-3">
                                            <Skeleton className="h-16 w-full rounded-2xl" />
                                            <Skeleton className="h-16 w-full rounded-2xl" />
                                        </div>
                                    ) : auditLogs.length === 0 ? (
                                        <div className="p-10 text-center opacity-30 italic font-bold">لا يوجد سجل حركات موثق لهذا الموعد.</div>
                                    ) : (
                                        <div className="relative pr-6 border-r-2 border-slate-100 space-y-8">
                                            {auditLogs.map((log) => (
                                                <div key={log.id} className="relative flex items-start gap-4">
                                                    <div className="absolute -right-[1.85rem] top-1 p-1 bg-white rounded-full border-2 shadow-sm"><div className="h-3 w-3 rounded-full bg-primary" /></div>
                                                    <div className="flex-1 bg-slate-50 p-4 rounded-2xl border shadow-inner group">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Avatar className="h-6 w-6 border-2 border-white shadow-sm">
                                                                    <AvatarImage src={log.userAvatar} />
                                                                    <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">{log.userName?.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="font-black text-sm text-[#1e1b4b]">{log.userName}</span>
                                                            </div>
                                                            <span className="text-[10px] font-mono font-bold text-slate-400">
                                                                {toFirestoreDate(log.createdAt) ? format(toFirestoreDate(log.createdAt)!, 'dd/MM HH:mm') : ''}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{log.details}</p>
                                                        <div className="mt-2 flex justify-end">
                                                            <Badge variant="outline" className="text-[8px] font-black uppercase bg-white/50">{log.action}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 flex justify-between border-t">
                    <Button variant="ghost" onClick={() => router.back()} className="font-black gap-2 h-12 text-slate-500 rounded-2xl hover:bg-white">
                        <ArrowRight className="h-5 w-5"/> العودة لجدول المواعيد
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
