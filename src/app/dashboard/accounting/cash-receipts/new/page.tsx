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
import { Save, Loader2, Target, Banknote, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, orderBy } from 'firebase/firestore';
import type { Client, ClientTransaction, Account, Employee, Department } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { numberToArabicWords, formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * محرك حساب إجمالي المسدد سابقاً للمشروع (Sovereign Audit Helper)
 */
const getTotalPaidForProject = async (projectId: string, db: any, tenantId: string) => {
    let total = 0;
    if (!projectId || !db || !tenantId) return total;
    const receiptsPath = getTenantPath('cashReceipts', tenantId);
    const receiptsQuery = query(collection(db, receiptsPath!), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        total += doc.data().amount || 0;
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

  const tenantId = currentUser?.currentCompanyId;

  // 🛡️ محرك توليد رقم السند السيادي
  useEffect(() => {
    if (!firestore || !tenantId) return;

    const generateVoucherNumber = async () => {
        setIsGeneratingVoucher(true);
        try {
            const currentYear = new Date().getFullYear();
            const counterPath = getTenantPath('counters/cashReceipts', tenantId);
            const counterRef = doc(firestore, counterPath!);
            const counterDoc = await getDoc(counterRef);
            
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setVoucherNumber(`CRV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            console.error("Error generating voucher number:", error);
            setVoucherNumber('خطأ: العداد غير متاح');
        } finally {
            setIsGeneratingVoucher(false);
        }
    };

    generateVoucherNumber();
  }, [firestore, tenantId]);

  useEffect(() => {
    if (amount && !isNaN(parseFloat(amount))) {
        setAmountInWords(numberToArabicWords(amount));
    } else {
        setAmountInWords('');
    }
  }, [amount]);

  // ✨ محرك توليد البيان الذكي (Smart Description Engine) ✨
  useEffect(() => {
    const generateDescription = async () => {
      if (!selectedProjectId || !amount || parseFloat(amount) <= 0 || !firestore || !tenantId) {
        return;
      }
      
      const project = clientProjects.find(p => p.id === selectedProjectId);
      if (!project || !project.contract?.clauses) return;

      const totalPaidPreviously = await getTotalPaidForProject(selectedProjectId, firestore, tenantId);
      
      let remainingAmountFromCurrentPayment = parseFloat(amount);
      const descriptionParts: string[] = [];
      let allocatedPaid = 0;

      for (const clause of project.contract.clauses) {
        if (remainingAmountFromCurrentPayment <= 0) break;
        
        const clauseAmount = clause.amount;
        // حساب ما تم دفعه على هذا البند تحديداً من السندات السابقة
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

    generateDescription();
  }, [amount, selectedProjectId, clientProjects, firestore, tenantId]);

  // 🛡️ محرك جلب البيانات المرجعية من مسار المنشأة
  useEffect(() => {
    if (!firestore || !tenantId) return;

    const fetchInitialData = async () => {
        setRefDataLoading(true);
        try {
            const clientsPath = getTenantPath('clients', tenantId);
            const coaPath = getTenantPath('chartOfAccounts', tenantId);
            const empPath = getTenantPath('employees', tenantId);
            const deptPath = getTenantPath('departments', tenantId);

            const [clientsSnap, accountsSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, clientsPath!), where('isActive', '==', true), limit(200))),
                getDocs(query(collection(firestore, coaPath!), orderBy('code'))),
                getDocs(query(collection(firestore, empPath!))),
                getDocs(query(collection(firestore, deptPath!)))
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
  }, [firestore, tenantId]);
  
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

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSelectedProjectId('');
    setClientProjects([]);
    setDescription('');

    const account = accounts.find(a => a.id === accountId);
    if (account) {
        const client = clients.find(c => c.nameAr === account.name);
        if (client) {
            setSelectedClientId(client.id!);
        } else {
            setSelectedClientId('');
        }
    } else {
        setSelectedClientId('');
    }
  };

  useEffect(() => {
    if (!firestore || !selectedClientId || !tenantId) {
        setClientProjects([]);
        return;
    }
    
    const fetchClientProjects = async () => {
        setProjectsLoading(true);
        try {
            const projectsPath = getTenantPath(`clients/${selectedClientId}/transactions`, tenantId);
            const projectsQuery = query(collection(firestore, projectsPath!));
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
  }, [firestore, selectedClientId, tenantId]);
  
  const handleSave = async () => {
    if (!firestore || !currentUser || !tenantId) return;
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
            const counterPath = getTenantPath('counters/cashReceipts', tenantId);
            const counterRef = doc(firestore, counterPath!);
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
            const receiptsPath = getTenantPath('cashReceipts', tenantId);
            const newReceiptRef = doc(collection(firestore, receiptsPath!));
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

            const jePath = getTenantPath('journalEntries', tenantId);
            const newJournalEntryRef = doc(collection(firestore, jePath!));

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
                companyId: tenantId
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
                entryNumber: `JE-${newVoucherNumber}`, date: newReceiptData.receiptDate,
                narration: `[تحصيل مالي] ${description} ${commissionAmount > 0 ? `(صافي المودع: ${formatCurrency(netBankDeposit)})` : ''}`,
                totalDebit: parseFloat(amount), totalCredit: parseFloat(amount), status: 'posted' as const,
                lines: jeLines,
                clientId: selectedClientId || null, transactionId: selectedProjectId || null,
                createdAt: serverTimestamp(), createdBy: currentUser.id,
                companyId: tenantId
            };

            transaction_fs.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            transaction_fs.set(newReceiptRef, cleanFirestoreData(newReceiptData));
            transaction_fs.set(newJournalEntryRef, journalEntryData);
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ سند القبض ومعالجة العمولات البنكية آلياً.' });
        router.push(`/dashboard/accounting/cash-receipts/${newReceiptId}`);

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل حفظ السند.' });
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
    <Card className={cn("max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-xl overflow-hidden glass-effect")} dir="rtl">
        <CardHeader className={cn("pb-8 rounded-t-[2.5rem] border-b bg-white/10")}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-[#FF7A00]/10 rounded-2xl text-[#FF7A00] shadow-inner">
                        <Banknote className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black text-[#1e1b4b]">سـنـد قـبـض / Cash Receipt</CardTitle>
                        <CardDescription className="font-black text-[#1e1b4b]/60">
                            {isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند المعتمد
                        </CardDescription>
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8 p-10 bg-white/95">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
                <div className="md:col-span-2 grid gap-2">
                <Label className="font-black text-[#1e1b4b] pr-1">استلمنا من (حساب العميل المالي) *</Label>
                <InlineSearchList 
                    value={selectedAccountId}
                    onSelect={handleAccountChange}
                    options={clientAccountOptions}
                    placeholder={refDataLoading ? 'جاري التحميل...' : 'اختر الحساب المالي للعميل...'}
                    disabled={refDataLoading || isSaving}
                    className="h-12 rounded-2xl border-2 soft-shadow-input"
                />
                </div>
                <div className="grid gap-2">
                    <Label className="font-black text-[#1e1b4b] pr-1">التاريخ *</Label>
                    <DateInput value={date} onChange={setDate} disabled={isSaving} className="h-12 rounded-2xl border-2 soft-shadow-input" />
                </div>
            </div>
            
            <div className="grid gap-2 p-6 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/20">
                <Label className="font-black flex items-center gap-2 text-primary">
                    <Target className="h-5 w-5"/> ربط بعقد/مشروع (مركز ربحية)
                </Label>
                <InlineSearchList 
                    value={selectedProjectId}
                    onSelect={setSelectedProjectId}
                    options={projectOptions}
                    placeholder={!selectedClientId ? 'اختر حساب العميل المربوط بملف أولاً' : projectsLoading ? 'جاري جلب المشاريع...' : 'اختر المشروع (اختياري)...'}
                    disabled={!selectedClientId || projectsLoading || isSaving}
                    className="h-12 bg-white border-primary/20 rounded-2xl soft-shadow-input"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="grid gap-2">
                    <Label className="font-black text-[#1e1b4b] pr-1">المبلغ المحصل *</Label>
                    <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr h-14 text-3xl font-black text-[#1e1b4b] rounded-2xl shadow-inner border-2 soft-shadow-input' value={amount} onChange={e => setAmount(e.target.value)} disabled={isSaving}/>
                </div>
                <div className="md:col-span-2 grid gap-2">
                <Label className="text-xs font-black text-muted-foreground uppercase pr-1">مبلغ وقدره (كتابة)</Label>
                <div className='p-4 text-sm font-black text-[#1e1b4b]/70 border-2 border-dashed rounded-2xl min-h-[56px] bg-muted/20 flex items-center justify-center italic text-center'>
                    {amountInWords || '(سيتم ملؤه تلقائياً)'}
                </div>
                </div>
            </div>
            <div className="grid gap-2">
                <Label htmlFor="description" className="font-black text-[#1e1b4b] pr-1">البيان / وذلك عن</Label>
                <Textarea id="description" placeholder="وصف عملية الدفع..." value={description} onChange={e => setDescription(e.target.value)} disabled={isSaving} rows={3} className="rounded-3xl border-2 p-4 text-base font-medium soft-shadow-input" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t">
                <div className="grid gap-2">
                    <Label className="font-black text-[#1e1b4b] pr-1">طريقة الدفع *</Label>
                    <Select dir='rtl' value={paymentMethod} onValueChange={setPaymentMethod} disabled={isSaving}>
                        <SelectTrigger className="h-12 rounded-2xl border-2 soft-shadow-input text-[#1e1b4b]"><SelectValue placeholder="اختر الطريقة..." /></SelectTrigger>
                        <SelectContent dir="rtl">{paymentMethodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label className="font-black text-[#1e1b4b] pr-1">حساب الإيداع *</Label>
                    <InlineSearchList value={debitAccountId} onSelect={setDebitAccountId} options={debitAccountOptions} placeholder={!paymentMethod ? 'اختر الطريقة أولاً' : 'اختر الحساب...'} disabled={isSaving || !paymentMethod} className="h-12 rounded-2xl border-2 soft-shadow-input" />
                </div>
                <div className="grid gap-2">
                <Label className="font-black text-[#1e1b4b] pr-1">رقم الشيك / المرجع</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} disabled={isSaving} className="h-12 rounded-2xl border-2 font-mono shadow-inner soft-shadow-input text-[#1e1b4b]" />
                </div>
            </div>
        </CardContent>
      <CardFooter className="flex justify-end gap-4 p-10 border-t bg-muted/10 rounded-b-[2.5rem]">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-14 px-10 rounded-2xl font-black h-12 text-[#1e1b4b]/60">إلغاء</Button>
        <Button onClick={handleSave} disabled={isSaving || isGeneratingVoucher} className="h-14 px-20 rounded-2xl font-black text-2xl shadow-2xl shadow-primary/30 gap-3 min-w-[350px] bg-[#7209B7] text-white">
            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
            اعتماد وإصدار السند
        </Button>
      </CardFooter>
    </Card>
  );
}
