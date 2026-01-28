'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, writeBatch, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, ClientTransaction, TransactionType } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

export function ClientTransactionForm({ isOpen, onClose, clientId, clientName }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);
    const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
    const [typesLoading, setTypesLoading] = useState(true);

    const [transactionType, setTransactionType] = useState('');
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
                const q = query(collection(firestore, 'transactionTypes'));
                const querySnapshot = await getDocs(q);
                const fetchedTypes: TransactionType[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedTypes.push({ id: doc.id, ...doc.data() } as TransactionType);
                });
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

    const resetForm = () => {
        setTransactionType('');
        setDescription('');
        setAssignedEngineerId('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن الاتصال بقاعدة البيانات أو تحديد المستخدم.' });
            return;
        }

        if (!transactionType) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار نوع المعاملة.' });
            return;
        }

        setIsSaving(true);

        try {
            const batch = writeBatch(firestore);
            const newTransactionRef = doc(collection(firestore, `clients/${clientId}/transactions`));
            const newTransactionRefId = newTransactionRef.id;

            let engineerForTransactionId: string | null = assignedEngineerId || null;

            // Special logic for "بلدية سكن خاص"
            if (transactionType.includes('بلدية') && transactionType.includes('سكن خاص')) {
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
                transactionType,
                description,
                assignedEngineerId: engineerForTransactionId,
                status: 'new',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            batch.set(newTransactionRef, newTransactionData);

            // Add creation log event to the transaction's timeline
            const timelineCollectionRef = collection(newTransactionRef, 'timelineEvents');
            const logEventRef = doc(timelineCollectionRef);
            
            let logContent = `أنشأ المعاملة "${transactionType}".`;
            if (engineer) {
                logContent += ` وأسندها إلى المهندس ${engineer.fullName}.`;
            }

            batch.set(logEventRef, {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            });

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
                    ? `لقد أنشأت المعاملة "${transactionType}" للعميل ${clientName} وأسندتها إلى ${engineerName}.`
                    : `أسند إليك ${currentUser.fullName} المعاملة "${transactionType}" للعميل ${clientName}.`;
                
                await createNotification(firestore, { userId: recipientId, title, body, link: `/dashboard/clients/${clientId}/transactions/${newTransactionRefId}` });
            }
            
            resetForm();
            onClose();

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
                            <select
                                id="transactionType"
                                value={transactionType}
                                onChange={(e) => setTransactionType(e.target.value)}
                                className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50")}
                                required
                                disabled={typesLoading}
                            >
                                <option value="" disabled>{typesLoading ? 'جاري التحميل...' : 'اختر نوع المعاملة...'}</option>
                                {transactionTypes.map(type => (
                                    <option key={type.id} value={type.name}>{type.name}</option>
                                ))}
                            </select>
                        </div>
                        {transactionType.includes('بلدية') && transactionType.includes('سكن خاص') ? (
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
                                <select
                                    id="assignedEngineerId"
                                    value={assignedEngineerId}
                                    onChange={(e) => setAssignedEngineerId(e.target.value)}
                                    className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50")}
                                    disabled={engineersLoading}
                                >
                                    <option value="">{engineersLoading ? 'جاري التحميل...' : 'اختر مهندسًا...'}</option>
                                    {engineers.map(e => (
                                        <option key={e.id} value={e.id!}>{e.fullName}</option>
                                    ))}
                                </select>
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
