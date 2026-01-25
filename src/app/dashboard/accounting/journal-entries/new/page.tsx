'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Account } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';

// Zod Schema for validation
const lineSchema = z.object({
  accountId: z.string().min(1, { message: 'الحساب مطلوب.' }),
  debit: z.coerce.number().min(0, 'القيمة يجب أن تكون موجبة.'),
  credit: z.coerce.number().min(0, 'القيمة يجب أن تكون موجبة.'),
  notes: z.string().optional(),
}).refine(data => data.debit > 0 || data.credit > 0, {
    message: 'يجب إدخال قيمة للمدين أو الدائن.',
    path: ['debit'], // arbitrary path
});

const journalEntrySchema = z.object({
  date: z.string().min(1, 'التاريخ مطلوب.'),
  narration: z.string().min(1, 'البيان مطلوب.'),
  reference: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'يجب أن يحتوي القيد على سطرين على الأقل.'),
}).refine(data => {
    const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebit - totalCredit) < 0.001; // Use tolerance for float comparison
}, {
    message: 'إجمالي المدين يجب أن يساوي إجمالي الدائن.',
    path: ['lines'],
});

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [entryNumber, setEntryNumber] = useState('جاري التوليد...');
  
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      narration: '',
      reference: '',
      lines: [
        { accountId: '', debit: 0, credit: 0, notes: '' },
        { accountId: '', debit: 0, credit: 0, notes: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const lines = watch('lines');
  const totalDebit = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0),
    [lines]
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0),
    [lines]
  );
  const balance = totalDebit - totalCredit;

  // Fetch accounts for combobox
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
  
  // Generate Entry Number
  useEffect(() => {
    if (!firestore) return;
    const generateEntryNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'journalEntries');
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setEntryNumber(`JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch (error) {
            setEntryNumber('خطأ');
        }
    };
    generateEntryNumber();
  }, [firestore]);
  
  const accountOptions: SearchOption[] = useMemo(() => 
    accounts
      .filter(acc => !acc.code.endsWith('00') && !acc.code.endsWith('0')) // Filter for only sub-accounts
      .map(acc => ({
        value: acc.id!,
        label: `${acc.name} (${acc.code})`,
        searchKey: acc.code,
      }))
  , [accounts]);

  // Automatically add a new line when the last one is filled
  useEffect(() => {
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const debit = Number(lastLine.debit) || 0;
      const credit = Number(lastLine.credit) || 0;
      if (lastLine && lastLine.accountId && (debit > 0 || credit > 0)) {
        append({ accountId: '', debit: 0, credit: 0, notes: '' }, { shouldFocus: false });
      }
    }
  }, [lines, append]);


  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!firestore) return;
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'journalEntries');
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            const newEntryNumber = `JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            
            const newEntryRef = doc(collection(firestore, 'journalEntries'));
            
            const linesWithNames = data.lines.map(line => {
                const account = accounts.find(acc => acc.id === line.accountId);
                return {
                    ...line,
                    accountName: account?.name || 'Unknown Account'
                };
            });

            transaction.set(newEntryRef, {
                ...data,
                lines: linesWithNames,
                entryNumber: newEntryNumber,
                totalDebit,
                totalCredit,
                status: 'draft',
                date: new Date(data.date),
                createdAt: serverTimestamp(),
            });
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ قيد اليومية كمسودة.' });
        router.push('/dashboard/accounting/journal-entries');

    } catch (error) {
        console.error('Error saving journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ قيد اليومية.' });
    }
  };

  return (
    <Card className="max-w-4xl mx-auto" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>قيد يومية جديد</CardTitle>
                        <CardDescription>أدخل تفاصيل القيد وتأكد من توازن المدين والدائن.</CardDescription>
                    </div>
                     <div className="text-right">
                        <Label>رقم القيد</Label>
                        <div className="font-mono text-lg font-semibold h-7">
                            {entryNumber}
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
                                        <Input type="number" step="0.001" className='dir-ltr' {...register(`lines.${index}.debit`)} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" step="0.001" className='dir-ltr' {...register(`lines.${index}.credit`)} />
                                    </TableCell>
                                    <TableCell>
                                        <Input {...register(`lines.${index}.notes`)} />
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
                                <TableCell colSpan={2} className={`font-bold font-mono text-left ${Math.abs(balance) > 0.0001 ? 'text-destructive' : 'text-green-600'}`}>
                                    {formatCurrency(balance)}
                                </TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
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
                <Button type="button" variant="outline" onClick={() => router.back()}>
                    <X className="ml-2 h-4 w-4"/> إلغاء
                </Button>
                <Button type="submit">
                    <Save className="ml-2 h-4 w-4"/> حفظ كمسودة
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
