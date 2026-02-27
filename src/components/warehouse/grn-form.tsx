
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
import { Loader2, Save, X, FileCheck, PackageCheck, ShoppingBag, AlertCircle, Calculator } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where } from 'firebase/firestore';
import type { PurchaseOrder, Account, Warehouse, Item, GoodsReceiptNote } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';

const lineSchema = z.object({
  internalItemId: z.string(),
  itemName: z.string(),
  quantityOrdered: z.number(),
  quantityPreviouslyReceived: z.number().default(0),
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
    const [loadingPoStatus, setLoadingPoStatus] = useState(false);

    // Fetch approved POs and other refs
    const { data: pos = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', [
        where('status', 'in', ['approved', 'partially_received'])
    ]);
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);

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
        });
    }, [firestore]);

    // SMART LOGIC: Fetch previous GRNs for the selected PO to calculate remaining balances
    useEffect(() => {
        if (!selectedPoId || !firestore) {
            replace([]);
            return;
        }

        const loadPoWithHistory = async () => {
            setLoadingPoStatus(true);
            try {
                const selectedPo = pos.find(p => p.id === selectedPoId);
                if (!selectedPo) return;

                // 1. Fetch all GRNs for this PO
                const grnsSnap = await getDocs(query(collection(firestore, 'grns'), where('purchaseOrderId', '==', selectedPoId)));
                
                const receivedTotals = new Map<string, number>();
                grnsSnap.forEach(doc => {
                    const grn = doc.data();
                    grn.itemsReceived?.forEach((item: any) => {
                        const current = receivedTotals.get(item.internalItemId) || 0;
                        receivedTotals.set(item.internalItemId, current + (item.quantityReceived || 0));
                    });
                });

                // 2. Map items with remaining quantities
                const itemsWithBalance = selectedPo.items.map(item => {
                    const previouslyReceived = receivedTotals.get(item.internalItemId!) || 0;
                    const remaining = Math.max(0, item.quantity - previouslyReceived);
                    
                    return {
                        internalItemId: item.internalItemId || '',
                        itemName: item.itemName,
                        quantityOrdered: item.quantity,
                        quantityPreviouslyReceived: previouslyReceived,
                        quantityReceived: remaining, // Auto-fill with remaining
                        unitPrice: item.unitPrice,
                        batchNumber: '',
                        expiryDate: null
                    };
                }).filter(i => i.quantityOrdered > i.quantityPreviouslyReceived); // Only show items not fully received

                replace(itemsWithBalance);
            } catch (error) {
                console.error("Error loading PO history:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل سجل استلامات الطلب.' });
            } finally {
                setLoadingPoStatus(false);
            }
        };

        loadPoWithHistory();
    }, [selectedPoId, firestore, pos, replace, toast]);

    const poOptions = useMemo(() => pos.map(p => ({ value: p.id!, label: `${p.poNumber} - ${p.vendorName}` })), [pos]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);

    const totalValue = useMemo(() => 
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantityReceived) || 0) * (item.unitPrice || 0), 0)
    , [watchedItems]);

    const onSubmit = async (data: GrnFormValues) => {
        if (!firestore || !currentUser) return;

        // Validation: Ensure no item exceeds the ordered quantity
        const exceedsLimit = data.itemsReceived.some(item => 
            (item.quantityReceived + item.quantityPreviouslyReceived) > (item.quantityOrdered + 0.001) // small tolerance
        );

        if (exceedsLimit) {
            toast({ 
                variant: 'destructive', 
                title: 'تجاوز الكمية المسموحة', 
                description: 'لا يمكن استلام كمية أكبر من الكمية المتبقية في أمر الشراء.' 
            });
            return;
        }

        const inventoryAccount = accounts.find(a => a.code === '1104');
        const apAccount = accounts.find(a => a.code === '2101'); 

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
                    narration: `استلام بضاعة - إذن رقم ${grnNumber} من المورد ${selectedPo.vendorName} (أمر شراء ${selectedPo.poNumber})`,
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

                // 3. SMART STATUS UPDATE: Check if PO is now fully received
                const isFullyReceived = data.itemsReceived.every(i => 
                    (i.quantityReceived + i.quantityPreviouslyReceived) >= (i.quantityOrdered - 0.001)
                );
                
                const poRef = doc(firestore, 'purchaseOrders', data.purchaseOrderId);
                transaction.update(poRef, { status: isFullyReceived ? 'received' : 'partially_received' });

                // 4. Update Counter
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'تم الاستلام بنجاح', description: 'تم تحديث المخزون وإصدار القيد المحاسبي المالي.' });
            router.push('/dashboard/warehouse/grns');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ إذن الاستلام.' });
        } finally {
            setIsSaving(false);
        }
    };

    const poOptionsLoading = posLoading || loadingPoStatus;

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
                                placeholder={poOptionsLoading ? "جاري تحليل تاريخ الطلب..." : "اختر أمر شراء معتمد..."}
                                disabled={poOptionsLoading || isSaving}
                            />
                        )}
                    />
                    {loadingPoStatus && <p className="text-[10px] text-primary flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> جاري فحص سجل التوريد للطلب...</p>}
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

            {fields.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <Label className="text-xl font-black flex items-center gap-2 text-foreground">
                            <Calculator className="h-5 w-5 text-muted-foreground" />
                            مطابقة الكميات المستلمة
                        </Label>
                    </div>
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-14 border-b-2">
                                    <TableHead className="px-6 font-bold">اسم الصنف</TableHead>
                                    <TableHead className="text-center font-bold">المطلوب</TableHead>
                                    <TableHead className="text-center font-bold">المستلم سابقاً</TableHead>
                                    <TableHead className="text-center font-bold bg-primary/5 text-primary">الكمية الحالية</TableHead>
                                    <TableHead className="text-left px-8 font-bold">إجمالي القيمة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index];
                                    const remaining = (item?.quantityOrdered || 0) - (item?.quantityPreviouslyReceived || 0);
                                    const lineTotal = (item?.quantityReceived || 0) * (item?.unitPrice || 0);
                                    const isFull = (item?.quantityReceived || 0) === remaining;

                                    return (
                                        <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-muted/5 transition-colors">
                                            <TableCell className="px-6 font-bold text-lg">{item?.itemName}</TableCell>
                                            <TableCell className="text-center font-mono font-bold text-muted-foreground">{item?.quantityOrdered}</TableCell>
                                            <TableCell className="text-center font-mono text-indigo-600 font-bold">{item?.quantityPreviouslyReceived || 0}</TableCell>
                                            <TableCell className="bg-primary/[0.02]">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Input 
                                                        type="number" 
                                                        step="any" 
                                                        {...register(`itemsReceived.${index}.quantityReceived`)} 
                                                        className={cn(
                                                            "text-center font-black text-xl w-24 h-11 rounded-xl border-2",
                                                            isFull ? "border-green-500 bg-green-50 text-green-700" : "border-primary/20"
                                                        )}
                                                    />
                                                    <span className="text-[9px] text-muted-foreground font-bold">المتبقي: {remaining}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-left font-mono font-black text-xl px-8 bg-muted/5 border-r">
                                                {formatCurrency(lineTotal)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="h-24 border-t-4 border-primary/20">
                                    <TableCell colSpan={4} className="text-right px-12 font-black text-2xl">إجمالي قيمة الاستلام المالي:</TableCell>
                                    <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                        {formatCurrency(totalValue)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </div>
            ) : selectedPoId && !loadingPoStatus && (
                <Alert className="rounded-2xl border-2 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-800 font-bold text-lg">طلب مكتمل التوريد</AlertTitle>
                    <AlertDescription className="text-green-700">
                        لقد تم استلام كافة كميات هذا الطلب مسبقاً. لا توجد بنود معلقة بانتظار الاستلام.
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-10 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving || fields.length === 0} className="h-12 px-16 rounded-xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[280px]">
                    {isSaving ? (
                        <>
                            <Loader2 className="ml-3 h-6 w-6 animate-spin"/>
                            جاري ترحيل البيانات...
                        </>
                    ) : (
                        <>
                            <Save className="ml-3 h-6 w-6"/>
                            اعتماد الاستلام وتحديث المخزن
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
