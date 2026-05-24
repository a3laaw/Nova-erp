'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Save, X, Loader2, Target, Banknote } from 'lucide-react';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { collection, query, getDocs, doc, runTransaction, serverTimestamp, getDoc, where, orderBy, Timestamp } from 'firebase/firestore';
import type { CashReceipt, Client, ClientTransaction, Account, Employee, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';

const getTotalPaidForProject = async (projectId: string, db: any, tenantId: string, excludeReceiptId?: string) => {
    let total = 0;
    if (!projectId || !db || !tenantId) return total;
    const receiptsPath = getTenantPath('cashReceipts', tenantId);
    if (!receiptsPath) return total;
    
    const receiptsQuery = query(collection(db, receiptsPath), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        if (doc.id !== excludeReceiptId) total += doc.data().amount || 0;
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

  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const tenantId = currentUser?.currentCompanyId;

  const receiptPath = useMemo(() => id && tenantId ? getTenantPath(`cashReceipts/${id}`, tenantId) : null, [id, tenantId]);
  const { data: receipt, loading: receiptLoading } = useDocument<CashReceipt>(firestore, receiptPath);
  
  const { data: accounts = [], loading: accountsLoading } = useSubscription<Account>(firestore, tenantId ? 'chartOfAccounts' : null, [orderBy('code')]);
  const { data: clients = [] } = useSubscription<Client>(firestore, tenantId ? 'clients' : null);
  const { data: employees = [] } = useSubscription<Employee>(firestore, tenantId ? 'employees' : null);
  const { data: departments = [] } = useSubscription<Department>(firestore, tenantId ? 'departments' : null);

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
  const [clientProjects, setClientProjects] = useState<ClientTransaction[]>([]);

  useEffect(() => {
    if (receipt && accounts.length > 0) {
      setDate(toFirestoreDate(receipt.receiptDate) || undefined);
      setAmount(String(receipt.amount));
      setAmountInWords(receipt.amountInWords);
      setDescription(receipt.description);
      setPaymentMethod(receipt.paymentMethod);
      setReference(receipt.reference || '');
      setSelectedProjectId(receipt.projectId || '');
      setSelectedClientId(receipt.clientId || '');

      const acc = accounts.find(a => a.code.startsWith('1102') && a.name === receipt.clientNameAr);
      if (acc) setSelectedAccountId(acc.id!);
      
      const drAccLine = accounts.find(a => a.name.includes(receipt.paymentMethod === 'Cash' ? 'صندوق' : 'بنك') && a.isPayable);
      if (drAccLine) setDebitAccountId(drAccLine.id!);
    }
  }, [receipt, accounts]);

  useEffect(() => {
    if (!firestore || !selectedClientId || !tenantId) return;
    const fetchProjects = async () => {
        const txsPath = getTenantPath(`clients/${selectedClientId}/transactions`, tenantId);
        const snapshot = await getDocs(query(collection(firestore, txsPath!)));
        setClientProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction)).filter(tx => !!tx.contract));
    };
    fetchProjects();
  }, [firestore, selectedClientId, tenantId]);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedProjectId('');
    const account = accounts.find(a => a.id === accountId);
    if (account) {
        const client = clients.find(c => c.nameAr === account.name);
        setSelectedClientId(client?.id || '');
    }
  };

  // ✨ محرك توصيف الدفعات المطور (Precise Narrative Engine V1600.0) ✨
  useEffect(() => {
    const generateDescription = async () => {
      if (!selectedProjectId || !amount || parseFloat(amount) <= 0 || !firestore || !tenantId) {
        return;
      }
      
      const project = clientProjects.find(p => p.id === selectedProjectId);
      if (!project || !project.contract?.clauses) return;

      const totalPaidPreviously = await getTotalPaidForProject(selectedProjectId, firestore, tenantId, id);
      
      let remainingAmountFromCurrentPayment = parseFloat(amount);
      const descriptionParts: string[] = [];
      let allocatedPaidSoFar = 0;

      for (const clause of project.contract.clauses) {
        if (remainingAmountFromCurrentPayment <= 0) break;
        
        const clauseAmount = clause.amount;
        const paidOnThisClausePreviously = Math.max(0, Math.min(clauseAmount, totalPaidPreviously - allocatedPaidSoFar));
        const remainingOnClause = clauseAmount - paidOnThisClausePreviously;

        if (remainingOnClause > 0) {
          const paymentForThisClause = Math.min(remainingAmountFromCurrentPayment, remainingOnClause);
          
          if (paymentForThisClause >= remainingOnClause && paidOnThisClausePreviously > 0) {
            // حالة استكمال السداد مع ذكر القيمة الكلية
            descriptionParts.push(`سداد ${formatCurrency(paymentForThisClause)} استكمالاً للدفعة "${clause.name}" التي قيمتها الإجمالية ${formatCurrency(clauseAmount)}`);
          } else if (paymentForThisClause >= remainingOnClause) {
            // سداد كامل (لأول مرة)
            descriptionParts.push(`سداد كامل للدفعة "${clause.name}" بقيمة ${formatCurrency(paymentForThisClause)}`);
          } else {
            // سداد جزئي (أول مرة أو إضافي)
            const partText = paidOnThisClausePreviously > 0 ? "جزء إضافي" : "جزء أول";
            descriptionParts.push(`سداد ${formatCurrency(paymentForThisClause)} كـ ${partText} من الدفعة "${clause.name}" التي قيمتها الإجمالية ${formatCurrency(clauseAmount)}`);
            const newRemaining = remainingOnClause - paymentForThisClause;
            descriptionParts.push(`(المتبقي من هذه الدفعة: ${formatCurrency(newRemaining)})`);
          }
          remainingAmountFromCurrentPayment -= paymentForThisClause;
        }
        allocatedPaidSoFar += clauseAmount;
      }

      if (remainingAmountFromCurrentPayment > 0) {
        descriptionParts.push(`مبلغ إضافي قدره ${formatCurrency(remainingAmountFromCurrentPayment)} كدفعة مقدمة خارج بنود العقد.`);
      }
      
      setDescription(descriptionParts.join('\n'));
    };

    if (clientProjects.length > 0) {
        generateDescription();
    }
  }, [amount, selectedProjectId, clientProjects, firestore, tenantId, id]);

  const handleSave = async () => {
    if (!firestore || !currentUser || !id || !receipt || !date || !tenantId || savingRef.current) return;
    if (!selectedAccountId || !amount || !paymentMethod || !debitAccountId) {
        toast({ variant: 'destructive', title: 'حقول ناقصة', description: 'الرجاء تعبئة جميع الحقول الإلزامية.'});
        return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const clientAccount = accounts.find(acc => acc.id === selectedAccountId);
            const debitAccount = accounts.find(acc => acc.id === debitAccountId);
            if (!clientAccount || !debitAccount) throw new Error("الحسابات المطلوبة غير موجودة.");

            const recPath = getTenantPath(`cashReceipts/${id}`, tenantId);
            transaction_fs.update(doc(firestore, recPath!), {
                receiptDate: date,
                clientId: selectedClientId || null,
                clientNameAr: clientAccount.name,
                projectId: selectedProjectId || null,
                amount: parseFloat(amount),
                amountInWords: numberToArabicWords(amount),
                description, paymentMethod, reference
            });

            if (receipt.journalEntryId) {
                const jePath = getTenantPath(`journalEntries/${receipt.journalEntryId}`, tenantId);
                transaction_fs.update(doc(firestore, jePath!), {
                    date: Timestamp.fromDate(date),
                    totalDebit: parseFloat(amount), totalCredit: parseFloat(amount),
                    narration: `[تعديل تحصيل] ${description}`
                });
            }
        });

        toast({ title: 'نجاح التحديث' });
        router.push(`/dashboard/accounting/cash-receipts/${id}`);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message });
        setIsSaving(false);
        savingRef.current = false;
    }
  };

  const clientAccountOptions = useMemo(() => 
    accounts.filter(a => a.code.startsWith('1102')).map(a => ({
      value: a.id!,
      label: `${a.name} (${a.code})`,
      searchKey: a.code
    }))
  , [accounts]);

  const debitAccountOptions = useMemo(() => {
    if (!paymentMethod) return [];
    const isCash = paymentMethod === 'Cash';
    return accounts
        .filter(acc => acc.type === 'asset' && acc.isPayable && acc.name.includes(isCash ? 'صندوق' : 'بنك'))
        .map(acc => ({ value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code }));
  }, [accounts, paymentMethod]);

  if (receiptLoading || accountsLoading) return <div className="p-8 max-w-4xl mx-auto"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden" dir="rtl">
        <CardHeader className="bg-primary/5 pb-8 border-b">
            <CardTitle>تعديل سند القبض #{receipt?.voucherNumber}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 p-10 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                <div className="md:col-span-2 grid gap-2">
                    <Label className="font-bold">استلمنا من (حساب العميل المالي) *</Label>
                    <InlineSearchList 
                        value={selectedAccountId}
                        onSelect={handleAccountChange}
                        options={clientAccountOptions}
                        placeholder="اختر الحساب..."
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">التاريخ *</Label>
                    <DateInput value={date} onChange={setDate} className="h-12 rounded-xl" />
                </div>
            </div>
            
            <div className="grid gap-2 p-6 bg-primary/5 rounded-3xl border-2 border-dashed">
                <Label className="font-black flex items-center gap-2 text-primary"><Target className="h-5 w-5"/> العقد المرتبط</Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={clientProjects.map(p => ({ value: p.id!, label: p.transactionType }))}
                    placeholder="اختر المشروع..."
                    disabled={!selectedClientId}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="grid gap-2">
                    <Label className="font-bold">المبلغ *</Label>
                    <Input type="number" step="0.001" className='text-left dir-ltr h-12 text-2xl font-black' value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="md:col-span-2 grid gap-2">
                    <Label className="text-xs font-bold text-muted-foreground">المبلغ كتابةً</Label>
                    <div className='p-3 text-sm font-bold border-2 border-dashed rounded-xl bg-muted/20 min-h-[48px] flex items-center justify-center'>{amountInWords}</div>
                </div>
            </div>

            <div className="grid gap-2">
                <Label className="font-bold">البيان / وذلك عن</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="rounded-2xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t">
                <div className="grid gap-2">
                    <Label className="font-bold">طريقة الدفع *</Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue /></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="Cash">نقداً</SelectItem>
                            <SelectItem value="Cheque">شيك</SelectItem>
                            <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label className="font-bold">حساب الإيداع *</Label>
                    <InlineSearchList value={debitAccountId} onSelect={setDebitAccountId} options={debitAccountOptions} placeholder="اختر الحساب..." />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">المرجع</Label>
                    <Input value={reference} onChange={e => setReference(e.target.value)} className="h-12 rounded-xl" />
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-4 p-10 border-t bg-muted/10">
        <Button variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
        <Button onClick={handleSave} disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg gap-2 shadow-xl">
            {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} حفظ التعديلات
        </Button>
      </CardFooter>
    </Card>
  );
}
