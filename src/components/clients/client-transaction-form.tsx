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
import { Loader2, Save, X, Workflow, UserCheck, Layers } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, writeBatch, getDoc, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, WorkStage, Department, SubService, TransactionStage } from '@/lib/types';
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
 * نموذج إنشاء المعاملة المطور (V26.0):
 * - إضافة التمييز بين الخدمات عبر إظهار "نوع النشاط" في القائمة المنسدلة.
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
    const [selectedSubServiceId, setSelectedSubServiceId] = useState('');
    const [subServices, setSubServices] = useState<SubService[]>([]);
    const [subServicesLoading, setSubServicesLoading] = useState(false);

    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);

    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        if (!firestore || !isOpen || !tenantId) return;
        
        const fetchAllData = async () => {
            setEngineersLoading(true);
            setTypesLoading(true);
            try {
                const clientRefPath = getTenantPath(`clients/${clientId}`, tenantId);
                const empPath = getTenantPath('employees', tenantId);
                const typesPath = getTenantPath('transactionTypes', tenantId);

                const [clientSnap, engSnap, typesSnap] = await Promise.all([
                    getDoc(doc(firestore, clientRefPath!)),
                    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, typesPath!), orderBy('order')))
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

    useEffect(() => {
        if (!transactionTypeName || !firestore || !tenantId) {
            setSubServices([]);
            setSelectedSubServiceId('');
            return;
        }

        const fetchSubServices = async () => {
            setSubServicesLoading(true);
            try {
                const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
                if (!selectedType?.id) return;

                const subsPath = getTenantPath(`transactionTypes/${selectedType.id}/subServices`, tenantId);
                const snap = await getDocs(query(collection(firestore, subsPath!), orderBy('order')));
                setSubServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService)));
            } finally {
                setSubServicesLoading(false);
            }
        };

        fetchSubServices();
    }, [transactionTypeName, transactionTypes, firestore, tenantId]);

    // ✨ التمييز بين الخدمات عبر إظهار النشاط (Activity Type) ككود تمييزي ✨
    const transactionTypeOptions = useMemo(() => 
        transactionTypes.map(t => ({ 
            value: t.name, 
            label: t.name,
            searchKey: t.activityType === 'consulting' ? 'استشارات' : t.activityType === 'construction' ? 'مقاولات' : 'مبيعات'
        })), 
    [transactionTypes]);

    const subServiceOptions = useMemo(() => 
        subServices.map(s => ({ value: s.id!, label: s.name })),
    [subServices]);

    const engineerOptions = useMemo(() => 
        engineers.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber })), 
    [engineers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !transactionTypeName || !tenantId) return;

        if (subServices.length > 0 && !selectedSubServiceId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار نوع الخدمة التفصيلي.' });
            return;
        }

        if (savingRef.current) return;
        savingRef.current = true;
        setIsSaving(true);

        try {
            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
            const selectedSub = subServices.find(s => s.id === selectedSubServiceId);

            let initialStages: any[] = [];
            const stagesPath = getTenantPath(`transactionTypes/${selectedType?.id}/subServices/${selectedSubServiceId}/workStages`, tenantId);
            
            if (stagesPath) {
                const stagesSnap = await getDocs(query(collection(firestore, stagesPath), orderBy('order')));
                initialStages = stagesSnap.docs.map(d => {
                    const data = d.data() as WorkStage;
                    return { 
                        stageId: d.id, 
                        name: data.name, 
                        status: 'pending' as const,
                        order: data.order || 0,
                        trackingType: data.trackingType || 'duration',
                        expectedDurationDays: data.expectedDurationDays || null,
                        maxOccurrences: data.maxOccurrences || null,
                        nextStageIds: data.nextStageIds || []
                    } satisfies TransactionStage;
                });
            }

            const batch = writeBatch(firestore);
            const clientPath = getTenantPath(`clients/${clientId}`, tenantId);
            const clientRef = doc(firestore, clientPath!);
            
            const newCounter = (client?.transactionCounter || 0) + 1;
            const transactionNumber = `CL${client?.fileNumber}-TX${String(newCounter).padStart(2, '0')}`;
            
            const transactionsPath = getTenantPath(`clients/${clientId}/transactions`, tenantId);
            const newTransactionRef = doc(collection(firestore, transactionsPath!));
            
            batch.update(clientRef, { transactionCounter: newCounter });

            const newTransactionData = {
                transactionNumber, 
                clientId, 
                transactionType: transactionTypeName,
                subServiceId: selectedSubServiceId || null,
                subServiceName: selectedSub?.name || null,
                description, 
                status: 'new', 
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(), 
                stages: initialStages,
                assignedEngineerId: assignedEngineerId || client?.assignedEngineer || null,
                transactionTypeId: selectedType?.id || null,
                companyId: tenantId
            };
            
            batch.set(newTransactionRef, cleanFirestoreData(newTransactionData));

            const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
            batch.set(timelineRef, {
                type: 'log', 
                content: `تم فتح مسار معاملة: "${transactionTypeName}${selectedSub ? ` - ${selectedSub.name}` : ''}". تم حقن ${initialStages.length} مرحلة إنجاز مبرمجة آلياً.`,
                userId: currentUser.id, 
                userName: currentUser.fullName, 
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            
            toast({ title: 'نجاح التأسيس الفني', description: `تم إعداد هيكل المعاملة بنجاح.` });
            onClose();
            router.refresh();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'فشل التأسيس', description: error.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) { onClose(); } }}>
            <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl overflow-hidden p-0 bg-white">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <div className="flex items-center gap-4 text-right">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Workflow className="h-6 w-6" /></div>
                            <div>
                                <DialogTitle className="text-xl font-black text-[#1e1b4b]">تأسيس معاملة تقنية</DialogTitle>
                                <DialogDescription className="font-bold text-slate-500">سيتم حقن مراحل العمل (WBS) آلياً بناءً على نوع الخدمة.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">الخدمة الرئيسية المستهدفة *</Label>
                            <InlineSearchList 
                                value={transactionTypeName} 
                                onSelect={setTransactionTypeName} 
                                options={transactionTypeOptions} 
                                placeholder={typesLoading ? 'جاري التحميل...' : 'اختر الخدمة الرئيسية...'} 
                                disabled={typesLoading || isSaving} 
                            />
                        </div>

                        {subServices.length > 0 && (
                            <div className="grid gap-2 animate-in slide-in-from-top-2">
                                <Label className="font-black text-primary pr-1 flex items-center gap-2">
                                    <Layers className="h-4 w-4" /> نوع الخدمة التفصيلي *
                                </Label>
                                <InlineSearchList 
                                    value={selectedSubServiceId} 
                                    onSelect={setSelectedSubServiceId} 
                                    options={subServiceOptions} 
                                    placeholder={subServicesLoading ? 'جاري جلب الخيارات...' : 'اختر التصنيف الميداني المعتمد...'} 
                                    disabled={subServicesLoading || isSaving} 
                                    className="border-primary/20 bg-primary/[0.02]"
                                />
                            </div>
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
                            <Label className="font-black text-gray-700 pr-1">ملاحظات إضافية</Label>
                            <Textarea 
                                value={description} 
                                onChange={e => setDescription(e.target.value)} 
                                placeholder="أي تفاصيل فنية خاصة..." 
                                disabled={isSaving}
                                className="rounded-2xl border-2 p-4 min-h-[100px] shadow-inner"
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !transactionTypeName} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30 gap-2 bg-[#7209B7] text-white">
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                            بدء مسار المعاملة
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
