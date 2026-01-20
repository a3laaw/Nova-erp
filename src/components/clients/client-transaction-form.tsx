'use client';

import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, ClientTransaction } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';


interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

const transactionTypes = [
    'تصميم بلدية (سكن خاص)',
    'تصميم بلدية (تجاري)',
    'تصميم كهرباء وماء',
    'إيصال تيار كهربائي',
    'إشراف على التنفيذ',
    'عقد توريد وتركيب',
    'معاملة أخرى'
];

export function ClientTransactionForm({ isOpen, onClose, clientId, clientName }: ClientTransactionFormProps) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [engineersLoading, setEngineersLoading] = useState(true);

    const [transactionType, setTransactionType] = useState('');
    const [description, setDescription] = useState('');
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!firestore || !isOpen) return;

        const fetchEngineers = async () => {
            setEngineersLoading(true);
            try {
                // A simple query, could be made more robust (e.g., check a 'role' field)
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

        fetchEngineers();
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

            const newTransactionData: Omit<ClientTransaction, 'id'> = {
                clientId,
                transactionType,
                description,
                assignedEngineerId: assignedEngineerId || undefined,
                status: 'new',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            batch.set(newTransactionRef, newTransactionData);

            // Add creation log event to the transaction's timeline
            const timelineCollectionRef = collection(newTransactionRef, 'timelineEvents');
            const logEventRef = doc(timelineCollectionRef);

            const engineer = engineers.find(e => e.id === assignedEngineerId);
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

            // 1. Add creator to recipients
            if (currentUser.id) {
                recipients.add(currentUser.id);
            }

            // 2. Add assignee to recipients
            if (assignedEngineerId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, assignedEngineerId);
                if (targetUserId) {
                    recipients.add(targetUserId);
                }
            }
            
            // 3. Send notifications to all unique recipients
            for (const recipientId of recipients) {
                const isCreator = recipientId === currentUser.id;
                
                const title = isCreator ? 'تم إنشاء معاملة بنجاح' : 'تم إسناد معاملة جديدة لك';
                const body = isCreator 
                    ? `لقد أنشأت المعاملة "${transactionType}" للعميل ${clientName} وأسندتها إلى ${engineerName}.`
                    : `أسند إليك ${currentUser.fullName} المعاملة "${transactionType}" للعميل ${clientName}.`;
                
                await createNotification(firestore, {
                    userId: recipientId,
                    title,
                    body,
                    link: `/dashboard/clients/${clientId}/transactions/${newTransactionRefId}`
                });
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
            <DialogContent
              className="sm:max-w-lg"
              dir="rtl"
              onPointerDownOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-radix-select-content]')) {
                  e.preventDefault();
                }
              }}
              onInteractOutside={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('[data-radix-select-content]')) {
                  e.preventDefault();
                }
              }}
            >
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
                            <Select dir="rtl" value={transactionType} onValueChange={setTransactionType} required>
                                <SelectTrigger id="transactionType">
                                    <SelectValue placeholder="اختر نوع المعاملة..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {transactionTypes.map(type => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="assignedEngineerId">إسناد إلى مهندس (اختياري)</Label>
                            <Select dir="rtl" value={assignedEngineerId} onValueChange={setAssignedEngineerId} disabled={engineersLoading}>
                                <SelectTrigger>
                                    <SelectValue placeholder={engineersLoading ? "تحميل المهندسين..." : "اختر مهندسًا..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {engineers.map(eng => (
                                        <SelectItem key={eng.id} value={eng.id!}>{eng.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
