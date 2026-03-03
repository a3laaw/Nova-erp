
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
import { Loader2, Save, X, FileCheck, PackageCheck, ShieldCheck, User, Truck, Box, Target, HardHat } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, where, limit, writeBatch } from 'firebase/firestore';
import type { PurchaseOrder, Account, Warehouse, Item, Vendor, Employee, Department, ConstructionProject, SubsidyQuota } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { cn } from '@/lib/utils';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const lineSchema = z.object({
  internalItemId: z.string(),
  itemName: z.string(),
  quantityOrdered: z.number().optional(),
  quantityPreviouslyReceived: z.number().default(0),
  quantityReceived: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "الكمية لا يمكن أن تكون سالبة")),
  unitPrice: z.number(),
  batchNumber: z.string().optional(),
});

const grnSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  isSubsidy: z.boolean().default(false),
  purchaseOrderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  warehouseId: z.string().min(1, "يجب تحديد المستودع المستلم."),
  possession: z.enum(['warehouse', 'subcontractor', 'site']).default('warehouse'),
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
    const savingRef = useRef(false);
    const [loadingPoStatus, setLoadingPoStatus] = useState(false);
    
    const { data: pos = [] } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', [
        where('status', 'in', ['approved', 'partially_received'])
    ]);
    const { data: projects = [] } = useSubscription<ConstructionProject>(firestore, 'projects', [where('status', '==', 'قيد التنفيذ')]);
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: warehouses = [] } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: employees = [] } = useSubscription<Employee>(firestore, 'employees');
    const { data: departments = [] } = useSubscription<Department>(firestore, 'departments');

    const { register, handleSubmit, control, watch, formState: { errors }, setValue } = useForm<GrnFormValues>({
        resolver: zodResolver(grnSchema),
        defaultValues: { 
            date: new Date(), 
            isSubsidy: false,
            possession: 'warehouse',
            itemsReceived: [],
            discountAmount: 0,
            deliveryFees: 0
        }
    });

    const { fields, replace, append, remove } = useFieldArray({ control, name: "itemsReceived" });
    const isSubsidy = watch('isSubsidy');
    const selectedPoId = watch('purchaseOrderId');
    const selectedProjectId = watch('projectId');
    const watchedItems = useWatch({ control, name: "itemsReceived" });
    const currentDiscount = watch('discountAmount');
    const currentDelivery = watch('deliveryFees');

    const selectedPo = useMemo(() => pos.find(p => p.id === selectedPoId), [pos, selectedPoId]);
    const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

    useEffect(() => {
        if (isSubsidy) {
            setValue('purchaseOrderId', null);
            replace([]);
        }
    }, [isSubsidy, setValue, replace]);

    useEffect(() => {
        if (isSubsidy || !selectedPoId || !firestore || !selectedPo) return;

        const loadPoData = async () => {
            setLoadingPoStatus(true);
            try {
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
                    const prev = receivedTotals.get(item.internalItemId!) || 0;
                    const remaining = Math.max(0, item.quantity - prev);
                    return {
                        internalItemId: item.internalItemId || '',
                        itemName: item.itemName,
                        quantityOrdered: item.quantity,
                        quantityPreviouslyReceived: prev,
                        quantityReceived: remaining,
                        unitPrice: item.unitPrice,
                    };
                }).filter(i => i.quantityOrdered > i.quantityPreviouslyReceived);

                replace(itemsWithBalance);
                setValue('discountAmount', selectedPo.discountAmount || 0);
                setValue('deliveryFees', selectedPo.deliveryFees || 0);
            } finally {
                setLoadingPoStatus(false);
            }
        };
        loadPoData();
    }, [selectedPoId, isSubsidy, firestore, selectedPo, replace, setValue]);

    const poOptions = useMemo(() => pos.map(p => ({ value: p.id!, label: `${p.poNumber} - ${p.vendorName}` })), [pos]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName })), [projects]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    const itemOptions = useMemo(() => allItems.filter(i => i.isSubsidyEligible).map(i => ({ value: i.id!, label: i.name })), [allItems]);

    const totalValue = useMemo(() => {
        const itemsSubtotal = (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantityReceived) || 0) * (item.unitPrice || 0), 0);
        return itemsSubtotal - (Number(currentDiscount) || 0) + (Number(currentDelivery) || 0);
    }, [watchedItems, currentDiscount, currentDelivery]);

    const onSubmit = async (data: GrnFormValues) => {
        if (!firestore || !currentUser) return;
        if (savingRef.current) return;

        savingRef.current = true;
        setIsSaving(true);
        try {
            const coaSnap = await getDocs(collection(firestore, 'chartOfAccounts'));
            const allAccounts = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

            let projectInfo: ConstructionProject | null = null;
            let autoTags = {};
            const projId = data.isSubsidy ? data.projectId : selectedPo?.projectId;
            if (projId) {
                const projSnap = await getDoc(doc(firestore, 'projects', projId));
                if (projSnap.exists()) {
                    projectInfo = { id: projSnap.id, ...projSnap.data() } as ConstructionProject;
                    const engineer = employees.find(e => e.id === projectInfo?.mainEngineerId);
                    const dept = departments.find(d => d.name === engineer?.department);
                    autoTags = { clientId: projectInfo.clientId, transactionId: projId, auto_profit_center: projId, auto_resource_id: projectInfo.mainEngineerId, ...(dept && { auto_dept_id: dept.id }) };
                }
            }

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const grnCounterRef = doc(firestore, 'counters', 'grns');
                const grnCounterDoc = await transaction.get(grnCounterRef);
                const nextGrnNumber = ((grnCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const grnNumber = `GRN-${currentYear}-${String(nextGrnNumber).padStart(4, '0')}`;

                const inventoryAcc = allAccounts.find(a => a.code === '1104');
                const newGrnRef = doc(collection(firestore, 'grns'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                let creditAccountId = '';
                let creditAccountName = '';
                let narration = '';

                if (data.isSubsidy) {
                    const subsidyRevAcc = allAccounts.find(a => a.code === '4104');
                    creditAccountId = subsidyRevAcc?.id || '';
                    creditAccountName = subsidyRevAcc?.name || 'إيرادات دعم';
                    narration = `استلام مواد مدعومة (تموين) #${grnNumber} - عهدة: ${data.possession} - مشروع: ${projectInfo?.projectName}`;
                    
                    // تحديث حصص المشروع (Received Quantity)
                    if (projectInfo) {
                        const updatedQuotas = (projectInfo.subsidyQuotas || []).map(q => {
                            const receivedInThisGrn = data.itemsReceived.find(i => i.internalItemId === q.itemId);
                            if (receivedInThisGrn) {
                                return { ...q, receivedQuantity: (q.receivedQuantity || 0) + receivedInThisGrn.quantityReceived };
                            }
                            return q;
                        });
                        transaction.update(doc(firestore, 'projects', projectInfo.id!), { subsidyQuotas: updatedQuotas });
                    }
                } else {
                    const vendorAcc = allAccounts.find(a => a.name === selectedPo?.vendorName && a.parentCode === '2101');
                    creditAccountId = vendorAcc?.id || '';
                    creditAccountName = vendorAcc?.name || 'مورد غير معروف';
                    narration = `استلام بضاعة #${grnNumber} من ${selectedPo?.vendorName}`;
                }

                transaction.set(newGrnRef, cleanFirestoreData({
                    grnNumber, purchaseOrderId: data.purchaseOrderId || null, projectId: projId || null,
                    warehouseId: data.warehouseId, date: data.date, itemsReceived: data.itemsReceived,
                    totalValue, isSubsidy: data.isSubsidy, possession: data.possession,
                    vendorName: data.isSubsidy ? 'وزارة التجارة (تموين)' : selectedPo?.vendorName,
                    journalEntryId: newJournalEntryRef.id, createdAt: serverTimestamp(), createdBy: currentUser.id,
                }));

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: `JE-${grnNumber}`, date: data.date, narration, status: 'posted',
                    totalDebit: totalValue, totalCredit: totalValue,
                    lines: [
                        { accountId: inventoryAcc!.id!, accountName: inventoryAcc!.name, debit: totalValue, credit: 0, ...autoTags },
                        { accountId: creditAccountId, accountName: creditAccountName, debit: 0, credit: totalValue, ...autoTags }
                    ],
                    clientId: projectInfo?.clientId || null, transactionId: projId || null,
                    isSubsidyEntry: data.isSubsidy, createdAt: serverTimestamp(), createdBy: currentUser.id,
                }));

                transaction.set(grnCounterRef, { counts: { [currentYear]: nextGrnNumber } }, { merge: true });
                
                if (!data.isSubsidy && data.purchaseOrderId) {
                    transaction.update(doc(firestore, 'purchaseOrders', data.purchaseOrderId), { status: 'received' });
                }
            });

            toast({ title: 'نجاح', description: 'تم استلام المواد وتحديث رصيد الحصص والقيود المالية.' });
            router.push('/dashboard/warehouse/grns');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: error.message });
            setIsSaving(false);
            savingRef.current = false;
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" dir="rtl">
            <div className="flex items-center justify-between p-6 bg-primary/5 rounded-[2.5rem] border-2 border-primary/10 shadow-inner">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary"><ShieldCheck className="h-8 w-8"/></div>
                    <div>
                        <Label className="text-xl font-black text-primary">استلام مواد مدعومة (تموين)؟</Label>
                        <p className="text-xs text-muted-foreground font-medium">سيتم تحديث حصص المالك المتبقية في ملف المشروع آلياً.</p>
                    </div>
                </div>
                <Controller name="isSubsidy" control={control} render={({field}) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border">
                {!isSubsidy ? (
                    <div className="grid gap-2">
                        <Label className="font-bold">أمر الشراء المرتبط *</Label>
                        <Controller control={control} name="purchaseOrderId" render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={poOptions} placeholder="اختر أمر شراء..." />
                        )} />
                    </div>
                ) : (
                    <div className="grid gap-2 animate-in zoom-in-95">
                        <Label className="font-bold text-primary">المشروع المرتبط بالدعم *</Label>
                        <Controller control={control} name="projectId" render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={projectOptions} placeholder="اختر المشروع..." />
                        )} />
                    </div>
                )}
                <div className="grid gap-2">
                    <Label className="font-bold">المستودع المستلم *</Label>
                    <Controller control={control} name="warehouseId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={warehouseOptions} placeholder="اختر المستودع..." />
                    )} />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">جهة الحيازة / الاستلام</Label>
                    <Controller name="possession" control={control} render={({field}) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className="bg-white rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="warehouse">المخزن الرئيسي</SelectItem>
                                <SelectItem value="site">مخزن الموقع</SelectItem>
                                <SelectItem value="subcontractor">عهدة مقاول الباطن</SelectItem>
                            </SelectContent>
                        </Select>
                    )}/>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                    <Label className="text-lg font-black flex items-center gap-2"><Calculator className="h-5 w-5 text-primary"/> الأصناف المستلمة</Label>
                    {isSubsidy && <Button type="button" variant="outline" size="sm" onClick={() => append({ internalItemId: '', itemName: '', quantityReceived: 1, unitPrice: 0 })}><PlusCircle className="h-4 w-4 ml-2"/> إضافة صنف مدعوم</Button>}
                </div>
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead className="px-6 font-bold">اسم الصنف</TableHead>
                                <TableHead className="text-center font-bold">الكمية</TableHead>
                                <TableHead className="text-center font-bold">سعر السوق</TableHead>
                                <TableHead className="text-left px-8 font-bold">الإجمالي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const item = watchedItems?.[index];
                                return (
                                    <TableRow key={field.id} className="h-16 border-b last:border-0">
                                        <TableCell className="text-center">
                                            {isSubsidy && <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>}
                                        </TableCell>
                                        <TableCell>
                                            {isSubsidy ? (
                                                <Controller name={`itemsReceived.${index}.internalItemId`} control={control} render={({field: f}) => (
                                                    <InlineSearchList value={f.value} onSelect={(v) => {
                                                        f.onChange(v);
                                                        const i = allItems.find(it => it.id === v);
                                                        if(i) {
                                                            setValue(`itemsReceived.${index}.itemName`, i.name);
                                                            setValue(`itemsReceived.${index}.unitPrice`, i.costPrice || 0);
                                                        }
                                                    }} options={itemOptions} placeholder="اختر مادة..." />
                                                )}/>
                                            ) : <span className="font-bold px-3">{item?.itemName}</span>}
                                        </TableCell>
                                        <TableCell><Input type="number" step="any" {...register(`itemsReceived.${index}.quantityReceived`)} className="text-center font-black"/></TableCell>
                                        <TableCell><Input type="number" step="0.001" {...register(`itemsReceived.${index}.unitPrice`)} className="text-center font-bold text-primary"/></TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-8">{formatCurrency((Number(item?.quantityReceived) || 0) * (item?.unitPrice || 0))}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="h-20 border-t-4">
                                <TableCell colSpan={4} className="text-right px-12 font-black text-xl">إجمالي القيمة دفترياً:</TableCell>
                                <TableCell className="text-left font-mono text-3xl font-black text-primary px-8">{formatCurrency(totalValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>

            <div className="flex justify-end gap-4 p-8 border-t">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving || fields.length === 0} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/30">
                    {isSaving ? <Loader2 className="ml-3 animate-spin"/> : <Save className="ml-3"/>} اعتماد الاستلام
                </Button>
            </div>
        </form>
    );
}
