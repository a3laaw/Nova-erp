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
import { formatCurrency, cleanFirestoreData, getTenantPath } from '@/lib/utils';
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
    const tenantId = currentUser?.currentCompanyId;

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
        if (!firestore || !tenantId) return;
        const fetchAccounts = async () => {
            const accSnap = await getDocs(query(collection(firestore, getTenantPath('chartOfAccounts', tenantId))));
            setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        };
        fetchAccounts();
     }, [firestore, tenantId]);

    const itemOptions = useMemo(() => (items || []).map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);
    const getIsItemExpiryTracked = (itemId: string) => items.find(i => i.id === itemId)?.expiryTracked || false;

    const onSubmit = async (data: OpeningBalanceFormValues) => {
        if (!firestore || !currentUser || !tenantId) return;
        
        const inventoryAccount = accounts.find(a => a.code === '1104');
        const openingEquityAccount = accounts.find(a => a.code === '34');

        if (!inventoryAccount || !openingEquityAccount) {
            toast({ variant: 'destructive', title: 'تنبيه', description: 'حسابات المخزون أو الأرصدة الافتتاحية غير معرفة في المنشأة.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterPath = getTenantPath('counters/inventoryAdjustments', tenantId);
                const counterRef = doc(firestore, counterPath);
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const newAdjNumber = `OB-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newAdjustmentRef = doc(collection(firestore, getTenantPath('inventoryAdjustments', tenantId)));
                const newJournalEntryRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)));

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
                    companyId: tenantId
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
                    companyId: tenantId
                };

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                transaction.set(newAdjustmentRef, cleanFirestoreData(adjustmentData));
                transaction.set(newJournalEntryRef, cleanFirestoreData(jeData));
            });

            toast({ title: 'تم الحفظ', description: 'تم تسجيل الأرصدة الافتتاحية والقيود المالية.' });
            router.push('/dashboard/warehouse/items');

        } catch (error) {
            console.error("Error saving opening balance:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الأرصدة الافتتاحية.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">إدخال أرصدة افتتاحية للمخزون</CardTitle>
                    <CardDescription>تسجيل الكميات والتكاليف الأولية للأصناف عند تأسيس المنشأة.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="date" className="font-bold mr-1">تاريخ الإدخال *</Label>
                            <Controller name="date" control={control} render={({ field }) => ( <DateInput value={field.value} onChange={field.onChange} /> )} />
                            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes" className="font-bold mr-1">ملاحظات عامة</Label>
                            <Input id="notes" {...register('notes')} placeholder="مثال: جرد تأسيسي..." className="h-11 rounded-xl" />
                        </div>
                    </div>
                    
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead className="w-2/5 font-bold">الصنف</TableHead>
                                    <TableHead className="text-center font-bold">الكمية</TableHead>
                                    <TableHead className="text-center font-bold">التكلفة</TableHead>
                                    <TableHead className="text-left px-8 font-bold">الإجمالي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index] || {};
                                    const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0);
                                    return (
                                    <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                        <TableCell className="text-center">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                        <TableCell>
                                            <Controller name={`items.${index}.itemId`} control={control} render={({ field: f }) => (<InlineSearchList value={f.value} onSelect={f.onChange} options={itemOptions} placeholder="اختر صنفاً..." className="border-none shadow-none font-bold text-base bg-transparent" />)} />
                                        </TableCell>
                                        <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center font-black border-none focus-visible:ring-0" /></TableCell>
                                        <TableCell><Input type="number" step="0.001" {...register(`items.${index}.unitCost`)} className="dir-ltr text-center font-bold text-primary border-none focus-visible:ring-0" /></TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-8 bg-muted/5">{formatCurrency(lineTotal)}</TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                            <TableFooter className="bg-primary/5 h-16">
                                <TableRow>
                                    <TableCell colSpan={4} className="text-right px-12 font-black text-xl">إجمالي الأرصدة:</TableCell>
                                    <TableCell className="text-left font-mono font-black text-2xl text-primary px-8">{formatCurrency(totalCost)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                     <div className="flex justify-start">
                        <Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })} className="h-12 border-dashed border-2 rounded-2xl gap-2 font-bold">
                            <PlusCircle className="ml-2 h-4 w-4" /> إضافة
                        </Button>
                    </div>
                    {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                </CardContent>
                <CardFooter className="flex justify-end gap-3 p-8 border-t bg-muted/10">
                    <Button type="button" variant="ghost" onClick={() => router.back()} className="h-12 px-8 font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || itemsLoading} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30 gap-2">
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        حفظ الأرصدة
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
