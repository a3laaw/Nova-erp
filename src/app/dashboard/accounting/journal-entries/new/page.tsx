
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
import { Save, X, Loader2, PlusCircle, Trash2, AlertTriangle, ArrowUp, ArrowDown, Target, Building2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup } from 'firebase/firestore';
import type { Account, ClientTransaction, Employee, Department } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';

const lineSchema = z.object({
  accountId: z.string().min(1, "الحساب مطلوب."),
  debit: z.any(),
  credit: z.any(),
  notes: z.string().optional(),
  projectLink: z.string().optional(),
  deptId: z.string().optional(), // مركز تكلفة إضافي
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

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<(ClientTransaction & { clientName: string })[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [entryNumber, setEntryNumber] = useState('جاري التوليد...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  
  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      narration: '',
      reference: '',
      lines: [
        { accountId: '', debit: '', credit: '', notes: '', projectLink: '', deptId: '' },
        { accountId: '', debit: '', credit: '', notes: '', projectLink: '', deptId: '' },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'lines',
  });

  const lines = useWatch({ control, name: "lines" });
  
  const totalDebit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;

  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
        setRefDataLoading(true);
        try {
            const [accSnap, projSnap, clientSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                getDocs(query(collectionGroup(firestore, 'transactions'))),
                getDocs(collection(firestore, 'clients')),
                getDocs(query(collection(firestore, 'employees'))),
                getDocs(query(collection(firestore, 'departments'))),
            ]);
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
            setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
            
            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const fetchedProjects = projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            setProjects(fetchedProjects.filter(p => p.clientName));
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات المرجعية.' });
        } finally {
            setRefDataLoading(false);
        }
    };
    fetchRefData();
  }, [firestore, toast]);
  
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
    accounts.filter(acc => acc.isPayable).map(acc => ({
      value: acc.id!,
      label: `${acc.name} (${acc.code})`,
      searchKey: acc.code,
    }))
  , [accounts]);

  const projectOptions = useMemo(() => projects.map(p => ({ value: `${p.clientId}/${p.id}`, label: `${p.clientName} - ${p.transactionType}` })), [projects]);
  const deptOptions = useMemo(() => departments.map(d => ({ value: d.id!, label: d.name })), [departments]);

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!firestore || !currentUser || submittingRef.current) return;
    
    submittingRef.current = true;
    setIsSubmitting(true);
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
            
            const linesWithDetails = data.lines
              .filter(line => line.accountId && (Number(line.debit) > 0 || Number(line.credit) > 0))
              .map(line => {
                const account = accounts.find(acc => acc.id === line.accountId);
                let newLine: any = {
                    accountId: line.accountId,
                    accountName: account?.name || 'Unknown Account',
                    debit: Number(line.debit) || 0,
                    credit: Number(line.credit) || 0,
                    notes: line.notes || '',
                    auto_dept_id: line.deptId || null
                };

                if (line.projectLink) {
                    const [clientId, transactionId] = line.projectLink.split('/');
                    const project = projects.find(p => p.id === transactionId);
                    if (project && project.assignedEngineerId) {
                        const engineer = employees.find(e => e.id === project.assignedEngineerId);
                        const department = departments.find(d => d.name === engineer?.department);
                        newLine.clientId = clientId;
                        newLine.transactionId = transactionId;
                        newLine.auto_profit_center = transactionId;
                        newLine.auto_resource_id = project.assignedEngineerId;
                        // إذا تم اختيار مشروع، يتم تجاوز القسم المختار يدوياً بالقسم المرتبط بالمهندس لضمان سلامة الربط
                        if (department) {
                            newLine.auto_dept_id = department.id;
                        }
                    }
                }
                return newLine;
            });

            transaction.set(newEntryRef, {
                date: new Date(data.date),
                narration: data.narration,
                reference: data.reference,
                lines: linesWithDetails,
                entryNumber: newEntryNumber,
                totalDebit,
                totalCredit,
                status: 'draft',
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                clientId: data.lines.some(l => l.projectLink) ? data.lines.find(l => l.projectLink)!.projectLink!.split('/')[0] : undefined,
                transactionId: data.lines.some(l => l.projectLink) ? data.lines.find(l => l.projectLink)!.projectLink!.split('/')[1] : undefined,
            });
        });
        
        toast({ title: 'نجاح', description: 'تم حفظ قيد اليومية كمسودة مع ربط مراكز التكلفة.' });
        router.push('/dashboard/accounting/journal-entries');

    } catch (error) {
        console.error('Error saving journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم حفظ قيد اليومية.' });
        setIsSubmitting(false);
        submittingRef.current = false;
    }
  };

  return (
    <Card className="max-w-6xl mx-auto" dir="rtl">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }}>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>قيد يومية جديد (إسناد مراكز التكلفة)</CardTitle>
                        <CardDescription>أدخل تفاصيل القيد مع إمكانية ربط كل سطر بمشروع (مركز رئيسي) أو قسم (مركز إضافي).</CardDescription>
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
                        <Controller control={control} name="date" render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                        {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="narration">البيان (الوصف)</Label>
                        <Input id="narration" {...register('narration')} disabled={isSubmitting}/>
                        {errors.narration && <p className="text-xs text-destructive">{errors.narration.message}</p>}
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="reference">المرجع (اختياري)</Label>
                        <Input id="reference" {...register('reference')} disabled={isSubmitting}/>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[220px]">الحساب</TableHead>
                                <TableHead className="min-w-[180px]">المشروع (مركز رئيسي)</TableHead>
                                <TableHead className="min-w-[150px]">القسم (مركز إضافي)</TableHead>
                                <TableHead className="min-w-[100px]">مدين</TableHead>
                                <TableHead className="min-w-[100px]">دائن</TableHead>
                                <TableHead className="min-w-[150px]">ملاحظات</TableHead>
                                <TableHead><span className="sr-only">حذف</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const selectedAccount = accounts.find(a => a.id === lines[index]?.accountId);
                                // السماح بربط مراكز التكلفة لكافة بنود المصاريف والإيرادات (أكواد 4 و 5)
                                const isAnalytical = selectedAccount && (selectedAccount.code.startsWith('5') || selectedAccount.code.startsWith('4'));
                                return (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Controller control={control} name={`lines.${index}.accountId`} render={({ field }) => (
                                                <InlineSearchList value={field.value} onSelect={field.onChange} options={accountOptions} placeholder="اختر حساب..." disabled={refDataLoading || isSubmitting} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {isAnalytical ? (
                                            <Controller control={control} name={`lines.${index}.projectLink`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value || ''} onSelect={f.onChange} options={projectOptions} placeholder="اختر المشروع..." disabled={refDataLoading || isSubmitting} className="text-xs h-9" />
                                            )} />
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground italic px-2">غير متاح</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {isAnalytical ? (
                                            <Controller control={control} name={`lines.${index}.deptId`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value || ''} onSelect={f.onChange} options={deptOptions} placeholder="اختر القسم..." disabled={refDataLoading || isSubmitting || !!lines[index]?.projectLink} className="text-xs h-9" />
                                            )} />
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground italic px-2">غير متاح</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Controller name={`lines.${index}.debit`} control={control} render={({ field }) => (
                                                <Input type="number" step="0.001" className='dir-ltr h-9 text-sm' {...field} onChange={e => field.onChange(e.target.value)} value={field.value || ''} disabled={isSubmitting} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Controller name={`lines.${index}.credit`} control={control} render={({ field }) => (
                                                <Input type="number" step="0.001" className='dir-ltr h-9 text-sm' {...field} onChange={e => field.onChange(e.target.value)} value={field.value || ''} disabled={isSubmitting} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Controller name={`lines.${index}.notes`} control={control} render={({ field }) => (
                                                <Input {...field} value={field.value || ''} disabled={isSubmitting} className="h-9 text-xs" />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2 || isSubmitting}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/30">
                                <TableCell colSpan={3} className="font-bold">الإجمالي</TableCell>
                                <TableCell className="font-bold font-mono text-left">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="font-bold font-mono text-left">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                     <div className="flex justify-start mt-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', debit: '', credit: '', notes: '', projectLink: '', deptId: '' })} disabled={isSubmitting}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إضافة سطر
                        </Button>
                     </div>
                </div>

                 {errors.lines && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>خطأ في ميزان القيد</AlertTitle>
                        <AlertDescription>
                            {errors.lines.message || 'الرجاء التأكد من توازن المدين والدائن.'}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-6 bg-muted/10">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
                    <X className="ml-2 h-4 w-4"/> إلغاء
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-12 px-12 rounded-xl font-black text-lg">
                    {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    حفظ القيد المبوب
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
