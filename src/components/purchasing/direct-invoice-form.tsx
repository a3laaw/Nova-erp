
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, Calculator, Receipt, CreditCard, Target, Truck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Account, Vendor, ConstructionProject, Employee, Department } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, numberToArabicWords } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const lineSchema = z.object({
  description: z.string().min(1, "وصف المادة مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  unitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("السعر مطلوب")),
});

const directInvoiceSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  vendorId: z.string().min(1, "يجب اختيار المورد."),
  projectId: z.string().min(1, "يجب اختيار المشروع (مركز التكلفة)."),
  paymentStatus: z.enum(['paid', 'unpaid']),
  paymentMethod: z.string().optional(),
  creditAccountId: z.string().optional(), // حساب الصندوق أو البنك في حال الدفع النقدي
  items: z.array(lineSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
  notes: z.string().optional(),
});

type DirectInvoiceValues = z.infer<typeof directInvoiceSchema>;

export function DirectInvoiceForm() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [invNumber, setInvNumber] = useState('جاري التوليد...');
    const [accounts, setAccounts] = useState<Account[]>([]);

    const { data: vendors = [], loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);
    const { data: projects = [], loading: projectsLoading } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees');
    const { data: departments = [] } = useSubscription<Department>(firestore, 'departments');

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<DirectInvoiceValues>({
        resolver: zodResolver(directInvoiceSchema),
        defaultValues: {
            date: new Date(),
            paymentStatus: 'unpaid',
            items: [{ description: '', quantity: 1, unitPrice: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const paymentStatus = watch('paymentStatus');
    const creditAccountId = watch('creditAccountId');

    const totalAmount = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
    [watchedItems]);

    useEffect(() => {
        if (!firestore) return;
        const generateInvNumber = async () => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'directPurchases');
            const counterDoc = await getDoc(counterRef);
            const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            setInvNumber(`DINV-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
        };
        generateInvNumber();
        
        getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        });
    }, [firestore]);

    const vendorOptions = useMemo(() => vendors.map(v => ({ value: v.id!, label: v.name })), [vendors]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);
    const cashBankOptions = useMemo(() => accounts.filter(a => a.isPayable && (a.code.startsWith('110101') || a.code.startsWith('110103'))).map(a => ({ value: a.id!, label: `${a.name} (${a.code})` })), [accounts]);

    const onSubmit = async (data: DirectInvoiceValues) => {
        if (!firestore || !currentUser || savingRef.current) return;

        savingRef.current = true;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'directPurchases');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const finalInvNumber = `DINV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const vendor = vendors.find(v => v.id === data.vendorId)!;
                const project = projects.find(p => p.id === data.projectId)!;
                const engineer = employees.find(e => e.id === project.mainEngineerId);
                const department = departments.find(d => d.name === engineer?.department);

                const newPoRef = doc(collection(firestore, 'purchaseOrders'));
                const newJeRef = doc(collection(firestore, 'journalEntries'));

                // 1. إنشاء سجل المشتريات (أمر شراء مكتمل ومباشر)
                transaction.set(newPoRef, cleanFirestoreData({
                    poNumber: finalInvNumber,
                    orderDate: data.date,
                    vendorId: data.vendorId,
                    vendorName: vendor.name,
                    projectId: data.projectId,
                    items: data.items.map(i => ({ ...i, itemName: i.description, total: i.quantity * i.unitPrice })),
                    totalAmount,
                    status: 'received', // تعتبر مستلمة مباشرة
                    type: 'direct_invoice',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                // 2. معالجة القيد المحاسبي المباشر
                const materialExpenseAccount = accounts.find(a => a.code === '5104') || accounts.find(a => a.code === '51');
                let creditAccount: any = null;
                let creditAccountName = '';

                if (data.paymentStatus === 'paid') {
                    creditAccount = accounts.find(a => a.id === data.creditAccountId);
                    creditAccountName = creditAccount?.name || 'حساب النقدية';
                } else {
                    creditAccount = accounts.find(a => a.name === vendor.name && a.parentCode === '2101');
                    if (!creditAccount) throw new Error("المورد ليس له حساب في شجرة الحسابات. يرجى تسجيل مورد رسمي.");
                    creditAccountName = creditAccount.name;
                }

                const autoTags = {
                    clientId: project.clientId,
                    transactionId: data.projectId,
                    auto_profit_center: data.projectId,
                    auto_resource_id: project.mainEngineerId,
                    ...(department && { auto_dept_id: department.id }),
                };

                transaction.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JE-${finalInvNumber}`,
                    date: data.date,
                    narration: `مشتريات مباشرة فاتورة #${finalInvNumber} - مورد: ${vendor.name} - مشروع: ${project.projectName}`,
                    status: 'posted',
                    totalDebit: totalAmount,
                    totalCredit: totalAmount,
                    lines: [
                        { accountId: materialExpenseAccount!.id!, accountName: materialExpenseAccount!.name, debit: totalAmount, credit: 0, ...autoTags },
                        { accountId: creditAccount.id, accountName: creditAccountName, debit: 0, credit: totalAmount, ...autoTags }
                    ],
                    clientId: project.clientId,
                    transactionId: data.projectId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم الحفظ والربط المالي', description: 'تم تسجيل المشتريات وتحميلها على تكاليف المشروع فوراً.' });
            router.push('/dashboard/purchasing/purchase-orders');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل حفظ الفاتورة.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="grid gap-3">
                    <Label className="font-black text-lg text-primary flex items-center gap-2">
                        <Truck className="h-5 w-5" /> اختيار المورد *
                    </Label>
                    <Controller
                        control={control}
                        name="vendorId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={vendorOptions}
                                placeholder={vendorsLoading ? "تحميل..." : "اختر المورد..."}
                                className="h-12 rounded-2xl border-2"
                            />
                        )}
                    />
                </div>
                <div className="grid gap-3">
                    <Label className="font-black text-lg text-primary flex items-center gap-2">
                        <Target className="h-5 w-5" /> المشروع (مركز التكلفة) *
                    </Label>
                    <Controller
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={projectOptions}
                                placeholder={projectsLoading ? "تحميل..." : "حمل التكلفة على مشروع..."}
                                className="h-12 rounded-2xl border-2"
                            />
                        )}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <Label className="text-xl font-black flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" /> تفاصيل المواد المشتراة
                </Label>
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="w-[60px]"></TableHead>
                                <TableHead className="font-bold text-base">بيان المادة / الخدمة</TableHead>
                                <TableHead className="w-32 text-center font-bold text-base">الكمية</TableHead>
                                <TableHead className="w-40 text-left px-6 font-bold text-base">سعر الوحدة</TableHead>
                                <TableHead className="w-40 text-left px-6 font-bold text-base">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const item = watchedItems?.[index];
                                const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
                                return (
                                    <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                        <TableCell className="text-center">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                        <TableCell>
                                            <Input {...register(`items.${index}.description`)} placeholder="اكتب اسم المادة..." className="border-none shadow-none text-lg font-bold bg-transparent" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center font-black text-xl border-none focus-visible:ring-0" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" step="0.001" {...register(`items.${index}.unitPrice`)} className="dir-ltr text-left font-black text-xl text-primary border-none focus-visible:ring-0" />
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-6 bg-muted/5">
                                            {formatCurrency(lineTotal)}
                                        </TableCell>
                                    </TableRow>
                                )})}
                        </TableBody>
                        <TableFooter className="bg-primary/5 h-20">
                            <TableRow>
                                <TableCell colSpan={4} className="text-right px-12 font-black text-xl">إجمالي قيمة الفاتورة:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-primary px-6">{formatCurrency(totalAmount)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold hover:bg-primary/5 transition-all">
                    <PlusCircle className="h-5 w-5 text-primary" /> إضافة بند آخر
                </Button>
            </div>

            <div className="p-8 bg-muted/20 rounded-[2.5rem] border-2 border-dashed space-y-6">
                <div className="flex items-center gap-3">
                    <CreditCard className="text-primary h-6 w-6" />
                    <h3 className="text-xl font-black">طريقة وتفاصيل الدفع</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="grid gap-3">
                        <Label className="font-bold">حالة الدفع *</Label>
                        <Controller name="paymentStatus" control={control} render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger className="h-12 rounded-2xl bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unpaid">آجل (على حساب المورد)</SelectItem>
                                    <SelectItem value="paid">مدفوع نقداً / شيك</SelectItem>
                                </SelectContent>
                            </Select>
                        )} />
                    </div>

                    {paymentStatus === 'paid' && (
                        <div className="grid gap-3 animate-in fade-in zoom-in-95">
                            <Label className="font-bold">حساب الخصم (من أين دفعت؟) *</Label>
                            <Controller name="creditAccountId" control={control} render={({ field }) => (
                                <InlineSearchList 
                                    value={field.value || ''} 
                                    onSelect={field.onChange} 
                                    options={cashBankOptions} 
                                    placeholder="اختر الصندوق أو البنك..." 
                                    className="h-12 rounded-2xl border-2"
                                />
                            )} />
                        </div>
                    )}
                </div>
                
                <div className="grid gap-2">
                    <Label className="font-bold">ملاحظات الفاتورة</Label>
                    <Textarea {...register('notes')} placeholder="أي تفاصيل إضافية..." rows={2} className="rounded-2xl" />
                </div>
            </div>

            <div className="flex justify-end gap-4 p-8 border-t">
                <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-14 px-8 rounded-2xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[280px]">
                    {isSaving ? <><Loader2 className="ml-3 h-6 w-6 animate-spin"/> جاري الحفظ...</> : <><Save className="ml-3 h-6 w-6"/> اعتماد وحفظ الفاتورة</>}
                </Button>
            </div>
        </form>
    );
}
