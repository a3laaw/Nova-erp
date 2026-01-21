'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, ClientTransaction } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { cn } from '@/lib/utils';


interface ClientTransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

const transactionTypes = [
    { value: 'تصميم بلدية (سكن خاص)', label: 'تصميم بلدية (سكن خاص)'},
    { value: 'تصميم بلدية (تجاري)', label: 'تصميم بلدية (تجاري)'},
    { value: 'تصميم كهرباء وماء', label: 'تصميم كهرباء وماء'},
    { value: 'إيصال تيار كهربائي', label: 'إيصال تيار كهربائي'},
    { value: 'إشراف على التنفيذ', label: 'إشراف على التنفيذ'},
    { value: 'عقد توريد وتركيب', label: 'عقد توريد وتركيب'},
    { value: 'معاملة أخرى', label: 'معاملة أخرى'}
];

function InlineSearchList({ value, onSelect, options, placeholder }: { value: string; onSelect: (value: string) => void; options: { label: string; value: string; searchKey?: string }[]; placeholder: string; }) {
    const [search, setSearch] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const MAX_DISPLAY_ITEMS = 50;

    useEffect(() => {
        setSearch(options.find(o => o.value === value)?.label || '');
    }, [value, options]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase()) ||
        (opt.searchKey && opt.searchKey.toLowerCase().includes(search.toLowerCase()))
    );

    const displayOptions = filteredOptions.slice(0, MAX_DISPLAY_ITEMS);

    return (
        <div className="relative">
            <Input
                value={search}
                placeholder={placeholder}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 150)} // Delay to allow click
                onChange={(e) => {
                    setSearch(e.target.value);
                    setShowOptions(true);
                    if (value) onSelect('');
                }}
            />
            {showOptions && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
                    <ul className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <li className="p-2 text-sm text-muted-foreground">لا توجد نتائج</li>
                        ) : (
                            <>
                                {displayOptions.map(opt => (
                                    <li
                                        key={opt.value}
                                        className="cursor-pointer p-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onSelect(opt.value);
                                            setSearch(opt.label);
                                            setShowOptions(false);
                                        }}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span>{opt.label}</span>
                                            {opt.searchKey && <span className="text-xs text-muted-foreground dir-ltr">{opt.searchKey}</span>}
                                        </div>
                                    </li>
                                ))}
                                {filteredOptions.length > MAX_DISPLAY_ITEMS && (
                                    <li className="p-2 text-xs text-center text-muted-foreground">
                                        ... و {filteredOptions.length - MAX_DISPLAY_ITEMS} نتائج أخرى
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

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
    
    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber || e.civilId })), [engineers]);


    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); } }}>
            <DialogContent
                dir="rtl"
                className="sm:max-w-lg"
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]')) {
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
                            <Label>نوع المعاملة <span className="text-destructive">*</span></Label>
                            <InlineSearchList value={transactionType} onSelect={setTransactionType} options={transactionTypes} placeholder="اختر نوع المعاملة..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>إسناد إلى مهندس (اختياري)</Label>
                            <InlineSearchList value={assignedEngineerId} onSelect={setAssignedEngineerId} options={engineerOptions} placeholder={engineersLoading ? "تحميل..." : "ابحث بالاسم أو الرقم الوظيفي..."} />
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
