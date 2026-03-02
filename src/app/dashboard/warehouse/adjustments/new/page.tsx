'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Loader2, Save, X, RotateCcw, AlertTriangle, PackageSearch, ShieldCheck, User, Truck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, serverTimestamp, orderBy, where, Timestamp } from 'firebase/firestore';
import type { Account, Item, Warehouse, Client, Vendor, InventoryAdjustment } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const lineSchema = z.object({
  itemId: z.string().min(1, "الصنف مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  unitCost: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "التكلفة مطلوبة")),
});

const adjSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  type: z.enum(['damage', 'theft', 'opening_balance', 'purchase_return', 'sales_return', 'other']),
  warehouseId: z.string().min(1, "المستودع مطلوب."),
  notes: z.string().min(1, "يجب ذكر سبب العملية."),
  clientId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
  recoveredDiscount: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  items: z.array(lineSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type AdjFormValues = z.infer<typeof adjSchema>;

const typeTranslations: Record<string, string> = {
    damage: 'تسوية تلف مواد (خسارة)',
    theft: 'تسوية فقد / سرقة (خسارة)',
    opening_balance: 'رصيد افتتاحي',
    purchase_return: 'مردود مشتريات (إرجاع للمورد)',
    sales_return: 'مردود مبيعات (مرتجع من عميل)',
    other: 'أخرى'
};

export default function NewAdjustmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [isSaving, setIsSaving] = useState(false);
    const savingRef = useRef(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    
    // محركات الأرصدة والرقابة الثلاثية
    const [stockBalances, setStockBalances] = useState<Record<string, number>>({});
    const [vendorPurchaseBalances, setVendorPurchaseBalances] = useState<Record<string, number>>({});
    const [clientSalesBalances, setClientSalesBalances] = useState<Record<string, number>>({});
    
    const [loadingStock, setLoadingStock] = useState(false);
    const [loadingVendorBalances, setLoadingVendorBalances] = useState(false);
    const [loadingClientBalances, setLoadingClientBalances] = useState(false);

    const initialType = searchParams.get('type') as any;

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: clients = [] } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);
    const { data: vendors = [] } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);
    
    const { register, handleSubmit, control, formState: { errors }, watch, setValue } = useForm<AdjFormValues>({
        resolver: zodResolver(adjSchema),
        defaultValues: {
            date: new Date(),
            type: initialType || 'damage',
            items: [{ itemId: '', quantity: 1, unitCost: 0 }],
            recoveredDiscount: 0,
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const adjType = watch('type');
    const selectedWarehouseId = watch('warehouseId');
    const selectedVendorId = watch('vendorId');
    const selectedClientId = watch('clientId');

    const isOutbound = useMemo(() => ['damage', 'theft', 'purchase_return'].includes(adjType), [adjType]);

    const totalCost = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [watchedItems]);

    // 🛡️ الدرع 1: فحص الرصيد الفعلي في المستودع
    const fetchStockBalances = useCallback(async (warehouseId: string) => {
        if (!firestore || !warehouseId) return;
        setLoadingStock(true);
        try {
            const balances: Record<string, number> = {};
            const grnsSnap = await getDocs(query(collection(firestore, 'grns'), where('warehouseId', '==', warehouseId)));
            grnsSnap.forEach(doc => {
                doc.data().itemsReceived?.forEach((i: any) => {
                    balances[i.internalItemId] = (balances[i.internalItemId] || 0) + i.quantityReceived;
                });
            });

            const adjsSnap = await getDocs(query(collection(firestore, 'inventoryAdjustments')));
            adjsSnap.forEach(doc => {
                const data = doc.data() as InventoryAdjustment;
                data.items.forEach(i => {
                    if (data.type === 'transfer') {
                        if (data.fromWarehouseId === warehouseId) balances[i.itemId] = (balances[i.itemId] || 0) - i.quantity;
                        if (data.toWarehouseId === warehouseId) balances[i.itemId] = (balances[i.itemId] || 0) + i.quantity;
                    } else if (data.warehouseId === warehouseId) {
                        const isOut = ['material_issue', 'damage', 'theft', 'purchase_return'].includes(data.type);
                        balances[i.itemId] = (balances[i.itemId] || 0) + (i.quantity * (isOut ? -1 : 1));
                    }
                });
            });
            setStockBalances(balances);
        } finally {
            setLoadingStock(false);
        }
    }, [firestore]);

    // 🛡️ الدرع 2: فحص رصيد المورد
    const fetchVendorPurchaseBalances = useCallback(async (vId: string) => {
        if (!firestore || !vId) {
            setVendorPurchaseBalances({});
            return;
        }
        setLoadingVendorBalances(true);
        try {
            const balances: Record<string, number> = {};
            const grnsSnap = await getDocs(query(collection(firestore, 'grns'), where('vendorId', '==', vId)));
            grnsSnap.forEach(doc => {
                doc.data().itemsReceived?.forEach((i: any) => {
                    balances[i.internalItemId] = (balances[i.internalItemId] || 0) + i.quantityReceived;
                });
            });

            const returnsSnap = await getDocs(query(collection(firestore, 'inventoryAdjustments'), 
                where('vendorId', '==', vId), 
                where('type', '==', 'purchase_return')
            ));
            returnsSnap.forEach(doc => {
                doc.data().items?.forEach((i: any) => {
                    balances[i.itemId] = (balances[i.itemId] || 0) - i.quantity;
                });
            });
            setVendorPurchaseBalances(balances);
        } finally {
            setLoadingVendorBalances(false);
        }
    }, [firestore]);

    // 🛡️ الدرع 3: فحص رصيد مبيعات العميل
    const fetchClientSalesBalances = useCallback(async (cId: string) => {
        if (!firestore || !cId) {
            setClientSalesBalances({});
            return;
        }
        setLoadingClientBalances(true);
        try {
            const balances: Record<string, number> = {};
            const salesSnap = await getDocs(query(collection(firestore, 'inventoryAdjustments'), 
                where('clientId', '==', cId),
                where('type', '==', 'material_issue')
            ));
            
            salesSnap.forEach(doc => {
                doc.data().items?.forEach((i: any) => {
                    balances[i.itemId] = (balances[i.itemId] || 0) + i.quantity;
                });
            });

            const returnsSnap = await getDocs(query(collection(firestore, 'inventoryAdjustments'), 
                where('clientId', '==', cId), 
                where('type', '==', 'sales_return')
            ));
            returnsSnap.forEach(doc => {
                doc.data().items?.forEach((i: any) => {
                    balances[i.itemId] = (balances[i.itemId] || 0) - i.quantity;
                });
            });
            setClientSalesBalances(balances);
        } finally {
            setLoadingClientBalances(false);
        }
    }, [firestore]);

    useEffect(() => {
        if (selectedWarehouseId) fetchStockBalances(selectedWarehouseId);
    }, [selectedWarehouseId, fetchStockBalances]);

    useEffect(() => {
        if (adjType === 'purchase_return' && selectedVendorId) {
            fetchVendorPurchaseBalances(selectedVendorId);
        } else if (adjType === 'sales_return' && selectedClientId) {
            fetchClientSalesBalances(selectedClientId);
        }
    }, [adjType, selectedVendorId, selectedClientId, fetchVendorPurchaseBalances, fetchClientSalesBalances]);

    useEffect(() => {
        if (!firestore) return;
        getDocs(query(collection(firestore, 'chartOfAccounts'))).then(snap => {
            setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
        });
    }, [firestore]);

    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const vendorOptions = useMemo(() => vendors.map(v => ({ value: v.id!, label: v.name })), [vendors]);

    const onSubmit = async (data: AdjFormValues) => {
        if (!firestore || !currentUser || savingRef.current) return;

        // التحقق النهائي من الأرصدة قبل الحفظ
        for (const item of data.items) {
            const currentStock = stockBalances[item.itemId] || 0;
            const purchasedFromVendor = vendorPurchaseBalances[item.itemId] || 0;
            const soldToClient = clientSalesBalances[item.itemId] || 0;
            const itemName = items.find(i => i.id === item.itemId)?.name;

            if (isOutbound && item.quantity > currentStock) {
                toast({ variant: 'destructive', title: 'عجز مخزني', description: `لا يمكن سحب (${item.quantity}) من صنف "${itemName}" لأن المتوفر هو (${currentStock}) فقط.` });
                return;
            }

            if (data.type === 'purchase_return' && data.vendorId && item.quantity > purchasedFromVendor) {
                toast({ variant: 'destructive', title: 'تجاوز حد التوريد', description: `لا يمكن إرجاع (${item.quantity}) للمورد لأنك لم تشترِ منه سوى (${purchasedFromVendor}) من هذا الصنف.` });
                return;
            }

            if (data.type === 'sales_return' && data.clientId && item.quantity > soldToClient) {
                toast({ variant: 'destructive', title: 'تجاوز حد المبيعات', description: `لا يمكن استرجاع (${item.quantity}) من العميل لأنه لم يشترِ سوى (${soldToClient}) من هذا الصنف.` });
                return;
            }
        }

        savingRef.current = true;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'inventoryAdjustments');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const adjNumber = data.type === 'purchase_return' ? `RET-${currentYear}-${String(nextNumber).padStart(4, '0')}` : data.type === 'sales_return' ? `SRET-${currentYear}-${String(nextNumber).padStart(4, '0')}` : `ADJ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
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

                // منطق القيد المحاسبي المولد
                const inventoryAccount = accounts.find(a => a.code === '1104');
                let debitAccount: Account | undefined;
                let creditAccount: Account | undefined;
                let narration = '';

                if (data.type === 'damage' || data.type === 'theft') {
                    debitAccount = accounts.find(a => a.code === '5211'); 
                    creditAccount = inventoryAccount;
                    narration = `تسوية مخزنية (${typeTranslations[data.type]}) - ${data.notes}`;
                } else if (data.type === 'purchase_return') {
                    const vendor = vendors.find(v => v.id === data.vendorId);
                    debitAccount = accounts.find(a => a.name === vendor?.name && a.parentCode === '2101');
                    creditAccount = inventoryAccount;
                    narration = `مردود مشتريات للمورد: ${vendor?.name} - ${data.notes}`;
                } else if (data.type === 'sales_return') {
                    const client = clients.find(c => c.id === data.clientId);
                    debitAccount = inventoryAccount;
                    creditAccount = accounts.find(a => a.name === client?.nameAr && a.parentCode === '1102');
                    narration = `مردود مبيعات من العميل: ${client?.nameAr} - ${data.notes}`;
                }

                if (debitAccount && creditAccount) {
                    const totalWithDiscount = totalCost + (Number(data.recoveredDiscount) || 0);
                    transaction.set(newJournalEntryRef, cleanFirestoreData({
                        entryNumber: `JE-${adjNumber}`,
                        date: data.date,
                        narration,
                        status: 'posted',
                        totalDebit: totalWithDiscount,
                        totalCredit: totalWithDiscount,
                        lines: [
                            { accountId: debitAccount.id!, accountName: debitAccount.name, debit: totalWithDiscount, credit: 0 },
                            { accountId: creditAccount.id!, accountName: creditAccount.name, debit: 0, credit: totalCost },
                            ...(data.type === 'purchase_return' && data.recoveredDiscount ? [{
                                accountId: accounts.find(a => a.code === '4104')?.id || '', 
                                accountName: 'خصم مكتسب (مسترد)',
                                debit: 0,
                                credit: Number(data.recoveredDiscount)
                            }] : [])
                        ],
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.id,
                    }));
                }

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح العملية', description: 'تمت المردودات وتحديث الأرصدة والقيود المحاسبية بدقة.' });
            router.push('/dashboard/warehouse/reports');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إتمام العملية.' });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-none shadow-2xl overflow-hidden" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="flex items-center gap-3 text-2xl font-black">
                        <RotateCcw className="text-primary h-8 w-8"/> 
                        {adjType === 'purchase_return' ? 'مردود مشتريات للمورد' : adjType === 'sales_return' ? 'مردود مبيعات من عميل' : 'إذن تسوية مخزنية'}
                    </CardTitle>
                    <CardDescription>إدارة المردودات والتسويات مع تفعيل نظام "الدروع الرقابية" للأرصدة التاريخية.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-6 rounded-3xl border-2 border-dashed">
                        <div className="grid gap-2">
                            <Label className="font-bold">نوع العملية المخزنية *</Label>
                            <Controller name="type" control={control} render={({ field }) => (
                                <Select value={field.value} onValueChange={field.onChange} disabled={!!initialType}>
                                    <SelectTrigger className="h-11 rounded-xl border-2"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(typeTranslations).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            )} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">تاريخ العملية</Label>
                            <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label className="font-bold">المستودع المتأثر *</Label>
                            <Controller name="warehouseId" control={control} render={({ field }) => (
                                <InlineSearchList value={field.value} onSelect={field.onChange} options={warehouseOptions} placeholder="اختر المستودع..." />
                            )} />
                        </div>
                        
                        {adjType === 'sales_return' && (
                            <div className="grid gap-2 animate-in fade-in zoom-in-95">
                                <Label className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary"/> العميل (المرتجع منه) *</Label>
                                <Controller name="clientId" control={control} render={({ field }) => (
                                    <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." />
                                )} />
                            </div>
                        )}

                        {adjType === 'purchase_return' && (
                            <div className="grid gap-2 animate-in fade-in zoom-in-95">
                                <Label className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary"/> المورد (المرتجع إليه) *</Label>
                                <Controller name="vendorId" control={control} render={({ field }) => (
                                    <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={vendorOptions} placeholder="ابحث عن مورد..." />
                                )} />
                            </div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-bold">الملاحظات / سبب العملية *</Label>
                        <Input {...register('notes')} placeholder="لماذا يتم الإرجاع أو التسوية؟" className="h-11 rounded-xl" />
                        {errors.notes && <p className="text-xs text-destructive font-bold">{errors.notes.message}</p>}
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                            <Label className="text-lg font-black flex items-center gap-2">
                                <PackageSearch className="h-5 w-5 text-primary"/> الأصناف المرتجعة/المعدلة
                            </Label>
                            <div className="flex gap-2">
                                {adjType === 'purchase_return' && <Badge variant="secondary" className="bg-blue-100 text-blue-700">رقابة المورد نشطة</Badge>}
                                {adjType === 'sales_return' && <Badge variant="secondary" className="bg-purple-100 text-purple-700">رقابة مبيعات العميل نشطة</Badge>}
                            </div>
                        </div>
                        <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="h-14">
                                        <TableHead className="w-[60px]"></TableHead>
                                        <TableHead className="font-bold">الصنف</TableHead>
                                        <TableHead className="w-28 text-center font-bold">في المخزن</TableHead>
                                        {adjType === 'purchase_return' && <TableHead className="w-28 text-center font-bold text-blue-700">من المورد</TableHead>}
                                        {adjType === 'sales_return' && <TableHead className="w-28 text-center font-bold text-purple-700">اشترى العميل</TableHead>}
                                        <TableHead className="w-32 text-center font-bold bg-primary/5">الكمية</TableHead>
                                        <TableHead className="w-40 text-left px-6 font-bold">القيمة</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => {
                                        const item = watchedItems?.[index];
                                        const curStock = stockBalances[item?.itemId || ''] || 0;
                                        const purchased = vendorPurchaseBalances[item?.itemId || ''] || 0;
                                        const sold = clientSalesBalances[item?.itemId || ''] || 0;
                                        
                                        const isInsufficientStock = isOutbound && (item?.quantity || 0) > curStock;
                                        const isInsufficientVendor = adjType === 'purchase_return' && (item?.quantity || 0) > purchased;
                                        const isInsufficientClient = adjType === 'sales_return' && (item?.quantity || 0) > sold;

                                        const hasError = isInsufficientStock || isInsufficientVendor || isInsufficientClient;

                                        return (
                                            <TableRow key={field.id} className={cn("h-16 border-b last:border-0", hasError && "bg-red-50")}>
                                                <TableCell className="text-center">
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                                </TableCell>
                                                <TableCell>
                                                    <Controller name={`items.${index}.itemId`} control={control} render={({ field: itemField }) => (
                                                        <InlineSearchList value={itemField.value} onSelect={(val) => {
                                                            itemField.onChange(val);
                                                            const i = items.find(it => it.id === val);
                                                            if (i) setValue(`items.${index}.unitCost`, i.costPrice || 0);
                                                        }} options={itemOptions} placeholder="اختر الصنف..." className="border-none shadow-none text-lg font-bold" />
                                                    )} />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {loadingStock ? <Loader2 className="h-4 w-4 animate-spin mx-auto"/> : <span className={cn("font-mono font-bold", isInsufficientStock ? "text-red-600" : "text-muted-foreground")}>{curStock}</span>}
                                                </TableCell>
                                                {adjType === 'purchase_return' && (
                                                    <TableCell className="text-center">
                                                        {loadingVendorBalances ? <Loader2 className="h-4 w-4 animate-spin mx-auto"/> : <span className={cn("font-mono font-bold", isInsufficientVendor ? "text-red-600" : "text-blue-700")}>{purchased}</span>}
                                                    </TableCell>
                                                )}
                                                {adjType === 'sales_return' && (
                                                    <TableCell className="text-center">
                                                        {loadingClientBalances ? <Loader2 className="h-4 w-4 animate-spin mx-auto"/> : <span className={cn("font-mono font-bold", isInsufficientClient ? "text-red-600" : "text-purple-700")}>{sold}</span>}
                                                    </TableCell>
                                                )}
                                                <TableCell className="bg-primary/[0.02]">
                                                    <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="text-center font-black text-xl border-none focus-visible:ring-0" />
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-bold px-6 bg-muted/5">
                                                    {formatCurrency((Number(item?.quantity) || 0) * (Number(item?.unitCost) || 0))}
                                                </TableCell>
                                            </TableRow>
                                        )})}
                                </TableBody>
                                <TableFooter className="bg-primary/5 h-20">
                                    <TableRow>
                                        <TableCell colSpan={adjType === 'purchase_return' || adjType === 'sales_return' ? 5 : 4} className="text-right px-12 font-black text-xl">إجمالي قيمة المستند:</TableCell>
                                        <TableCell className="text-left font-mono font-black text-2xl text-primary px-6">{formatCurrency(totalCost)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <Button type="button" variant="outline" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold hover:bg-primary/5 transition-all">
                            <PlusCircle className="h-5 w-5 text-primary" /> إضافة صنف آخر
                        </Button>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4 p-8 border-t bg-muted/10">
                    <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loadingStock || loadingVendorBalances || loadingClientBalances} className="h-12 px-16 rounded-xl font-black text-xl shadow-2xl shadow-primary/30">
                        {isSaving ? <Loader2 className="ml-3 h-6 w-6 animate-spin"/> : <Save className="ml-3 h-6 w-6"/>}
                        اعتماد العملية والترحيل
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}