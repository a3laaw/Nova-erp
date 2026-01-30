
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
import { Save, X, Loader2, AlertCircle, Info } from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, writeBatch, serverTimestamp, getDoc, where, runTransaction, Timestamp, orderBy } from 'firebase/firestore';
import type { CashReceipt, Client, ClientTransaction, Account, Employee, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { format } from 'date-fns';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [journalEntryIsPosted, setJournalEntryIsPosted] = useState(false);

  // Form state
  const [date, setDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  
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
  
  // Fetch related data
  useEffect(() => {
    if (!firestore) return;
    const fetchRelatedData = async () => {
        setAccountsLoading(true);
        try {
            const [clientsSnap, accountsSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'clients'))),
                getDocs(query(collection(firestore, 'chartOfAccounts'))),
                getDocs(query(collection(firestore, 'employees'))),
                getDocs(query(collection(firestore, 'departments')))
            ]);
            setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
            setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
        } finally {
            setAccountsLoading(false);
        }
    };
    fetchRelatedData();
  }, [firestore, toast]);

  // Fetch journal entry details
   useEffect(() => {
    if (receipt?.journalEntryId && firestore && accounts.length > 0) {
        const fetchJournalEntry = async () => {
            const jeRef = doc(firestore, 'journalEntries', receipt.journalEntryId!);
            const jeSnap = await getDoc(jeRef);
            if (jeSnap.exists()) {
                const jeData = jeSnap.data();
                setJournalEntryIsPosted(jeData.status === 'posted');
                // Set the debitAccountId from the fetched journal entry
                const debitLine = jeData.lines?.find((l: any) => l.debit > 0);
                if (debitLine?.accountId) {
                    setDebitAccountId(debitLine.accountId);
                }
            }
        };
        fetchJournalEntry();
    } else {
        setJournalEntryIsPosted(false);
    }
 }, [receipt, firestore, accounts, paymentMethod]);
  

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);
  
  useEffect(() => {
    const generateDescription = async () => {
      // Use originalReceipt to get the project ID and creation date, ensuring a stable reference
      if (!originalReceipt?.projectId || !amount || parseFloat(amount) <= 0 || !firestore) {
        // Fallback to the stored description if we can't generate a new one
        setDescription(originalReceipt?.description || '');
        return;
      }
      
      const project = clientProjects.find(p => p.id === originalReceipt.projectId);
      if (!project || !project.contract?.clauses) {
        setDescription(originalReceipt?.description || '');
        return;
      }

      // Logic to get total paid amount *before this specific receipt*
      const totalPaidPreviously = await getTotalPaidForProject(originalReceipt.projectId, firestore, id);
      
      let remainingAmountFromCurrentPayment = parseFloat(amount);
      const descriptionParts: string[] = [];
      let allocatedPaid = 0;

      for (const clause of project.contract.clauses) {
        if (remainingAmountFromCurrentPayment <= 0) break;
        
        const clauseAmount = clause.amount;
        const paidOnThisClausePreviously = Math.max(0, Math.min(clauseAmount, totalPaidPreviously - allocatedPaid));
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

    if(clientProjects.length > 0) {
      generateDescription();
    }
  }, [amount, originalReceipt, clientProjects, firestore, id]);


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


  const projectOptions = useMemo(() => clientProjects.map(p => {
    const dateString = p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);

  const debitAccountOptions = useMemo(() => {
    return accounts
      .filter(acc => acc.type === 'asset' && (acc.name.includes('بنك') || acc.name.includes('صندوق')))
      .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
  }, [accounts]);

 const handleSave = async () => {
    if (!firestore || !currentUser || !id || !originalReceipt) return;

    if (!amount || !date || !paymentMethod || !debitAccountId) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    setIsSaving(true);

    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const receiptRefDoc = doc(firestore, 'cashReceipts', id);
            
            // It's safer to get the latest original receipt data inside the transaction
            const latestReceiptSnap = await transaction_fs.get(receiptRefDoc);
            if (!latestReceiptSnap.exists()) {
                throw new Error("لم يتم العثور على سند القبض.");
            }
            const freshOriginalReceipt = latestReceiptSnap.data() as CashReceipt;

            const clientAccount = accounts.find(acc => acc.name === freshOriginalReceipt.clientNameAr);
            const selectedDebitAccount = accounts.find(acc => acc.id === debitAccountId);

            if (!clientAccount || !selectedDebitAccount) {
                throw new Error("الحسابات المطلوبة (العميل أو حساب الاستلام) غير موجودة.");
            }

            const receiptUpdatePayload = {
                receiptDate: new Date(date),
                projectId: selectedProjectId || null,
                amount: parseFloat(amount),
                amountInWords: amountInWords,
                description: description,
                paymentMethod: paymentMethod,
                reference: reference,
            };
            transaction_fs.update(receiptRefDoc, cleanFirestoreData(receiptUpdatePayload));

            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            let autoTags = {};
            if (selectedProjectId && selectedProject && selectedProject.assignedEngineerId) {
                const engineer = employees.find(e => e.id === selectedProject.assignedEngineerId);
                const department = departments.find(d => d.name === engineer?.department);
                
                autoTags = {
                    clientId: freshOriginalReceipt.clientId,
                    transactionId: selectedProjectId,
                    auto_profit_center: selectedProjectId,
                    auto_resource_id: selectedProject.assignedEngineerId,
                    ...(department && { auto_dept_id: department.id }),
                };
            }

            const newLines = [
                { accountId: selectedDebitAccount.id!, accountName: selectedDebitAccount.name, debit: parseFloat(amount), credit: 0 },
                { accountId: clientAccount.id, accountName: clientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
            ];

            const jeUpdatePayload = {
                date: Timestamp.fromDate(new Date(date)),
                lines: newLines,
                totalDebit: parseFloat(amount),
                totalCredit: parseFloat(amount),
                narration: description || `تحديث سند قبض رقم ${freshOriginalReceipt.voucherNumber}`,
                transactionId: selectedProjectId || null,
                clientId: freshOriginalReceipt.clientId,
            };

            if (freshOriginalReceipt.journalEntryId) {
                const jeRef = doc(firestore, 'journalEntries', freshOriginalReceipt.journalEntryId);
                transaction_fs.update(jeRef, jeUpdatePayload);
            } else {
                // This logic is a fallback in case a JE was never created.
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
                transaction_fs.set(newJournalEntryRef, {
                    ...jeUpdatePayload,
                    status: 'posted',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    entryNumber: `CRV-JE-${freshOriginalReceipt.voucherNumber}`,
                });
                transaction_fs.update(receiptRefDoc, { journalEntryId: newJournalEntryRef.id });
            }
        });

        // Post-transaction logic for updating contract clauses
        if (originalReceipt.projectId) {
            const totalPaid = await getTotalPaidForProject(originalReceipt.projectId, firestore);
            const transactionRef = doc(firestore, 'clients', originalReceipt.clientId, 'transactions', originalReceipt.projectId);
            const transactionDoc = await getDoc(transactionRef);

            if (transactionDoc.exists() && transactionDoc.data().contract?.clauses) {
                const transactionData = transactionDoc.data();
                let accumulatedAmount = 0;
                let dueClauseFound = false;
                const updatedClauses = transactionData.contract.clauses.map((clause: any) => {
                    const newClause = {...clause};
                    if (totalPaid >= accumulatedAmount + clause.amount) {
                        newClause.status = 'مدفوعة';
                    } else if (totalPaid > accumulatedAmount && !dueClauseFound) {
                        newClause.status = 'مستحقة';
                        dueClauseFound = true;
                    } else {
                        newClause.status = 'غير مستحقة';
                    }
                    accumulatedAmount += clause.amount;
                    return newClause;
                });
                await updateDoc(transactionRef, { 'contract.clauses': updatedClauses });
            }
        }

        toast({ title: 'نجاح', description: 'تم تحديث سند القبض والقيد المحاسبي بنجاح.' });
        router.push(`/dashboard/accounting/cash-receipts/${id}`);

    } catch (error) {
        console.error("Error updating cash receipt:", error);
        toast({
            variant: 'destructive',
            title: 'خطأ في الحفظ',
            description: error instanceof Error ? error.message : 'لم يتم حفظ التعديلات، الرجاء المحاولة مرة أخرى.',
        });
    } finally {
        setIsSaving(false);
    }
  };

  if (receiptLoading || accountsLoading) {
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
             {journalEntryIsPosted && (
                <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-200">
                    <Info className="h-4 w-4 !text-blue-600 dark:!text-blue-300" />
                    <AlertTitle>ملاحظة</AlertTitle>
                    <AlertDescription>
                        سيتم تحديث القيد المحاسبي المرتبط تلقائيًا عند حفظ التعديلات.
                    </AlertDescription>
                </Alert>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    <Label htmlFor="debitAccountId">حساب الاستلام <span className="text-destructive">*</span></Label>
                    <InlineSearchList 
                        value={debitAccountId}
                        onSelect={setDebitAccountId}
                        options={debitAccountOptions}
                        placeholder={accountsLoading ? 'تحميل...' : 'اختر حساب البنك أو الصندوق...'}
                        disabled={accountsLoading || isSaving}
                    />
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
        <Button onClick={handleSave} disabled={isSaving || receiptLoading || accountsLoading}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
      </CardFooter>
    </Card>
  );
}

    
