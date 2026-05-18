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
  deptId: z.string().optional(), 
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
  
  const tenantId = currentUser?.currentCompanyId;

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

  const { fields, append, remove, move } = useFieldArray({ control, name: 'lines' });
  const lines = useWatch({ control, name: "lines" });
  
  const totalDebit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => (lines || []).reduce((sum, line) => sum + (Number(line.credit) || 0), 0), [lines]);
  const balance = totalDebit - totalCredit;

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchRefData = async () => {
        setRefDataLoading(true);
        try {
            const coaPath = getTenantPath('chartOfAccounts', tenantId);
            const empPath = getTenantPath('employees', tenantId);
            const deptPath = getTenantPath('departments', tenantId);
            const clientPath = getTenantPath('clients', tenantId);

            const [accSnap, projSnap, clientSnap, empSnap, deptSnap] = await Promise.all([
                getDocs(query(collection(firestore, coaPath), orderBy('code'))),
                getDocs(query(collectionGroup(firestore, 'transactions'), where('companyId', '==', tenantId))),
                getDocs(collection(firestore, clientPath)),
                getDocs(query(collection(firestore, empPath))),
                getDocs(query(collection(firestore, deptPath))),
            ]);
            
            setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
            setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
            setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
            
            const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
            const fetchedProjects = projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            setProjects(fetchedProjects.filter(p => p.clientName));
        } catch(e) {
            console.error("Reference data fetch failed:", e);
            toast({ variant: 'destructive', title: 'خطأ في التحميل', description: 'فشل جلب الحسابات أو المشاريع بسبب نقص الصلاحيات.' });
        } finally {
            setRefDataLoading(false);
        }
    };
    fetchRefData();
  }, [firestore, tenantId, toast]);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const generateEntryNumber = async () => {
        try {
            const currentYear = new Date().getFullYear();
            // 🛡️ استخدام المسار المعزول للعدادات
            const counterPath = getTenantPath('counters/journalEntries', tenantId);
            const counterRef = doc(firestore, counterPath);
            const counterDoc = await getDoc(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            setEntryNumber(`JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        } catch { setEntryNumber('خطأ'); }
    };
    generateEntryNumber();
  }, [firestore, tenantId]);
  
  const accountOptions: SearchOption[] = useMemo(() => 
    accounts.filter(acc => acc.isPayable).map(acc => ({
      value: acc.id!,
      label: `${acc.name} (${acc.code})`,
      searchKey: acc.code,
    }))
  , [accounts]);

  const projectOptions = useMemo(() => projects.map(p => ({ value: `${p.clientId}/${p.id}`, label: `${p.clientName} - ${p.transactionType}` })), [projects]);

  const onSubmit = async (data: JournalEntryFormValues) => {
    if (!firestore || !currentUser || !tenantId || submittingRef.current) return;
    
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterPath = getTenantPath('counters/journalEntries', tenantId);
            const counterRef = doc(firestore, counterPath);
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = (counterDoc.data()?.counts?.[currentYear] || 0) + 1;
            
            const newEntryNumber = `JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            const jePath = getTenantPath('journalEntries', tenantId);
            const newEntryRef = doc(collection(firestore, jePath));
            
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
                companyId: tenantId,
                clientId: data.lines.some(l => l.projectLink) ? data.lines.find(l => l.projectLink)!.projectLink!.split('/')[0] : undefined,
                transactionId: data.lines.some(l => l.projectLink) ? data.lines.find(l => l.projectLink)!.projectLink!.split('/')[1] : undefined,
            });

            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
        });
        
        toast({ title: 'تم الحفظ', description: 'تم تسجيل القيد في دفاتر المنشأة.' });
        router.push('/dashboard/accounting/journal-entries');

    } catch (error) {
        console.error('Error saving journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ القيد.' });
        setIsSubmitting(false);
        submittingRef.current = false;
    }
  };

  return (
    <Card className="max-w-6xl mx-auto rounded-[2.5rem] border-none shadow-2xl glass-effect" dir="rtl">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(onSubmit)(e); }}>
            <CardHeader className="bg-primary/5 pb-8 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl font-black">قيد يومية جديد</CardTitle>
                        <CardDescription>أدخل تفاصيل القيد مع إمكانية ربط كل سطر بمشروع أو قسم لضمان دقة التقارير.</CardDescription>
                    </div>
                     <div className="text-left bg-white p-3 rounded-2xl border shadow-inner">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground mr-1">رقم القيد المتوقع</Label>
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
                        <Label className="font-black text-gray-700 pr-1">البيان (الوصف العام) *</Label>
                        <Input id="narration" {...register('narration')} disabled={isSubmitting} className="h-11 rounded-xl border-2 font-bold" placeholder="اشرح الغرض من القيد..." />
                    </div>
                     <div className="grid gap-2">
                        <Label className="font-black text-gray-700 pr-1">المرجع</Label>
                        <Input id="reference" {...register('reference')} disabled={isSubmitting} className="h-11 rounded-xl border-2 font-mono" placeholder="رقم الشيك أو الحوالة..." />
                    </div>
                </div>
                
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                     <Table>
                        <TableHeader className="bg-muted/50 h-14">
                            <TableRow className="border-none">
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="min-w-[220px] font-black">الحساب المالي</TableHead>
                                <TableHead className="min-w-[180px] font-black">المشروع المستهدف</TableHead>
                                <TableHead className="min-w-[100px] text-center font-black">مدين (+)</TableHead>
                                <TableHead className="min-w-[100px] text-center font-black">دائن (-)</TableHead>
                                <TableHead className="min-w-[150px] font-black">ملاحظات البند</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const selectedAccount = accounts.find(a => a.id === lines[index]?.accountId);
                                const isAnalytical = selectedAccount && (selectedAccount.code.startsWith('5') || selectedAccount.code.startsWith('4'));
                                return (
                                <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                    <TableCell className="text-center">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2 || isSubmitting} className="text-destructive rounded-full hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                                    </TableCell>
                                    <TableCell>
                                        <Controller control={control} name={`lines.${index}.accountId`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value} onSelect={f.onChange} options={accountOptions} placeholder="اختر حساب..." disabled={refDataLoading || isSubmitting} className="border-none shadow-none font-bold text-base bg-transparent" />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {isAnalytical ? (
                                            <Controller control={control} name={`lines.${index}.projectLink`} render={({ field: f }) => (
                                                <InlineSearchList value={f.value || ''} onSelect={f.onChange} options={projectOptions} placeholder="اربط بمشروع..." disabled={refDataLoading || isSubmitting} className="border-none shadow-none text-xs bg-transparent h-10 border-dashed border-2 rounded-xl" />
                                            )} />
                                        ) : (
                                            <div className="text-[10px] text-muted-foreground opacity-30 italic px-4">غير تخصصي</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="bg-blue-50/10">
                                        <Controller name={`lines.${index}.debit`} control={control} render={({ field: f }) => (
                                                <Input type="number" step="0.001" className='dir-ltr text-center font-black text-xl border-none focus-visible:ring-0 bg-transparent text-blue-600' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} disabled={isSubmitting} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell className="bg-red-50/10">
                                        <Controller name={`lines.${index}.credit`} control={control} render={({ field: f }) => (
                                                <Input type="number" step="0.001" className='dir-ltr text-center font-black text-xl border-none focus-visible:ring-0 bg-transparent text-red-600' {...f} onChange={e => f.onChange(e.target.value)} value={f.value || ''} disabled={isSubmitting} />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input {...register(`lines.${index}.notes`)} disabled={isSubmitting} className="border-none shadow-none text-xs italic bg-transparent" placeholder="وصف البند..." />
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
                    <Button type="button" variant="outline" onClick={() => append({ accountId: '', debit: '', credit: '', notes: '', projectLink: '', deptId: '' })} disabled={isSubmitting} className="h-12 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 font-black text-lg text-primary gap-2">
                        <PlusCircle className="h-5 w-5" /> إضافة
                    </Button>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-4 p-10 border-t bg-muted/10 rounded-b-[2.5rem]">
                <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSubmitting} className="h-14 px-10 rounded-2xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSubmitting || Math.abs(balance) > 0.001} className="h-14 px-20 rounded-2xl font-black text-2xl shadow-2xl shadow-primary/30 min-w-[320px] gap-3">
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Save className="ml-2 h-5 w-5"/>}
                    اعتماد القيد
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
}
