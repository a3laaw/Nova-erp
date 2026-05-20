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
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X, Workflow, UserCheck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, writeBatch, getDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, WorkStage, Department } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  fromAppointmentId?: string | null;
}

/**
 * نموذج إضافة معاملة جديدة (محرك الإسناد الذكي V11.0):
 * - يقوم آلياً بإسناد المهندس المختص بناءً على ربط "أنواع الخدمات" بـ "أقسام الوظائف المعتمدة".
 * - تم إصلاح خطأ الـ Hooks عبر نقل الاستدعاء لداخل المكون.
 */
export function ClientTransactionForm({ isOpen, onClose, clientId, clientName, fromAppointmentId }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [client, setClient] = useState<Client | null>(null);
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

    // جلب الأقسام المعتمدة لغرض الربط الذكي
    const { data: allDepartments = [] } = useSubscription<Department>(firestore, 'departments');

    useEffect(() => {
        if (!firestore || !isOpen || !tenantId) return;
        
        const fetchAllData = async () => {
            setEngineersLoading(true);
            setTypesLoading(true);
            try {
                const clientRef = doc(firestore, getTenantPath(`clients/${clientId}`, tenantId));
                const empPath = getTenantPath('employees', tenantId);
                const typesPath = getTenantPath('transactionTypes', tenantId);

                const [clientSnap, engSnap, typesSnap] = await Promise.all([
                    getDoc(clientRef),
                    getDocs(query(collection(firestore, empPath), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, typesPath), orderBy('order')))
                ]);

                if (clientSnap.exists()) setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                setEngineers(engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
                setTransactionTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));

            } catch (error) {
                console.error("Reference data error:", error);
            } finally {
                setEngineersLoading(false);
                setTypesLoading(false);
            }
        };

        fetchAllData();
    }, [firestore, isOpen, tenantId, clientId]);

    /**
     * محرك الإسناد الموحد (The Integrated Link Engine):
     * يقوم بمطابقة قسم المهندس مع الأقسام المعتمدة للخدمة المختارة.
     */
    useEffect(() => {
        if (transactionTypeName && client && engineers.length > 0 && allDepartments.length > 0) {
            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
            if (!selectedType) return;

            const linkedDeptIds = selectedType.departmentIds || [];
            
            if (client.assignedEngineer) {
                const clientEngineer = engineers.find(e => e.id === client.assignedEngineer);
                
                const isMatch = linkedDeptIds.some(deptId => {
                    const deptName = allDepartments.find(d => d.id === deptId)?.name;
                    return deptName && clientEngineer?.department === deptName;
                });
                
                if (isMatch) {
                    setAssignedEngineerId(client.assignedEngineer);
                } else {
                    setAssignedEngineerId('');
                }
            }
        }
    }, [transactionTypeName, client, transactionTypes, engineers, allDepartments]);

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
            
            const newCounter = (client?.transactionCounter || 0) + 1;
            const transactionNumber = `CL${client?.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
            
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
            
            toast({ title: 'تمت الإضافة بنجاح', description: `المعاملة جاهزة للمتابعة برقم ${transactionNumber}` });
            onClose();
            router.refresh();

        } catch (error: any) {
            console.error("Save transaction error:", error);
            toast({ variant: 'destructive', title: 'فشل الحفظ', description: error.message });
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
                                <DialogTitle className="text-xl font-black text-[#1e1b4b]">إضافة معاملة جديدة معتمدة</DialogTitle>
                                <DialogDescription className="font-bold text-slate-500">ربط الخدمة بملف العميل وتسريع إسناد المهندسين المختصين.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">نوع المعاملة المعتمدة *</Label>
                            <InlineSearchList 
                                value={transactionTypeName} 
                                onSelect={setTransactionTypeName} 
                                options={transactionTypeOptions} 
                                placeholder={typesLoading ? 'جاري جلب القوائم...' : 'اختر الخدمة المطلوبة...'} 
                                disabled={typesLoading || isSaving} 
                            />
                        </div>

                        {assignedEngineerId && (
                            <Alert className="bg-green-50 border-green-200 rounded-2xl animate-in slide-in-from-top-2 border-2 border-dashed">
                                <UserCheck className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-xs font-black text-green-800 uppercase tracking-tighter">إسناد تلقائي ذكي</AlertTitle>
                                <AlertDescription className="text-[10px] font-bold text-green-700 leading-tight">تم التعرف على المهندس المتابع لهذا العميل وإسناده آلياً لتوافق تخصصه مع هذه الخدمة.</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">إسناد المهندس المختص</Label>
                            <InlineSearchList 
                                value={assignedEngineerId} 
                                onSelect={setAssignedEngineerId} 
                                options={engineerOptions} 
                                placeholder={engineersLoading ? 'جاري التحميل...' : 'اختر المهندس المسؤول...'} 
                                disabled={engineersLoading || isSaving} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">ملاحظات العقد أو التنفيذ</Label>
                            <Textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="أي تفاصيل فنية خاصة بهذه المعاملة..." 
                                disabled={isSaving}
                                className="rounded-2xl border-2 p-4 min-h-[100px] shadow-inner"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !transactionTypeName} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2">
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                            حفظ المعاملة وبدء المسار
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}