'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Appointment, Client, WorkStage, ClientTransaction } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Link2, Plus, ShieldCheck, UserPlus, FileText, Target } from 'lucide-react';
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

/**
 * غرفة العمليات الميدانية (Sovereign Visit Control):
 * هذا هو "عقل الميدان" الذي يربط إنجاز المهندس بالدورة المستندية والمالية.
 * تم إصلاح التعارض عند تحويل عميل محتمل لضمان اختفاء التنبيه فور الربط.
 */
export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const tenantId = currentUser?.currentCompanyId;

    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, id ? `appointments/${id}` : null);
    
    // 🛡️ الربط اللحظي: جلب بيانات العميل بمجرد توفر الـ clientId
    const clientPath = useMemo(() => appointment?.clientId ? `clients/${appointment.clientId}` : null, [appointment?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
    
    const transactionPath = useMemo(() => (appointment?.clientId && appointment?.transactionId) ? `clients/${appointment.clientId}/transactions/${appointment.transactionId}` : null, [appointment]);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, transactionPath);

    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!firestore || !tenantId || !transaction?.transactionTypeId) return;

        const fetchStages = async () => {
            try {
                const txTypeSnap = await getDoc(doc(firestore, getTenantPath(`transactionTypes/${transaction.transactionTypeId}`, tenantId)));
                if (!txTypeSnap.exists()) return;
                
                const deptIds = txTypeSnap.data().departmentIds || [];
                const allStages: WorkStage[] = [];
                
                for (const deptId of deptIds) {
                    const stagesSnap = await getDocs(query(collection(firestore, getTenantPath(`departments/${deptId}/workStages`, tenantId)), orderBy('order')));
                    stagesSnap.docs.forEach(d => allStages.push({ id: d.id, ...d.data() } as WorkStage));
                }
                setWorkStages(allStages);
            } catch (e) {
                console.error("Error fetching stages:", e);
            }
        };
        fetchStages();
    }, [firestore, tenantId, transaction?.transactionTypeId]);

    const handleUpdateVisitStatus = async () => {
        if (!firestore || !currentUser || !tenantId || !appointment || !selectedStageId) return;
        setIsSaving(true);
        const stageTemplate = workStages.find(s => s.id === selectedStageId);
        
        try {
            const batch = writeBatch(firestore);
            const txPath = getTenantPath(`clients/${appointment.clientId}/transactions/${appointment.transactionId}`, tenantId);
            const apptPath = getTenantPath(`appointments/${appointment.id}`, tenantId);
            
            const txRef = doc(firestore, txPath);
            
            if (transaction) {
                const stages = [...(transaction.stages || [])];
                const stageIdx = stages.findIndex(s => s.stageId === selectedStageId);
                
                const stageUpdate = { 
                    stageId: selectedStageId, 
                    name: stageTemplate?.name, 
                    status: 'completed', 
                    endDate: serverTimestamp() 
                };
                
                if (stageIdx > -1) stages[stageIdx] = { ...stages[stageIdx], ...stageUpdate };
                else stages.push(stageUpdate);

                let financeComment = "";
                if (transaction.contract?.clauses) {
                    const updatedClauses = transaction.contract.clauses.map((clause: any) => {
                        if (clause.condition === stageTemplate?.name && clause.status === 'غير مستحقة') {
                            financeComment = `\n\n**[إشعار مالي]** استحقت دفعة "${clause.name}" بقيمة **${formatCurrency(clause.amount)}**.`;
                            return { ...clause, status: 'مستحقة' };
                        }
                        return clause;
                    });
                    batch.update(txRef, { 'contract.clauses': updatedClauses });
                }

                batch.update(txRef, { stages, status: 'in-progress', updatedAt: serverTimestamp() });
                
                const timelineRef = doc(collection(txRef, 'timelineEvents'));
                batch.set(timelineRef, {
                    type: 'comment', 
                    content: `**[محضر زيارة]**\nتم إنجاز مرحلة: ${stageTemplate?.name}\n\n**ملاحظات المهندس:**\n${notes}${financeComment}`, 
                    userId: currentUser.id, 
                    userName: currentUser.fullName, 
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            }

            batch.update(doc(firestore, apptPath), { 
                workStageUpdated: true, 
                notes, 
                actualCompletionDate: serverTimestamp() 
            });

            await batch.commit();
            toast({ title: 'تم توثيق الإنجاز', description: 'تم تحديث سير العمل والبيانات المالية بنجاح.' });
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
                            <Badge variant="outline" className="bg-white text-primary border-primary/20 font-black px-4">مركز تحكم الزيارة</Badge>
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">
                                {client?.nameAr || appointment.clientName}
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

                <CardContent className="p-10 space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                            <Label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">تاريخ الموعد</Label>
                            <p className="font-black text-lg text-slate-800 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                {apptDate ? format(apptDate, 'eeee, dd MMMM', { locale: ar }) : '-'}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                            <Label className="text-[10px] font-black text-slate-400 block mb-2 uppercase">وقت الزيارة</Label>
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
                                توثيق إنجاز الأعمال (WBS)
                            </h3>
                            <div className="grid gap-3">
                                <Label className="font-black text-slate-700 pr-2">ما هي المرحلة التي تم إكمالها؟ *</Label>
                                <InlineSearchList 
                                    value={selectedStageId} 
                                    onSelect={setSelectedStageId} 
                                    options={workStages.map(s => ({ value: s.id!, label: s.name }))} 
                                    placeholder="ابحث عن مرحلة الإنجاز المخططة..." 
                                    className="h-12 bg-white rounded-2xl border-2"
                                />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-slate-700 pr-2">محضر الاجتماع / الملاحظات الفنية</Label>
                                <Textarea 
                                    value={notes} 
                                    onChange={e => setNotes(e.target.value)} 
                                    placeholder="اكتب هنا ما تم الاتفاق عليه ليتم إدراجه في سجل العميل..." 
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
                                اعتماد الإنجاز وتفعيل المالية
                            </Button>
                        </div>
                    ) : appointment.workStageUpdated ? (
                        <Alert className="bg-green-50 border-green-200 rounded-[2rem] py-8 shadow-xl">
                            <Check className="h-8 w-8 text-green-600"/>
                            <AlertTitle className="text-green-800 font-black text-2xl mb-2">تم توثيق الزيارة بنجاح</AlertTitle>
                            <AlertDescription className="text-green-700 font-bold text-lg">
                                تم إغلاق ملف الزيارة، تحديث سجل العميل التاريخي، وتفعيل الدفعات المالية المرتبطة آلياً.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-6">
                            <Alert variant="destructive" className="rounded-[2rem] border-4 border-dashed border-red-200 py-8 bg-red-50/50">
                                <AlertCircle className="h-8 w-8 text-red-600"/>
                                <AlertTitle className="text-red-900 font-black text-2xl mb-2">إجراء مطلوب للربط</AlertTitle>
                                <AlertDescription className="text-red-800 font-bold text-lg leading-relaxed">
                                    {isProspective 
                                        ? "هذا الشخص (عميل محتمل)؛ يجب تحويله لملف رسمي لتمكين إدارة معاملاته وتفعيل الدفعات المالية."
                                        : "يرجى ربط هذه الزيارة بإحدى المعاملات المفتوحة لهذا العميل لتتمكن من تحديث مراحل الإنجاز."}
                                </AlertDescription>
                            </Alert>
                            
                            <div className="flex flex-col gap-4">
                                {isProspective ? (
                                    <Button asChild className="h-16 rounded-[2rem] font-black text-2xl gap-4 shadow-2xl bg-[#FF7A00] text-white">
                                        <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName || '')}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}&engineerId=${appointment.engineerId}`}>
                                            <UserPlus className="h-8 w-8" />
                                            تحويل لملف عميل رسمي الآن
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button asChild variant="outline" className="h-16 rounded-[2rem] font-black text-2xl gap-4 border-4 border-primary text-primary hover:bg-primary/5 shadow-xl">
                                        <Link href={`/dashboard/clients/${appointment.clientId}`}>
                                            <Link2 className="h-8 w-8" />
                                            ربط الزيارة بمعاملة حالية
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 flex justify-between border-t">
                    <Button variant="ghost" onClick={() => router.back()} className="font-black gap-2 h-12 text-slate-500 rounded-2xl hover:bg-white">
                        <ArrowRight className="h-5 w-5"/> العودة للجدول
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
