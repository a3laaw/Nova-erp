'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
import { Save, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup, where } from 'firebase/firestore';
import type { Account } from '@/lib/types'; // Simplified imports
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, getTenantPath, cn, cleanFirestoreData } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';

// --- Schema Definition ---
const lineSchema = z.object({
  accountId: z.string().min(1, "الحساب مطلوب."),
  debit: z.any(),
  credit: z.any(),
  notes: z.string().optional(),
});

const journalEntrySchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
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
    message: 'إجمالي المدين يجب أن يساوي إجمالي الدائن.',
    path: ['lines'],
});

type JournalEntryFormValues = z.infer<typeof journalEntrySchema>;

// --- Main Component ---
export default function NewJournalEntryPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [entryNumber, setEntryNumber] = useState('جاري التوليد...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  
  const tenantId = currentUser?.currentCompanyId;

  const { register, handleSubmit, control } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
    defaultValues: {
      date: new Date(),
      narration: '',
      reference: '',
      lines: [
        { accountId: '', debit: '', credit: '', notes: '' },
        { accountId: '', debit: '', credit: '', notes: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: "lines" });
  
  // --- Calculated Totals ---
  const totalDebit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;
  const isBalanced = Math.abs(balance) < 0.001;

  // --- Data Fetching ---
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchRefData = async () => {
        setRefDataLoading(true);
        try {
            const accSnap = await getDocs(query(collection(firestore, getTenantPath('chartOfAccounts', tenantId)!), orderBy('code')));
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
        } catch(error) {
            console.error("Error fetching accounts:", error);
            toast({ variant: 'destructive', title: 'فشل جلب الحسابات', description: (error as Error).message });
        } finally { 
            setRefDataLoading(false); 
        }
    };
    fetchRefData();
  }, [firestore, tenantId, toast]);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchEntryNumber = async () => {
      const currentYear = new Date().getFullYear();
      const counterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
      const counterDoc = await getDoc(counterRef);
      const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
      setEntryNumber(`JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
    };
    fetchEntryNumber().catch(err => {
      console.error("Error fetching entry number:", err);
      toast({ variant: 'destructive', title: 'فشل جلب الرقم المتسلسل'});
    });
  }, [firestore, tenantId, toast]);
  
  const parentAccountCodes = useMemo(() => {
      const codes = new Set<string>();
      if (accounts.length > 0) {
          accounts.forEach(p => {
              accounts.forEach(c => {
                  if (c.code.startsWith(p.code) && c.code !== p.code) {
                      codes.add(p.code);
                  }
              });
          });
      }
      return codes;
  }, [accounts]);

  const accountOptions: SearchOption[] = useMemo(() => 
    accounts
      .filter(acc => !parentAccountCodes.has(acc.code))
      .map(acc => ({
        value: acc.id!,
        label: `${acc.name} (${acc.code})`,
        searchKey: acc.code,
      }))
  , [accounts, parentAccountCodes]);

  // --- Submission Logic ---
  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!firestore || !currentUser || !tenantId || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = (counterDoc.data()?.counts?.[currentYear] || 0) + 1;
            
            const newEntryNumber = `JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            const newEntryRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));
            
            const linesWithDetails = data.lines
              .filter(line => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))
              .map(line => {
                const account = accounts.find(acc => acc.id === line.accountId);
                return {
                    accountId: line.accountId,
                    accountName: account?.name || 'Unknown Account',
                    debit: Number(line.debit) || 0,
                    credit: Number(line.credit) || 0,
                    notes: line.notes || ''
                    // Analytical dimensions are now derived from source documents, not manual entry
                };
            });

            // Anti-Null validation would be enforced on source documents (Receipts, Invoices)
            // This manual page is for adjustments and assumes the accountant knows the implications.

            transaction.set(newEntryRef, cleanFirestoreData({
                date: data.date, 
                narration: data.narration, 
                reference: data.reference || '',
                lines: linesWithDetails, 
                entryNumber: newEntryNumber,
                totalDebit, 
                totalCredit, 
                status: 'draft',
                createdAt: serverTimestamp(), 
                createdBy: currentUser.id, 
                companyId: tenantId
            }));

            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });
        toast({ title: 'تم إنشاء القيد المحاسبي' });
        router.push('/dashboard/accounting/journal-entries');
    } catch (error: any) {
        console.error("Transaction Error:", error);
        toast({ variant: 'destructive', title: 'فشل الحفظ', description: error.message });
    } finally { 
        setIsSubmitting(false); 
        submittingRef.current = false; 
    }
  };

  // --- UI Rendering ---
  return (
    <Card className="max-w-5xl mx-auto rounded-xl border border-slate-200 shadow-sm bg-white" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="px-6 py-4 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold">قيد يومية يدوي جديد</CardTitle>
                        <CardDescription className="text-xs text-slate-500 mt-1">
                            لل تسويات المحاسبية المعقدة والتصحيحات. لا تستخدم للإدخالات اليومية.
                        </CardDescription>
                    </div>
                     <div className="text-left bg-slate-50 px-3 py-1.5 rounded-lg border">
                        <Label className="text-[10px] font-semibold uppercase text-slate-500">رقم القيد</Label>
                        <div className="font-mono text-sm font-bold text-primary">{entryNumber}</div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-6 p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <Label className="font-semibold text-xs mb-1.5 block">التاريخ *</Label>
                        <Controller control={control} name="date" render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
                    </div>
                     <div>
                        <Label className="font-semibold text-xs mb-1.5 block">البيان (الوصف) *</Label>
                        <Input {...register('narration')} placeholder="الغرض من القيد..." />
                    </div>
                     <div>
                        <Label className="font-semibold text-xs mb-1.5 block">المرجع</Label>
                        <Input {...register('reference')} placeholder="رقم المستند الأصلي..." />
                    </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                     <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead>الحساب المالي</TableHead>
                                <TableHead className="text-center">مدين (+)</TableHead>
                                <TableHead className="text-center">دائن (-)</TableHead>
                                <TableHead>ملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell className="p-1 text-center">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2} className="h-7 w-7 text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </TableCell>
                                    <TableCell className="p-1 min-w-[300px]">
                                        <Controller control={control} name={`lines.${index}.accountId`} render={({ field: f }) => (
                                            <InlineSearchList value={f.value} onSelect={f.onChange} options={accountOptions} placeholder="اختر حساب..." disabled={refDataLoading} />
                                        )}/>
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller name={`lines.${index}.debit`} control={control} render={({ field: f }) => (
                                            <Input type="number" step="any" className='dir-ltr text-center' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} />
                                        )}/>
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Controller name={`lines.${index}.credit`} control={control} render={({ field: f }) => (
                                            <Input type="number" step="any" className='dir-ltr text-center' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} />
                                        )}/>
                                    </TableCell>
                                    <TableCell className="p-1">
                                        <Input {...register(`lines.${index}.notes`)} placeholder="وصف البند..." />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-slate-50">
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold">الإجماليات:</TableCell>
                                <TableCell className="text-center font-mono font-bold text-blue-700">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-center font-mono font-bold text-red-700">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className={cn("text-center font-mono text-xs", balance !== 0 ? 'text-red-500' : 'text-green-500')}>
                                    {formatCurrency(balance)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                
                <div className="flex justify-between items-center">
                    <Button type="button" variant="outline" onClick={() => append({ accountId: '', debit: '', credit: '', notes: '' })}>
                        <PlusCircle className="h-4 w-4 ml-2" /> إضافة سطر
                    </Button>
                    {!isBalanced && (
                        <Alert variant="destructive" className="w-auto p-2 text-xs">
                            القيد غير متوازن. الفرق: {formatCurrency(Math.abs(balance))}
                        </Alert>
                    )}
                </div>
            </CardContent>
            
            <CardFooter className="p-4 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>إلغاء</Button>
                <Button type="submit" disabled={isSubmitting || !isBalanced}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                    حفظ القيد
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
