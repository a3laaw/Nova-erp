'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, serverTimestamp, runTransaction, writeBatch, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import type { Boq, BoqItem, BoqReferenceItem } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const itemSchema = z.object({
  id: z.string(),
  itemNumber: z.string(),
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string().min(1, "الوحدة مطلوبة."),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  notes: z.string().optional(),
  parentId: z.string().nullable(),
  level: z.number(),
  isHeader: z.boolean(),
});

const boqFormSchema = z.object({
  name: z.string().min(1, "اسم جدول الكميات مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
});

type BoqFormValues = z.infer<typeof boqFormSchema>;

export function BoqForm() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);

    const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: [{ id: 'root-1', itemNumber: '1.0', description: '', unit: '', quantity: 0, sellingUnitPrice: 0, notes: '', parentId: null, level: 0, isHeader: false }]
        }
    });

    const { fields, append, remove, update } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');

    const totalValue = useMemo(() => {
        return watchedItems.reduce((sum, item) => {
            if (item.isHeader) return sum;
            return sum + ((item.quantity || 0) * (item.sellingUnitPrice || 0));
        }, 0);
    }, [watchedItems]);

    const handleAddItem = (isHeader: boolean, parentId: string | null = null) => {
        let level = 0;
        let parentNumber = '';
        if (parentId) {
            const parentIndex = fields.findIndex(f => f.id === parentId);
            if (parentIndex > -1) {
                level = fields[parentIndex].level + 1;
                parentNumber = fields[parentIndex].itemNumber + '.';
            }
        }
        
        const siblings = fields.filter(f => f.parentId === parentId);
        const newItemNumber = `${parentNumber}${siblings.length + 1}`;

        append({
            id: new Date().toISOString() + Math.random(),
            itemNumber: newItemNumber,
            description: '',
            unit: '',
            quantity: 0,
            sellingUnitPrice: 0,
            notes: '',
            parentId,
            level,
            isHeader,
        });
    };
    
    const handleMasterItemSelect = (index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            setValue(`items.${index}.description`, masterItem.name);
            setValue(`items.${index}.unit`, masterItem.unit || '');
        }
    };

    const onSubmit = async (data: BoqFormValues) => {
        if (!firestore || !user) return;
        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const counterRef = doc(firestore, 'counters', 'boqs');
                const counterDoc = await transaction.get(counterRef);
                const currentYear = new Date().getFullYear();
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data().counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const boqNumber = `BOQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const boqRef = doc(collection(firestore, 'boqs'));
                
                const finalItems = data.items.map(item => ({
                    ...item,
                    total: item.isHeader ? 0 : (item.quantity || 0) * (item.sellingUnitPrice || 0)
                }));
                const totalValue = finalItems.reduce((sum, item) => sum + item.total, 0);

                const boqData: Omit<Boq, 'id'> = {
                    boqNumber,
                    name: data.name,
                    status: data.status,
                    clientName: data.clientName,
                    totalValue,
                    itemCount: data.items.length,
                    createdAt: serverTimestamp(),
                };
                transaction.set(boqRef, boqData);
                
                // Firestore transactions don't support batched writes to subcollections easily.
                // We'll write the items after the transaction.
                // For full atomicity, a Cloud Function would be needed.
            });

            const q = query(collection(firestore, 'boqs'), orderBy('createdAt', 'desc'), limit(1));
            const boqSnap = await getDocs(q);
            if (!boqSnap.empty) {
                const newBoqId = boqSnap.docs[0].id;
                const itemsBatch = writeBatch(firestore);
                data.items.forEach(item => {
                   const { id, ...itemData } = item; // Exclude client-side id
                   const itemRef = doc(collection(firestore, `boqs/${newBoqId}/items`));
                   itemsBatch.set(itemRef, cleanFirestoreData(itemData));
                });
                await itemsBatch.commit();
            }

            toast({ title: 'نجاح', description: 'تم إنشاء جدول الكميات بنجاح.' });
            router.push('/dashboard/construction/boq');

        } catch (error) {
            console.error("Error creating BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء جدول الكميات.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const masterItemOptions = useMemo(() => masterItems.map(i => ({value: i.id!, label: i.name})), [masterItems]);

    return (
         <Card>
            <CardHeader>
                <CardTitle>إنشاء جدول كميات جديد</CardTitle>
                <CardDescription>أدخل تفاصيل جدول الكميات. يمكنك ربطه بعميل لاحقًا.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label htmlFor="name">اسم/مرجع جدول الكميات *</Label><Input id="name" {...register('name')} /></div>
                            <div className="grid gap-2"><Label htmlFor="clientName">اسم العميل (المحتمل)</Label><Input id="clientName" {...register('clientName')} /></div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label htmlFor="status">الحالة</Label>
                                <Controller name="status" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent></Select>
                                )}/>
                            </div>
                        </div>
                        
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader><TableRow><TableHead className="w-1/3">بيان الأعمال</TableHead><TableHead>الوحدة</TableHead><TableHead>الكمية</TableHead><TableHead>سعر الوحدة</TableHead><TableHead className="text-left">الإجمالي</TableHead><TableHead className="w-[100px]">الإجراءات</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => {
                                        const item = watchedItems[index] || {};
                                        const isLumpSum = item.unit === 'مقطوعية';
                                        const total = isLumpSum ? (item.sellingUnitPrice || 0) : (item.quantity || 0) * (item.sellingUnitPrice || 0);

                                        return (
                                        <TableRow key={field.id}>
                                            <TableCell style={{ paddingRight: `${item.level * 2}rem` }}>
                                                <InlineSearchList 
                                                    placeholder='اختر بندًا أو اكتب مباشرة...'
                                                    value={item.id}
                                                    onSelect={(val) => handleMasterItemSelect(index, val)}
                                                    options={masterItemOptions}
                                                />
                                                 <Textarea {...register(`items.${index}.description`)} rows={2} className="mt-1"/>
                                            </TableCell>
                                            <TableCell>
                                                <Input {...register(`items.${index}.unit`)} placeholder="م3، م2،..." />
                                            </TableCell>
                                            <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr" disabled={isLumpSum} /></TableCell>
                                            <TableCell><Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} className="dir-ltr" /></TableCell>
                                            <TableCell className="text-left font-mono">{formatCurrency(total)}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleAddItem(false, field.id)}><PlusCircle className="h-4 w-4"/></Button>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})
                                }
                                </TableBody>
                                <TableFooter><TableRow className="bg-muted text-base font-bold"><TableCell colSpan={4}>الإجمالي</TableCell><TableCell colSpan={2} className="text-left font-mono">{formatCurrency(totalValue)}</TableCell></TableRow></TableFooter>
                            </Table>
                        </div>
                        {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                        <Button type="button" variant="outline" onClick={() => handleAddItem(true, null)}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند رئيسي</Button>
                    </div>
                    <div className="mt-6 pt-6 border-t flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
