'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Printer, Save, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, updateDoc, orderBy, writeBatch, limit } from 'firebase/firestore';
import type { Client, Company, ClientTransaction, Account, Employee, Department, TransactionStage } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';
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


export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [date, setDate] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');

  const [voucherNumber, setVoucherNumber] = useState('جاري التوليد...');
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const generateVoucherNumber = async () => {
        setIsGeneratingVoucher(true);
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setVoucherNumber(`CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            console.error("Error generating voucher number:", error);
            setVoucherNumber('خطأ');
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد رقم سند تلقائي.' });
        } finally {
            setIsGeneratingVoucher(false);
        }
    };

    generateVoucherNumber();
  }, [firestore, toast]);

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);


  // Effect to fetch initial company, client, and accounts data
  useEffect(() => {
    if (!firestore) return;

    const fetchInitialData = async () => {
        setClientsLoading(true);
        setAccountsLoading(true);
        try {
            const [clientsSnap, accountsSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collection(firestore, 'employees'))),
                getDocs(query(collection(firestore, 'departments')))
            ]);

            const fetchedClients = clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
            setClients(fetchedClients);
            
            setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));

        } catch (error) {
            console.error("Error fetching initial data:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات الأساسية.' });
        } finally {
            setClientsLoading(false);
            setAccountsLoading(false);
        }
    };
    fetchInitialData();
  }, [firestore, toast]);
  
  // Effect to fetch client's projects (transactions) when a client is selected
  useEffect(() => {
    if (!firestore || !selectedClientId) {
        setClientProjects([]);
        setSelectedProjectId('');
        return;
    }
    
    const fetchClientProjects = async () => {
        setProjectsLoading(true);
        try {
            const projectsQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
            const snapshot = await getDocs(projectsQuery);
            // Only show projects that have a contract
            const fetchedProjects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction))
                .filter(tx => !!tx.contract);

            setClientProjects(fetchedProjects);
        } catch (error) {
            console.error("Error fetching client projects:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب معاملات العميل.' });
        } finally {
            setProjectsLoading(false);
        }
    };

    fetchClientProjects();
  }, [firestore, selectedClientId, toast]);
  
  // Effect for automatic description generation
  useEffect(() => {
    const generateDescription = async () => {
        if (!selectedProjectId || !amount || parseFloat(amount) <= 0 || !firestore) {
            setDescription('');
            return;
        }

        const project = clientProjects.find(p => p.id === selectedProjectId);
        if (!project || !project.contract?.clauses) {
            setDescription(''); // Reset description if no contract or clauses
            return;
        }

        // 1. Fetch all existing payments for this project
        let totalAlreadyPaid = 0;
        try {
            totalAlreadyPaid = await getTotalPaidForProject(selectedProjectId, firestore);
        } catch (e) {
            console.error("Could not fetch previous payments for description generation:", e);
        }

        let remainingAmountFromCurrentPayment = parseFloat(amount);
        const descriptionParts: string[] = [];
        let allocatedPaid = 0;

        // Iterate over a copy of clauses to avoid state issues
        for (const clause of [...project.contract.clauses]) {
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
  }, [amount, selectedProjectId, clientProjects, firestore]);


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
  
  const debitAccountOptions = useMemo(() => {
    return accounts
      .filter(acc => acc.type === 'asset' && acc.isPayable)
      .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
  }, [accounts]);

  const handleSave = async () => {
    if (!firestore || !currentUser) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'Firebase غير متاح أو المستخدم غير مسجل.' });
        return;
    }
    
    if (!selectedClientId || !amount || !date || !paymentMethod || !debitAccountId) {
        toast({
            variant: 'destructive',
            title: 'حقول ناقصة',
            description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).',
        });
        return;
    }

    if (isGeneratingVoucher) {
        toast({ variant: 'destructive', title: 'الرجاء الانتظار', description: 'جاري توليد رقم السند.' });
        return;
    }

    setIsSaving(true);
    let newReceiptId = '';
    let isFirstReceiptForProject = false;
    let transactionRef: any = null;

    try {
        // --- PRE-TRANSACTION READS ---
        if (selectedProjectId) {
            const receiptsForProjectQuery = query(collection(firestore, 'cashReceipts'), where('projectId', '==', selectedProjectId), limit(1));
            const receiptsSnap = await getDocs(receiptsForProjectQuery);
            isFirstReceiptForProject = receiptsSnap.empty;

            transactionRef = doc(firestore, 'clients', selectedClientId, 'transactions', selectedProjectId);
        }

        // --- ATOMIC TRANSACTION ---
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            
            // READS within transaction (only get() on DocumentReference is allowed)
            const counterDoc = await transaction_fs.get(counterRef);
            const selectedClient = clients.find(c => c.id === selectedClientId);
            if (!selectedClient) throw new Error("لم يتم العثور على العميل المختار.");
            
            const clientAccount = accounts.find(acc => acc.name === selectedClient.nameAr);
            if (!clientAccount) throw new Error(`لم يتم العثور على حساب محاسبي للعميل: ${selectedClient.nameAr}. تأكد من إنشاء عقد له أولاً.`);
            
            const debitAccount = accounts.find(acc => acc.id === debitAccountId);
            if (!debitAccount) throw new Error('حساب الاستلام المختار غير صالح.');
            
            // --- WRITES within transaction ---
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            transaction_fs.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            const newVoucherNumber = `CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            
            const newReceiptRef = doc(collection(firestore, 'cashReceipts'));
            newReceiptId = newReceiptRef.id;

            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            
            let autoTags = {};
            if (selectedProjectId && selectedProject && selectedProject.assignedEngineerId) {
                const engineer = employees.find(e => e.id === selectedProject.assignedEngineerId);
                const department = departments.find(d => d.name === engineer?.department);
                
                autoTags = {
                    clientId: selectedClientId,
                    transactionId: selectedProjectId,
                    auto_profit_center: selectedProjectId,
                    auto_resource_id: selectedProject.assignedEngineerId,
                    ...(department && { auto_dept_id: department.id }),
                };
            }

            const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

            const newReceiptData: any = { 
                voucherNumber: newVoucherNumber, voucherSequence: nextNumber, voucherYear: currentYear,
                clientId: selectedClientId, clientNameAr: selectedClient?.nameAr || '', clientNameEn: selectedClient?.nameEn || '',
                amount: parseFloat(amount), amountInWords: amountInWords, receiptDate: Timestamp.fromDate(new Date(date)),
                paymentMethod: paymentMethod, description: description, reference: reference, journalEntryId: newJournalEntryRef.id,
                createdAt: serverTimestamp(),
            };
            
            if (selectedProjectId && selectedProject) {
                newReceiptData.projectId = selectedProjectId;
                newReceiptData.projectNameAr = selectedProject.transactionType;
            }

            transaction_fs.set(newReceiptRef, newReceiptData);
            
            const journalEntryData = {
                entryNumber: `CRV-JE-${newVoucherNumber}`, date: newReceiptData.receiptDate,
                narration: description || `سند قبض رقم ${newVoucherNumber} من العميل ${selectedClient?.nameAr}`,
                totalDebit: parseFloat(amount), totalCredit: parseFloat(amount), status: 'posted' as const,
                lines: [
                    { accountId: debitAccount.id!, accountName: debitAccount.name, debit: parseFloat(amount), credit: 0 },
                    { accountId: clientAccount.id, accountName: clientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
                ],
                clientId: selectedClientId, transactionId: selectedProjectId || null,
                createdAt: serverTimestamp(), createdBy: currentUser.id,
            };
            transaction_fs.set(newJournalEntryRef, journalEntryData);

            if (transactionRef && isFirstReceiptForProject) {
                const txSnap = await transaction_fs.get(transactionRef);
                if (txSnap.exists()) {
                    const txData = txSnap.data() as ClientTransaction;
                    const currentStages: TransactionStage[] = [...(txData.stages || [])];
                    const contractStageIndex = currentStages.findIndex(s => s.name === 'توقيع العقد');

                    if (contractStageIndex !== -1 && currentStages[contractStageIndex].status !== 'completed') {
                        currentStages[contractStageIndex].status = 'completed';
                        currentStages[contractStageIndex].endDate = new Date() as any; // Firestore will convert this
                        transaction_fs.update(transactionRef, { stages: currentStages });
                    }
                }
            }
        });
        
        // --- POST-TRANSACTION LOGIC ---
        toast({ title: 'نجاح', description: 'تم حفظ سند القبض والقيد المحاسبي بنجاح.' });
        
        if (selectedProjectId) {
            const txRef = doc(firestore, 'clients', selectedClientId, 'transactions', selectedProjectId);
            const transactionDoc = await getDoc(txRef);
            if (!transactionDoc.exists()) throw new Error('Transaction not found for post-processing');
            const transactionData = transactionDoc.data() as ClientTransaction;

            const postTransactionBatch = writeBatch(firestore);
            
            // Update all contract clauses statuses
            if (transactionData.contract?.clauses) {
                const totalPaid = await getTotalPaidForProject(selectedProjectId, firestore);
                let accumulatedAmount = 0;
                let dueClauseFound = false;
                
                const updatedClauses = transactionData.contract.clauses.map((clause: any) => {
                    const newClause = { ...clause };
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
                 postTransactionBatch.update(txRef, { 'contract.clauses': updatedClauses });
            }
            
            await postTransactionBatch.commit();
        }
        
        // Post-transaction notifications
         if (selectedProjectId) {
            const selectedProject = clientProjects.find(p => p.id === selectedProjectId);
            if (selectedProject?.assignedEngineerId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, selectedProject.assignedEngineerId);
                if (targetUserId && targetUserId !== currentUser.id) {
                     await createNotification(firestore, {
                        userId: targetUserId,
                        title: `دفعة جديدة لمعاملة`,
                        body: `قام ${currentUser.fullName} بتسجيل دفعة جديدة بقيمة ${formatCurrency(parseFloat(amount))} لمعاملة "${selectedProject.transactionType}" للعميل ${clients.find(c => c.id === selectedClientId)?.nameAr}.`,
                        link: `/dashboard/clients/${selectedClientId}/transactions/${selectedProjectId}`
                    });
                }
            }
        }

        router.push(`/dashboard/accounting/cash-receipts/${newReceiptId}`);

    } catch (error) {
        console.error("Error saving cash receipt:", error);
        toast({
            variant: 'destructive',
            title: 'خطأ في الحفظ',
            description: error instanceof Error ? error.message : 'لم يتم حفظ السند، الرجاء المحاولة مرة أخرى.',
        });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedProjectId('');
    setClientProjects([]);
    setDescription('');
  };

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle>سـنـد قـبـض / Cash Receipt Voucher</CardTitle>
                    <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                <Label htmlFor="receivedFrom">استلمنا من السيد/السادة <span className="text-destructive">*</span></Label>
                <InlineSearchList 
                    value={selectedClientId}
                    onSelect={handleClientChange}
                    options={clientOptions}
                    placeholder={clientsLoading ? 'جاري التحميل...' : 'ابحث عن عميل بالاسم أو الجوال...'}
                    disabled={clientsLoading || isSaving}
                />
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
                    placeholder={!selectedClientId ? 'اختر عميلاً أولاً' : projectsLoading ? 'جاري جلب المشاريع...' : 'اختر المشروع (اختياري)...'}
                    disabled={!selectedClientId || projectsLoading || isSaving}
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
      <CardFooter className="flex justify-end gap-2 no-print">
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/accounting')} disabled={isSaving}>
            <X className="ml-2 h-4 w-4" />
            إلغاء
        </Button>
        <Button onClick={handleSave} disabled={isSaving || isGeneratingVoucher}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الحفظ...' : 'حفظ وإنشاء السند'}
        </Button>
      </CardFooter>
    </Card>
  );
}
