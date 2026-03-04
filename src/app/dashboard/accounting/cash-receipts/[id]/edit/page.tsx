'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { Save, X, Loader2, AlertCircle, Info, Target } from 'lucide-react';
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
import { format } from 'date-fns';

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
  
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // Form state
  const [date, setDate] = useState<Date | undefined>();
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [amount, setAmount] = useState('');
  const [amountInWords, setAmountInWords] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  
  const receiptRef = useMemo(() => (firestore && id ? doc(firestore, 'cashReceipts', id) : null), [firestore, id]);
  const { data: receiptData, loading: receiptLoading } = useDocument<CashReceipt>(firestore, receiptRef ? receiptRef.path : null);

  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
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
        } finally {
            setRefDataLoading(false);
        }
    };
    fetchRefData();
  }, [firestore]);

  useEffect(() => {
    if (receiptData && accounts.length > 0) {
      setReceipt(receiptData);
      setOriginalReceipt(receiptData);
      setDate(toFirestoreDate(receiptData.receiptDate) || undefined);
      setAmount(String(receiptData.amount));
      setAmountInWords(receiptData.amountInWords);
      setDescription(receiptData.description);
      setPaymentMethod(receiptData.paymentMethod);
      setReference(receiptData.reference || '');
      setSelectedProjectId(receiptData.projectId || '');
      setSelectedClientId(receiptData.clientId || '');

      // تحديد الحساب المالي المختار بناءً على اسم العميل المسجل في السند
      const acc = accounts.find(a => a.name === receiptData.clientNameAr && a.parentCode === '1102');
      if (acc) setSelectedAccountId(acc.id!);
    }
  }, [receiptData, accounts]);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedProjectId('');
    setClientProjects([]);
    
    const account = accounts.find(a => a.id === accountId);
    if (account) {
        const client = clients.find(c => c.nameAr === account.name);
        if (client) setSelectedClientId(client.id!);
        else setSelectedClientId('');
    } else setSelectedClientId('');
  };

  useEffect(() => {
    if (!firestore || !selectedClientId) {
        setClientProjects([]);
        return;
    }
    const fetchProjects = async () => {
        const snapshot = await getDocs(query(collection(firestore, `clients/${selectedClientId}/transactions`)));
        setClientProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction)).filter(tx => !!tx.contract));
    };
    fetchProjects();
  }, [firestore, selectedClientId]);

  const handleSave = async () => {
    if (!firestore || !currentUser || !id || !originalReceipt || !date || savingRef.current) return;

    if (!selectedAccountId || !amount || !paymentMethod || !debitAccountId) {
        toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول الإلزامية (*).'});
        return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const clientAccount = accounts.find(acc => acc.id === selectedAccountId);
            const selectedDebitAccount = accounts.find(acc => acc.id === debitAccountId);
            if (!clientAccount || !selectedDebitAccount) throw new Error("الحسابات المطلوبة غير موجودة.");

            const selectedMethodData = branding?.payment_methods?.find(m => m.name === paymentMethod);
            let commissionAmount = 0;
            if (selectedMethodData) {
                commissionAmount = (parseFloat(amount) * ((selectedMethodData.percentageFee || 0) / 100)) + (selectedMethodData.fixedFee || 0);
            }
            const netBankDeposit = parseFloat(amount) - commissionAmount;

            transaction_fs.update(doc(firestore, 'cashReceipts', id), {
                receiptDate: date,
                clientId: selectedClientId || null,
                clientNameAr: clientAccount.name,
                projectId: selectedProjectId || null,
                amount: parseFloat(amount),
                amountInWords: numberToArabicWords(amount),
                description, paymentMethod, reference, commissionAmount
            });
            
            let autoTags = {};
            if (selectedProjectId) {
                const project = clientProjects.find(p => p.id === selectedProjectId);
                if (project?.assignedEngineerId) {
                    const engineer = employees.find(e => e.id === project.assignedEngineerId);
                    const dept = departments.find(d => d.name === engineer?.department);
                    autoTags = { clientId: selectedClientId, transactionId: selectedProjectId, auto_profit_center: selectedProjectId, auto_resource_id: project.assignedEngineerId, ...(dept && { auto_dept_id: dept.id }) };
                }
            }

            const jeLines = [
                { accountId: selectedDebitAccount.id!, accountName: selectedDebitAccount.name, debit: netBankDeposit, credit: 0 },
                { accountId: clientAccount.id!, accountName: clientAccount.name, debit: 0, credit: parseFloat(amount), ...autoTags }
            ];

            if (commissionAmount > 0 && selectedMethodData?.expenseAccountId) {
                jeLines.push({ accountId: selectedMethodData.expenseAccountId, accountName: selectedMethodData.expenseAccountName || 'مصروف عمولات بنكية', debit: commissionAmount, credit: 0 });
            }

            if (originalReceipt.journalEntryId) {
                transaction_fs.update(doc(firestore, 'journalEntries', originalReceipt.journalEntryId), {
                    date: Timestamp.fromDate(date),
                    lines: jeLines,
                    totalDebit: parseFloat(amount),
                    totalCredit: parseFloat(amount),
                    narration: `[تعديل دفعة] ${description}`,
                    transactionId: selectedProjectId || null,
                    clientId: selectedClientId || null,
                });
            }
        });

        toast({ title: 'نجاح', description: 'تم تحديث السند والقيد المحاسبي.' });
        router.push(`/dashboard/accounting/cash-receipts/${id}`);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
        setIsSaving(false);
        savingRef.current = false;
    }
  };

  if (receiptLoading || refDataLoading) return <Card className="max-w-4xl mx-auto"><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent className="space-y-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>;

  return (
    <Card className="max-w-4xl mx-auto rounded-3xl border-none shadow-xl" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 rounded-t-3xl border-b">
            <CardTitle>تعديل سند القبض</CardTitle>
            <CardDescription>تعديل بيانات السند رقم: {receipt?.voucherNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2 grid gap-2">
                    <Label className="font-bold">استلمنا من (حساب العميل المالي) *</Label>
                    <InlineSearchList 
                        value={selectedAccountId}
                        onSelect={handleAccountChange}
                        options={accounts.filter(a => a.parentCode === '1102').map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }))}
                        placeholder="اختر الحساب..."
                        className="h-12 rounded-xl"
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">التاريخ *</Label>
                    <DateInput value={date} onChange={setDate} className="h-12" />
                </div>
            </div>
            
            <div className="grid gap-2 p-4 bg-muted/30 rounded-2xl border border-dashed">
                <Label className="font-bold text-primary flex items-center gap-2"><Target className="h-4 w-4"/> العقد / المشروع المرتبط</Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={clientProjects.map(p => ({ value: p.id!, label: p.transactionType }))}
                    placeholder={!selectedClientId ? "اختر حساب العميل أولاً" : "اختر العقد..."}
                    disabled={!selectedClientId}
                    className="h-11 bg-white"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="grid gap-2">
                    <Label className="font-bold">المبلغ *</Label>
                    <Input type="number" step="0.001" className='text-left dir-ltr h-12 text-xl font-black text-primary' value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="md:col-span-2 grid gap-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">المبلغ كتابةً</Label>
                    <div className='p-3 text-sm font-bold text-muted-foreground border-2 border-dashed rounded-xl bg-muted/50 flex items-center justify-center italic text-center'>{amountInWords}</div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label className="font-bold">البيان</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                <div className="grid gap-2">
                    <Label className="font-bold">طريقة الدفع</Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod}>
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
                    <InlineSearchList value={debitAccountId} onSelect={setDebitAccountId} options={accounts.filter(a => a.type === 'asset' && a.isPayable && a.name.includes(paymentMethod === 'Cash' ? 'صندوق' : 'بنك')).map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }))} placeholder="اختر الحساب..." className="h-11" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">المرجع</Label>
                    <Input value={reference} onChange={e => setReference(e.target.value)} className="h-11 rounded-xl" />
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-3 p-8 border-t bg-muted/10 rounded-b-3xl">
        <Button variant="ghost" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
        <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} حفظ التعديلات
        </Button>
      </CardFooter>
    </Card>
  );
}
