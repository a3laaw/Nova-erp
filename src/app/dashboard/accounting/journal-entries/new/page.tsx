
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
import { Save, X, Loader2, PlusCircle, Trash2, AlertTriangle, Target } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup, where } from 'firebase/firestore';
import type { Account, ClientTransaction, Employee, Department } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, getTenantPath } from '@/lib/utils';
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
  
  const tenantId = currentUser?.currentCompanyId;

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema),
    mode: 'onChange',
    defaultValues: {
      date: new Date(),
      narration: '',
      reference: '',
      lines: [
        { accountId: '', debit: '', credit: '', notes: '', projectLink: '' },
        { accountId: '', debit: '', credit: '', notes: '', projectLink: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: "lines" });
  
  const totalDebit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchRefData = async () => {
        setRefDataLoading(true);
        try {
            const [accSnap, projSnap, clientSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, getTenantPath('chartOfAccounts', tenantId)!), orderBy('code'))),
                getDocs(query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId))),
                getDocs(collection(firestore, getTenantPath('clients', tenantId)!)),
                getDocs(query(collection(firestore, getTenantPath('employees', tenantId)!))),
                getDocs(query(collection(firestore, getTenantPath('departments', tenantId)!))),
            ]);
            
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
            setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
            
            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const fetchedProjects = projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            setProjects(fetchedProjects.filter(p => p.clientName));
        } finally { setRefDataLoading(false); }
    };
    fetchRefData();
  }, [firestore, tenantId]);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const currentYear = new Date().getFullYear();
    const counterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
    getDoc(counterRef).then(doc => {
        const nextNumber = ((doc.data()?.counts || {})[currentYear] || 0) + 1;
        setEntryNumber(`JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
    });
  }, [firestore, tenantId]);
  
  const accountOptions: SearchOption[] = useMemo(() => 
    accounts.filter(acc => acc.isPayable).map(acc => ({
      value: acc.id!,
      label: `${acc.name} (${acc.code})`,
      searchKey: acc.code,
    }))
  , [accounts]);

  const projectOptions = useMemo(() => projects.map(p => ({ 
    value: `${p.clientId}/${p.id}`, 
    label: `${p.clientName} - ${p.subServiceName || p.transactionType} (${p.transactionNumber})` 
  })), [projects]);

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
                let newLine: any = {
                    accountId: line.accountId,
                    accountName: account?.name || 'Unknown Account',
                    debit: Number(line.debit) || 0,
                    credit: Number(line.credit) || 0,
                    notes: line.notes || ''
                };
                if (line.projectLink) {
                    const [cid, tid] = line.projectLink.split('/');
                    const project = projects.find(p => p.id === tid);
                    if (project) {
                        const engineer = employees.find(e => e.id === project.assignedEngineerId);
                        const department = departments.find(d => d.name === engineer?.department);
                        newLine.clientId = cid; newLine.transactionId = tid;
                        newLine.auto_profit_center = tid;
                        newLine.auto_resource_id = project.assignedEngineerId;
                        if (department) newLine.auto_dept_id = department.id;
                    }
                }
                return newLine;
            });

            transaction.set(newEntryRef, {
                date: data.date, narration: data.narration, reference: data.reference,
                lines: linesWithDetails, entryNumber: newEntryNumber,
                totalDebit, totalCredit, status: 'draft',
                createdAt: serverTimestamp(), createdBy: currentUser.id, companyId: tenantId
            });

            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });
        toast({ title: 'تم إنشاء القيد المحاسبي' });
        router.push('/dashboard/accounting/journal-entries');
    } finally { setIsSubmitting(false); submittingRef.current = false; }
  };

  return (
    <Card className="max-w-6xl mx-auto rounded-[2.5rem] border-none shadow-2xl glass-effect" dir="rtl">
        <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-black">قيد يومية جديد</CardTitle>
                        <CardDescription>أدخل تفاصيل القيد مع إمكانية ربط كل سطر بمركز ربحية لضمان دقة التقارير.</CardDescription>
                    </div>
                     <div className="text-left bg-white p-3 rounded-2xl border shadow-inner">
                        <Label className="text-[10px] font-black uppercase text-slate-400 mr-1">رقم القيد</Label>
                        <div className="font-mono text-xl font-black text-primary">{entryNumber}</div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-8 p-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="grid gap-2">
                        <Label className="font-black text-gray-700 pr-1">التاريخ *</Label>
                        <Controller control={control} name="date" render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                    </div>
                     <div className="grid gap-2">
                        <Label className="font-black text-gray-700 pr-1">البيان (الوصف) *</Label>
                        <Input {...register('narration')} placeholder="اشرح الغرض من القيد..." className="h-11 rounded-xl border-2 font-bold" />
                    </div>
                     <div className="grid gap-2">
                        <Label className="font-black text-gray-700 pr-1">المرجع</Label>
                        <Input {...register('reference')} placeholder="رقم الشيك أو الحوالة..." className="h-11 rounded-xl border-2 font-mono" />
                    </div>
                </div>
                
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                     <Table>
                        <TableHeader className="bg-muted/50 h-14">
                            <TableRow className="border-none">
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="min-w-[220px] font-black">الحساب المالي</TableHead>
                                <TableHead className="min-w-[180px] font-black">مركز الربحية</TableHead>
                                <TableHead className="min-w-[100px] text-center font-black">مدين (+)</TableHead>
                                <TableHead className="min-w-[100px] text-center font-black">دائن (-)</TableHead>
                                <TableHead className="min-w-[150px] font-black">ملاحظات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const selectedAccount = accounts.find(a => a.id === lines[index]?.accountId);
                                const isAnalytical = selectedAccount && (selectedAccount.code.startsWith('5') || selectedAccount.code.startsWith('4'));
                                return (
                                <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                    <TableCell className="text-center">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2} className="text-destructive rounded-full hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                    <TableCell>
                                        <Controller control={control} name={`lines.${index}.accountId`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value} onSelect={f.onChange} options={accountOptions} placeholder="اختر حساب..." disabled={refDataLoading} className="border-none shadow-none font-bold bg-transparent" />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {isAnalytical ? (
                                            <Controller control={control} name={`lines.${index}.projectLink`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value || ''} onSelect={f.onChange} options={projectOptions} placeholder="اربط بمشروع..." disabled={refDataLoading} className="border-none shadow-none text-xs bg-transparent h-10 border-dashed border-2 rounded-xl" />
                                            )} />
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground opacity-30 italic px-4">غير تخصصي</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="bg-blue-50/10">
                                        <Controller name={`lines.${index}.debit`} control={control} render={({ field: f }) => (
                                                <Input type="number" step="any" className='dir-ltr text-center font-black text-xl border-none focus-visible:ring-0 bg-transparent text-blue-600' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="bg-red-50/10">
                                        <Controller name={`lines.${index}.credit`} control={control} render={({ field: f }) => (
                                                <Input type="number" step="any" className='dir-ltr text-center font-black text-xl border-none focus-visible:ring-0 bg-transparent text-red-600' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input {...register(`lines.${index}.notes`)} className="border-none shadow-none text-xs italic bg-transparent" placeholder="وصف البند..." />
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                        <TableFooter className="bg-primary/5 h-20">
                            <TableRow className="border-t-4 border-primary/20">
                                <TableCell colSpan={3} className="text-right px-12 font-black text-xl">الإجماليات:</TableCell>
                                <TableCell className="text-center font-mono text-xl font-black text-blue-700">{formatCurrency(totalDebit)}</TableCell>
                                <TableCell className="text-center font-mono text-xl font-black text-red-700">{formatCurrency(totalCredit)}</TableCell>
                                <TableCell className={cn("text-left font-mono font-black text-xs px-6", Math.abs(balance) > 0.001 ? "text-red-600" : "text-green-600")}>
                                    الفرق: {formatCurrency(balance)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                
                <div className="flex justify-start">
                    <Button type="button" variant="outline" onClick={() => append({ accountId: '', debit: '', credit: '', notes: '', projectLink: '' })} className="h-12 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 font-black text-lg text-primary gap-2">
                        <PlusCircle className="h-5 w-5" /> إضافة
                    </Button>
                </div>
            </CardContent>
            <CardFooter className="p-10 border-t bg-muted/10 flex justify-end gap-4 rounded-b-[2.5rem]">
                <Button type="button" variant="ghost" onClick={() => router.back()} className="h-14 px-10 rounded-2xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSubmitting || Math.abs(balance) > 0.001} className="h-14 px-20 rounded-2xl font-black text-2xl shadow-xl shadow-primary/30 bg-[#7209B7] text-white min-w-[320px] gap-4">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="h-5 w-5"/>}
                    اعتماد
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
