
'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, FileCheck, PackageCheck, ShoppingBag, AlertCircle, Calculator, CheckCircle2, AlertTriangle, Info, UserPlus, ShieldCheck, Tag, Truck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, limit, writeBatch } from 'firebase/firestore';
import type { PurchaseOrder, Account, Warehouse, Item, Vendor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  discountAmount: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  deliveryFees: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
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
    
    const [isProspectiveVendor, setIsProspectiveVendor] = useState(false);
    const [isRegistrationDialogOpen, setIsRegistrationDialogOpen] = useState(false);
    const [vendorData, setVendorData] = useState({ phone: '', address: '', contactPerson: '' });

    // مراجع لمنع إعادة تعيين البيانات عند تحديث الحالة في الخلفية
    const lastLoadedPoIdRef = useRef<string | null>(null);

    const { data: pos = [], loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', [
        where('status', 'in', ['approved', 'partially_received'])
    ]);
    const { data: registeredVendors = [], loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors');
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<GrnFormValues>({
        resolver: zodResolver(grnSchema),
        defaultValues: { 
            date: new Date(), 
            itemsReceived: [],
            discountAmount: 0,
            deliveryFees: 0
        }
    });

    const { fields, replace } = useFieldArray({ control, name: "itemsReceived" });
    const selectedPoId = watch('purchaseOrderId');
    const watchedItems = useWatch({ control, name: "itemsReceived" });
    const currentDiscount = watch('discountAmount');
    const currentDelivery = watch('deliveryFees');

    const selectedPo = useMemo(() => pos.find(p => p.id === selectedPoId), [pos, selectedPoId]);

    // محرك تحميل بيانات أمر الشراء - يعمل فقط عند تغيير المعرف
    useEffect(() => {
        if (!selectedPoId || !firestore || !selectedPo) {
            if (!selectedPoId) {
                lastLoadedPoIdRef.current = null;
                replace([]);
                setValue('discountAmount', 0);
                setValue('deliveryFees', 0);
                setIsProspectiveVendor(false);
            }
            return;
        }

        // إذا كان أمر الشراء هو نفسه الذي تم تحميله بالفعل، لا تفعل شيئاً للحفاظ على تعديلات المستخدم
        if (selectedPoId === lastLoadedPoIdRef.current) return;

        const loadPoData = async () => {
            setLoadingPoStatus(true);
            try {
                // 1. فحص هل المورد مسجل أم محتمل
                const isRegistered = registeredVendors.some(v => v.id === selectedPo.vendorId);
                setIsProspectiveVendor(!isRegistered);

                // 2. جلب تاريخ الاستلام السابق لهذا الأمر
                const grnsSnap = await getDocs(query(collection(firestore, 'grns'), where('purchaseOrderId', '==', selectedPoId)));
                const receivedTotals = new Map<string, number>();
                grnsSnap.forEach(doc => {
                    const grn = doc.data();
                    grn.itemsReceived?.forEach((item: any) => {
                        const current = receivedTotals.get(item.internalItemId) || 0;
                        receivedTotals.set(item.internalItemId, current + (item.quantityReceived || 0));
                    });
                });

                // 3. تحضير بنود الاستلام بالكميات المتبقية
                const itemsWithBalance = selectedPo.items.map(item => {
                    const previouslyReceived = receivedTotals.get(item.internalItemId!) || 0;
                    const remaining = Math.max(0, item.quantity - previouslyReceived);
                    return {
                        internalItemId: item.internalItemId || '',
                        itemName: item.itemName,
                        quantityOrdered: item.quantity,
                        quantityPreviouslyReceived: previouslyReceived,
                        quantityReceived: remaining, // القيمة الافتراضية هي المتبقي، ولكنها قابلة للتعديل
                        unitPrice: item.unitPrice,
                        batchNumber: '',
                        expiryDate: null
                    };
                }).filter(i => i.quantityOrdered > i.quantityPreviouslyReceived);

                // 4. تعيين القيم في النموذج
                replace(itemsWithBalance);
                setValue('discountAmount', selectedPo.discountAmount || 0);
                setValue('deliveryFees', selectedPo.deliveryFees || 0);
                
                // تحديث المرجع لضمان عدم التكرار
                lastLoadedPoIdRef.current = selectedPoId;

            } catch (error) {
                console.error("Load PO Error:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحميل بيانات أمر الشراء.' });
            } finally {
                setLoadingPoStatus(false);
            }
        };

        loadPoData();
    }, [selectedPoId, firestore, selectedPo, registeredVendors, replace, setValue, toast]);

    const poOptions = useMemo(() => pos.map(p => ({ value: p.id!, label: `${p.poNumber} - ${p.vendorName}` })), [pos]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    
    const totalValue = useMemo(() => {
        const itemsSubtotal = (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantityReceived) || 0) * (item.unitPrice || 0), 0);
        return itemsSubtotal - (Number(currentDiscount) || 0) + (Number(currentDelivery) || 0);
    }, [watchedItems, currentDiscount, currentDelivery]);

    const handleRegisterVendor = async () => {
        if (!selectedPo || !firestore) return;
        
        const phoneTrimmed = vendorData.phone.trim();
        if (!phoneTrimmed) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'رقم الهاتف مطلوب إجبارياً لتثبيت المورد ومنع التكرار.' });
            return;
        }

        setIsSaving(true);
        try {
            const vendorsRef = collection(firestore, 'vendors');
            const phoneQuery = query(vendorsRef, where('phone', '==', phoneTrimmed));
            const phoneSnap = await getDocs(phoneQuery);
            
            if (!phoneSnap.empty) {
                toast({ 
                    variant: 'destructive', 
                    title: 'رقم مكرر', 
                    description: 'رقم الهاتف هذا مسجل بالفعل لمورد آخر في النظام.' 
                });
                setIsSaving(false);
                return;
            }

            await runTransaction(firestore, async (transaction) => {
                const newVendorRef = doc(collection(firestore, 'vendors'));
                const newVendorData = {
                    name: selectedPo.vendorName,
                    phone: phoneTrimmed,
                    address: vendorData.address,
                    contactPerson: vendorData.contactPerson,
                    createdAt: serverTimestamp(),
                };
                transaction.set(newVendorRef, newVendorData);

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
            const accountsRef = collection(firestore, 'chartOfAccounts');
            const coaSnap = await getDocs(query(accountsRef));
            const allAccounts = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const grnCounterRef = doc(firestore, 'counters', 'grns');
                const coaVendorCounterRef = doc(firestore, 'counters', 'coa_vendors');
                
                const [grnCounterDoc, coaVendorCounterDoc] = await Promise.all([
                    transaction.get(grnCounterRef),
                    transaction.get(coaVendorCounterRef)
                ]);

                let inventoryAcc = allAccounts.find(a => a.code === '1104');
                let vendorAcc = allAccounts.find(a => a.name === selectedPo.vendorName && a.parentCode === '2101');

                const nextGrnNumber = ((grnCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const grnNumber = `GRN-${currentYear}-${String(nextGrnNumber).padStart(4, '0')}`;
                
                let nextVendorNum = coaVendorCounterDoc.data()?.lastNumber || 0;

                if (!vendorAcc) {
                    nextVendorNum++;
                    const vendorCode = `2101${String(nextVendorNum).padStart(3, '0')}`;
                    const newVenAccRef = doc(accountsRef);
                    vendorAcc = { id: newVenAccRef.id, code: vendorCode, name: selectedPo.vendorName, type: 'liability', level: 3, parentCode: '2101', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' };
                    transaction.set(newVenAccRef, vendorAcc);
                    transaction.set(coaVendorCounterRef, { lastNumber: nextVendorNum }, { merge: true });
                }

                const newGrnRef = doc(collection(firestore, 'grns'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                const itemsSubtotal = data.itemsReceived.reduce((sum, i) => sum + (i.quantityReceived * i.unitPrice), 0);
                
                const processedItems = data.itemsReceived.map(item => {
                    const itemRawTotal = item.quantityReceived * item.unitPrice;
                    const ratio = itemsSubtotal > 0 ? (itemRawTotal / itemsSubtotal) : 0;
                    
                    const itemShareOfDiscount = ratio * data.discountAmount;
                    const itemShareOfDelivery = ratio * data.deliveryFees;
                    const itemNetTotal = itemRawTotal - itemShareOfDiscount + itemShareOfDelivery;

                    return {
                        ...item,
                        total: itemNetTotal, 
                        rawTotal: itemRawTotal
                    };
                });

                transaction.set(newGrnRef, cleanFirestoreData({
                    grnNumber, 
                    purchaseOrderId: data.purchaseOrderId, 
                    warehouseId: data.warehouseId,
                    date: data.date, 
                    itemsReceived: processedItems,
                    totalValue, 
                    discountAmount: data.discountAmount,
                    deliveryFees: data.deliveryFees,
                    vendorId: selectedPo.vendorId, 
                    vendorName: selectedPo.vendorName,
                    createdAt: serverTimestamp(), 
                    createdBy: currentUser.id,
                }));

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: `JE-${grnNumber}`, 
                    date: data.date,
                    narration: `استلام بضاعة #${grnNumber} من ${selectedPo.vendorName} (تعديل يدوي للكميات والخصوم)`,
                    status: 'posted', 
                    totalDebit: totalValue, 
                    totalCredit: totalValue,
                    lines: [
                        { accountId: inventoryAcc!.id!, accountName: inventoryAcc!.name, debit: totalValue, credit: 0 },
                        { accountId: vendorAcc.id!, accountName: vendorAcc.name, debit: 0, credit: totalValue }
                    ],
                    createdAt: serverTimestamp(), 
                    createdBy: currentUser.id,
                }));

                transaction.set(grnCounterRef, { counts: { [currentYear]: nextGrnNumber } }, { merge: true });
                
                const isFullyReceived = data.itemsReceived.every(i => (i.quantityReceived + i.quantityPreviouslyReceived) >= (i.quantityOrdered - 0.0001));
                transaction.update(doc(firestore, 'purchaseOrders', data.purchaseOrderId), { status: isFullyReceived ? 'received' : 'partially_received' });
            });

            toast({ title: 'تم الاستلام بنجاح', description: 'تم تحديث المخزون والشجرة المحاسبية بنظام التكلفة المعدلة.' });
            router.push('/dashboard/warehouse/grns');
        } catch (error: any) {
            console.error("GRN Transaction Error:", error);
            toast({ variant: 'destructive', title: 'خطأ تقني', description: error.message || 'فشل حفظ إذن الاستلام.' });
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

            {loadingPoStatus ? (
                <div className="p-12 text-center">
                    <Loader2 className="animate-spin mx-auto h-10 w-10 text-primary" />
                    <p className="mt-4 text-muted-foreground font-bold">جاري تحميل بنود الطلب وفحص السجلات السابقة...</p>
                </div>
            ) : fields.length > 0 && !isProspectiveVendor ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-2 border-dashed rounded-3xl bg-muted/10">
                        <div className="grid gap-2">
                            <Label className="font-bold text-green-700 flex items-center gap-2"><Tag className="h-4 w-4"/> الخصم الإجمالي الفعلي (د.ك)</Label>
                            <Input 
                                type="number" step="0.001" 
                                {...register('discountAmount')} 
                                className="h-11 text-lg font-bold border-green-200 focus:border-green-500 bg-background"
                                placeholder="0.000"
                            />
                            <p className="text-[10px] text-muted-foreground italic">يمكنك تعديل الخصم إذا تغير عند الاستلام.</p>
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold text-blue-700 flex items-center gap-2"><Truck className="h-4 w-4"/> رسوم التوصيل الفعلية (د.ك)</Label>
                            <Input 
                                type="number" step="0.001" 
                                {...register('deliveryFees')} 
                                className="h-11 text-lg font-bold border-blue-200 focus:border-blue-500 bg-background"
                                placeholder="0.000"
                            />
                            <p className="text-[10px] text-muted-foreground italic">أدخل التكلفة النهائية للشحن لهذا الاستلام.</p>
                        </div>
                    </div>

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
                                    const lineTotal = (item?.quantityReceived || 0) * (item?.unitPrice || 0);
                                    const remainingToReceive = (item?.quantityOrdered || 0) - (item?.quantityPreviouslyReceived || 0);

                                    return (
                                        <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-muted/5">
                                            <TableCell className="px-6 font-bold text-lg">{item?.itemName}</TableCell>
                                            <TableCell className="text-center font-mono font-bold text-muted-foreground">{item?.quantityOrdered}</TableCell>
                                            <TableCell className="text-center font-mono text-indigo-600 font-bold">{item?.quantityPreviouslyReceived || 0}</TableCell>
                                            <TableCell className="bg-primary/[0.02] py-2">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Input 
                                                        type="number" step="any" 
                                                        {...register(`itemsReceived.${index}.quantityReceived`)} 
                                                        className="text-center font-black text-xl w-28 h-11 rounded-xl border-2 border-primary/20 shadow-inner"
                                                    />
                                                    <span className="text-[9px] text-muted-foreground">المتبقي: {remainingToReceive}</span>
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
                                    <TableCell colSpan={4} className="text-right px-12 font-black text-2xl">إجمالي مديونية المورد (الصافي):</TableCell>
                                    <TableCell className="text-left font-mono text-3xl font-black text-primary px-8 border-r bg-primary/5">
                                        {formatCurrency(totalValue)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </div>
            ) : selectedPoId && !isProspectiveVendor && (
                <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/5">
                    <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-500 opacity-20" />
                    <p className="text-lg font-bold text-muted-foreground">لقد تم استلام كافة بنود هذا الطلب سابقاً.</p>
                </div>
            )}

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-10 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving || fields.length === 0 || isProspectiveVendor} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20 min-w-[280px]">
                    {isSaving ? <><Loader2 className="ml-3 h-6 w-6 animate-spin"/> جاري الحفظ...</> : <><Save className="ml-3 h-6 w-6"/> اعتماد الاستلام والترحيل</>}
                </Button>
            </div>
        </form>

        <Dialog open={isRegistrationDialogOpen} onOpenChange={setIsRegistrationDialogOpen}>
            <DialogContent dir="rtl" className="rounded-3xl max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <ShieldCheck className="text-green-600" /> تسجيل بيانات المورد الرسمي
                    </DialogTitle>
                    <DialogDescription>يجب إكمال بيانات المورد للمتابعة المحاسبية.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label>رقم الجوال / الهاتف <span className="text-destructive">*</span></Label>
                        <Input value={vendorData.phone} onChange={e => setVendorData(p => ({...p, phone: e.target.value}))} placeholder="أدخل رقم التواصل الرئيسي..." dir="ltr" required />
                    </div>
                    <div className="grid gap-2">
                        <Label>جهة الاتصال</Label>
                        <Input value={vendorData.contactPerson} onChange={e => setVendorData(p => ({...p, contactPerson: e.target.value}))} placeholder="اسم الشخص المسؤول..." />
                    </div>
                    <div className="grid gap-2">
                        <Label>عنوان الشركة</Label>
                        <Textarea value={vendorData.address} onChange={e => setVendorData(p => ({...p, address: e.target.value}))} placeholder="المقر الرئيسي..." />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setIsRegistrationDialogOpen(false)}>تراجع</Button>
                    <Button onClick={handleRegisterVendor} disabled={isSaving || !vendorData.phone.trim()} className="rounded-xl font-bold px-8">
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4 ml-2"/> : <UserPlus className="h-4 w-4 ml-2" />}
                        تثبيت المورد والمتابعة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}
