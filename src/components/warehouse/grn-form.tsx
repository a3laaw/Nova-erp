
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
import { Loader2, Save, X, FileCheck, PackageCheck, ShoppingBag, AlertCircle } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import type { PurchaseOrder, Account, Warehouse, Item, GoodsReceiptNote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const lineSchema = z.object({
  internalItemId: z.string(),
  itemName: z.string(),
  quantityOrdered: z.number(),
  quantityReceived: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "الكمية لا يمكن أن تكون سالبة")),
  unitPrice: z.number(),
  batchNumber: z.string().optional(),
  expiryDate: z.date().optional().nullable(),
});

const grnSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  purchaseOrderId: z.string().min(1, "يجب اختيار أمر الشراء."),
  warehouseId: z.string().min(1, "يجب تحديد المستودع المستلم."),
  itemsReceived: z.array(lineSchema).min(1, 'يجب استلام صنف واحد على الأقل.'),
});

type GrnFormValues = z.infer<typeof grnSchema>;

export function GrnForm({ onClose }: { onClose: () => void }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loadingRefs, setLoadingRefs] = useState(true);

    const { data: pos = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', [where('status', 'in', ['approved', 'partially_received'])]);
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items');

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<GrnFormValues>({
        resolver: zodResolver(grnSchema),
        defaultValues: {
            date: new Date(),
            itemsReceived: [],
        }
    });

    const { fields, replace } = useFieldArray({ control, name: "itemsReceived" });
    const selectedPoId = watch('purchaseOrderId');
    const watchedItems = useWatch({ control, name: "itemsReceived" });

    useEffect(() => {
        if (!firestore) return;
        getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
            setLoadingRefs(false);
        });
    }, [firestore]);

    useEffect(() => {
        if (!selectedPoId) {
            replace([]);
            return;
        }
        const selectedPo = pos.find(p => p.id === selectedPoId);
        if (selectedPo) {
            replace(selectedPo.items.map(item => ({
                internalItemId: item.internalItemId || '',
                itemName: item.itemName,
                quantityOrdered: item.quantity,
                quantityReceived: item.quantity, // Default to full receipt
                unitPrice: item.unitPrice,
                batchNumber: '',
                expiryDate: null
            })));
        }
    }, [selectedPoId, pos, replace]);

    const poOptions = useMemo(() => pos.map(p => ({ value: p.id!, label: `${p.poNumber} - ${p.vendorName}` })), [pos]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);

    const totalValue = useMemo(() => 
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantityReceived) || 0) * (item.unitPrice || 0), 0)
    , [watchedItems]);

    const onSubmit = async (data: GrnFormValues) => {
        if (!firestore || !currentUser) return;

        const inventoryAccount = accounts.find(a => a.code === '1104');
        const apAccount = accounts.find(a => a.code === '2101'); // Accounts Payable

        if (!inventoryAccount || !apAccount) {
            toast({ variant: 'destructive', title: 'خطأ محاسبي', description: 'حسابات المخزون أو الموردين غير معرفة.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'grns');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const grnNumber = `GRN-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const selectedPo = pos.find(p => p.id === data.purchaseOrderId)!;
                const newGrnRef = doc(collection(firestore, 'grns'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                // 1. Create GRN Document
                const grnData = {
                    grnNumber,
                    purchaseOrderId: data.purchaseOrderId,
                    warehouseId: data.warehouseId,
                    date: data.date,
                    itemsReceived: data.itemsReceived.map(i => ({ ...i, total: i.quantityReceived * i.unitPrice })),
                    totalValue,
                    vendorId: selectedPo.vendorId,
                    vendorName: selectedPo.vendorName,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                transaction.set(newGrnRef, cleanFirestoreData(grnData));

                // 2. Create Journal Entry
                const jeData = {
                    entryNumber: `JE-${grnNumber}`,
                    date: data.date,
                    narration: `استلام بضاعة - إذن رقم ${grnNumber} من المورد ${selectedPo.vendorName}`,
                    status: 'posted',
                    totalDebit: totalValue,
                    totalCredit: totalValue,
                    lines: [
                        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: totalValue, credit: 0 },
                        { accountId: apAccount.id, accountName: apAccount.name, debit: 0, credit: totalValue, partner_name: selectedPo.vendorName, partner_type: 'vendor' }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                transaction.set(newJournalEntryRef, cleanFirestoreData(jeData));

                // 3. Update PO Status
                const poRef = doc(firestore, 'purchaseOrders', data.purchaseOrderId);
                const isFullyReceived = data.itemsReceived.every(i => i.quantityReceived >= i.quantityOrdered);
                transaction.update(poRef, { status: isFullyReceived ? 'received' : 'partially_received' });

                // 4. Update Counter
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم الاستلام بنجاح', description: 'تم تحديث المخزون وإصدار القيد المحاسبي.' });
            router.push('/dashboard/warehouse/grns');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ إذن الاستلام.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border border-primary/10">
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary"/> أمر الشراء المرجعي *</Label>
                    <Controller
                        control={control}
                        name="purchaseOrderId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={poOptions}
                                placeholder={posLoading ? "تحميل..." : "اختر أمر شراء معلق..."}
                                disabled={posLoading || isSaving}
                            />
                        )}
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary"/> المستودع المستلم *</Label>
                    <Controller
                        control={control}
                        name="warehouseId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={warehouseOptions}
                                placeholder={warehousesLoading ? "تحميل..." : "اختر المستودع..."}
                                disabled={warehousesLoading || isSaving}
                            />
                        )}
                    />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">تاريخ الاستلام</Label>
                    <Controller
                        name="date"
                        control={control}
                        render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving}/>}
                    />
                </div>
            </div>

            {fields.length > 0 && (
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14 border-b-2">
                                <TableHead>اسم الصنف</TableHead>
                                <TableHead className="text-center">الكمية المطلوبة</TableHead>
                                <TableHead className="text-center">الكمية المستلمة</TableHead>
                                <TableHead className="text-center">رقم التشغيلة (Batch)</TableHead>
                                <TableHead className="text-left px-6">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const item = watchedItems?.[index];
                                const lineTotal = (item?.quantityReceived || 0) * (item?.unitPrice || 0);
                                const isExcess = (item?.quantityReceived || 0) > (item?.quantityOrdered || 0);

                                return (
                                    <TableRow key={field.id} className="h-16 border-b last:border-0">
                                        <TableCell className="font-bold">{item?.itemName}</TableCell>
                                        <TableCell className="text-center font-mono opacity-60">{item?.quantityOrdered}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <Input 
                                                    type="number" 
                                                    step="any" 
                                                    {...register(`itemsReceived.${index}.quantityReceived`)} 
                                                    className={cn("text-center font-black text-lg", isExcess && "text-amber-600 border-amber-200 bg-amber-50")}
                                                />
                                                {isExcess && <p className="text-[9px] text-amber-600 text-center">كمية زائدة عن الطلب</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Input {...register(`itemsReceived.${index}.batchNumber`)} placeholder="اختياري..." className="text-center text-xs" />
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-6 bg-muted/5">
                                            {formatCurrency(lineTotal)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="h-20 border-t-4 border-primary/20">
                                <TableCell colSpan={4} className="text-right px-8 font-black text-xl">إجمالي قيمة الاستلام:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-primary px-6 border-r bg-primary/5">
                                    {formatCurrency(totalValue)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving || fields.length === 0} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
                    {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin"/> : <Save className="ml-3 h-5 w-5"/>}
                    تأكيد الاستلام والترحيل
                </Button>
            </div>
        </form>
    );
}
