
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, writeBatch, getDoc, collectionGroup, orderBy, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, WorkStage, TransactionStage } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';

interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  fromAppointmentId?: string | null;
}

/**
 * نموذج إضافة معاملة جديدة:
 * تم تحديثه بنظام الحماية ضد الحفظ المزدوج والتفاعل اللحظي.
 */
export function ClientTransactionForm({ isOpen, onClose, clientId, clientName, fromAppointmentId }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);
    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [typesLoading, setTypesLoading] = useState(true);
    const [workStages, setWorkStages] = useState<WorkStage[]>([]);

    const [transactionTypeName, setTransactionTypeName] = useState('');
    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    
    // نظام الحماية
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    useEffect(() => {
        if (!firestore || !isOpen) return;
        
        const fetchReferenceData = async () => {
            setEngineersLoading(true);
            setTypesLoading(true);
            try {
                const [engSnap, transTypesSnap, stagesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, 'transactionTypes'), orderBy('name'))),
                    getDocs(query(collectionGroup(firestore, 'workStages')))
                ]);

                setEngineers(engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
                setTransactionTypes(transTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));
                setWorkStages(stagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkStage)));

            } catch (error) {
                console.error("Reference data error:", error);
            } finally {
                setEngineersLoading(false);
                setTypesLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, isOpen]);

    const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.name, label: t.name })), [transactionTypes]);
    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName })), [engineers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !transactionTypeName) return;

        // منع الحفظ المزدوج
        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);

        try {
            const clientRef = doc(firestore, 'clients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (!clientSnap.exists()) throw new Error("Client not found");
            const clientData = clientSnap.data() as Client;

            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
            const departmentIds = selectedType?.departmentIds || [];

            const initialStages = workStages
                .filter(stage => departmentIds.includes((stage as any).parent?.path.split('/')[1]))
                .map(stageData => ({
                    stageId: stageData.id,
                    name: stageData.name,
                    status: 'pending' as const,
                    order: stageData.order,
                    stageType: stageData.stageType,
                    allowedRoles: stageData.allowedRoles || [],
                }));

            const batch = writeBatch(firestore);
            const newCounter = (clientData.transactionCounter || 0) + 1;
            const transactionNumber = `CL${clientData.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
            
            const newTransactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
            
            batch.update(clientRef, { transactionCounter: newCounter });

            const newTransactionData = {
                transactionNumber, clientId, transactionType: transactionTypeName,
                description, status: 'new', createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(), stages: initialStages,
                assignedEngineerId: assignedEngineerId || null,
                transactionTypeId: selectedType?.id || null,
            };
            batch.set(newTransactionRef, cleanFirestoreData(newTransactionData));

            if (fromAppointmentId) {
                batch.update(doc(firestore, 'appointments', fromAppointmentId), { transactionId: newTransactionRef.id });
            }

            const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
            batch.set(timelineRef, {
                type: 'log', content: `أنشأ المعاملة "${transactionTypeName}" برقم ${transactionNumber}.`,
                userId: currentUser.id, userName: currentUser.fullName, createdAt: serverTimestamp(),
            });

            await batch.commit();
            
            toast({ title: 'نجاح', description: 'تم إنشاء المعاملة بنجاح.' });
            onClose();
            router.refresh();

        } catch (error) {
            console.error("Save transaction error:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في إضافة المعاملة.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) { onClose(); } }}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>إضافة معاملة جديدة</DialogTitle>
                        <DialogDescription>أضف خدمة جديدة لملف العميل الحالي.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <Label>نوع المعاملة *</Label>
                            <InlineSearchList value={transactionTypeName} onSelect={setTransactionTypeName} options={transactionTypeOptions} placeholder="اختر نوع المعاملة..." disabled={isSaving} />
                        </div>
                        <div className="grid gap-2">
                            <Label>إسناد لمهندس</Label>
                            <InlineSearchList value={assignedEngineerId} onSelect={setAssignedEngineerId} options={engineerOptions} placeholder="اختر مهندسًا..." disabled={isSaving} />
                        </div>
                        <div className="grid gap-2">
                            <Label>الوصف</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="تفاصيل إضافية..." disabled={isSaving} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !transactionTypeName}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                            حفظ المعاملة
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
