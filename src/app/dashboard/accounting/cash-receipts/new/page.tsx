'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Printer, Save, X, Loader2, Target, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, orderBy, writeBatch, limit, collectionGroup, addDoc } from 'firebase/firestore';
import type { Client, Company, ClientTransaction, Account, Employee, Department, TransactionStage, WorkStage, PaymentMethod } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
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

export default function NewCashReceiptPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const [selectedAccountId, setSelectedAccountId] = useState('');
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
        } finally {
            setIsGeneratingVoucher(false);
        }
    };

    generateVoucherNumber();
  }, [firestore]);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);

  useEffect(() => {
    if (!firestore) return;

    const fetchInitialData = async () => {
        setRefDataLoading(true);
        try {
            const [clientsSnap, accountsSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collection(firestore, 'employees'))),
                getDocs(query(collection(firestore, 'departments')))
            ]);

            setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
            setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            setEmployees(empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
            setDepartments(deptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));

        } catch (error) {
            console.error("Error fetching initial data:", error);
        } finally {
            setRefDataLoading(false);
        }
    };
    fetchInitialData();
  }, [firestore]);
  
  useEffect(() => {
    if (accounts.length > 0 && paymentMethod) {
      const isCash = paymentMethod === 'Cash';
      const searchKey = isCash ? 'صندوق' : 'بنك';
      const defaultAccount = accounts.find(acc => acc.isPayable && acc.type === 'asset' && acc.name.includes(searchKey));
      setDebitAccountId(defaultAccount?.id || '');
    } else if (!paymentMethod) {
        setDebitAccountId('');
    }
  }, [accounts, paymentMethod]);

  // منطق التعرف على العميل بناءً على الحساب المختار من الشجرة
  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedProjectId('');
    setClientProjects([]);
    setDescription('');

    const account = accounts.find(a => a.id === accountId);
    if (account) {
        // البحث عن العميل الذي يطابق اسمه اسم الحساب في الشجرة
        const client = clients.find(c => c.nameAr === account.name);
        if (client) {
            setSelectedClientId(client.id!);
        } else {
            setSelectedClientId('');
            toast({ 
                variant: 'default', 
                title: 'تنبيه الربط', 
                description: 'تم اختيار حساب عميل مالي ولكن لا يوجد ملف عميل مرتبط بهذا الاسم لجلب العقود.' 
            });
        }
    } else {
        setSelectedClientId('');
    }
  };

  useEffect(() => {
    if (!firestore || !selectedClientId) {
        setClientProjects([]);
        return;
    }
    
    const fetchClientProjects = async () => {
        setProjectsLoading(true);
        try {
            const projectsQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
            const snapshot = await getDocs(projectsQuery);
            const fetchedProjects = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction))
                .filter(tx => !!tx.contract);

            setClientProjects(fetchedProjects);
        } catch (error) {
            console.error("Error fetching client projects:", error);
        } finally {
            setProjectsLoading(false);
        }
    };

    fetchClientProjects();
  }, [firestore, selectedClientId]);
  
  useEffect(() => {
    const generateDescription = async () => {
        if (!selectedProjectId || !amount || parseFloat(amount) <= 0 || !firestore) {
            setDescription('');
            return;
        }

        const project = clientProjects.find(p => p.id === selectedProjectId);
        if (!project || !project.contract?.clauses) {
            setDescription('');
            return;
        }

        let totalAlreadyPaid = 0;
        try {
            totalAlreadyPaid = await getTotalPaidForProject(selectedProjectId, firestore);
        } catch (e) {
            console.error("Could not fetch previous payments:", e);
        }

        let remainingAmountFromCurrentPayment = parseFloat(amount);
        const descriptionParts: string[] = [];
        let allocatedPaid = 0;

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

  const handleSave = async () => {
    if (!firestore || !currentUser) return;
    if (savingRef.current) return;
    
    if (!selectedAccountId || !amount || !date || !paymentMethod || !debitAccountId) {
        toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).'});
        return;
    }

    savingRef.current = true;
    setIsSaving(true);
    let newReceiptId = '';
    
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'cashReceipts');
            const counterDoc = await transaction_fs.get(counterRef);
            
            const clientAccount = accounts.find(acc => acc.id === selectedAccountId);
            if (!clientAccount) throw new Error("لم يتم العثور على حساب العميل في الشجرة.");
            
            const debitAccount = accounts.find(acc => acc.id === debitAccountId);
            if (!debitAccount) throw new Error('حساب الاستلام غير صالح.');
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
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

            const selectedMethodData = branding?.payment_methods?.find(m => m.name === paymentMethod);
            let commissionAmount = 0;
            if (selectedMethodData) {
                const percFee = parseFloat(amount) * ((selectedMethodData.percentageFee || 0) / 100);
                const fixedFee = selectedMethodData.fixedFee || 0;
                commissionAmount = percFee + fixedFee;
            }
            const netBankDeposit = parseFloat(amount) - commissionAmount;

            const newReceiptData: any = { 
                voucherNumber: newVoucherNumber, voucherSequence: nextNumber, voucherYear: currentYear,
                clientId: selectedClientId || null, clientNameAr: clientAccount.name, 
                amount: parseFloat(amount), amountInWords: amountInWords, receiptDate: date,
                paymentMethod: paymentMethod, description: description, reference: reference, journalEntryId: newJournalEntryRef.id,
                commissionAmount,
                createdAt: serverTimestamp(),
            };
            
            if (selectedProjectId && selectedProject) {
                newReceiptData.projectId = selectedProjectId;
                newReceiptData.projectNameAr = selectedProject.transactionType;
            }

            const jeLines = [
                { accountId: debitAccount.id!, accountName: debitAccount.name, debit: netBankDeposit, credit: 0 },
                { accountId: clientAccount.id!, accountName: clientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
            ];

            if (commissionAmount > 0 && selectedMethodData?.expenseAccountId) {
                jeLines.push({
                    accountId: selectedMethodData.expenseAccountId,
                    accountName: selectedMethodData.expenseAccountName || 'مصروف عمولات بنكية',
                    debit: commissionAmount,
                    credit: 0
                });
            }

            const journalEntryData = {
                entryNumber: `CRV-JE-${newVoucherNumber}`, date: newReceiptData.receiptDate,
                narration: `[إشعار مالي] ${description} ${commissionAmount > 0 ? `(صافي المودع: ${formatCurrency(netBankDeposit)})` : ''}`,
                totalDebit: parseFloat(amount), totalCredit: parseFloat(amount), status: 'posted' as const,
                lines: jeLines,
                clientId: selectedClientId || null, transactionId: selectedProjectId || null,
                createdAt: serverTimestamp(), createdBy: currentUser.id,
            };

            transaction_fs.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction_fs.set(newReceiptRef, cleanFirestoreData(newReceiptData));
            transaction_fs.set(newJournalEntryRef, journalEntryData);
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ سند القبض ومعالجة العمولات البنكية آلياً.' });
        router.push(`/dashboard/accounting/cash-receipts/${newReceiptId}`);

    } catch (error: any) {
        console.error("Error saving cash receipt:", error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message || 'فشل حفظ السند.' });
        setIsSaving(false);
        savingRef.current = false;
    }
  };

  const clientAccountOptions = useMemo(() => 
    accounts.filter(a => a.parentCode === '1102').map(a => ({
      value: a.id!,
      label: `${a.name} (${a.code})`,
      searchKey: a.code
    }))
  , [accounts]);

  const projectOptions = useMemo(() => clientProjects.map(p => {
    const date = toFirestoreDate(p.createdAt);
    const dateString = date ? format(date, 'dd/MM/yyyy') : '';
    return {
        value: p.id!,
        label: dateString ? `${p.transactionType} (${dateString})` : p.transactionType,
    }
  }), [clientProjects]);
  
  const paymentMethodOptions = useMemo(() => {
      const base = [{ value: 'Cash', label: 'نقداً' }, { value: 'Cheque', label: 'شيك' }, { value: 'Bank Transfer', label: 'تحويل بنكي' }];
      const dynamic = (branding?.payment_methods || []).map(m => ({ value: m.name, label: m.name }));
      return [...base, ...dynamic];
  }, [branding]);

  const debitAccountOptions = useMemo(() => {
    if (!paymentMethod) return [];
    const isCash = paymentMethod === 'Cash';
    return accounts
        .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes(isCash ? 'صندوق' : 'بنك'))
        .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
  }, [accounts, paymentMethod]);

  return (
    <Card className="max-w-4xl mx-auto rounded-3xl border-none shadow-xl overflow-hidden" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 rounded-t-3xl border-b">
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl font-black">سـنـد قـبـض / Cash Receipt</CardTitle>
                    <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                <Label className="font-bold">استلمنا من (حساب العميل في الشجرة) <span className="text-destructive">*</span></Label>
                <InlineSearchList 
                    value={selectedAccountId}
                    onSelect={handleAccountChange}
                    options={clientAccountOptions}
                    placeholder={refDataLoading ? 'جاري التحميل...' : 'اختر الحساب المالي للعميل...'}
                    disabled={refDataLoading || isSaving}
                    className="h-12 rounded-xl border-primary/20"
                />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">التاريخ *</Label>
                    <DateInput value={date} onChange={setDate} disabled={isSaving} className="h-12" />
                </div>
            </div>
            
            <div className="grid gap-2 p-4 bg-muted/30 rounded-2xl border border-dashed">
                <Label className="font-bold flex items-center gap-2 text-primary">
                    <Target className="h-4 w-4"/> ربط بعقد/مشروع (مركز ربحية)
                </Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={projectOptions}
                    placeholder={!selectedClientId ? 'اختر حساب العميل المربوط بملف أولاً' : projectsLoading ? 'جاري جلب المشاريع...' : 'اختر المشروع (اختياري)...'}
                    disabled={!selectedClientId || projectsLoading || isSaving}
                    className="h-11 bg-white border-primary/20"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label className="font-bold">المبلغ المحصل <span className="text-destructive">*</span></Label>
                    <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr h-12 text-xl font-black text-primary' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
                </div>
                <div className="md:col-span-2 grid gap-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase">مبلغ وقدره (كتابة)</Label>
                <div className='p-3 text-sm font-bold text-muted-foreground border-2 border-dashed rounded-xl min-h-[48px] bg-muted/50 flex items-center justify-center italic text-center'>
                    {amountInWords || '(سيتم ملؤه تلقائياً)'}
                </div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description" className="font-bold">البيان / وذلك عن</Label>
                <Textarea id="description" placeholder="وصف عملية الدفع..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving} rows={3} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                <div className="grid gap-2">
                    <Label className="font-bold">طريقة الدفع <span className="text-destructive">*</span></Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="اختر الطريقة..." /></SelectTrigger>
                        <SelectContent dir="rtl">{paymentMethodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label className="font-bold">حساب الإيداع <span className="text-destructive">*</span></Label>
                    <InlineSearchList value={debitAccountId} onSelect={setDebitAccountId} options={debitAccountOptions} placeholder={!paymentMethod ? 'اختر الطريقة أولاً' : 'اختر الحساب...'} disabled={isSaving || !paymentMethod} className="h-11" />
                </div>
                <div className="grid gap-2">
                <Label className="font-bold">رقم الشيك / المرجع</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving} className="h-11 rounded-xl" />
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-3 p-8 border-t bg-muted/10 rounded-b-3xl">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 font-bold">إلغاء</Button>
        <Button onClick={handleSave} disabled={isSaving || isGeneratingVoucher} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-2">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} اعتماد السند
        </Button>
      </CardFooter>
    </Card>
  );
}
