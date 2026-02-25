
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, Building2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy, collectionGroup } from 'firebase/firestore';
import type { Item, ClientTransaction, Account, InventoryAdjustment, Employee, Department } from '@/lib/types';
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

const issueSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  projectId: z.string().min(1, "يجب تحديد المشروع (مركز التكلفة)."),
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

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);

    const { register, handleSubmit, control, watch, formState: { errors } } = useForm<IssueFormValues>({
        resolver: zodResolver(issueSchema),
        defaultValues: {
            date: new Date(),
            items: [{ itemId: '', quantity: 1, unitCost: 0 }],
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = watch("items");

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
                setProjects(projSnap.docs.map(d => ({...d.data(), id: d.id, clientName: clientMap.get(d.data().clientId)} as ClientTransaction & { clientName: string }));
            } catch(e) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات المرجعية.' });
            } finally {
                setLoadingRefs(false);
            }
        };
        fetchRefData();
    }, [firestore, toast]);

    const onSubmit = async (data: IssueFormValues) => {
        if (!firestore || !currentUser) return;
        
        const inventoryAccount = accounts.find(a => a.code === '1104');
        // We look for code 5104 (Direct Materials) or fallback to 51 (Direct Costs)
        const projectExpenseAccount = accounts.find(a => a.code === '5104') || accounts.find(a => a.code === '51');

        if (!inventoryAccount || !projectExpenseAccount) {
            toast({ variant: 'destructive', title: 'خطأ محاسبي', description: 'لم يتم العثور على حساب المخزون أو حساب مصاريف المشروع.' });
            return;
        }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'materialIssues');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const issueNumber = `MI-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newIssueRef = doc(collection(firestore, 'inventoryAdjustments'));
                const newJournalEntryRef = doc(collection(firestore, 'journalEntries'));

                const project = projects.find(p => p.id === data.projectId);
                const engineer = employees.find(e => e.id === project?.assignedEngineerId);
                const department = departments.find(d => d.name === engineer?.department);

                const autoTags = {
                    clientId: project?.clientId,
                    transactionId: data.projectId,
                    auto_profit_center: data.projectId,
                    auto_resource_id: project?.assignedEngineerId,
                    ...(department && { auto_dept_id: department.id }),
                };

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

                const issueData: Omit<InventoryAdjustment, 'id'> = {
                    adjustmentNumber: issueNumber,
                    date: data.date,
                    type: 'material_issue',
                    notes: data.notes,
                    items: processedItems,
                    projectId: data.projectId,
                    journalEntryId: newJournalEntryRef.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };
                
                const jeData = {
                    entryNumber: `JE-${issueNumber}`,
                    date: data.date,
                    narration: `صرف مواد لمشروع: ${project?.transactionType} (${data.notes || ''})`,
                    status: 'posted',
                    totalDebit: totalCost,
                    totalCredit: totalCost,
                    lines: [
                        { accountId: projectExpenseAccount.id, accountName: projectExpenseAccount.name, debit: totalCost, credit: 0, ...autoTags },
                        { accountId: inventoryAccount.id, accountName: inventoryAccount.name, debit: 0, credit: totalCost }
                    ],
                    clientId: project?.clientId,
                    transactionId: data.projectId,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                };

                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
                transaction.set(newIssueRef, cleanFirestoreData(issueData));
                transaction.set(newJournalEntryRef, cleanFirestoreData(jeData));
            });

            toast({ title: 'نجاح', description: 'تم حفظ إذن الصرف وتحميل التكلفة على المشروع.' });
            router.push('/dashboard/warehouse/material-issue');

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ إذن الصرف.' });
        } finally {
            setIsSaving(false);
        }
    };

    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: `${p.clientName} - ${p.transactionType}` })), [projects]);
    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                    <Label>المشروع (مركز التكلفة) <span className="text-destructive">*</span></Label>
                    <Controller
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                            <InlineSearchList 
                                value={field.value} 
                                onSelect={field.onChange} 
                                options={projectOptions}
                                placeholder={loadingRefs ? "تحميل..." : "اختر المشروع..."}
                                disabled={loadingRefs}
                            />
                        )}
                    />
                    {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message}</p>}
                </div>
                <div className="grid gap-2">
                    <Label>تاريخ الصرف</Label>
                    <Controller
                        name="date"
                        control={control}
                        render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
                    />
                </div>
            </div>

            <div className="border rounded-xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-2/5">الصنف</TableHead>
                            <TableHead className="w-1/6">الكمية</TableHead>
                            <TableHead className="w-1/6">متوسط التكلفة</TableHead>
                            <TableHead className="text-left">الإجمالي</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => {
                            const lineItem = watchedItems?.[index];
                            const lineTotal = (Number(lineItem?.quantity) || 0) * (Number(lineItem?.unitCost) || 0);
                            return (
                                <TableRow key={field.id}>
                                    <TableCell>
                                        <Controller
                                            control={control}
                                            name={`items.${index}.itemId`}
                                            render={({ field: itemField }) => (
                                                <InlineSearchList 
                                                    value={itemField.value} 
                                                    onSelect={(val) => {
                                                        itemField.onChange(val);
                                                        const itemData = items.find(i => i.id === val);
                                                        if (itemData) setValue(`items.${index}.unitCost`, itemData.costPrice || 0);
                                                    }}
                                                    options={itemOptions}
                                                    placeholder="اختر صنف..."
                                                />
                                            )}
                                        />
                                    </TableCell>
                                    <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center" /></TableCell>
                                    <TableCell><Input type="number" step="0.001" {...register(`items.${index}.unitCost`)} className="dir-ltr text-center" /></TableCell>
                                    <TableCell className="text-left font-mono font-bold">{formatCurrency(lineTotal)}</TableCell>
                                    <TableCell>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                    <TableFooter className="bg-muted/20">
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold py-4">إجمالي قيمة المواد المصروفة:</TableCell>
                            <TableCell className="text-left font-bold font-mono text-lg text-primary">{formatCurrency(totalCost)}</TableCell>
                            <TableCell />
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            
            <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: '', quantity: 1, unitCost: 0 })}>
                <PlusCircle className="ml-2 h-4 w-4" /> إضافة صنف آخر
            </Button>

            <div className="grid gap-2">
                <Label htmlFor="notes">ملاحظات الإذن</Label>
                <Textarea id="notes" {...register('notes')} placeholder="أي تفاصيل إضافية عن سبب الصرف أو الجهة المستلمة..." />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    حفظ وترحيل التكلفة
                </Button>
            </div>
        </form>
    );
}
