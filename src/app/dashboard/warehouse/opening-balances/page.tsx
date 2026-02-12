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
import { Save, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Account, Item } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';

const openingBalanceItemSchema = z.object({
  itemId: z.string().min(1, "الصنف مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')) || 0, z.number().positive("الكمية يجب أن تكون أكبر من صفر")),
  unitCost: z.preprocess((v) => parseFloat(String(v || '0')) || 0, z.number().positive("التكلفة يجب أن تكون أكبر من صفر")),
  expiryDate: z.date().optional(),
});

const openingBalanceSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  notes: z.string().optional(),
  items: z.array(openingBalanceItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type OpeningBalanceFormValues = z.infer<typeof openingBalanceSchema>;

export default function OpeningBalancesPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    const { data: items, loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    
    const { register, handleSubmit, control, formState: { errors }, watch } = useForm<OpeningBalanceFormValues>({
        resolver: zodResolver(openingBalanceSchema),
        mode: 'onChange',
        defaultValues: {
            date: new Date(),
            items: [{ itemId: '', quantity: 1, unitCost: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = watch("items");

    const totalCost = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [watchedItems]);
    
     useEffect(() => {
        if (!firestore) return;
        const fetchAccounts = async () => {
            const accSnap = await getDocs(query(collection(firestore, 'chartOfAccounts')));
            setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        };
        fetchAccounts();
     }, [firestore]);

    const itemOptions = useMemo(() => (items || []).map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);
    const getIsItemExpiryTracked = (itemId: string) => items.find(i => i.id === itemId)?.expiryTracked || false;

    const onSubmit = async (data: OpeningBalanceFormValues) => {
        if (!firestore || !currentUser) return;
        
        const inventoryAccount = accounts.find(a => a.code === '1104');
        const openingEquityAccount = accounts.find(a => a.code === '34');

        if (!inventoryAccount || !openingEquityAccount) {
            toast({ variant: 'destructive', title: 'خطأ في الحسابات', description: 'لم يتم العثور على حساب المخزون أو حساب الأرصدة الافتتاحية.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'inventoryAdjustments');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const newAdjNumber = `OB-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newAdjustmentRef = doc(collection(firestore, 'inventoryAdjustments'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                const processedItems = data.items.map(item => {
                    const selectedItem = items.find(i => i.id === item.itemId)!;
                    return {
                        itemId: item.itemId,
                        itemName: selectedItem.name,
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        totalCost: Number(item.quantity) * Number(item.unitCost),
                        expiryDate: getIsItemExpiryTracked(item.itemId) ? item.expiryDate : null,
                    };
                });
                
                const totalValue = processedItems.reduce((sum, item) => sum + item.totalCost, 0);

                const adjustmentData = {
                    adjustmentNumber: newAdjNumber,
                    date: data.date,
                    type: 'opening_balance',
                    notes: data.notes,
                    items: processedItems,
                    journalEntryId: newJournalEntryRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                
                const jeData = {
                    entryNumber: `JE-${newAdjNumber}`,
                    date: data.date,
                    narration: `إثبات أرصدة افتتاحية للمخزون - ${data.notes || ''}`,
                    status: 'posted',
                    totalDebit: totalValue,
                    totalCredit: totalValue,
                    lines: [
                        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: totalValue, credit: 0 },
                        { accountId: openingEquityAccount.id, accountName: openingEquityAccount.name, debit: 0, credit: totalValue }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                transaction.set(newAdjustmentRef, cleanFirestoreData(adjustmentData));
                transaction.set(newJournalEntryRef, cleanFirestoreData(jeData));
            });

            toast({ title: 'نجاح', description: 'تم حفظ الأرصدة الافتتاحية وإنشاء القيد المحاسبي.' });
            router.push('/dashboard/warehouse/items');

        } catch (error) {
            console.error("Error saving opening balance:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الأرصدة الافتتاحية.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>إدخال أرصدة افتتاحية للمخزون</CardTitle>
                    <CardDescription>استخدم هذه الشاشة لتسجيل الكميات والتكاليف الأولية للأصناف عند بدء استخدام النظام.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="date">تاريخ الإدخال <span className="text-destructive">*</span></Label>
                            <Controller name="date" control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Input id="notes" {...register('notes')} placeholder="مثال: جرد نهاية العام" />
                        </div>
                    </div>
                    
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader><TableRow><TableHead className="w-2/5">الصنف</TableHead><TableHead>الكمية</TableHead><TableHead>تكلفة الوحدة</TableHead><TableHead>تاريخ الصلاحية</TableHead><TableHead className="text-left">الإجمالي</TableHead><TableHead><span className="sr-only">حذف</span></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index] || {};
                                    const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0);
                                    const showExpiry = item.itemId && getIsItemExpiryTracked(item.itemId);
                                    return (
                                    <TableRow key={field.id}>
                                        <TableCell><Controller name={`items.${index}.itemId`} control={control} render={({ field }) => (<InlineSearchList value={field.value} onSelect={field.onChange} options={itemOptions} placeholder="اختر صنفًا..." />)} /></TableCell>
                                        <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr" /></TableCell>
                                        <TableCell><Input type="number" step="0.001" {...register(`items.${index}.unitCost`)} className="dir-ltr" /></TableCell>
                                        <TableCell>
                                            {showExpiry ? <Controller name={`items.${index}.expiryDate`} control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} /> : <span className="text-xs text-muted-foreground">لا يتطلب</span>}
                                        </TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(lineTotal)}</TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                            <TableFooter><TableRow><TableCell colSpan={4} className="font-bold text-lg">الإجمالي</TableCell><TableCell colSpan={2} className="text-left font-bold font-mono text-lg">{formatCurrency(totalCost)}</TableCell></TableRow></TableFooter>
                        </Table>
                    </div>
                     <div className="flex justify-start">
                        <Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })}>
                            <PlusCircle className="ml-2 h-4 w-4" /> إضافة صنف
                        </Button>
                    </div>
                    {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || itemsLoading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        حفظ الأرصدة الافتتاحية
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
