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
import { Loader2, Save, X, Workflow } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, writeBatch, getDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, WorkStage } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
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
 * تم ربطه بـ "إدارة أنواع الخدمات" لضمان ظهور القوائم المرجعية المحدثة المخصصة للمنشأة.
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
    
    const [transactionTypeName, setTransactionTypeName] = useState('');
    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        if (!firestore || !isOpen || !tenantId) return;
        
        const fetchReferenceData = async () => {
            setEngineersLoading(true);
            setTypesLoading(true);
            try {
                // 1. جلب الموظفين المتاحين للإسناد
                const empPath = getTenantPath('employees', tenantId);
                const engSnap = await getDocs(query(collection(firestore, empPath), where('status', '==', 'active')));
                setEngineers(engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));

                // 2. جلب أنواع الخدمات المعتمدة من القوائم المرجعية الموحدة
                const typesPath = getTenantPath('transactionTypes', tenantId);
                const typesSnap = await getDocs(query(collection(firestore, typesPath), orderBy('order')));
                setTransactionTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));

            } catch (error) {
                console.error("Reference data error:", error);
                toast({ variant: 'destructive', title: 'خطأ في جلب البيانات', description: 'تأكد من إعداد القوائم المرجعية للخدمات.' });
            } finally {
                setEngineersLoading(false);
                setTypesLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, isOpen, tenantId, toast]);

    const transactionTypeOptions = useMemo(() => 
        transactionTypes.map(t => ({ value: t.name, label: t.name })), 
    [transactionTypes]);

    const engineerOptions = useMemo(() => 
        engineers.map(e => ({ value: e.id!, label: e.fullName })), 
    [engineers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !transactionTypeName || !tenantId) return;

        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);

        try {
            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
            const departmentIds = selectedType?.departmentIds || [];

            // جلب مراحل العمل المعتمدة المرتبطة بالأقسام التي تتبع لها هذه الخدمة
            let initialStages: any[] = [];
            for (const deptId of departmentIds) {
                const stagesPath = getTenantPath(`departments/${deptId}/workStages`, tenantId);
                const stagesSnap = await getDocs(query(collection(firestore, stagesPath), orderBy('order')));
                stagesSnap.forEach(d => {
                    const data = d.data() as WorkStage;
                    initialStages.push({
                        stageId: d.id,
                        name: data.name,
                        status: 'pending',
                        order: data.order || 0
                    });
                });
            }

            const batch = writeBatch(firestore);
            const clientRef = doc(firestore, getTenantPath(`clients/${clientId}`, tenantId));
            const clientSnap = await getDoc(clientRef);
            if (!clientSnap.exists()) throw new Error("الملف الرسمي للعميل غير موجود.");
            
            const clientData = clientSnap.data() as Client;
            const newCounter = (clientData.transactionCounter || 0) + 1;
            const transactionNumber = `CL${clientData.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
            
            const transactionsPath = getTenantPath(`clients/${clientId}/transactions`, tenantId);
            const newTransactionRef = doc(collection(firestore, transactionsPath));
            
            batch.update(clientRef, { transactionCounter: newCounter });

            const newTransactionData = {
                transactionNumber, 
                clientId, 
                transactionType: transactionTypeName,
                description, 
                status: 'new', 
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(), 
                stages: initialStages,
                assignedEngineerId: assignedEngineerId || null,
                transactionTypeId: selectedType?.id || null,
                companyId: tenantId
            };
            
            batch.set(newTransactionRef, cleanFirestoreData(newTransactionData));

            if (fromAppointmentId) {
                const apptPath = getTenantPath(`appointments/${fromAppointmentId}`, tenantId);
                batch.update(doc(firestore, apptPath), { transactionId: newTransactionRef.id });
            }

            // توثيق الحدث في سجل المتابعة المعتمد
            const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
            batch.set(timelineRef, {
                type: 'log', 
                content: `تم فتح معاملة جديدة: "${transactionTypeName}" برقم مرجعي ${transactionNumber}.`,
                userId: currentUser.id, 
                userName: currentUser.fullName, 
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            
            toast({ title: 'نجاح الربط', description: 'تم إنشاء المعاملة وربطها بسير العمل المعتمد بنجاح.' });
            onClose();
            router.refresh();

        } catch (error: any) {
            console.error("Save transaction error:", error);
            toast({ variant: 'destructive', title: 'فشل الربط', description: error.message || 'فشل في إضافة المعاملة.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) { onClose(); } }}>
            <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 bg-white">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                                <Workflow className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <DialogTitle className="text-xl font-black text-[#1e1b4b]">إضافة معاملة جديدة</DialogTitle>
                                <DialogDescription className="font-bold">اختر نوع الخدمة من القوائم المرجعية لفتح ملف إنجاز جديد.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">نوع المعاملة (من القوائم المعتمدة) *</Label>
                            <InlineSearchList 
                                value={transactionTypeName} 
                                onSelect={setTransactionTypeName} 
                                options={transactionTypeOptions} 
                                placeholder={typesLoading ? 'جاري جلب القوائم...' : 'اختر الخدمة المطلوبة...'} 
                                disabled={typesLoading || isSaving} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">إسناد لمهندس المتابعة</Label>
                            <InlineSearchList 
                                value={assignedEngineerId} 
                                onSelect={setAssignedEngineerId} 
                                options={engineerOptions} 
                                placeholder={engineersLoading ? 'جاري التحميل...' : 'اختر المهندس المختص...'} 
                                disabled={engineersLoading || isSaving} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">ملاحظات أو وصف إضافي</Label>
                            <Textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="أي تفاصيل خاصة بهذه المعاملة..." 
                                disabled={isSaving}
                                className="rounded-2xl border-2 p-4 min-h-[100px]"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !transactionTypeName} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2">
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                            حفظ المعاملة
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
