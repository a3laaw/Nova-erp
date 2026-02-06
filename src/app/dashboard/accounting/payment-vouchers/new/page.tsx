'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, doc, runTransaction, serverTimestamp, Timestamp, getDoc, orderBy, collectionGroup } from 'firebase/firestore';
import type { Account, ClientTransaction, Employee, Department } from '@/lib/types';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const paymentVoucherSchema = z.object({
    payeeName: z.string().min(1, 'اسم المستفيد مطلوب'),
    payeeType: z.string().min(1, 'نوع المستفيد مطلوب'),
    amount: z.preprocess((a) => (String(a || '').trim() === '' ? 0 : parseFloat(String(a))), z.number().positive('المبلغ يجب أن يكون أكبر من صفر')),
    paymentDate: z.string().min(1, 'تاريخ الدفع مطلوب'),
    paymentMethod: z.string().min(1, 'طريقة الدفع مطلوبة'),
    description: z.string().min(1, 'الوصف مطلوب'),
    reference: z.string().optional(),
    debitAccountId: z.string().min(1, 'حساب المدين مطلوب'),
    creditAccountId: z.string().min(1, 'حساب الدائن مطلوب'),
    projectLink: z.string().optional(), // clientId/transactionId
});

type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;

export default function NewPaymentVoucherPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [voucherNumber, setVoucherNumber] = useState('جاري التوليد...');
  const [isGeneratingVoucher, setIsGeneratingVoucher] = useState(true);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<(ClientTransaction & { clientName: string })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<PaymentVoucherFormValues>({
      resolver: zodResolver(paymentVoucherSchema),
      defaultValues: {
          paymentDate: new Date().toISOString().split('T')[0],
          amount: '',
      }
  });

  const amountValue = watch('amount');
  const selectedDebitAccountId = watch('debitAccountId');
  const payeeType = watch('payeeType');
  const paymentMethod = watch('paymentMethod');
  const amountInWords = useMemo(() => {
    const numAmount = Number(amountValue);
    if (numAmount && !isNaN(numAmount)) {
        return numberToArabicWords(numAmount);
    }
    return '';
  }, [amountValue]);

  // Generate Voucher Number & Fetch Ref Data
  useEffect(() => {
    if (!firestore) return;
    const fetchInitialData = async () => {
        setIsGeneratingVoucher(true);
        setRefDataLoading(true);
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'paymentVouchers');
            
            const [counterDoc, accSnap, empSnap, projSnap, clientSnap, deptSnap] = await Promise.all([
                getDoc(counterRef),
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collection(firestore, 'employees'), orderBy('fullName'))),
                getDocs(query(collectionGroup(firestore, 'transactions'))),
                getDocs(collection(firestore, 'clients')),
                getDocs(query(collection(firestore, 'departments'))),
            ]);

            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setVoucherNumber(`PV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
            
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
            setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));

            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const fetchedProjects = projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            setProjects(fetchedProjects.filter(p => p.clientName));

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات الأساسية.' });
        } finally {
            setIsGeneratingVoucher(false);
            setRefDataLoading(false);
        }
    };
    fetchInitialData();
  }, [firestore, toast]);
  
  const debitAccount = useMemo(() => accounts.find(a => a.id === selectedDebitAccountId), [accounts, selectedDebitAccountId]);
  const showProjectLink = useMemo(() => debitAccount && debitAccount.code.startsWith('51'), [debitAccount]);

  const creditAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'asset' && acc.isPayable).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);
  const debitAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'expense' || (acc.type === 'liability' && acc.isPayable)).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);
  const employeePayeeOptions = useMemo(() => employees.map(e => ({ value: e.fullName, label: e.fullName })), [employees]);
  const projectOptions = useMemo(() => projects.map(p => ({ value: `${p.clientId}/${p.id}`, label: `${p.clientName} - ${p.transactionType}` })), [projects]);

  const onSubmit = async (data: PaymentVoucherFormValues) => {
    if (!firestore || !currentUser || isGeneratingVoucher) return;
    
    setIsSaving(true);
    let newVoucherId = '';

    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'paymentVouchers');
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            const newVoucherNumber = `PV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            
            const debitAccount = accounts.find(a => a.id === data.debitAccountId);
            const creditAccount = accounts.find(a => a.id === data.creditAccountId);

            if (!debitAccount || !creditAccount) throw new Error("لم يتم العثور على حسابات المدين أو الدائن.");
            
            const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
            
            const newVoucherData = {
                voucherNumber: newVoucherNumber, voucherSequence: nextNumber, voucherYear: currentYear,
                payeeName: data.payeeName, payeeType: data.payeeType, amount: data.amount, amountInWords,
                paymentDate: Timestamp.fromDate(new Date(data.paymentDate)), paymentMethod: data.paymentMethod,
                description: data.description, reference: data.reference,
                debitAccountId: data.debitAccountId, debitAccountName: debitAccount.name,
                creditAccountId: data.creditAccountId, creditAccountName: creditAccount.name,
                status: 'draft' as const, createdAt: serverTimestamp(), journalEntryId: newJournalEntryRef.id,
                ...(showProjectLink && data.projectLink ? { clientId: data.projectLink.split('/')[0], transactionId: data.projectLink.split('/')[1] } : {})
            };

            const newVoucherRef = doc(collection(firestore, 'paymentVouchers'));
            newVoucherId = newVoucherRef.id;
            transaction.set(newVoucherRef, cleanFirestoreData(newVoucherData));

            const debitLine: any = { accountId: data.debitAccountId, accountName: debitAccount.name, debit: data.amount, credit: 0 };
            
            if (showProjectLink && data.projectLink) {
                const [clientId, transactionId] = data.projectLink.split('/');
                debitLine.clientId = clientId;
                debitLine.transactionId = transactionId;
                
                const project = projects.find(p => p.id === transactionId);
                if (project && project.assignedEngineerId) {
                    const engineer = employees.find(e => e.id === project.assignedEngineerId);
                    const department = departments.find(d => d.name === engineer?.department);

                    debitLine.auto_profit_center = transactionId;
                    debitLine.auto_resource_id = project.assignedEngineerId;
                    if (department) {
                        debitLine.auto_dept_id = department.id;
                    }
                }
            }

            const journalEntryData = {
                entryNumber: `PV-JE-${newVoucherNumber}`, date: newVoucherData.paymentDate,
                narration: `${data.description} (سند صرف رقم ${newVoucherNumber})`,
                totalDebit: data.amount, totalCredit: data.amount, status: 'posted' as const,
                lines: [ debitLine, { accountId: data.creditAccountId, accountName: creditAccount.name, debit: 0, credit: data.amount } ],
                createdAt: serverTimestamp(), createdBy: currentUser.id,
            };
            transaction.set(newJournalEntryRef, journalEntryData);
        });

        toast({ title: 'نجاح', description: 'تم إنشاء سند الصرف والقيد المحاسبي بنجاح.' });
        router.push(`/dashboard/accounting/payment-vouchers/${newVoucherId}`);

    } catch (error) {
        console.error("Error saving payment voucher:", error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error instanceof Error ? error.message : 'فشل حفظ سند الصرف.' });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>سـنـد صـرف / Payment Voucher</CardTitle>
                        <CardDescription>{isGeneratingVoucher ? <Skeleton className="h-4 w-32" /> : voucherNumber} : رقم السند</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="payeeType">نوع المستفيد <span className="text-destructive">*</span></Label>
                        <Controller name="payeeType" control={control} render={({ field }) => (
                            <Select dir='rtl' onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="payeeType"><SelectValue placeholder="اختر نوع المستفيد..." /></SelectTrigger>
                                <SelectContent><SelectItem value="vendor">مورد</SelectItem><SelectItem value="employee">موظف</SelectItem><SelectItem value="other">أخرى</SelectItem></SelectContent>
                            </Select>
                        )} />
                        {errors.payeeType && <p className="text-xs text-destructive">{errors.payeeType.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="payeeName">اسم المستفيد <span className="text-destructive">*</span></Label>
                         {payeeType === 'employee' ? (
                              <Controller name="payeeName" control={control} render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={employeePayeeOptions} placeholder={refDataLoading ? "تحميل..." : "اختر موظفًا..."} disabled={refDataLoading} />
                              )} />
                         ) : (
                            <Input id="payeeName" {...register('payeeName')} />
                         )}
                        {errors.payeeName && <p className="text-xs text-destructive">{errors.payeeName.message}</p>}
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                        <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr' {...register('amount')} />
                        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                        <Label>مبلغ وقدره (كتابة)</Label>
                        <div className='p-2 text-sm text-muted-foreground border rounded-md min-h-[40px] bg-muted/50'>
                            {amountInWords || '(سيتم ملؤه تلقائياً)'}
                        </div>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="description">وذلك عن / البيان <span className="text-destructive">*</span></Label>
                    <Textarea id="description" placeholder="وصف عملية الصرف..." {...register('description')} />
                     {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                         <Label htmlFor="paymentDate">تاريخ الدفع <span className="text-destructive">*</span></Label>
                        <Controller name="paymentDate" control={control} render={({ field }) => ( <Input id="paymentDate" type="date" value={field.value} onChange={field.onChange} /> )} />
                        {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                        <Controller name="paymentMethod" control={control} render={({ field }) => (
                            <Select dir='rtl' onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger id="paymentMethod"><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                                <SelectContent><SelectItem value="Cash">نقداً</SelectItem><SelectItem value="Cheque">شيك</SelectItem><SelectItem value="Bank Transfer">تحويل بنكي</SelectItem><SelectItem value="EmployeeCustody">عهدة موظف</SelectItem></SelectContent>
                            </Select>
                        )} />
                         {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                        <Input id="reference" placeholder="رقم المرجع..." {...register('reference')} />
                    </div>
                </div>
                 <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t", showProjectLink && "md:grid-cols-3")}>
                    <div className="grid gap-2">
                        <Label htmlFor="debitAccountId">الحساب المدين (المصروف) <span className="text-destructive">*</span></Label>
                        <Controller name="debitAccountId" control={control} render={({ field }) => (
                            <InlineSearchList value={field.value} onSelect={field.onChange} options={debitAccountOptions} placeholder={refDataLoading ? "تحميل..." : "اختر حساب المصروف أو المورد..."} disabled={refDataLoading} />
                        )} />
                         {errors.debitAccountId && <p className="text-xs text-destructive">{errors.debitAccountId.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="creditAccountId">الحساب الدائن</Label>
                         <Controller name="creditAccountId" control={control} render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={creditAccountOptions} placeholder={refDataLoading ? "تحميل..." : "اختر حساب الصندوق أو البنك..."} disabled={refDataLoading || paymentMethod === 'EmployeeCustody'} />
                        )} />
                         {errors.creditAccountId && <p className="text-xs text-destructive">{errors.creditAccountId.message}</p>}
                    </div>
                    {showProjectLink && (
                        <div className="grid gap-2">
                            <Label htmlFor="projectLink">ربط بمشروع (مركز تكلفة)</Label>
                            <Controller name="projectLink" control={control} render={({ field }) => (
                                <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={projectOptions} placeholder={refDataLoading ? "تحميل..." : "اختر مشروعًا..."} disabled={refDataLoading} />
                            )} />
                        </div>
                    )}
                 </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                    <X className="ml-2 h-4 w-4" />
                    إلغاء
                </Button>
                <Button type="submit" disabled={isSaving || isGeneratingVoucher}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
