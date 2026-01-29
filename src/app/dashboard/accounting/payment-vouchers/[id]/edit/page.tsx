
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { Save, X, Loader2, AlertCircle } from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, serverTimestamp, orderBy, runTransaction, Timestamp } from 'firebase/firestore';
import type { Account, PaymentVoucher } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { numberToArabicWords, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { format as formatDateFns } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const paymentVoucherSchema = z.object({
    payeeName: z.string().min(1, 'اسم المستفيد مطلوب'),
    payeeType: z.string().min(1, 'نوع المستفيد مطلوب'),
    amount: z.preprocess((a) => parseFloat(z.string().parse(a)), z.number().positive('المبلغ يجب أن يكون أكبر من صفر')),
    paymentDate: z.string().min(1, 'تاريخ الدفع مطلوب'),
    paymentMethod: z.string().min(1, 'طريقة الدفع مطلوبة'),
    description: z.string().min(1, 'الوصف مطلوب'),
    reference: z.string().optional(),
    debitAccountId: z.string().min(1, 'حساب المدين مطلوب'),
    creditAccountId: z.string().min(1, 'حساب الدائن مطلوب'),
});

type PaymentVoucherFormValues = z.infer<typeof paymentVoucherSchema>;

export default function EditPaymentVoucherPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [journalEntryIsPosted, setJournalEntryIsPosted] = useState(false);


  const voucherRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'paymentVouchers', id);
  }, [firestore, id]);

  const [voucherSnap, voucherLoading] = useDoc(voucherRef);

  const { register, handleSubmit, control, watch, formState: { errors }, reset } = useForm<PaymentVoucherFormValues>({
      resolver: zodResolver(paymentVoucherSchema),
  });

  useEffect(() => {
    if (voucherSnap?.exists()) {
        const data = voucherSnap.data() as PaymentVoucher;
        reset({
            payeeName: data.payeeName,
            payeeType: data.payeeType,
            amount: data.amount,
            paymentDate: data.paymentDate?.toDate ? formatDateFns(data.paymentDate.toDate(), 'yyyy-MM-dd') : '',
            paymentMethod: data.paymentMethod,
            description: data.description,
            reference: data.reference || '',
            debitAccountId: data.debitAccountId,
            creditAccountId: data.creditAccountId,
        });

        if (data.journalEntryId && firestore) {
            const jeRef = doc(firestore, 'journalEntries', data.journalEntryId);
            getDoc(jeRef).then(jeSnap => {
                if (jeSnap.exists()) {
                    setJournalEntryIsPosted(jeSnap.data().status === 'posted');
                }
            });
        }
    }
  }, [voucherSnap, reset, firestore]);


  const amountValue = watch('amount');
  const amountInWords = useMemo(() => {
    if (amountValue && !isNaN(amountValue)) {
        return numberToArabicWords(amountValue);
    }
    return '';
  }, [amountValue]);

  // Fetch Accounts
  useEffect(() => {
    if (!firestore) return;
    const fetchAccounts = async () => {
        setAccountsLoading(true);
        try {
            const q = query(collection(firestore, 'chartOfAccounts'), orderBy('code'));
            const snapshot = await getDocs(q);
            setAccounts(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Account)));
        } catch(e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب شجرة الحسابات.' });
        } finally {
            setAccountsLoading(false);
        }
    };
    fetchAccounts();
  }, [firestore, toast]);

  const creditAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'asset' && (acc.name.includes('بنك') || acc.name.includes('صندوق'))).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);
  
  const debitAccountOptions = useMemo(() => accounts.filter(acc => acc.type === 'expense' || (acc.type === 'liability' && acc.name.includes('مورد'))).map(acc => ({value: acc.id!, label: `${acc.name} (${acc.code})`, searchKey: acc.code})), [accounts]);


  const onSubmit = async (data: PaymentVoucherFormValues) => {
    if (!firestore || !currentUser || !id || !voucherSnap?.exists()) return;

    if (journalEntryIsPosted) {
        const shouldProceed = await new Promise((resolve) => {
            toast({
                variant: 'destructive',
                title: 'القيد المحاسبي مرحّل',
                description: 'هذا السند مرتبط بقيد مرحّل. تعديله سيؤثر على الحسابات. هل تريد المتابعة وتحديث القيد تلقائياً؟',
                action: (
                    <>
                        <Button onClick={() => resolve(true)} variant="default">نعم، متابعة</Button>
                        <Button onClick={() => resolve(false)} variant="outline">إلغاء</Button>
                    </>
                ),
            });
        });
        if (!shouldProceed) {
            return;
        }
    }
    
    setIsSaving(true);
    try {
       await runTransaction(firestore, async (transaction_fs) => {
           const voucherRefDoc = doc(firestore, 'paymentVouchers', id);
           const originalVoucherData = voucherSnap.data() as PaymentVoucher;
           
           const debitAccount = accounts.find(a => a.id === data.debitAccountId);
           const creditAccount = accounts.find(a => a.id === data.creditAccountId);
           if (!debitAccount || !creditAccount) {
               throw new Error("لم يتم العثور على حسابات المدين أو الدائن.");
           }

           const updatePayload = {
               ...data,
               amount: Number(data.amount),
               amountInWords: amountInWords,
               debitAccountName: debitAccount.name,
               creditAccountName: creditAccount.name,
               paymentDate: new Date(data.paymentDate),
           };
           
           transaction_fs.update(voucherRefDoc, cleanFirestoreData(updatePayload));
           
           const newLines = [
                { accountId: data.debitAccountId, accountName: debitAccount.name, debit: data.amount, credit: 0 },
                { accountId: data.creditAccountId, accountName: creditAccount.name, debit: 0, credit: data.amount }
           ];

           const jeUpdatePayload = {
                date: Timestamp.fromDate(new Date(data.paymentDate)),
                lines: newLines,
                totalDebit: data.amount,
                totalCredit: data.amount,
                narration: `تحديث سند صرف رقم ${originalVoucherData.voucherNumber} إلى ${data.payeeName}`,
           };

           if (originalVoucherData.journalEntryId) {
                const jeRef = doc(firestore, 'journalEntries', originalVoucherData.journalEntryId);
                transaction_fs.update(jeRef, jeUpdatePayload);
           } else {
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));
                transaction_fs.set(newJournalEntryRef, {
                    ...jeUpdatePayload,
                    status: 'posted',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    entryNumber: `PV-JE-${originalVoucherData.voucherNumber}`,
                });
                transaction_fs.update(voucherRefDoc, { journalEntryId: newJournalEntryRef.id });
           }

       });
        
        toast({ title: 'نجاح', description: 'تم تحديث سند الصرف والقيد المحاسبي بنجاح.' });
        router.push(`/dashboard/accounting/payment-vouchers/${id}`);

    } catch (error) {
        console.error("Error updating payment voucher:", error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error instanceof Error ? error.message : 'فشل حفظ سند الصرف.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  if (voucherLoading) {
      return (
          <Card className="max-w-4xl mx-auto" dir="rtl">
              <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
              <CardContent className="space-y-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>تعديل سند صرف</CardTitle>
                        <CardDescription>
                            تعديل بيانات سند الصرف رقم: {voucherSnap?.data()?.voucherNumber}
                        </CardDescription>
                    </div>
                </div>
                 {journalEntryIsPosted && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>القيد مرحّل</AlertTitle>
                        <AlertDescription>
                            سيتم تحديث القيد المحاسبي المرتبط تلقائيًا عند حفظ التعديلات.
                        </AlertDescription>
                    </Alert>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="payeeName">اسم المستفيد <span className="text-destructive">*</span></Label>
                        <Input id="payeeName" {...register('payeeName')} disabled={isSaving} />
                        {errors.payeeName && <p className="text-xs text-destructive">{errors.payeeName.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="payeeType">نوع المستفيد <span className="text-destructive">*</span></Label>
                        <Controller
                            name="payeeType"
                            control={control}
                            render={({ field }) => (
                                <Select dir='rtl' onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                    <SelectTrigger id="payeeType"><SelectValue placeholder="اختر نوع المستفيد..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="vendor">مورد</SelectItem>
                                        <SelectItem value="employee">موظف</SelectItem>
                                        <SelectItem value="other">أخرى</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.payeeType && <p className="text-xs text-destructive">{errors.payeeType.message}</p>}
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="amount">المبلغ <span className="text-destructive">*</span></Label>
                        <Input id="amount" type="number" step="0.001" placeholder="0.000" className='text-left dir-ltr' {...register('amount')} disabled={isSaving} />
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
                    <Textarea id="description" placeholder="وصف عملية الصرف..." {...register('description')} disabled={isSaving}/>
                     {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                         <Label htmlFor="paymentDate">تاريخ الدفع <span className="text-destructive">*</span></Label>
                        <Input id="paymentDate" type="date" {...register('paymentDate')} disabled={isSaving}/>
                        {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="paymentMethod">طريقة الدفع <span className="text-destructive">*</span></Label>
                        <Controller
                            name="paymentMethod"
                            control={control}
                            render={({ field }) => (
                                <Select dir='rtl' onValueChange={field.onChange} value={field.value} disabled={isSaving}>
                                    <SelectTrigger id="paymentMethod"><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">نقداً</SelectItem>
                                        <SelectItem value="Cheque">شيك</SelectItem>
                                        <SelectItem value="Bank Transfer">تحويل بنكي</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                         {errors.paymentMethod && <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="reference">رقم الشيك/المرجع</Label>
                        <Input id="reference" placeholder="رقم المرجع..." {...register('reference')} disabled={isSaving}/>
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                    <div className="grid gap-2">
                        <Label htmlFor="debitAccountId">الحساب المدين (المصروف) <span className="text-destructive">*</span></Label>
                        <Controller
                            name="debitAccountId"
                            control={control}
                            render={({ field }) => (
                                <InlineSearchList 
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={debitAccountOptions}
                                    placeholder={accountsLoading ? "تحميل..." : "اختر حساب المصروف أو المورد..."}
                                    disabled={accountsLoading || isSaving}
                                />
                            )}
                        />
                         {errors.debitAccountId && <p className="text-xs text-destructive">{errors.debitAccountId.message}</p>}
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="creditAccountId">الحساب الدائن (الصندوق/البنك) <span className="text-destructive">*</span></Label>
                         <Controller
                            name="creditAccountId"
                            control={control}
                            render={({ field }) => (
                                <InlineSearchList 
                                    value={field.value}
                                    onSelect={field.onChange}
                                    options={creditAccountOptions}
                                    placeholder={accountsLoading ? "تحميل..." : "اختر حساب الصندوق أو البنك..."}
                                    disabled={accountsLoading || isSaving}
                                />
                            )}
                        />
                         {errors.creditAccountId && <p className="text-xs text-destructive">{errors.creditAccountId.message}</p>}
                    </div>
                 </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
                    <X className="ml-2 h-4 w-4" />
                    إلغاء
                </Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
