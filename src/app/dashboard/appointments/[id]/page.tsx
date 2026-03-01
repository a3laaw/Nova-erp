'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, Timestamp, limit, deleteField, addDoc } from 'firebase/firestore';
import type { Appointment, Client, Employee, WorkStage, ClientTransaction, TransactionStage } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Link2, Plus, ShieldCheck } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';

export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // --- جلب البيانات ---
    const { data: appointment, loading: apptLoading } = useDocument<Appointment>(firestore, id ? `appointments/${id}` : null);
    const { data: client } = useDocument<Client>(firestore, appointment?.clientId ? `clients/${appointment.clientId}` : null);
    const { data: transaction } = useDocument<ClientTransaction>(firestore, (appointment?.clientId && appointment?.transactionId) ? `clients/${appointment.clientId}/transactions/${appointment.transactionId}` : null);

    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [notes, setNotes] = useState('');

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
                
                // تحديث المرحلة
                const stageUpdate = { 
                    stageId: selectedStageId, 
                    name: stageTemplate?.name, 
                    status: 'completed', 
                    endDate: serverTimestamp() 
                };
                if (stageIdx > -1) stages[stageIdx] = stageUpdate as any;
                else stages.push(stageUpdate as any);

                // --- الربط المالي (الاستحقاق) ---
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

                batch.update(txRef, { stages, status: 'in-progress' });
                
                // توثيق في التايم لاين
                const timelineRef = doc(collection(txRef, 'timelineEvents'));
                batch.set(timelineRef, {
                    type: 'comment', content: commentContent, userId: currentUser.id, userName: currentUser.fullName, createdAt: serverTimestamp()
                });
            }

            // إغلاق الزيارة
            batch.update(doc(firestore, 'appointments', appointment.id!), { workStageUpdated: true, notes });
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تحديث سير العمل والبيانات المالية.' });
            router.push('/dashboard/appointments');
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التحديث' }); }
        finally { setIsSaving(false); }
    };

    if (apptLoading) return <Skeleton className="h-64 w-full" />;
    if (!appointment) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
            <Card className="rounded-3xl shadow-lg border-none overflow-hidden">
                <CardHeader className="bg-primary/5 pb-8">
                    <CardTitle className="text-2xl font-black">{appointment.title}</CardTitle>
                    <CardDescription>العميل: {client?.nameAr || appointment.clientName}</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label className="text-xs opacity-60">التاريخ</Label><p className="font-bold">{format(toFirestoreDate(appointment.appointmentDate)!, 'PPP', { locale: ar })}</p></div>
                        <div className="space-y-1"><Label className="text-xs opacity-60">وقت الزيارة</Label><p className="font-bold font-mono">{format(toFirestoreDate(appointment.appointmentDate)!, 'p', { locale: ar })}</p></div>
                    </div>

                    {!appointment.workStageUpdated && appointment.transactionId ? (
                        <div className="p-6 border-2 border-dashed border-primary/20 bg-primary/5 rounded-3xl space-y-4">
                            <h3 className="font-black text-primary flex items-center gap-2"><Workflow className="h-5 w-5"/> تحديث إنجاز الزيارة</h3>
                            <div className="grid gap-2">
                                <Label>مرحلة العمل المنجزة</Label>
                                <InlineSearchList value={selectedStageId} onSelect={setSelectedStageId} options={workStages.map(s => ({ value: s.id!, label: s.name }))} placeholder="اختر المرحلة..." />
                            </div>
                            <div className="grid gap-2">
                                <Label>ملاحظات المهندس</Label>
                                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="اكتب نتائج الزيارة هنا..." />
                            </div>
                            <Button onClick={handleUpdateStage} disabled={isSaving || !selectedStageId} className="w-full h-12 rounded-xl font-black text-lg gap-2">
                                {isSaving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
                                تأكيد الإنجاز وتفعيل الدفعات
                            </Button>
                        </div>
                    ) : appointment.workStageUpdated ? (
                        <Alert className="bg-green-50 border-green-200"><Check className="h-4 w-4 text-green-600"/><AlertTitle className="text-green-800">تم تحديث الزيارة</AlertTitle><AlertDescription>تم توثيق هذه الزيارة وتحديث الأثر المالي المرتبط بها.</AlertDescription></Alert>
                    ) : (
                        <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>زيارة غير مرتبطة</AlertTitle><AlertDescription>يجب ربط الزيارة بمعاملة داخلية أولاً لتتمكن من تحديث سير العمل.</AlertDescription></Alert>
                    )}
                </CardContent>
                <CardFooter className="bg-muted/30 p-6 flex justify-between">
                    <Button variant="ghost" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> عودة للتقويم</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
