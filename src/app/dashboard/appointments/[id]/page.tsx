'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, limit } from 'firebase/firestore';
import type { Appointment, Client, WorkStage, ClientTransaction, TransactionStage } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Link2, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { Separator } from '@/components/ui/separator';

/**
 * صفحة تفاصيل الزيارة (مركز التحكم الميداني):
 * - تسمح بتوثيق نتائج الزيارة وتحديث مراحل العمل (WBS).
 * - تقوم بتفعيل استحقاق الدفعات المالية في العقد آلياً عند إنجاز المراحل.
 * - تسمح بتحويل العملاء المحتملين إلى عملاء رسميين.
 */
export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // --- جلب البيانات الأساسية ---
    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, id ? `appointments/${id}` : null);
    const { data: client } = useDocument<Client>(firestore, appointment?.clientId ? `clients/${appointment.clientId}` : null);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, (appointment?.clientId && appointment?.transactionId) ? `clients/${appointment.clientId}/transactions/${appointment.transactionId}` : null);

    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');

    // جلب مراحل العمل المعتمدة للقسم المعماري
    useEffect(() => {
        if (!firestore) return;
        const fetchStages = async () => {
            const deptSnap = await getDocs(query(collection(firestore, 'departments'), where('name', '==', 'القسم المعماري'), limit(1)));
            if (!deptSnap.empty) {
                const stagesSnap = await getDocs(query(collection(firestore, `departments/${deptSnap.docs[0].id}/workStages`), orderBy('order')));
                setWorkStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage)));
            }
        };
        fetchStages();
    }, [firestore]);

    // معالجة تحديث مرحلة العمل والربط المالي
    const handleUpdateStage = async () => {
        if (!firestore || !currentUser || !appointment || !selectedStageId) return;
        setIsSaving(true);
        const stageTemplate = workStages.find(s => s.id === selectedStageId);
        
        try {
            const batch = writeBatch(firestore);
            const txRef = doc(firestore, `clients/${appointment.clientId}/transactions/${appointment.transactionId}`);
            const txSnap = await getDoc(txRef);
            
            if (txSnap.exists()) {
                const txData = txSnap.data() as ClientTransaction;
                const stages = [...(txData.stages || [])];
                const stageIdx = stages.findIndex(s => s.stageId === selectedStageId);
                
                // 1. تحديث حالة المرحلة إلى "مكتملة"
                const stageUpdate = { 
                    stageId: selectedStageId, 
                    name: stageTemplate?.name, 
                    status: 'completed', 
                    endDate: serverTimestamp() 
                };
                if (stageIdx > -1) stages[stageIdx] = stageUpdate as any;
                else stages.push(stageUpdate as any);

                // 2. الربط المالي: البحث عن دفعة في العقد مرتبطة بهذه المرحلة
                let commentContent = `تم إكمال مرحلة: **${stageTemplate?.name}** ميدانياً.`;
                if (txData.contract?.clauses) {
                    const updatedClauses = txData.contract.clauses.map(clause => {
                        if (clause.condition === stageTemplate?.name && clause.status === 'غير مستحقة') {
                            commentContent += `\n\n**[إشعار مالي]** استحقاق دفعة بقيمة **${formatCurrency(clause.amount)}**.`;
                            return { ...clause, status: 'مستحقة' };
                        }
                        return clause;
                    });
                    batch.update(txRef, { 'contract.clauses': updatedClauses });
                }

                // تحديث المعاملة
                batch.update(txRef, { stages, status: 'in-progress' });
                
                // توثيق في التايم لاين الخاص بالمعاملة
                const timelineRef = doc(collection(txRef, 'timelineEvents'));
                batch.set(timelineRef, {
                    type: 'comment', 
                    content: commentContent, 
                    userId: currentUser.id, 
                    userName: currentUser.fullName, 
                    createdAt: serverTimestamp()
                });
            }

            // 3. إغلاق الزيارة وتوثيق الملاحظات
            batch.update(doc(firestore, 'appointments', appointment.id!), { workStageUpdated: true, notes });
            await batch.commit();
            
            toast({ title: 'نجاح', description: 'تم تحديث سير العمل والبيانات المالية بنجاح.' });
            router.push('/dashboard/appointments');
        } catch (e) { 
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ في التحديث' }); 
        }
        finally { setIsSaving(false); }
    };

    if (apptLoading) return <div className="p-8"><Skeleton className="h-64 w-full rounded-[2.5rem]" /></div>;
    if (!appointment) return <div className="p-20 text-center text-muted-foreground font-bold">لم يتم العثور على تفاصيل الزيارة.</div>;

    const apptDate = toFirestoreDate(appointment.appointmentDate);

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20" dir="rtl">
            <Card className="rounded-[2.5rem] shadow-xl border-none overflow-hidden bg-card">
                <CardHeader className="bg-primary/5 pb-8 px-8 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-black">{appointment.title}</CardTitle>
                            <CardDescription className="font-bold flex items-center gap-2 mt-1">
                                <User className="h-3 w-3" />
                                {client?.nameAr || appointment.clientName}
                                {!appointment.clientId && <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-[10px] h-4">عميل محتمل</Badge>}
                            </CardDescription>
                        </div>
                        <div className="text-left font-mono text-sm opacity-60">
                            {client?.fileId || 'رقم الملف: ---'}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">تاريخ الموعد</Label>
                            <p className="font-bold">{apptDate ? format(apptDate, 'eeee, dd MMMM', { locale: ar }) : '-'}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">وقت الزيارة</Label>
                            <p className="font-bold font-mono">{apptDate ? format(apptDate, 'p', { locale: ar }) : '-'}</p>
                        </div>
                    </div>

                    <Separator />

                    {/* --- منطقة الإجراءات الذكية --- */}
                    {!appointment.workStageUpdated && appointment.transactionId ? (
                        <div className="p-6 border-2 border-dashed border-primary/20 bg-primary/5 rounded-[2rem] space-y-4">
                            <h3 className="font-black text-primary flex items-center gap-2 text-lg">
                                <Workflow className="h-5 w-5"/> 
                                تحديث إنجاز الزيارة
                            </h3>
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs pr-1">مرحلة العمل المنجزة خلال الموعد</Label>
                                <InlineSearchList 
                                    value={selectedStageId} 
                                    onSelect={setSelectedStageId} 
                                    options={workStages.map(s => ({ value: s.id!, label: s.name }))} 
                                    placeholder="اختر المرحلة التي تم إكمالها..." 
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs pr-1">ملاحظات المهندس الفنية</Label>
                                <Textarea 
                                    value={notes} 
                                    onChange={e => setNotes(e.target.value)} 
                                    placeholder="اكتب ملخص ما دار في الاجتماع أو نتائج الزيارة..." 
                                    rows={4}
                                    className="rounded-xl border-2"
                                />
                            </div>
                            <Button onClick={handleUpdateStage} disabled={isSaving || !selectedStageId} className="w-full h-12 rounded-xl font-black text-lg gap-2 shadow-lg shadow-primary/20">
                                {isSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                                تأكيد الإنجاز وتفعيل الدفعات
                            </Button>
                        </div>
                    ) : appointment.workStageUpdated ? (
                        <Alert className="bg-green-50 border-green-200 rounded-2xl py-6">
                            <Check className="h-5 w-5 text-green-600"/>
                            <AlertTitle className="text-green-800 font-black text-lg">تم توثيق الزيارة بنجاح</AlertTitle>
                            <AlertDescription className="text-green-700 font-medium">
                                تم تحديث سير العمل في المعاملة المرتبطة وتفعيل أي مطالبات مالية مستحقة تلقائياً.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-4">
                            <Alert variant="destructive" className="rounded-2xl border-2 py-6 bg-red-50">
                                <AlertCircle className="h-5 w-5 text-red-600"/>
                                <AlertTitle className="text-red-800 font-black text-lg">إجراء مطلوب: ربط الزيارة</AlertTitle>
                                <AlertDescription className="text-red-700 font-medium leading-relaxed">
                                    {!appointment.clientId 
                                        ? "هذا الشخص عميل محتمل ولم يتم فتح ملف رسمي له بعد. يجب تحويله لعميل مسجل للبدء في إدارة معاملاته ومراحل عمله."
                                        : "يجب ربط هذه الزيارة بإحدى المعاملات الداخلية لهذا العميل (مثل تصميم بلدية أو إشراف) لتتمكن من تحديث سير العمل."}
                                </AlertDescription>
                            </Alert>
                            
                            <div className="flex flex-col gap-3">
                                {!appointment.clientId ? (
                                    <Button asChild className="h-14 rounded-2xl font-black text-lg gap-3 shadow-xl shadow-primary/20">
                                        <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName || '')}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&fromAppointmentId=${appointment.id}&engineerId=${appointment.engineerId}`}>
                                            <UserPlus className="h-6 w-6" />
                                            تحويل العميل إلى ملف رسمي الآن
                                        </Link>
                                    </Button>
                                ) : (
                                    <Button asChild variant="outline" className="h-14 rounded-2xl font-black text-lg gap-3 border-2 border-primary text-primary hover:bg-primary/5">
                                        <Link href={`/dashboard/clients/${appointment.clientId}?fromAppointmentId=${appointment.id}`}>
                                            <Link2 className="h-6 w-6" />
                                            ربط الزيارة بمعاملة حالية
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 p-6 flex justify-between border-t">
                    <Button variant="ghost" onClick={() => router.back()} className="font-bold gap-2 hover:bg-background transition-all">
                        <ArrowRight className="h-4 w-4"/> عودة للتقويم
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
