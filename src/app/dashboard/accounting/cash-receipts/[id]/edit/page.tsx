
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, writeBatch, serverTimestamp, getDoc, where } from 'firebase/firestore';
import type { CashReceipt, Client, ClientTransaction } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

const getTotalPaidForProject = async (projectId: string, db: any, excludeReceiptId?: string) => {
    let total = 0;
    if (!projectId || !db) return total;
    const receiptsQuery = query(collection(db, 'cashReceipts'), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        if (doc.id !== excludeReceiptId) {
            total += doc.data().amount || 0;
        }
    });
    return total;
};


export default function EditCashReceiptPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [receipt, setReceipt] = useState<CashReceipt | null>(null);
  const [originalReceipt, setOriginalReceipt] = useState<CashReceipt | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [date, setDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  
  const receiptRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'cashReceipts', id);
  }, [firestore, id]);

  const [receiptSnap, receiptLoading] = useDoc(receiptRef);

  useEffect(() => {
    if (!receiptSnap?.exists()) {
      if (!receiptLoading) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على سند القبض.' });
        router.push('/dashboard/accounting/cash-receipts');
      }
      return;
    }
    
    const data = { id: receiptSnap.id, ...receiptSnap.data() } as CashReceipt;
    setReceipt(data);
    setOriginalReceipt(data);

    // Populate form
    setDate(data.receiptDate?.toDate ? format(data.receiptDate.toDate(), 'yyyy-MM-dd') : '');
    setSelectedProjectId(data.projectId || '');
    setAmount(String(data.amount));
    setAmountInWords(data.amountInWords);
    setDescription(data.description);
    setPaymentMethod(data.paymentMethod);
    setReference(data.reference || '');
    
  }, [receiptSnap, receiptLoading, toast, router]);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);
  
    useEffect(() => {
        const generateDescription = async () => {
            if (!receipt?.projectId || !amount || parseFloat(amount) <= 0 || !firestore || !id) {
                setDescription(receipt?.description || '');
                return;
            }

            let totalAlreadyPaid = 0;
            try {
                totalAlreadyPaid = await getTotalPaidForProject(receipt.projectId, firestore, id);
            } catch (e) {
                console.error("Could not fetch previous payments for description generation:", e);
            }

            const project = clientProjects.find(p => p.id === receipt.projectId);
            if (!project || !project.contract?.clauses) {
                setDescription('');
                return;
            }

            let remainingAmountFromCurrentPayment = parseFloat(amount);
            const descriptionParts: string[] = [];
            let allocatedPaid = 0;

            for (const clause of project.contract.clauses) {
                if (remainingAmountFromCurrentPayment <= 0) break;
                
                const clauseAmount = clause.amount;
                const paidOnThisClausePreviously = Math.max(0, Math.min(clauseAmount, totalAlreadyPaid - allocatedPaid));
                const remainingOnClause = clauseAmount - paidOnThisClausePreviously;

                if (remainingOnClause > 0) {
                    const paymentForThisClause = Math.min(remainingAmountFromCurrentPayment, remainingOnClause);
                    
                    if (paymentForThisClause >= remainingOnClause) {
                        descriptionParts.push(`سداد كامل للدفعة "${clause.name}" بقيمة ${formatCurrency(remainingOnClause)}`);
                    } else {
                        descriptionParts.push(`سداد جزئي من الدفعة "${clause.name}" بقيمة ${formatCurrency(paymentForThisClause)}`);
                        const newRemaining = remainingOnClause - paymentForThisClause;
                        descriptionParts.push(`(المتبقي من هذه الدفعة: ${formatCurrency(newRemaining)})`);
                    }
                    remainingAmountFromCurrentPayment -= paymentForThisClause;
                }
                allocatedPaid += clauseAmount;
            }

            if (remainingAmountFromCurrentPayment > 0) {
                descriptionParts.push(`مبلغ إضافي قدره ${formatCurrency(remainingAmountFromCurrentPayment)} كدفعة مقدمة على الحساب.`);
            }
            
            setDescription(descriptionParts.join('\n'));
        };

        generateDescription();
    }, [amount, receipt, clientProjects, firestore, id]);

  useEffect(() => {
    if (!firestore) return;
    const fetchClients = async () => {
        try {
            const q = query(collection(firestore, 'clients'));
            const snapshot = await getDocs(q);
            const fetchedClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(fetchedClients);
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب قائمة العملاء.' });
        } finally {
            setLoading(receiptLoading);
        }
    };
    fetchClients();
  }, [firestore, toast, receiptLoading]);
  
  useEffect(() => {
    if (!firestore || !receipt?.clientId) {
        setClientProjects([]);
        return;
    }
    const fetchClientProjects = async () => {
        try {
            const projectsQuery = query(collection(firestore, `clients/${receipt.clientId}/transactions`));
            const snapshot = await getDocs(projectsQuery);
            const fetchedProjects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction))
                .filter(tx => !!tx.contract);
            setClientProjects(fetchedProjects);
        } catch (error) {
            console.error("Error fetching client projects:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب عقود العميل.' });
        }
    };
    fetchClientProjects();
  }, [firestore, receipt?.clientId, toast]);

  const clientOptions = useMemo(() => clients.map(c => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile,
  })), [clients]);

  const projectOptions = useMemo(() => clientProjects.map(p => {
    const dateString = p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);

  const handleSave = async () => {
    if (!firestore || !currentUser || !id || !originalReceipt) return;
    
    if (!amount || !date || !paymentMethod) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    setIsSaving(true);
    
    try {
        const batch = writeBatch(firestore);
        const receiptRefDoc = doc(firestore, 'cashReceipts', id);
        
        const updatePayload: Record<string, any> = {};
        const changes: string[] = [];

        if (date !== format(originalReceipt.receiptDate.toDate(), 'yyyy-MM-dd')) {
            updatePayload.receiptDate = new Date(date);
            changes.push(`تغيير تاريخ السند من ${format(originalReceipt.receiptDate.toDate(), 'dd/MM/yyyy')} إلى ${format(new Date(date), 'dd/MM/yyyy')}`);
        }
        if (selectedProjectId !== (originalReceipt.projectId || '')) {
            updatePayload.projectId = selectedProjectId;
            const oldProjectName = clientProjects.find(p => p.id === originalReceipt.projectId)?.transactionType || 'غير مرتبط';
            const newProjectName = clientProjects.find(p => p.id === selectedProjectId)?.transactionType || 'غير مرتبط';
            changes.push(`تغيير ربط المشروع من "${oldProjectName}" إلى "${newProjectName}"`);
        }
        if (parseFloat(amount) !== originalReceipt.amount) {
            updatePayload.amount = parseFloat(amount);
            updatePayload.amountInWords = amountInWords;
            changes.push(`تغيير المبلغ من ${formatCurrency(originalReceipt.amount)} إلى ${formatCurrency(parseFloat(amount))}`);
        }
        if (description !== originalReceipt.description) {
            updatePayload.description = description;
            changes.push(`تحديث الوصف.`);
        }
        if (paymentMethod !== originalReceipt.paymentMethod) {
            updatePayload.paymentMethod = paymentMethod;
            changes.push(`تغيير طريقة الدفع.`);
        }
        if (reference !== (originalReceipt.reference || '')) {
            updatePayload.reference = reference;
            changes.push(`تحديث المرجع.`);
        }
        
        if (Object.keys(updatePayload).length > 0) {
            batch.update(receiptRefDoc, cleanFirestoreData(updatePayload));
            
            if (changes.length > 0) {
                const logContent = `قام ${currentUser.fullName} بتعديل سند القبض رقم ${originalReceipt.voucherNumber}:\n- ${changes.join('\n- ')}`;
                const historyRef = doc(collection(firestore, 'clients', originalReceipt.clientId, 'history'));
                batch.set(historyRef, {
                    type: 'log',
                    content: logContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                });
            }
            
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تحديث سند القبض بنجاح.' });

            // --- Post-transaction update of contract clause statuses ---
            if (originalReceipt.projectId) { // Always recalculate if the project exists
                const projectRef = doc(firestore, `clients/${originalReceipt.clientId}/transactions/${originalReceipt.projectId}`);
                
                // Recalculate total paid amount for the project, considering the new amount
                const newTotalPaid = await getTotalPaidForProject(originalReceipt.projectId, firestore, id) + parseFloat(amount);
                
                const transactionDoc = await getDoc(projectRef);
                
                if (transactionDoc.exists() && transactionDoc.data().contract?.clauses) {
                    const transactionData = transactionDoc.data();
                    let accumulatedAmount = 0;
                    let dueClauseFound = false;
                    const updatedClauses = transactionData.contract.clauses.map((clause: any) => {
                        const newClause = {...clause};
                        if (newTotalPaid >= accumulatedAmount + clause.amount) {
                            newClause.status = 'مدفوعة';
                        } else if (newTotalPaid > accumulatedAmount && !dueClauseFound) {
                            newClause.status = 'مستحقة';
                            dueClauseFound = true;
                        } else {
                            newClause.status = 'غير مستحقة'; 
                        }
                        accumulatedAmount += clause.amount;
                        return newClause;
                    });
                    // This update must happen outside the main transaction batch
                    await updateDoc(projectRef, { 'contract.clauses': updatedClauses });
                }
            }


            // --- Notification Logic ---
            if (changes.length > 0 && originalReceipt.projectId) {
                 const transactionRef = doc(firestore, 'clients', originalReceipt.clientId, 'transactions', originalReceipt.projectId);
                 const transactionSnap = await getDoc(transactionRef);
                 if (transactionSnap.exists()) {
                     const transactionData = transactionSnap.data() as ClientTransaction;
                     const engineerId = transactionData.assignedEngineerId;

                     const recipients = new Set<string>();
                     if(currentUser.id) recipients.add(currentUser.id);
                     if (engineerId) {
                         const targetUserId = await findUserIdByEmployeeId(firestore, engineerId);
                         if(targetUserId) recipients.add(targetUserId);
                     }
                    
                     for (const recipientId of recipients) {
                         const isCreator = recipientId === currentUser.id;
                         await createNotification(firestore, {
                            userId: recipientId,
                            title: isCreator ? 'تم تحديث سند القبض' : 'تم تحديث سند قبض',
                            body: isCreator 
                                ? `لقد قمت بتحديث سند القبض رقم ${originalReceipt.voucherNumber}.`
                                : `قام ${currentUser.fullName} بتحديث سند القبض رقم ${originalReceipt.voucherNumber} لمعاملة "${transactionData.transactionType}".`,
                            link: `/dashboard/accounting/cash-receipts/${id}`
                        });
                     }
                 }
            }
            // --- End Notification Logic ---
        } else {
            toast({ title: 'لا توجد تغييرات', description: 'لم يتم تعديل أي بيانات.' });
        }

        router.push(`/dashboard/accounting/cash-receipts/${id}`);

    } catch (error) {
        console.error("Error updating cash receipt:", error);
        toast({
            variant: 'destructive',
            title: 'خطأ في الحفظ',
            description: 'لم يتم حفظ التعديلات، الرجاء المحاولة مرة أخرى.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (loading) {
      return (
          <Card className="max-w-4xl mx-auto">
              <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
              <CardContent className="space-y-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
               <CardFooter className="flex justify-end gap-2">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </CardFooter>
          </Card>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>تعديل سند القبض</CardTitle>
                    <CardDescription>
                        تعديل بيانات سند القبض رقم: {receipt?.voucherNumber}
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                    <Label htmlFor="receivedFrom">استلمنا من السيد/السادة</Label>
                    <Input id="receivedFrom" value={clients.find(c => c.id === receipt?.clientId)?.nameAr || ''} disabled readOnly />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                    <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSaving}/>
                </div>
            </div>
            
            <div className="grid gap-2">
                <Label htmlFor="project">ربط بعقد/مشروع</Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={projectOptions}
                    placeholder={'اختر العقد المراد سداد دفعة له...'}
                    disabled={isSaving}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                    <Input id="amount" type="number" placeholder="0.000" className='text-left dir-ltr' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
                </div>
                <div className="md:col-span-2 grid gap-2">
                <Label htmlFor="amountInWords">مبلغ وقدره (كتابة)</Label>
                <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50'>
                    {amountInWords || '(سيتم ملؤه تلقائياً)'}
                </div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description">وذلك عن</Label>
                <Textarea id="description" placeholder="وصف عملية الدفع (سيتم توليده تلقائياً عند اختيار مشروع)..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving}/>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                        <SelectTrigger id="paymentMethod">
                            <SelectValue placeholder="اختر طريقة الدفع" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Cash">نقداً</SelectItem>
                            <SelectItem value="Cheque">شيك</SelectItem>
                            <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                            <SelectItem value="K-Net">كي-نت</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                <Input id="reference" placeholder="رقم المرجع..." value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving}/>
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button onClick={handleSave} disabled={isSaving || loading}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
      </CardFooter>
    </Card>
  );
}
