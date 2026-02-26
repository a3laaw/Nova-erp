
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, ArrowLeftRight, Package, Trash2, PlusCircle } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Warehouse, Item, InventoryAdjustment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';

const lineSchema = z.object({
  itemId: z.string().min(1, "الصنف مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  unitCost: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "التكلفة مطلوبة")),
});

const transferSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  fromWarehouseId: z.string().min(1, "يجب تحديد المستودع المصدر."),
  toWarehouseId: z.string().min(1, "يجب تحديد المستودع المستلم."),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
}).refine(data => data.fromWarehouseId !== data.toWarehouseId, {
    message: "لا يمكن التحويل لنفس المستودع.",
    path: ["toWarehouseId"]
});

type TransferFormValues = z.infer<typeof transferSchema>;

export function TransferForm({ onClose }: { onClose: () => void }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);

    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: allItems = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);

    const { register, handleSubmit, control, watch, formState: { errors }, setValue } = useForm<TransferFormValues>({
        resolver: zodResolver(transferSchema),
        defaultValues: {
            date: new Date(),
            items: [{ itemId: '', quantity: 1, unitCost: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });

    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    const itemOptions = useMemo(() => allItems.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [allItems]);

    const onSubmit = async (data: TransferFormValues) => {
        if (!firestore || !currentUser) return;

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'stockTransfers');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const transferNumber = `TR-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const newTransferRef = doc(collection(firestore, 'inventoryAdjustments'));

                const processedItems = data.items.map(item => {
                    const selectedItem = allItems.find(i => i.id === item.itemId)!;
                    return {
                        itemId: item.itemId,
                        itemName: selectedItem.name,
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        totalCost: Number(item.quantity) * Number(item.unitCost),
                    };
                });

                const transferData = {
                    adjustmentNumber: transferNumber,
                    date: data.date,
                    type: 'transfer',
                    notes: data.notes,
                    items: processedItems,
                    fromWarehouseId: data.fromWarehouseId,
                    toWarehouseId: data.toWarehouseId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };

                transaction.set(newTransferRef, cleanFirestoreData(transferData));
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح', description: 'تم تسجيل التحويل المخزني بنجاح.' });
            router.push('/dashboard/warehouse/reports');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التحويل.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border border-primary/10">
                <div className="grid gap-2">
                    <Label className="font-bold">المستودع المصدر (من)</Label>
                    <Controller
                        control={control}
                        name="fromWarehouseId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={warehouseOptions}
                                placeholder="اختر مستودع..."
                                disabled={isSaving}
                            />
                        )}
                    />
                    {errors.fromWarehouseId && <p className="text-xs text-destructive">{errors.fromWarehouseId.message}</p>}
                </div>
                <div className="flex items-center justify-center pt-6">
                    <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">المستودع المستلم (إلى)</Label>
                    <Controller
                        control={control}
                        name="toWarehouseId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={warehouseOptions}
                                placeholder="اختر مستودع..."
                                disabled={isSaving}
                            />
                        )}
                    />
                    {errors.toWarehouseId && <p className="text-xs text-destructive">{errors.toWarehouseId.message}</p>}
                </div>
                <div className="grid gap-2 md:col-span-1">
                    <Label className="font-bold">تاريخ التحويل</Label>
                    <Controller
                        name="date"
                        control={control}
                        render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving}/>}
                    />
                </div>
            </div>

            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="h-14 border-b-2">
                            <TableHead className="w-[60px]"></TableHead>
                            <TableHead>اسم الصنف</TableHead>
                            <TableHead className="w-32 text-center font-bold">الكمية</TableHead>
                            <TableHead className="text-left px-6">تكلفة الوحدة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id} className="h-16 border-b last:border-0">
                                <TableCell className="text-center">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive hover:bg-destructive/10 rounded-full">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                                <TableCell>
                                    <Controller
                                        control={control}
                                        name={`items.${index}.itemId`}
                                        render={({ field: itemField }) => (
                                            <InlineSearchList 
                                                value={itemField.value} 
                                                onSelect={(val) => {
                                                    itemField.onChange(val);
                                                    const itemData = allItems.find(i => i.id === val);
                                                    if (itemData) setValue(`items.${index}.unitCost`, itemData.costPrice || 0);
                                                }}
                                                options={itemOptions}
                                                placeholder="اختر مادة..."
                                                disabled={isSaving}
                                                className="border-none shadow-none focus-visible:ring-0 font-bold"
                                            />
                                        )}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center font-black" />
                                </TableCell>
                                <TableCell className="text-left font-mono font-bold px-6">
                                    <Input type="number" step="0.001" {...register(`items.${index}.unitCost`)} className="dir-ltr text-left border-none shadow-none focus-visible:ring-0" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            
            <div className="flex justify-center">
                <Button type="button" variant="secondary" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })} className="h-12 px-8 rounded-xl font-bold gap-2">
                    <PlusCircle className="ml-2 h-5 w-5" /> إضافة صنف آخر
                </Button>
            </div>

            <div className="grid gap-3">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea id="notes" {...register('notes')} placeholder="أي تفاصيل عن سبب التحويل أو الشخص المستلم..." className="rounded-2xl border-2" rows={3}/>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin"/> : <Save className="ml-3 h-5 w-5"/>}
                    تأكيد التحويل
                </Button>
            </div>
        </form>
    );
}
