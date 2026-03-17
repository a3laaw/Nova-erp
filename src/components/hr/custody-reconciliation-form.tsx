'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, PlusCircle, Trash2, Banknote, Camera, Info, History, ShieldCheck, Wallet } from 'lucide-react';
import { useFirebase, useSubscription, useStorage } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Account, Employee, CustodyReconciliation, JournalEntry } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, generateStableId } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

const itemSchema = z.object({
  description: z.string().min(1, "بيان المصروف مطلوب."),
  amount: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("المبلغ مطلوب")),
  category: z.string().min(1, "تصنيف المصروف مطلوب."),
  file: z.any().optional(),
});

const reconciliationSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  employeeId: z.string().min(1, "الموظف مطلوب."),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند مصروف واحد على الأقل.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof reconciliationSchema>;

export function CustodyReconciliationForm() {
    const { firestore, storage } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [recNumber, setRecNumber] = useState('جاري التوليد...');
    const [custodyBalance, setCustodyBalance] = useState(0);
    const [loadingBalance, setLoadingBalance] = useState(false);

    const { data: employees = [], loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: accounts = [] } = useSubscription<Account>(firestore, 'chartOfAccounts', [orderBy('code')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(reconciliationSchema),
        defaultValues: {
            date: new Date(),
            employeeId: currentUser?.role !== 'Admin' ? currentUser?.employeeId : '',
            items: [{ description: '', amount: 0, category: '' }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const selectedEmployeeId = watch('employeeId');

    const totalSpent = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [watchedItems]);

    // ✨ محرك رصيد العهدة اللحظي
    useEffect(() => {
        if (!firestore || !selectedEmployeeId) {
            setCustodyBalance(0);
            return;
        }
        setLoadingBalance(true);
        const fetchBalance = async () => {
            try {
                const custodyAcc = accounts.find(a => a.parentCode === '110102' && a.name.includes(employees.find(e => e.id === selectedEmployeeId)?.fullName || ''));
                if (!custodyAcc) {
                    setCustodyBalance(0);
                    return;
                }
                const jesSnap = await getDocs(query(collection(firestore, 'journalEntries'), where('status', '==', 'posted')));
                const balance = jesSnap.docs.flatMap(d => (d.data() as JournalEntry).lines)
                    .filter(l => l.accountId === custodyAcc.id)
                    .reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);
                setCustodyBalance(balance);
            } finally {
                setLoadingBalance(false);
            }
        };
        fetchBalance();
    }, [selectedEmployeeId, firestore, accounts, employees]);

    useEffect(() => {
        if (!firestore) return;
        const generateNumber = async () => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'custodyReconciliations');
            const counterDoc = await getDoc(counterRef);
            const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            setRecNumber(`REC-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        };
        generateNumber();
    }, [firestore]);

    const employeeOptions = useMemo(() => employees.map(e => ({ value: e.id!, label: e.fullName })), [employees]);
    const expenseAccountOptions = useMemo(() => accounts.filter(a => a.code.startsWith('5')).map(a => ({ value: a.id!, label: `${a.name} (${a.code})` })), [accounts]);

    const onSubmit = async (data: FormValues) => {
        if (!firestore || !currentUser || !storage) return;
        if (totalSpent > custodyBalance && currentUser.role !== 'Admin') {
            toast({ variant: 'destructive', title: 'تجاوز الرصيد', description: 'لا يمكنك تسوية مبلغ أكبر من المتوفر في عهدتك.' });
            return;
        }

        savingRef.current = true;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'custodyReconciliations');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalRecNumber = `REC-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const processedItems = [];
                for (const item of data.items) {
                    const acc = accounts.find(a => a.id === item.category);
                    let attachmentUrl = '';
                    
                    // Upload logic inside loop (Simplified for transaction context)
                    // Note: In real production, upload outside transaction then commit IDs
                    
                    processedItems.push({
                        description: item.description,
                        amount: Number(item.amount),
                        category: item.category,
                        categoryName: acc?.name || '',
                        attachmentUrl
                    });
                }

                const newRecRef = doc(collection(firestore, 'custody_reconciliations'));
                transaction.set(newRecRef, cleanFirestoreData({
                    reconciliationNumber: finalRecNumber,
                    employeeId: data.employeeId,
                    employeeName: employees.find(e => e.id === data.employeeId)?.fullName,
                    date: data.date,
                    totalAmount: totalSpent,
                    items: processedItems,
                    status: 'pending',
                    notes: data.notes,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم إرسال التسوية', description: 'بانتظار مراجعة واعتماد المحاسب المالي.' });
            router.push('/dashboard/hr');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال طلب التسوية.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><Wallet className="h-8 w-8"/></div>
                        <div>
                            <CardTitle className="text-2xl font-black">تسوية عهدة نقدية</CardTitle>
                            <CardDescription>قم بإدخال مصروفاتك الميدانية وإرفاق الفواتير لتصفية عهدتك المالية.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="grid gap-2">
                            <Label className="font-bold">الموظف صاحب العهدة</Label>
                            <Controller
                                control={control}
                                name="employeeId"
                                render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value} 
                                        onSelect={field.onChange} 
                                        options={employeeOptions}
                                        placeholder="ابحث عن الموظف..."
                                        disabled={currentUser?.role !== 'Admin' || isSaving}
                                    />
                                )}
                            />
                        </div>
                        <div className="bg-primary/5 p-4 rounded-2xl border-2 border-dashed border-primary/20 flex items-center justify-between shadow-inner">
                            <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-primary">رصيد العهدة الحالي</Label>
                                <p className="text-2xl font-black text-primary font-mono">
                                    {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin"/> : formatCurrency(custodyBalance)}
                                </p>
                            </div>
                            <Banknote className="h-8 w-8 text-primary opacity-20" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xl font-black flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" /> تفاصيل المصروفات
                        </Label>
                        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="h-14">
                                        <TableHead className="w-[60px]"></TableHead>
                                        <TableHead className="font-bold">بيان المصروف (الفاتورة)</TableHead>
                                        <TableHead className="w-48 font-bold">التصنيف المحاسبي</TableHead>
                                        <TableHead className="w-32 text-center font-bold">المبلغ</TableHead>
                                        <TableHead className="w-16 text-center">📷</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                            <TableCell className="text-center">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                            <TableCell>
                                                <Input {...register(`items.${index}.description`)} placeholder="مثال: بترول سيارة، قرطاسية..." className="border-none shadow-none font-bold bg-transparent" />
                                            </TableCell>
                                            <TableCell>
                                                <Controller
                                                    control={control}
                                                    name={`items.${index}.category`}
                                                    render={({ field: catField }) => (
                                                        <InlineSearchList value={catField.value} onSelect={catField.onChange} options={expenseAccountOptions} placeholder="نوع المصروف..." className="h-8 text-xs border-dashed" />
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" step="any" {...register(`items.${index}.amount`)} onWheel={(e) => e.currentTarget.blur()} className="dir-ltr text-center font-black text-xl text-primary border-none shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Camera className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-primary/5 h-20">
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-right px-12 font-black text-xl">إجمالي مصروفات التسوية:</TableCell>
                                        <TableCell className="text-center font-mono text-2xl font-black text-primary">{formatCurrency(totalSpent)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <Button type="button" variant="outline" onClick={() => append({ description: '', amount: 0, category: '' })} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold hover:bg-primary/5 transition-all">
                            <PlusCircle className="h-5 w-5 text-primary" /> إضافة سطر مصروف آخر
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        <Label className="font-bold text-gray-700 pr-2">ملاحظات إضافية</Label>
                        <Textarea {...register('notes')} placeholder="أي تفاصيل أخرى للمحاسب..." className="rounded-2xl border-2" rows={3}/>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between gap-4 p-10 border-t bg-muted/10">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">الرصيد المتبقي بعد التسوية:</Label>
                        <p className={cn("text-xl font-black font-mono", custodyBalance - totalSpent < 0 ? "text-red-600" : "text-green-600")}>
                            {formatCurrency(custodyBalance - totalSpent)}
                        </p>
                    </div>
                    <Button type="submit" disabled={isSaving || totalSpent === 0} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[300px] gap-3">
                        {isSaving ? <Loader2 className="ml-3 h-6 w-6 animate-spin"/> : <Save className="ml-3 h-6 w-6"/>}
                        إرسال طلب التسوية للمراجعة
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}

import { ShoppingCart } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
