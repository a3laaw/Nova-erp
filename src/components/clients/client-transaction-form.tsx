'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Info } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, writeBatch, getDoc, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { InlineSearchList } from '../ui/inline-search-list';

interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  fromAppointmentId?: string | null;
}

interface FetchedTransactionType extends TransactionType {
    parentDeptId: string;
}

export function ClientTransactionForm({ isOpen, onClose, clientId, clientName, fromAppointmentId }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);
    const [transactionTypes, setTransactionTypes] = useState<FetchedTransactionType[]>([]);
    const [typesLoading, setTypesLoading] = useState(true);

    const [transactionTypeName, setTransactionTypeName] = useState('');
    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!firestore || !isOpen) return;

        const fetchEngineers = async () => {
            setEngineersLoading(true);
            try {
                const q = query(collection(firestore, 'employees'), where('jobTitle', '!=', ''));
                const querySnapshot = await getDocs(q);
                const fetchedEngineers: Employee[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as Employee;
                    if (data.jobTitle?.includes('مهندس') || data.jobTitle?.toLowerCase().includes('engineer')) {
                        fetchedEngineers.push({ id: doc.id, ...data });
                    }
                });
                setEngineers(fetchedEngineers);
            } catch (error) {
                console.error("Failed to fetch engineers:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة المهندسين.' });
            } finally {
                setEngineersLoading(false);
            }
        };

        const fetchTransactionTypes = async () => {
             setTypesLoading(true);
             try {
                const q = query(collectionGroup(firestore, 'transactionTypes'));
                const querySnapshot = await getDocs(q);
                const fetchedTypes: FetchedTransactionType[] = [];
                const uniqueNames = new Set<string>();
    
                querySnapshot.forEach((doc) => {
                    const data = doc.data() as TransactionType;
                    const parentDeptId = doc.ref.parent.parent?.id;
                    
                    if (data.name && parentDeptId && !uniqueNames.has(data.name)) {
                        fetchedTypes.push({
                            id: doc.id,
                            name: data.name,
                            parentDeptId: parentDeptId
                        });
                        uniqueNames.add(data.name);
                    }
                });
                
                fetchedTypes.sort((a,b) => a.name.localeCompare(b.name, 'ar'));
                setTransactionTypes(fetchedTypes);
            } catch (error) {
                console.error("Failed to fetch transaction types:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة أنواع المعاملات.' });
            } finally {
                setTypesLoading(false);
            }
        };

        fetchEngineers();
        fetchTransactionTypes();
    }, [firestore, isOpen, toast]);

    const transactionTypeOptions = useMemo(() => 
        transactionTypes.map(t => ({ value: t.name, label: t.name })), 
    [transactionTypes]);

    const engineerOptions = useMemo(() => 
        engineers.map(e => ({ value: e.id!, label: e.fullName })), 
    [engineers]);

    const resetForm = () => {
        setTransactionTypeName('');
        setDescription('');
        setAssignedEngineerId('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        if (!transactionTypeName) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار نوع المعاملة.' });
            return;
        }

        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);
            const newTransactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
            const newTransactionRefId = newTransactionRef.id;

            let engineerForTransactionId: string | null = assignedEngineerId || null;

            const selectedType = transactionTypes.find(t => t.name === transactionTypeName);

            // Special logic for "بلدية سكن خاص"
            if (transactionTypeName.includes('بلدية') && transactionTypeName.includes('سكن خاص')) {
                const clientRef = doc(firestore, 'clients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = clientSnap.data() as Client;
                    if (clientData.assignedEngineer) {
                        engineerForTransactionId = clientData.assignedEngineer;
                    } else {
                         toast({ variant: 'destructive', title: 'خطأ', description: 'يجب إسناد مهندس مسؤول للعميل أولاً قبل إنشاء معاملة سكن خاص.' });
                         setIsSaving(false);
                         return;
                    }
                }
            }

            const engineer = engineers.find(e => e.id === engineerForTransactionId);

            const newTransactionData: Omit<ClientTransaction, 'id'> = {
                clientId,
                transactionType: transactionTypeName,
                description,
                departmentId: selectedType?.parentDeptId,
                transactionTypeId: selectedType?.id,
                assignedEngineerId: engineerForTransactionId,
                status: 'new',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            batch.set(newTransactionRef, newTransactionData);

            // Add creation log event to the transaction's timeline
            let logContent = `أنشأ المعاملة "${transactionTypeName}".`;
            if (engineer) {
                logContent += ` وأسندها إلى المهندس ${engineer.fullName}.`;
            }
            
            // Link the appointment to this new transaction if it originated from one
            if (fromAppointmentId) {
                const appointmentRef = doc(firestore, 'appointments', fromAppointmentId);
                batch.update(appointmentRef, { transactionId: newTransactionRefId });
                logContent += ` (مرتبطة بالموعد ${fromAppointmentId.substring(0, 5)}...).`;
            }
            
            const timelineCollectionRef = collection(newTransactionRef, 'timelineEvents');
            const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);
            const logEventData = {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            };
            batch.set(doc(timelineCollectionRef), logEventData);
            batch.set(doc(historyCollectionRef), logEventData);


            await batch.commit();
            
            toast({ title: 'نجاح', description: 'تمت إضافة المعاملة والسجل بنجاح.' });
            
            // --- Notification Logic ---
            const engineerName = engineer ? engineer.fullName : 'غير مسند';
            const recipients = new Set<string>();

            if (currentUser.id) recipients.add(currentUser.id);

            if (engineerForTransactionId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, engineerForTransactionId);
                if (targetUserId) recipients.add(targetUserId);
            }
            
            for (const recipientId of recipients) {
                const isCreator = recipientId === currentUser.id;
                const title = isCreator ? 'تم إنشاء معاملة بنجاح' : 'تم إسناد معاملة جديدة لك';
                const body = isCreator 
                    ? `لقد أنشأت المعاملة "${transactionTypeName}" للعميل ${clientName} وأسندتها إلى ${engineerName}.`
                    : `أسند إليك ${currentUser.fullName} المعاملة "${transactionTypeName}" للعميل ${clientName}.`;
                
                await createNotification(firestore, { userId: recipientId, title, body, link: `/dashboard/clients/${clientId}/transactions/${newTransactionRefId}` });
            }
            
            resetForm();
            onClose();

            // After everything is done, if we came from an appointment, go back to it.
            if (fromAppointmentId) {
                router.push(`/dashboard/appointments/${fromAppointmentId}`);
            }

        } catch (error) {
            console.error("Error adding transaction:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل في إضافة المعاملة.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>إضافة معاملة داخلية جديدة</DialogTitle>
                        <DialogDescription>
                            أضف خدمة جديدة لملف العميل. سيتم إشعار المهندس المسؤول (إن وجد).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="transactionType">نوع المعاملة <span className="text-destructive">*</span></Label>
                            <InlineSearchList 
                                value={transactionTypeName}
                                onSelect={setTransactionTypeName}
                                options={transactionTypeOptions}
                                placeholder={typesLoading ? 'جاري التحميل...' : 'اختر نوع المعاملة...'}
                                disabled={typesLoading}
                            />
                        </div>
                        {transactionTypeName.includes('بلدية') && transactionTypeName.includes('سكن خاص') ? (
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>إسناد تلقائي</AlertTitle>
                                <AlertDescription>
                                    سيتم إسناد هذه المعاملة تلقائيًا إلى المهندس المسؤول عن ملف العميل.
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <div className="grid gap-2">
                                <Label htmlFor="assignedEngineerId">إسناد إلى مهندس (اختياري)</Label>
                                <InlineSearchList
                                    value={assignedEngineerId}
                                    onSelect={setAssignedEngineerId}
                                    options={engineerOptions}
                                    placeholder={engineersLoading ? 'جاري التحميل...' : 'اختر مهندسًا...'}
                                    disabled={engineersLoading}
                                />
                            </div>
                        )}
                        
                         <div className="grid gap-2">
                            <Label htmlFor="description">وصف المعاملة</Label>
                            <Textarea 
                                id="description" 
                                placeholder="أضف أي تفاصيل أو ملاحظات إضافية هنا..." 
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isSaving ? 'جاري الحفظ...' : 'حفظ المعاملة'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
