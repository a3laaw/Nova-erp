
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Loader2, Save, X, PlusCircle, Trash2, Ban } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Account, Item, Warehouse } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const lineSchema = z.object({
  itemId: z.string().min(1, "الصنف مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  unitCost: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "التكلفة مطلوبة")),
});

const adjSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  type: z.enum(['damage', 'theft', 'other']),
  warehouseId: z.string().min(1, "المستودع مطلوب."),
  notes: z.string().min(1, "يجب ذكر سبب التسوية."),
  items: z.array(lineSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type AdjFormValues = z.infer<typeof adjSchema>;

export default function NewAdjustmentPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    
    const { register, handleSubmit, control, formState: { errors }, watch, setValue } = useForm<AdjFormValues>({
        resolver: zodResolver(adjSchema),
        defaultValues: {
            date: new Date(),
            type: 'damage',
            items: [{ itemId: '', quantity: 1, unitCost: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });

    const totalCost = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [watchedItems]);

    useEffect(() => {
        if (!firestore) return;
        getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        });
    }, [firestore]);

    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);

    const onSubmit = async (data: AdjFormValues) => {
        if (!firestore || !currentUser) return;

        const inventoryAccount = accounts.find(a => a.code === '1104');
        const lossAccount = accounts.find(a => a.code === '5211') || accounts.find(a => a.code.startsWith('52')); // General expense fallback

        if (!inventoryAccount || !lossAccount) {
            toast({ variant: 'destructive', title: 'خطأ محاسبي', description: 'حسابات المخزون أو المصاريف غير متوفرة.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'inventoryAdjustments');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const adjNumber = `ADJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newAdjRef = doc(collection(firestore, 'inventoryAdjustments'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                const processedItems = data.items.map(item => {
                    const selectedItem = items.find(i => i.id === item.itemId)!;
                    return {
                        itemId: item.itemId,
                        itemName: selectedItem.name,
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        totalCost: Number(item.quantity) * Number(item.unitCost),
                    };
                });

                transaction.set(newAdjRef, cleanFirestoreData({
                    adjustmentNumber: adjNumber,
                    ...data,
                    items: processedItems,
                    journalEntryId: newJournalEntryRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: `JE-${adjNumber}`,
                    date: data.date,
                    narration: `تسوية مخزنية (${data.type === 'theft' ? 'فقد' : 'تلف'}) - ${data.notes}`,
                    status: 'posted',
                    totalDebit: totalCost,
                    totalCredit: totalCost,
                    lines: [
                        { accountId: lossAccount.id, accountName: lossAccount.name, debit: totalCost, credit: 0 },
                        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: 0, credit: totalCost }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح', description: 'تم تسجيل التسوية وتحديث الأرصدة.' });
            router.push('/dashboard/warehouse/adjustments');
        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التسوية.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><Ban /> تسجيل تسوية مخزنية (تلف / فقد)</CardTitle>
                    <CardDescription>يستخدم هذا الإجراء لخصم كميات من المخزون وتحميل قيمتها كمصروف (خسارة) على الشركة.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl">
                        <div className="grid gap-2">
                            <Label>تاريخ التسوية</Label>
                            <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
                        </div>
                        <div className="grid gap-2">
                            <Label>نوع التسوية</Label>
                            <Controller name="type" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="damage">تلف مواد</SelectItem>
                                        <SelectItem value="theft">فقد / سرقة</SelectItem>
                                        <SelectItem value="other">أخرى</SelectItem>
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="grid gap-2">
                            <Label>المستودع المتأثر</Label>
                            <Controller name="warehouseId" control={control} render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={warehouseOptions} placeholder="اختر المستودع..." />
                            )} />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>الملاحظات (السبب بالتفصيل) *</Label>
                        <Input {...register('notes')} placeholder="اشرح سبب التسوية هنا..." />
                        {errors.notes && <p className="text-xs text-destructive">{errors.notes.message}</p>}
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>الصنف</TableHead>
                                    <TableHead className="w-32 text-center">الكمية التالفة</TableHead>
                                    <TableHead className="w-40 text-left px-6">التكلفة الإجمالية</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index];
                                    return (
                                        <TableRow key={field.id}>
                                            <TableCell className="text-center">
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                            <TableCell>
                                                <Controller name={`items.${index}.itemId`} control={control} render={({ field: itemField }) => (
                                                    <InlineSearchList value={itemField.value} onSelect={(val) => {
                                                        itemField.onChange(val);
                                                        const i = items.find(it => it.id === val);
                                                        if (i) setValue(`items.${index}.unitCost`, i.costPrice || 0);
                                                    }} options={itemOptions} placeholder="اختر الصنف..." />
                                                )} />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="text-center font-bold" />
                                            </TableCell>
                                            <TableCell className="text-left font-mono font-bold px-6 bg-muted/5">
                                                {formatCurrency((Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0))}
                                            </TableCell>
                                        </TableRow>
                                    )})}
                            </TableBody>
                            <TableFooter className="bg-red-50/50">
                                <TableRow>
                                    <TableCell colSpan={3} className="text-right px-8 font-bold">إجمالي الخسارة:</TableCell>
                                    <TableCell className="text-left font-mono font-black text-red-600 px-6">{formatCurrency(totalCost)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })} className="w-full border-dashed"><PlusCircle className="ml-2 h-4 w-4"/> إضافة صنف آخر</Button>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-6">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" variant="destructive" disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : <Save className="ml-2 h-4 w-4"/>}
                        تأكيد التسوية والخصم
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
