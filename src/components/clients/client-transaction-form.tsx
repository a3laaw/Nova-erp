
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Save, X, Workflow, Layers } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, writeBatch, getDoc, orderBy, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType, WorkStage, SubService, TransactionStage } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { InlineSearchList } from '../ui/inline-search-list';

interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  fromAppointmentId?: string | null;
}

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !transactionTypeName || !tenantId) return;

        setIsSaving(true);
        try {
            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);
            const selectedSub = subServices.find(s => s.id === selectedSubServiceId);

            // 🛡️ محرك التسمية المتسلسلة (Unique Index Engine): منع تكرار الأسماء المتشابهة 🛡️
            const txsPath = getTenantPath(`clients/${clientId}/transactions`, tenantId);
            const existingSnap = await getDocs(query(collection(firestore, txsPath!), where('transactionType', '>=', transactionTypeName), where('transactionType', '<=', transactionTypeName + '\uf8ff')));
            const sameTypeCount = existingSnap.docs.filter(d => d.data().transactionType.startsWith(transactionTypeName)).length;
            
            const finalTypeName = sameTypeCount > 0 
                ? `${transactionTypeName} - ${String(sameTypeCount + 1).padStart(3, '0')}`
                : transactionTypeName;

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
            const newTransactionRef = doc(collection(firestore, txsPath!));
            
            batch.update(clientRef, { transactionCounter: newCounter });

            batch.set(newTransactionRef, cleanFirestoreData({
                transactionNumber, 
                clientId, 
                transactionType: finalTypeName,
                subServiceName: selectedSub?.name || null,
                description, 
                status: 'new', 
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(), 
                stages: initialStages,
                assignedEngineerId: assignedEngineerId || client?.assignedEngineer || null,
                companyId: tenantId
            }));

            const timelineRef = doc(collection(newTransactionRef, 'timelineEvents'));
            batch.set(timelineRef, {
                type: 'log', 
                content: `تم فتح المسار الفني للمنشأة: "${finalTypeName}".`,
                userId: currentUser.id, 
                userName: currentUser.fullName, 
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            await batch.commit();
            toast({ title: 'تم فتح المسار الفني' });
            onClose();
            router.refresh();

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: error.message });
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
            <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl p-0 bg-white">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <DialogTitle className="text-xl font-black">فتح مسار معاملة جديدة</DialogTitle>
                        <DialogDescription className="font-bold text-slate-500">سيتم تحديد رقم تسلسلي آلياً في حال وجود معاملات مشابهة.</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2">
                            <Label className="font-black">نوع الخدمة الرئيسية *</Label>
                            <InlineSearchList 
                                value={transactionTypeName} 
                                onSelect={setTransactionTypeName} 
                                options={transactionTypeOptions} 
                                placeholder="اختر الخدمة..." 
                                disabled={typesLoading || isSaving} 
                            />
                        </div>
                        {subServices.length > 0 && (
                            <div className="grid gap-2 animate-in slide-in-from-top-2">
                                <Label className="font-black text-primary flex items-center gap-2"><Layers className="h-4 w-4" /> الخدمة التفصيلية *</Label>
                                <InlineSearchList 
                                    value={selectedSubServiceId} 
                                    onSelect={setSelectedSubServiceId} 
                                    options={subServices.map(s => ({ value: s.id!, label: s.name }))} 
                                    placeholder="حدد النوع..." 
                                    disabled={subServicesLoading || isSaving} 
                                />
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label className="font-black">المهندس المسؤول</Label>
                            <InlineSearchList 
                                value={assignedEngineerId} 
                                onSelect={setAssignedEngineerId} 
                                options={engineers.map(e => ({ value: e.id!, label: e.fullName }))} 
                                placeholder="اختر المهندس..." 
                                disabled={engineersLoading || isSaving} 
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black">ملاحظات إضافية</Label>
                            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="أدخل أي تفاصيل..." rows={2} />
                        </div>
                    </div>
                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !transactionTypeName} className="font-black px-10 rounded-xl">
                            {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'بدء المسار'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
