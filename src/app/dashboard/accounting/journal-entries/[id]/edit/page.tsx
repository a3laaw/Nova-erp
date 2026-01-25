'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, AlertTriangle } from 'lucide-react';
import { useFirebase, useDoc } from '@/firebase';
import { doc, updateDoc, getDocs, collection, query, orderBy } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { Skeleton } from '@/components/ui/skeleton';
import { format as formatDateFns } from 'date-fns';


const lineSchema = z.object({
  accountId: z.string().min(1, "الحساب مطلوب."),
  accountName: z.string().optional(), // It will be added on submit
  debit: z.any(),
  credit: z.any(),
  notes: z.string().optional(),
});

const journalEntrySchema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب.'),
  narration: z.string().min(1, 'البيان مطلوب.'),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'يجب أن يحتوي القيد على سطرين على الأقل.')
}).refine(data => {
    const validLines = data.lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) return false;

    const totalDebit = validLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = validLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.001;
}, {
    message: 'إجمالي المدين يجب أن يساوي إجمالي الدائن ويجب أن يكون هناك سطرين على الأقل.',
    path: ['lines'],
});

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;

export default function EditJournalEntryPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const entryRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'journalEntries', id);
  }, [firestore, id]);

  const [entrySnapshot, entryLoading, entryError] = useDoc(entryRef);

  const entry = useMemo(() => {
    if (entrySnapshot?.exists()) {
      return { id: entrySnapshot.id, ...entrySnapshot.data() } as JournalEntry;
    }
    return null;
  }, [entrySnapshot]);

  const { register, handleSubmit, control, formState: { errors, isDirty }, reset } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });
  
  useEffect(() => {
    if (entry) {
      reset({
        date: entry.date?.toDate ? formatDateFns(entry.date.toDate(), 'yyyy-MM-dd') : '',
        narration: entry.narration,
        reference: entry.reference || '',
        lines: entry.lines.map(line => ({
            accountId: line.accountId,
            debit: line.debit || '',
            credit: line.credit || '',
            notes: line.notes || ''
        }))
      });
    }
  }, [entry, reset]);

  const lines = useWatch({ control, name: "lines" });
  
  const totalDebit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;

  useEffect(() => {
    if (!firestore) return;
    const fetchAccounts = async () => {
        setAccountsLoading(true);
        try {
            const q = query(collection(firestore, 'chartOfAccounts'), orderBy('code'));
            const snapshot = await getDocs(q);
            const fetchedAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            setAccounts(fetchedAccounts);
        } catch (error) {
            console.error("Error fetching chart of accounts: ", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب شجرة الحسابات.' });
        } finally {
            setAccountsLoading(false);
        }
    };
    fetchAccounts();
  }, [firestore, toast]);
  
  const accountOptions: SearchOption[] = useMemo(() => 
    accounts
      .filter(acc => !acc.code.endsWith('00') && !acc.code.endsWith('0'))
      .map(acc => ({
        value: acc.id!,
        label: `${acc.name} (${acc.code})`,
        searchKey: acc.code,
      }))
  , [accounts]);

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!firestore || !entry) return;
    if(entry.status === 'posted') {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن تعديل قيد مرحّل.' });
        return;
    }
    
    setIsSubmitting(true);

    try {
        const entryRefDoc = doc(firestore, 'journalEntries', entry.id!);
        
        const linesWithNames = data.lines
          .filter(line => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))
          .map(line => {
            const account = accounts.find(acc => acc.id === line.accountId);
            return {
                accountId: line.accountId,
                accountName: account?.name || 'Unknown Account',
                debit: Number(line.debit) || 0,
                credit: Number(line.credit) || 0,
                notes: line.notes || ''
            };
        });

        const updatePayload = {
            date: new Date(data.date),
            narration: data.narration,
            reference: data.reference,
            lines: linesWithNames,
            totalDebit,
            totalCredit,
        };
        const safeUpdatePayload = cleanFirestoreData(updatePayload);
        console.log("البيانات قبل التنظيف (Journal Entry Edit):", JSON.stringify(updatePayload, null, 2));
        console.log("البيانات بعد التنظيف (Journal Entry Edit):", JSON.stringify(safeUpdatePayload, null, 2));

        await updateDoc(entryRefDoc, safeUpdatePayload);
        
        toast({ title: 'نجاح', description: 'تم تحديث قيد اليومية بنجاح.' });
        router.push('/dashboard/accounting/journal-entries');

    } catch (error) {
        console.error('Error updating journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم تحديث قيد اليومية.' });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  if (entryLoading || accountsLoading) {
    return <Card className="max-w-4xl mx-auto" dir="rtl"><CardHeader><Skeleton className="h-8 w-48" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
  }
  
  if (!entry) {
    return <Card dir="rtl"><CardHeader><CardTitle>خطأ</CardTitle></CardHeader><CardContent><p>لم يتم العثور على قيد اليومية المطلوب.</p></CardContent></Card>
  }
  
  if (entry.status === 'posted') {
    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                 <CardTitle>القيد مرحّل</CardTitle>
                <CardDescription>لا يمكن تعديل هذا القيد لأنه تم ترحيله. الرجاء التراجع عن الترحيل أولاً لتتمكن من تعديله.</CardDescription>
            </CardHeader>
             <CardContent>
                <Button onClick={() => router.back()}>العودة</Button>
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
                        <CardTitle>تعديل قيد اليومية</CardTitle>
                        <CardDescription>تعديل تفاصيل القيد والتأكد من توازنه.</CardDescription>
                    </div>
                     <div className="text-right">
                        <Label>رقم القيد</Label>
                        <div className="font-mono text-lg font-semibold h-7">
                            {entry.entryNumber}
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="date">التاريخ</Label>
                        <Input id="date" type="date" {...register('date')} />
                        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="narration">البيان (الوصف)</Label>
                        <Input id="narration" {...register('narration')} />
                        {errors.narration && <p className="text-xs text-destructive">{errors.narration.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="reference">المرجع (اختياري)</Label>
                        <Input id="reference" {...register('reference')} />
                    </div>
                </div>
                
                <div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-2/5">الحساب</TableHead>
                                <TableHead className="w-1/5">مدين</TableHead>
                                <TableHead className="w-1/5">دائن</TableHead>
                                <TableHead className="w-1/5">ملاحظات</TableHead>
                                <TableHead><span className="sr-only">حذف</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Controller
                                            control={control}
                                            name={`lines.${index}.accountId`}
                                            render={({ field }) => (
                                                <InlineSearchList
                                                    value={field.value}
                                                    onSelect={field.onChange}
                                                    options={accountOptions}
                                                    placeholder="اختر حساب..."
                                                    disabled={accountsLoading}
                                                />
                                            )}
                                        />
                                        {errors.lines?.[index]?.accountId && <p className="text-xs text-destructive mt-1">{errors.lines[index]?.accountId?.message}</p>}
                                    </TableCell>
                                    <TableCell>
                                        <Controller
                                            name={`lines.${index}.debit`}
                                            control={control}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    step="0.001"
                                                    className='dir-ltr'
                                                    {...field}
                                                    onChange={e => field.onChange(e.target.value)}
                                                    value={field.value || ''}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Controller
                                            name={`lines.${index}.credit`}
                                            control={control}
                                            render={({ field }) => (
                                                <Input
                                                    type="number"
                                                    step="0.001"
                                                    className='dir-ltr'
                                                    {...field}
                                                    onChange={e => field.onChange(e.target.value)}
                                                    value={field.value || ''}
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Controller
                                            name={`lines.${index}.notes`}
                                            control={control}
                                            render={({ field }) => (
                                                <Input {...field} value={field.value || ''} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">الإجمالي</TableCell>
                                <TableCell className="font-bold font-mono text-left">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="font-bold font-mono text-left">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-bold">الفرق</TableCell>
                                <TableCell colSpan={2} className={`font-bold font-mono text-left ${Math.abs(balance) > 0.001 ? 'text-destructive' : 'text-green-600'}`}>
                                    {formatCurrency(balance)}
                                </TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                     <div className="flex justify-start mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', debit: '', credit: '', notes: '' })}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة سطر
                        </Button>
                     </div>
                </div>

                 {errors.lines && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>خطأ في القيد</AlertTitle>
                        <AlertDescription>
                            {errors.lines.message || (errors.lines.root && errors.lines.root.message) || 'الرجاء التأكد من أن جميع الحقول مملوءة بشكل صحيح وأن القيد متوازن.'}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    <X className="ml-2 h-4 w-4"/> إلغاء
                </Button>
                <Button type="submit" disabled={isSubmitting || !isDirty}>
                    {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
