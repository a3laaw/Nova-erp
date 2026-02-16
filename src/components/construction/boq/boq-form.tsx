'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import type { Boq, BoqItem } from '@/lib/types';
import Link from 'next/link';

const itemSchema = z.object({
  id: z.string(),
  itemNumber: z.string(),
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string().min(1, "الوحدة مطلوبة."),
  plannedQuantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  plannedUnitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
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

    const { register, handleSubmit, control, watch, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: [{ id: '1', itemNumber: '1.0', description: '', unit: '', plannedQuantity: 1, plannedUnitPrice: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');

    const totalValue = useMemo(() =>
        watchedItems.reduce((sum, item) => sum + (item.plannedQuantity * item.plannedUnitPrice), 0),
    [watchedItems]);

    const addBoqItem = () => {
        const lastItemNumber = fields.length > 0 ? parseFloat(fields[fields.length - 1].itemNumber) : 0;
        const newItemNumber = (lastItemNumber + 1).toFixed(1);
        append({
            id: new Date().toISOString(),
            itemNumber: newItemNumber,
            description: '',
            unit: '',
            plannedQuantity: 1,
            plannedUnitPrice: 0,
        });
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

                const itemsBatch = writeBatch(firestore); // Use a new batch for subcollection writes
                data.items.forEach(item => {
                    const itemRef = doc(collection(firestore, `boqs/${boqRef.id}/items`));
                    itemsBatch.set(itemRef, { ...item, id: undefined });
                });
                
                // Committing the items batch needs to be handled after the transaction
                // This is a limitation. A better way is to do this in a server-side function.
                // For now, we will commit it after.
                
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });
            // This is not transactional with the main BOQ creation, but it's the best we can do on the client.
            const tempBoqRef = doc(collection(firestore, 'boqs')); // Create a temp ref to get an ID for the items path
            const itemsBatch = writeBatch(firestore);
             data.items.forEach(item => {
                const itemRef = doc(collection(firestore, `boqs/${tempBoqRef.id}/items`));
                 itemsBatch.set(itemRef, { ...item, id: undefined });
             });
            await itemsBatch.commit();


            toast({ title: 'نجاح', description: 'تم إنشاء جدول الكميات بنجاح.' });
            router.push('/dashboard/construction/boq');

        } catch (error) {
            console.error("Error creating BOQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء جدول الكميات.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
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
                        <TableHeader><TableRow><TableHead>رقم البند</TableHead><TableHead className="w-2/5">وصف البند</TableHead><TableHead>الوحدة</TableHead><TableHead>الكمية</TableHead><TableHead>سعر الوحدة</TableHead><TableHead className="text-left">الإجمالي</TableHead><TableHead/></TableRow></TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id}>
                                    <TableCell><Input {...register(`items.${index}.itemNumber`)} className="w-20"/></TableCell>
                                    <TableCell><Textarea {...register(`items.${index}.description`)} rows={1}/></TableCell>
                                    <TableCell><Input {...register(`items.${index}.unit`)} className="w-24"/></TableCell>
                                    <TableCell><Input type="number" {...register(`items.${index}.plannedQuantity`)} className="w-24 dir-ltr"/></TableCell>
                                    <TableCell><Input type="number" {...register(`items.${index}.plannedUnitPrice`)} className="w-24 dir-ltr"/></TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency((watchedItems[index]?.plannedQuantity || 0) * (watchedItems[index]?.plannedUnitPrice || 0))}</TableCell>
                                    <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter><TableRow className="bg-muted text-base font-bold"><TableCell colSpan={5}>الإجمالي</TableCell><TableCell colSpan={2} className="text-left font-mono">{formatCurrency(totalValue)}</TableCell></TableRow></TableFooter>
                    </Table>
                </div>
                 {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                <Button type="button" variant="outline" onClick={addBoqItem}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند</Button>
            </div>
             <div className="mt-6 pt-6 border-t flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
            </div>
        </form>
    );
}

