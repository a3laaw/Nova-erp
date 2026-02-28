
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy } from 'firebase/firestore';
import type { Client, ClientTransaction, Employee, FieldVisit } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, X, Calendar, User, MapPin } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData } from '@/lib/utils';

export function FieldVisitForm() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedTransactionId, setSelectedTransactionId] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState('');
    const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
    const [plannedStageId, setPlannedStageId] = useState('');

    const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients', [where('isActive', '==', true)]);
    const { data: engineers = [], loading: engineersLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    
    const [transactions, setTransactions] = useState<ClientTransaction[]>([]);
    const [stages, setStages] = useState<{ id: string, name: string }[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

    useEffect(() => {
        if (!selectedClientId || !firestore) {
            setTransactions([]);
            setSelectedTransactionId('');
            return;
        }
        setIsLoadingTransactions(true);
        const fetchTxs = async () => {
            const q = query(collection(firestore, `clients/${selectedClientId}/transactions`));
            const snap = await getDocs(q);
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientTransaction)));
            setIsLoadingTransactions(false);
        };
        fetchTxs();
    }, [selectedClientId, firestore]);

    useEffect(() => {
        if (!selectedTransactionId) {
            setStages([]);
            setPlannedStageId('');
            return;
        }
        const tx = transactions.find(t => t.id === selectedTransactionId);
        if (tx && tx.stages) {
            setStages(tx.stages.map(s => ({ id: s.stageId, name: s.name })));
        }
    }, [selectedTransactionId, transactions]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !selectedClientId || !selectedTransactionId || !selectedEngineerId || !scheduledDate) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى تعبئة جميع الحقول المطلوبة.' });
            return;
        }

        setIsSaving(true);
        try {
            const client = clients.find(c => c.id === selectedClientId);
            const tx = transactions.find(t => t.id === selectedTransactionId);
            const eng = engineers.find(e => e.id === selectedEngineerId);
            const stage = stages.find(s => s.id === plannedStageId);

            const visitData: Omit<FieldVisit, 'id'> = {
                clientId: selectedClientId,
                clientName: client?.nameAr || 'غير معروف',
                transactionId: selectedTransactionId,
                transactionType: tx?.transactionType || 'غير معروف',
                engineerId: selectedEngineerId,
                engineerName: eng?.fullName || 'غير معروف',
                scheduledDate: scheduledDate,
                plannedStageId: plannedStageId,
                plannedStageName: stage?.name || 'غير محدد',
                status: 'planned',
                createdAt: serverTimestamp(),
            };

            await addDoc(collection(firestore, 'field_visits'), cleanFirestoreData(visitData));
            toast({ title: 'تمت الجدولة', description: 'تمت إضافة الزيارة الميدانية لخطة العمل بنجاح.' });
            router.push('/dashboard/construction/field-visits');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الزيارة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto rounded-3xl shadow-xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black flex items-center gap-3">
                        <MapPin className="text-primary h-7 w-7" />
                        جدولة زيارة ميدانية جديدة
                    </CardTitle>
                    <CardDescription>قم بتخطيط الزيارة القادمة وتحديد المهام المتوقع إنجازها في الموقع.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid gap-2">
                        <Label className="font-bold">العميل المستهدف *</Label>
                        <InlineSearchList 
                            value={selectedClientId}
                            onSelect={setSelectedClientId}
                            options={clients.map(c => ({ value: c.id, label: c.nameAr }))}
                            placeholder="ابحث عن عميل..."
                            disabled={clientsLoading}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold">المعاملة / المشروع *</Label>
                            <InlineSearchList 
                                value={selectedTransactionId}
                                onSelect={setSelectedTransactionId}
                                options={transactions.map(t => ({ value: t.id!, label: t.transactionType }))}
                                placeholder={isLoadingTransactions ? "جاري التحميل..." : "اختر المعاملة..."}
                                disabled={!selectedClientId || isLoadingTransactions}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">المرحلة المخطط إنجازها</Label>
                            <InlineSearchList 
                                value={plannedStageId}
                                onSelect={setPlannedStageId}
                                options={stages.map(s => ({ value: s.id, label: s.name }))}
                                placeholder="اختر المرحلة..."
                                disabled={!selectedTransactionId}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="grid gap-2">
                            <Label className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary"/> المهندس الزائر *</Label>
                            <InlineSearchList 
                                value={selectedEngineerId}
                                onSelect={setSelectedEngineerId}
                                options={engineers.map(e => ({ value: e.id!, label: e.fullName }))}
                                placeholder="اختر المهندس..."
                                disabled={engineersLoading}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary"/> تاريخ الزيارة المخطط *</Label>
                            <DateInput value={scheduledDate} onChange={setScheduledDate} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 p-8 flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving} className="h-12 px-10 rounded-2xl font-black text-lg gap-2">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        تأكيد وإضافة للخطة
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
