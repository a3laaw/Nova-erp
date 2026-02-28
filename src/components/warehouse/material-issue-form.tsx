
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, Building2, Search, Info, ShoppingCart, User, ShieldCheck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup } from 'firebase/firestore';
import type { Item, ClientTransaction, Account, Employee, Department, BoqItem, ItemCategory, Warehouse, Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { DateInput } from '@/components/ui/date-input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths } from 'date-fns';

const lineSchema = z.object({
  boqItemId: z.string().optional(),
  itemId: z.string().min(1, "الصنف مطلوب."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().positive("الكمية مطلوبة")),
  unitCost: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "التكلفة مطلوبة")),
});

const issueSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  issueType: z.enum(['project_site', 'direct_sale']),
  projectId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  warehouseId: z.string().min(1, "يجب تحديد المستودع المصدر."),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type IssueFormValues = z.infer<typeof issueSchema>;

export function MaterialIssueForm({ onClose }: { onClose: () => void }) {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [isSaving, setIsSaving] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<(ClientTransaction & { clientName: string })[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loadingRefs, setLoadingRefs] = useState(true);

    const { data: allItems = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: categories = [] } = useSubscription<ItemCategory>(firestore, 'itemCategories');
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);

    const [boqItems, setBoqItems] = useState<BoqItem[]>([]);
    const [loadingBoq, setLoadingBoq] = useState(false);

    const { register, handleSubmit, control, watch, formState: { errors }, setValue } = useForm<IssueFormValues>({
        resolver: zodResolver(issueSchema),
        defaultValues: {
            date: new Date(),
            issueType: 'project_site',
            items: [{ boqItemId: '', itemId: '', quantity: 1, unitCost: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const issueType = watch('issueType');
    const selectedProjectId = watch('projectId');
    const selectedClientId = watch('clientId');
    const issueDate = watch('date');

    const totalCost = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0),
    [watchedItems]);

    useEffect(() => {
        if (!firestore) return;
        const fetchRefData = async () => {
            setLoadingRefs(true);
            try {
                const [accSnap, projSnap, clientSnap, empSnap, deptSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                    getDocs(query(collectionGroup(firestore, 'transactions'))),
                    getDocs(collection(firestore, 'clients')),
                    getDocs(query(collection(firestore, 'employees'))),
                    getDocs(query(collection(firestore, 'departments'))),
                ]);
                
                setAccounts(accSnap.docs.map(d => ({id: d.id, ...d.data()} as Account)));
                setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
                setDepartments(deptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
                
                const clientMap = new Map(clientSnap.docs.map(d => [d.id, d.data().nameAr]));
                const fetchedProjects = projSnap.docs.map(d => ({ ...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId) } as ClientTransaction & { clientName: string }));
                setProjects(fetchedProjects.filter(p => p.clientName));
            } catch(e) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات المرجعية.' });
            } finally {
                setLoadingRefs(false);
            }
        };
        fetchRefData();
    }, [firestore, toast]);

    useEffect(() => {
        if (issueType !== 'project_site' || !selectedProjectId || !firestore) {
            setBoqItems([]);
            return;
        }
        setLoadingBoq(true);
        const fetchBoq = async () => {
            try {
                const project = projects.find(p => p.id === selectedProjectId);
                if (!project || !project.boqId) {
                    setBoqItems([]);
                    return;
                }
                const itemsSnap = await getDocs(query(collection(firestore, `boqs/${project.boqId}/items`), orderBy('itemNumber')));
                const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as BoqItem));
                setBoqItems(items.filter(i => !i.isHeader));
            } catch (error) {
                console.error("Error fetching BOQ:", error);
            } finally {
                setLoadingBoq(false);
            }
        }
        fetchBoq();
    }, [selectedProjectId, firestore, projects, issueType]);

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: `${p.clientName} - ${p.transactionType}` })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const warehouseOptions = useMemo(() => warehouses.map(w => ({ value: w.id!, label: w.name })), [warehouses]);
    const boqItemOptions = useMemo(() => boqItems.map(i => ({ value: i.id!, label: `${i.itemNumber} - ${i.description}` })), [boqItems]);
    const itemOptions = useMemo(() => allItems.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [allItems]);

    const getFilteredItemOptions = useCallback((boqItemId?: string) => {
        if (!boqItemId) return itemOptions;
        const boqItem = boqItems.find(i => i.id === boqItemId);
        if (!boqItem || !boqItem.itemId) return itemOptions;
        const allowedCategoryIds = new Set(categories.filter(cat => cat.boqReferenceItemIds?.includes(boqItem.itemId!)).map(c => c.id));
        return allItems.filter(item => allowedCategoryIds.has(item.categoryId)).map(i => ({ value: i.id!, label: i.name, searchKey: i.sku }));
    }, [boqItems, allItems, categories, itemOptions]);


    const onSubmit = async (data: IssueFormValues) => {
        if (!firestore || !currentUser) return;
        const inventoryAccount = accounts.find(a => a.code === '1104');
        const expenseCode = data.issueType === 'project_site' ? '5104' : '5101';
        const projectExpenseAccount = accounts.find(a => a.code === expenseCode) || accounts.find(a => a.code === '51');

        if (!inventoryAccount || !projectExpenseAccount) {
            toast({ variant: 'destructive', title: 'خطأ محاسبي', description: 'حسابات المخزون أو التكاليف غير معرفة.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'materialIssues');
                const counterDoc = await transaction.get(counterRef);
                const nextNumber = ((counterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                const issueNumber = `MI-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newIssueRef = doc(collection(firestore, 'inventoryAdjustments'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                let autoTags = {};
                let narration = '';
                let projectInfo = null;
                let clientInfo = null;

                if (data.issueType === 'project_site') {
                    projectInfo = projects.find(p => p.id === data.projectId);
                    const engineer = employees.find(e => e.id === projectInfo?.assignedEngineerId);
                    const department = departments.find(d => d.name === engineer?.department);
                    narration = `صرف مواد لمشروع: ${projectInfo?.transactionType} (${data.notes || ''})`;
                    autoTags = { clientId: projectInfo?.clientId, transactionId: data.projectId, auto_profit_center: data.projectId, auto_resource_id: projectInfo?.assignedEngineerId, ...(department && { auto_dept_id: department.id }) };
                } else {
                    clientInfo = clients.find(c => c.id === data.clientId);
                    narration = `تسليم بضاعة مباعة للعميل: ${clientInfo?.nameAr} (${data.notes || ''})`;
                    autoTags = { clientId: data.clientId };
                }

                const processedItems = data.items.map(item => {
                    const selectedItem = allItems.find(i => i.id === item.itemId)!;
                    let warrantyEndDate = null;
                    if (selectedItem.warrantyMonths && selectedItem.warrantyMonths > 0) {
                        warrantyEndDate = addMonths(data.date, selectedItem.warrantyMonths);
                    }

                    return {
                        itemId: item.itemId,
                        itemName: selectedItem.name,
                        quantity: Number(item.quantity),
                        unitCost: Number(item.unitCost),
                        totalCost: Number(item.quantity) * Number(item.unitCost),
                        boqItemId: item.boqItemId || null,
                        warrantyEndDate: warrantyEndDate ? Timestamp.fromDate(warrantyEndDate) : null,
                    };
                });

                transaction.set(newIssueRef, cleanFirestoreData({
                    adjustmentNumber: issueNumber,
                    date: data.date,
                    type: 'material_issue',
                    issueType: data.issueType,
                    notes: data.notes,
                    items: processedItems,
                    projectId: data.projectId || null,
                    projectName: projectInfo?.projectName || null,
                    clientId: data.clientId || projectInfo?.clientId || null,
                    clientName: clientInfo?.nameAr || projectInfo?.clientName || null,
                    warehouseId: data.warehouseId,
                    journalEntryId: newJournalEntryRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(newJournalEntryRef, cleanFirestoreData({
                    entryNumber: `JE-${issueNumber}`,
                    date: data.date,
                    narration,
                    status: 'posted',
                    totalDebit: totalCost,
                    totalCredit: totalCost,
                    lines: [
                        { accountId: projectExpenseAccount.id!, accountName: projectExpenseAccount.name, debit: totalCost, credit: 0, ...autoTags },
                        { accountId: inventoryAccount.id!, accountName: inventoryAccount.name, debit: 0, credit: totalCost }
                    ],
                    clientId: data.clientId || projectInfo?.clientId || null,
                    transactionId: data.projectId || null,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                }));

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح', description: 'تم حفظ إذن الصرف وتحديث الكفالات آلياً.' });
            router.push('/dashboard/warehouse/material-issue');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ إذن الصرف.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="flex justify-center p-4 bg-primary/5 rounded-2xl border-2 border-primary/10">
                <Controller
                    control={control}
                    name="issueType"
                    render={({ field }) => (
                        <div className="flex gap-4">
                            <Button type="button" variant={field.value === 'project_site' ? 'default' : 'outline'} onClick={() => field.onChange('project_site')} className="rounded-xl font-bold">
                                <Building2 className="ml-2 h-4 w-4" /> صرف لمشروع إنشائي
                            </Button>
                            <Button type="button" variant={field.value === 'direct_sale' ? 'default' : 'outline'} onClick={() => field.onChange('direct_sale')} className="rounded-xl font-bold">
                                <ShoppingCart className="ml-2 h-4 w-4" /> تسليم بضاعة مباعة
                            </Button>
                        </div>
                    )}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/30 p-6 rounded-2xl border border-primary/10">
                {issueType === 'project_site' ? (
                    <div className="grid gap-2">
                        <Label className="font-bold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary"/> المشروع (مركز التكلفة) *</Label>
                        <Controller control={control} name="projectId" render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={projectOptions} placeholder="اختر المشروع..." disabled={loadingRefs || isSaving} />
                        )} />
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary"/> العميل المستلم *</Label>
                        <Controller control={control} name="clientId" render={({ field }) => (
                            <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." disabled={clientsLoading || isSaving} />
                        )} />
                    </div>
                )}
                <div className="grid gap-2">
                    <Label className="font-bold">المستودع المصدر *</Label>
                    <Controller control={control} name="warehouseId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={warehouseOptions} placeholder="اختر المستودع..." disabled={warehousesLoading || isSaving} />
                    )} />
                </div>
                <div className="grid gap-2">
                    <Label className="font-bold">تاريخ الصرف</Label>
                    <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving}/>} />
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-black flex items-center gap-2"><Search className="h-5 w-5 text-primary"/> بنود الصرف</h3>
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14 border-b-2">
                                <TableHead className="w-[60px]"></TableHead>
                                {issueType === 'project_site' && <TableHead className="w-[250px] font-bold">بند المقايسة (BOQ)</TableHead>}
                                <TableHead className="font-bold">الصنف المصروف</TableHead>
                                <TableHead className="w-32 text-center font-bold">الكمية</TableHead>
                                <TableHead className="w-40 text-left font-bold px-6">إجمالي التكلفة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => {
                                const lineItem = watchedItems?.[index];
                                const lineTotal = (Number(lineItem?.quantity) || 0) * (Number(lineItem?.unitPrice) || 0);
                                const allowedItems = getFilteredItemOptions(lineItem?.boqItemId);
                                const selectedItemInfo = allItems.find(i => i.id === lineItem?.itemId);

                                return (
                                    <TableRow key={field.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 h-20">
                                        <TableCell className="text-center">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive hover:bg-destructive/10 rounded-full">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                        {issueType === 'project_site' && (
                                            <TableCell>
                                                <Controller control={control} name={`items.${index}.boqItemId`} render={({ field: boqField }) => (
                                                    <InlineSearchList value={boqField.value || ''} onSelect={(val) => { boqField.onChange(val); setValue(`items.${index}.itemId`, ''); }} options={boqItemOptions} placeholder="اختر بند المقايسة..." disabled={loadingBoq || !selectedProjectId} className="border-none shadow-none focus-visible:ring-0 text-sm font-semibold" />
                                                )} />
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Controller control={control} name={`items.${index}.itemId`} render={({ field: itemField }) => (
                                                <div className="flex flex-col gap-1">
                                                    <InlineSearchList value={itemField.value} onSelect={(val) => { itemField.onChange(val); const itemData = allItems.find(i => i.id === val); if (itemData) setValue(`items.${index}.unitCost`, itemData.costPrice || 0); }} options={allowedItems} placeholder="اختر مادة..." disabled={(issueType === 'project_site' && !lineItem?.boqItemId) || isSaving} className="border-none shadow-none focus-visible:ring-0 text-lg font-bold" />
                                                    {selectedItemInfo?.warrantyMonths && selectedItemInfo.warrantyMonths > 0 && (
                                                        <div className="px-3 flex items-center gap-1 text-[10px] text-primary font-bold">
                                                            <ShieldCheck className="h-3 w-3" /> كفالة لمدة {selectedItemInfo.warrantyMonths} شهر
                                                        </div>
                                                    )}
                                                </div>
                                            )} />
                                        </TableCell>
                                        <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center border-none shadow-none text-xl font-black font-mono focus-visible:ring-0" /></TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-6 bg-muted/5">{formatCurrency(lineTotal)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="h-20 border-t-4 border-primary/20">
                                <TableCell colSpan={issueType === 'project_site' ? 4 : 3} className="text-right px-8 font-black text-xl">إجمالي قيمة التكلفة المنصرفة:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-primary px-6 border-r bg-primary/5">{formatCurrency(totalCost)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
            
            <div className="flex justify-center">
                <Button type="button" variant="secondary" onClick={() => append({ boqItemId: '', itemId: '', quantity: 1, unitCost: 0 })} className="h-12 px-8 rounded-xl font-bold gap-2">
                    <PlusCircle className="ml-2 h-5 w-5" /> إضافة سطر صرف جديد
                </Button>
            </div>

            <div className="grid gap-3">
                <Label htmlFor="notes" className="font-bold text-muted-foreground pr-2">ملاحظات الإذن</Label>
                <Textarea id="notes" {...register('notes')} placeholder="تفاصيل إضافية..." className="rounded-2xl border-2" rows={3}/>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20">
                    {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin"/> : <Save className="ml-3 h-5 w-5"/>}
                    حفظ وترحيل التكلفة
                </Button>
            </div>
        </form>
    );
}
