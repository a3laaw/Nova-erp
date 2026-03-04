'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { useFirebase, useDocument } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, writeBatch, serverTimestamp, getDoc, where, runTransaction, Timestamp, orderBy } from 'firebase/firestore';
import type { CashReceipt, Client, ClientTransaction, Account, Employee, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';

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
  const { branding } = useBranding();
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
  const savingRef = useRef(false);
  const [journalEntryIsPosted, setJournalEntryIsPosted] = useState(false);

  // Form state
  const [date, setDate] = useState<Date | undefined>();
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

  const { data: receiptData, loading: receiptLoading } = useDocument<CashReceipt>(firestore, receiptRef ? receiptRef.path : null);


  useEffect(() => {
    if (!receiptData) {
      if (!receiptLoading) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على سند القبض.' });
        router.push('/dashboard/accounting/cash-receipts');
      }
      return;
    }
    
    setReceipt(receiptData);
    setOriginalReceipt(receiptData);

    // Populate form
    setDate(toFirestoreDate(receiptData.receiptDate) || undefined);
    setSelectedProjectId(receiptData.projectId || '');
    setAmount(String(receiptData.amount));
    setAmountInWords(receiptData.amountInWords);
    setDescription(receiptData.description);
    setPaymentMethod(receiptData.paymentMethod);
    setReference(receiptData.reference || '');
    
  }, [receiptData, receiptLoading, toast, router]);
  
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
 }, [receipt, firestore, accounts]);
  

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);
  
  useEffect(() => {
    const generateDescription = async () => {
      if (!originalReceipt?.projectId || !amount || parseFloat(amount) <= 0 || !firestore) {
        setDescription(originalReceipt?.description || '');
        return;
      }
      
      const project = clientProjects.find(p => p.id === originalReceipt.projectId);
      if (!project || !project.contract?.clauses) {
        setDescription(originalReceipt?.description || '');
        return;
      }

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
        }
    };
    fetchClientProjects();
  }, [firestore, receipt?.clientId]);


  const projectOptions = useMemo(() => clientProjects.map(p => {
    const date = toFirestoreDate(p.createdAt);
    const dateString = date ? format(date, 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);

  const debitAccountOptions = useMemo(() => {
    if (!paymentMethod) return [];
    
    if (paymentMethod === 'Cash') {
        return accounts
            .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes('صندوق'))
            .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
    } else {
        return accounts
            .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes('بنك'))
            .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
    }
  }, [accounts, paymentMethod]);
  
 const handleSave = async () => {
    if (!firestore || !currentUser || !id || !originalReceipt || !date || savingRef.current) return;

    if (!amount || !paymentMethod || !debitAccountId) {
        toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).'});
        return;
    }

    savingRef.current = true;
    setIsSaving(true);
    
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const receiptRefDoc = doc(firestore, 'cashReceipts', id);
            const selectedClientAccount = accounts.find(acc => acc.name === originalReceipt.clientNameAr);
            const selectedDebitAccount = accounts.find(acc => acc.id === debitAccountId);

            if (!selectedClientAccount || !selectedDebitAccount) {
                throw new Error("الحسابات المطلوبة غير موجودة.");
            }

            // 🏦 محرك حساب العمولات البنكية المحدث (Banking Commission Engine)
            const selectedMethodData = branding?.payment_methods?.find(m => m.name === paymentMethod);
            let commissionAmount = 0;
            if (selectedMethodData) {
                if (selectedMethodData.type === 'percentage') {
                    commissionAmount = parseFloat(amount) * (selectedMethodData.value / 100);
                } else {
                    commissionAmount = selectedMethodData.value;
                }
            }
            const netBankDeposit = parseFloat(amount) - commissionAmount;

            transaction_fs.update(receiptRefDoc, {
                receiptDate: date,
                projectId: selectedProjectId || null,
                amount: parseFloat(amount),
                amountInWords: amountInWords,
                description: description,
                paymentMethod: paymentMethod,
                reference: reference,
                commissionAmount
            });
            
            const projectId = selectedProjectId || originalReceipt.projectId || null;
            let autoTags = {};
            if (projectId) {
                const project = clientProjects.find(p => p.id === projectId);
                if (project && project.assignedEngineerId) {
                    const engineer = employees.find(e => e.id === project.assignedEngineerId);
                    const department = departments.find(d => d.name === engineer?.department);
                    autoTags = { 
                        clientId: originalReceipt.clientId, 
                        transactionId: projectId, 
                        auto_profit_center: projectId, 
                        auto_resource_id: project.assignedEngineerId, 
                        ...(department && { auto_dept_id: department.id }) 
                    };
                }
            }

            const jeLines = [
                { accountId: selectedDebitAccount.id!, accountName: selectedDebitAccount.name, debit: netBankDeposit, credit: 0 },
                { accountId: selectedClientAccount.id!, accountName: selectedClientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
            ];

            if (commissionAmount > 0 && selectedMethodData?.expenseAccountId) {
                jeLines.push({
                    accountId: selectedMethodData.expenseAccountId,
                    accountName: selectedMethodData.expenseAccountName || 'مصروف عمولات بنكية',
                    debit: commissionAmount,
                    credit: 0
                });
            }

            const jeUpdatePayload = {
                date: Timestamp.fromDate(date),
                lines: jeLines,
                totalDebit: parseFloat(amount),
                totalCredit: parseFloat(amount),
                narration: `[تعديل دفعة] ${description} ${commissionAmount > 0 ? `(صافي المودع: ${formatCurrency(netBankDeposit)})` : ''}`,
                transactionId: projectId,
                clientId: originalReceipt.clientId,
            };

            if (originalReceipt.journalEntryId) {
                transaction_fs.update(doc(firestore, 'journalEntries', originalReceipt.journalEntryId), jeUpdatePayload);
            }
        });

        toast({ title: 'نجاح', description: 'تم تحديث سند القبض والقيد المحاسبي.' });
        router.push(`/dashboard/accounting/cash-receipts/${id}`);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
        setIsSaving(false);
        savingRef.current = false;
    }
  };

  if (receiptLoading || accountsLoading) {
      return (
          <Card className="max-w-4xl mx-auto"><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent className="space-y-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /></CardContent></Card>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto rounded-3xl border-none shadow-xl" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 rounded-t-3xl border-b">
            <CardTitle>تعديل سند القبض</CardTitle>
            <CardDescription>تعديل بيانات سند القبض رقم: {receipt?.voucherNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                    <Label className="font-bold">استلمنا من السيد/السادة</Label>
                    <Input value={originalReceipt?.clientNameAr || ''} disabled readOnly className="bg-muted h-12 rounded-xl" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">التاريخ *</Label>
                    <DateInput value={date} onChange={setDate} disabled={isSaving} className="h-12" />
                </div>
            </div>
            
            <div className="grid gap-2 p-4 bg-muted/30 rounded-2xl border border-dashed">
                <Label className="font-bold text-primary flex items-center gap-2"><Target className="h-4 w-4"/> العقد / المشروع المرتبط</Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={projectOptions}
                    placeholder={'اختر العقد المراد سداد دفعة له...'}
                    disabled={isSaving}
                    className="h-11 bg-white border-primary/20"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label className="font-bold">المبلغ المحصل *</Label>
                    <Input id="amount" type="number" step="0.001" className='text-left dir-ltr h-12 text-xl font-black text-primary' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
                </div>
                <div className="md:col-span-2 grid gap-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">مبلغ وقدره (كتابة)</Label>
                    <div className='p-3 text-sm font-bold text-muted-foreground border-2 border-dashed rounded-xl min-h-[48px] bg-muted/50 flex items-center justify-center italic'>
                        {amountInWords}
                    </div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description" className="font-bold">وذلك عن / البيان</Label>
                <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving} rows={3} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                <div className="grid gap-2">
                    <Label className="font-bold">طريقة الدفع</Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="Cash">نقداً</SelectItem>
                            <SelectItem value="Cheque">شيك</SelectItem>
                            <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                            {(branding?.payment_methods || []).map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label className="font-bold">حساب الإيداع *</Label>
                    <InlineSearchList 
                        value={debitAccountId}
                        onSelect={setDebitAccountId}
                        options={debitAccountOptions}
                        placeholder={'اختر حساب...'}
                        disabled={accountsLoading || isSaving}
                        className="h-11"
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">رقم الشيك / المرجع</Label>
                    <Input value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving} className="h-11 rounded-xl" />
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-3 p-8 border-t bg-muted/10 rounded-b-3xl">
        <Button variant="ghost" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            حفظ التعديلات
        </Button>
      </CardFooter>
    </Card>
  );
}
