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
import { Loader2, Save, X, FileCheck, PackageCheck, ShoppingBag, AlertCircle, Calculator, CheckCircle2, AlertTriangle, Info, UserPlus, ShieldCheck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, limit, addDoc } from 'firebase/firestore';
import type { PurchaseOrder, Account, Warehouse, Item, GoodsReceiptNote, Vendor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '../ui/textarea';

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
    const [loadingPoStatus, setLoadingPoStatus] = useState(false);
    
    // حالات المورد المحتمل
    const [isProspectiveVendor, setIsProspectiveVendor] = useState(false);
    const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
    const [vendorData, setVendorData] = useState({ phone: '', address: '', contactPerson: '' });

    const { data: pos = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', [
        where('status', 'in', ['approved', 'partially_received'])
    ]);
    const { data: registeredVendors = [], loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors');
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<GrnFormValues>({
        resolver: zodResolver(grnSchema),
        defaultValues: { date: new Date(), itemsReceived: [] }
    });

    const { fields, replace } = useFieldArray({ control, name: "itemsReceived" });
    const selectedPoId = watch('purchaseOrderId');
    const watchedItems = useWatch({ control, name: "itemsReceived" });

    const selectedPo = useMemo(() => pos.find(p => p.id === selectedPoId), [pos, selectedPoId]);

    // تحقق من نوع المورد عند اختيار أمر الشراء
    useEffect(() => {
        if (selectedPo) {
            const isRegistered = registeredVendors.some(v => v.id === selectedPo.vendorId);
            setIsProspectiveVendor(!isRegistered);
        } else {
            setIsProspectiveVendor(false);
        }
    }, [selectedPo, registeredVendors]);

    useEffect(() => {
        if (!selectedPoId || !firestore) {
            replace([]);
            return;
        }

        const loadPoWithHistory = async () => {
            setLoadingPoStatus(true);
            try {
                if (!selectedPo) return;
                const grnsSnap = await getDocs(query(collection(firestore, 'grns'), where('purchaseOrderId', '==', selectedPoId)));
                const receivedTotals = new Map<string, number>();
                grnsSnap.forEach(doc => {
                    const grn = doc.data();
                    grn.itemsReceived?.forEach((item: any) => {
                        const current = receivedTotals.get(item.internalItemId) || 0;
                        receivedTotals.set(item.internalItemId, current + (item.quantityReceived || 0));
                    });
                });

                const itemsWithBalance = selectedPo.items.map(item => {
                    const previouslyReceived = receivedTotals.get(item.internalItemId!) || 0;
                    const remaining = Math.max(0, item.quantity - previouslyReceived);
                    return {
                        internalItemId: item.internalItemId || '',
                        itemName: item.itemName,
                        quantityOrdered: item.quantity,
                        quantityPreviouslyReceived: previouslyReceived,
                        quantityReceived: remaining,
                        unitPrice: item.unitPrice,
                        batchNumber: '',
                        expiryDate: null
                    };
                }).filter(i => i.quantityOrdered > i.quantityPreviouslyReceived);

                replace(itemsWithBalance);
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل سجل الاستلام.' });
            } finally {
                setLoadingPoStatus(false);
            }
        };
        loadPoWithHistory();
    }, [selectedPoId, firestore, selectedPo, replace, toast]);

    const poOptions = useMemo(() => pos.map(p => ({ value: p.id!, label: `${p.poNumber} - ${p.vendorName}` })), [pos]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    const totalValue = useMemo(() => (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantityReceived) || 0) * (item.unitPrice || 0), 0), [watchedItems]);

    // دمج المورد المحتمل في النظام وتحويله لمورد رسمي
    const handleRegisterVendor = async () => {
        if (!selectedPo || !firestore) return;
        if (!vendorData.phone) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'رقم الهاتف مطلوب لمنع تكرار الموردين.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                // 1. إنشاء المورد الرسمي
                const newVendorRef = doc(collection(firestore, 'vendors'));
                const newVendorData = {
                    name: selectedPo.vendorName,
                    phone: vendorData.phone,
                    address: vendorData.address,
                    contactPerson: vendorData.contactPerson,
                    createdAt: serverTimestamp(),
                };
                transaction.set(newVendorRef, newVendorData);

                // 2. تحديث أمر الشراء ليرتبط بالمورد الجديد
                const poRef = doc(firestore, 'purchaseOrders', selectedPoId);
                transaction.update(poRef, { vendorId: newVendorRef.id });
            });

            toast({ title: 'نجاح', description: 'تم تسجيل المورد بنجاح وتحويل الطلب إليه.' });
            setIsProspectiveVendor(false);
            setIsRegistrationDialogOpen(false);
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل المورد.' });
        } finally {
            setIsSaving(false);
        }
    };

    const onSubmit = async (data: GrnFormValues) => {
        if (!firestore || !currentUser || !selectedPo) return;

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const accountsRef = collection(firestore, 'chartOfAccounts');
                const coaSnap = await getDocs(query(accountsRef));
                const allAccounts = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

                // 1. تأمين الحسابات الرئيسية (ترميم تلقائي للشجرة)
                let inventoryAcc = allAccounts.find(a => a.code === '1104');
                if (!inventoryAcc) {
                    const newInvRef = doc(accountsRef);
                    inventoryAcc = { code: '1104', name: 'المخزون', type: 'asset', level: 2, parentCode: '11', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' };
                    transaction.set(newInvRef, inventoryAcc);
                    inventoryAcc.id = newInvRef.id;
                }

                let vendorsParentAcc = allAccounts.find(a => a.code === '2101');
                if (!vendorsParentAcc) {
                    const newVenPRef = doc(accountsRef);
                    vendorsParentAcc = { code: '2101', name: 'الموردون', type: 'liability', level: 2, parentCode: '21', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' };
                    transaction.set(newVenPRef, vendorsParentAcc);
                    vendorsParentAcc.id = newVenPRef.id;
                }

                // 2. البحث أو إنشاء حساب فرعي للمورد
                let vendorAcc = allAccounts.find(a => a.name === selectedPo.vendorName && a.parentCode === '2101');
                if (!vendorAcc) {
                    const nextCounterRef = doc(firestore, 'counters', 'coa_vendors');
                    const counterDoc = await transaction.get(nextCounterRef);
                    const nextNum = (counterDoc.data()?.lastNumber || 0) + 1;
                    const vendorCode = `2101${String(nextNum).padStart(3, '0')}`;
                    
                    const newVenAccRef = doc(accountsRef);
                    vendorAcc = { code: vendorCode, name: selectedPo.vendorName, type: 'liability', level: 3, parentCode: '2101', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' };
                    transaction.set(newVenAccRef, vendorAcc);
                    vendorAcc.id = newVenAccRef.id;
                    transaction.set(nextCounterRef, { lastNumber: nextNum }, { merge: true });
                }

                // 3. حفظ إذن الاستلام وتوليد القيد
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'grns');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const grnNumber = `GRN-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const newGrnRef = doc(collection(firestore, 'grns'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                transaction.set(newGrnRef, cleanFirestoreData({
                    grnNumber, purchaseOrderId: data.purchaseOrderId, warehouseId: data.warehouseId,
                    date: data.date, itemsReceived: data.itemsReceived.map(i => ({ ...i, total: i.quantityReceived * i.unitPrice })),
                    totalValue, vendorId: selectedPo.vendorId, vendorName: selectedPo.vendorName,
                    createdAt: serverTimestamp(), createdBy: currentUser.id,
                }));

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: `JE-${grnNumber}`, date: data.date,
                    narration: `استلام بضاعة #${grnNumber} من ${selectedPo.vendorName}`,
                    status: 'posted', totalDebit: totalValue, totalCredit: totalValue,
                    lines: [
                        { accountId: inventoryAcc.id!, accountName: inventoryAcc.name, debit: totalValue, credit: 0 },
                        { accountId: vendorAcc.id!, accountName: vendorAcc.name, debit: 0, credit: totalValue }
                    ],
                    createdAt: serverTimestamp(), createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                
                const isFullyReceived = data.itemsReceived.every(i => (i.quantityReceived + i.quantityPreviouslyReceived) >= (i.quantityOrdered - 0.0001));
                transaction.update(doc(firestore, 'purchaseOrders', data.purchaseOrderId), { status: isFullyReceived ? 'received' : 'partially_received' });
            });

            toast({ title: 'تم الاستلام بنجاح', description: 'تم تحديث المخزون والشجرة المحاسبية آلياً.' });
            router.push('/dashboard/warehouse/grns');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: error.message || 'فشل حفظ إذن الاستلام.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border border-primary/10">
                <div className="grid gap-2">
                    <Label className="font-bold flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary"/> أمر الشراء المعتمد *</Label>
                    <Controller
                        control={control}
                        name="purchaseOrderId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={poOptions}
                                placeholder={posLoading ? "جاري التحميل..." : "اختر أمر شراء..."}
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

            {isProspectiveVendor && (
                <Alert variant="destructive" className="border-2 border-red-500 bg-red-50 animate-pulse">
                    <AlertTriangle className="h-5 w-5" />
                    <AlertTitle className="font-black text-lg">المورد غير مسجل في النظام!</AlertTitle>
                    <AlertDescription className="space-y-4">
                        <p>لا يمكن إتمام عملية الاستلام وإصدار قيد مالي لمورد "محتمل". يجب عليك أولاً إكمال بيانات المورد وتحويله لمورد رسمي لمنع تكرار الحسابات المحاسبية.</p>
                        <Button type="button" onClick={() => setIsRegistrationDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl gap-2">
                            <UserPlus className="h-4 w-4" /> إكمال بيانات المورد الآن
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {fields.length > 0 && !isProspectiveVendor && (
                <div className="space-y-4">
                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-14 border-b-2">
                                    <TableHead className="px-6 font-bold text-base">اسم الصنف</TableHead>
                                    <TableHead className="text-center font-bold">الكمية المطلوبة</TableHead>
                                    <TableHead className="text-center font-bold">مستلم سابقاً</TableHead>
                                    <TableHead className="text-center font-bold bg-primary/5 text-primary text-base">الكمية الحالية</TableHead>
                                    <TableHead className="text-left px-8 font-bold text-base">قيمة التوريد</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index];
                                    const remaining = (item?.quantityOrdered || 0) - (item?.quantityPreviouslyReceived || 0);
                                    const lineTotal = (item?.quantityReceived || 0) * (item?.unitPrice || 0);
                                    return (
                                        <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-muted/5">
                                            <TableCell className="px-6 font-bold text-lg">{item?.itemName}</TableCell>
                                            <TableCell className="text-center font-mono font-bold text-muted-foreground">{item?.quantityOrdered}</TableCell>
                                            <TableCell className="text-center font-mono text-indigo-600 font-bold">{item?.quantityPreviouslyReceived || 0}</TableCell>
                                            <TableCell className="bg-primary/[0.02] py-2">
                                                <Input 
                                                    type="number" step="any" 
                                                    {...register(`itemsReceived.${index}.quantityReceived`)} 
                                                    className="text-center font-black text-xl w-28 h-11 rounded-xl border-2 border-primary/20 shadow-inner"
                                                />
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
                                    <TableCell colSpan={4} className="text-right px-12 font-black text-2xl">إجمالي القيمة المالية المستلمة:</TableCell>
                                    <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                        {formatCurrency(totalValue)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-10 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving || fields.length === 0 || isProspectiveVendor} className="h-12 px-16 rounded-xl font-black text-xl shadow-2xl shadow-primary/30 min-w-[280px]">
                    {isSaving ? <><Loader2 className="ml-3 h-6 w-6 animate-spin"/> جاري الحفظ...</> : <><Save className="ml-3 h-6 w-6"/> اعتماد الاستلام والترحيل</>}
                </Button>
            </div>
        </form>

        {/* حوار تسجيل المورد */}
        <Dialog open={isRegistrationDialogOpen} onOpenChange={setIsRegistrationDialogOpen}>
            <DialogContent dir="rtl" className="rounded-3xl max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <ShieldCheck className="text-green-600" /> تسجيل بيانات المورد الرسمي
                    </DialogTitle>
                    <DialogDescription>يجب إكمال بيانات المورد: <span className="font-bold text-foreground">{selectedPo?.vendorName}</span> للمتابعة المحاسبية.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>رقم الجوال / الهاتف <span className="text-destructive">*</span></Label>
                        <Input value={vendorData.phone} onChange={e => setVendorData(p => ({...p, phone: e.target.value}))} placeholder="أدخل رقم التواصل الرئيسي..." dir="ltr" />
                    </div>
                    <div className="grid gap-2">
                        <Label>جهة الاتصال</Label>
                        <Input value={vendorData.contactPerson} onChange={e => setVendorData(p => ({...p, contactPerson: e.target.value}))} placeholder="اسم الشخص المسؤول عند المورد..." />
                    </div>
                    <div className="grid gap-2">
                        <Label>عنوان الشركة</Label>
                        <Textarea value={vendorData.address} onChange={e => setVendorData(p => ({...p, address: e.target.value}))} placeholder="المقر الرئيسي أو فرع التوريد..." />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setIsRegistrationDialogOpen(false)}>تراجع</Button>
                    <Button onClick={handleRegisterVendor} disabled={isSaving || !vendorData.phone} className="rounded-xl font-bold px-8">
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4 ml-2"/> : <UserPlus className="h-4 w-4 ml-2" />}
                        تثبيت المورد والمتابعة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}