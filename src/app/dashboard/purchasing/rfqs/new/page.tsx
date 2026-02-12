
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Vendor, Item, RequestForQuotation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';
import { cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

const itemSchema = z.object({
  id: z.string().optional(),
  internalItemId: z.string().min(1, 'الصنف مطلوب.'),
  itemName: z.string().optional(),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0.01, "الكمية مطلوبة")),
});

const rfqSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  vendorIds: z.array(z.string()).min(1, 'يجب اختيار مورد واحد على الأقل.'),
  items: z.array(itemSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type RfqFormValues = z.infer<typeof rfqSchema>;

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function NewRfqPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [rfqNumber, setRfqNumber] = useState('جاري التوليد...');
    const [isSaving, setIsSaving] = useState(false);

    const { data: vendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', [orderBy('name')]);
    const { data: items, loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);

    const { register, handleSubmit, control, formState: { errors }, watch } = useForm<RfqFormValues>({
        resolver: zodResolver(rfqSchema),
        defaultValues: {
            date: new Date(),
            vendorIds: [],
            items: [{ id: generateId(), internalItemId: '', quantity: 1 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const loading = vendorsLoading || itemsLoading;

    useEffect(() => {
        if (!firestore) return;
        const generateRfqNumber = async () => {
            try {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'rfqs');
                const counterDoc = await getDoc(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                setRfqNumber(`RFQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
            } catch (error) {
                setRfqNumber('خطأ');
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في توليد رقم الطلب.' });
            }
        };
        generateRfqNumber();
    }, [firestore, toast]);

    const vendorOptions: MultiSelectOption[] = useMemo(() => (vendors || []).map(v => ({ value: v.id!, label: v.name })), [vendors]);
    const itemOptions = useMemo(() => (items || []).map(i => ({ value: i.id!, label: i.name, searchKey: i.sku })), [items]);

    const onSubmit = async (data: RfqFormValues) => {
        if (!firestore || !currentUser || loading) return;
        setIsSaving(true);
        let newRfqId = '';
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'rfqs');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                const newRfqNumber = `RFQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newRfqRef = doc(collection(firestore, 'rfqs'));
                newRfqId = newRfqRef.id;
                
                const processedItems = data.items.map(item => {
                    const selectedItem = items.find(i => i.id === item.internalItemId);
                    return {
                        id: generateId(),
                        internalItemId: item.internalItemId,
                        itemName: selectedItem?.name || 'Unknown',
                        quantity: Number(item.quantity)
                    };
                });
                
                const rfqData: Omit<RequestForQuotation, 'id'> = {
                    rfqNumber: newRfqNumber,
                    date: data.date,
                    vendorIds: data.vendorIds,
                    items: processedItems,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                };

                transaction.set(newRfqRef, cleanFirestoreData(rfqData));
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });
            
            toast({ title: 'نجاح', description: 'تم إنشاء طلب التسعير كمسودة.' });
            router.push('/dashboard/purchasing/rfqs');
        } catch (error) {
            console.error("Error creating RFQ:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء طلب التسعير.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>طلب تسعير جديد (RFQ)</CardTitle>
                            <CardDescription>أرسل طلبًا لعدة موردين للحصول على أفضل سعر.</CardDescription>
                        </div>
                        <div className="text-right">
                            <Label>رقم الطلب</Label>
                            <div className="font-mono text-lg font-semibold h-7">
                                {loading ? <Skeleton className="h-6 w-24" /> : rfqNumber}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label>التاريخ <span className="text-destructive">*</span></Label>
                            <Controller
                                name="date"
                                control={control}
                                render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
                            />
                            {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label>الموردون <span className="text-destructive">*</span></Label>
                            <Controller
                                name="vendorIds"
                                control={control}
                                render={({ field }) => (
                                    <MultiSelect
                                        options={vendorOptions}
                                        selected={field.value}
                                        onChange={field.onChange}
                                        placeholder={loading ? 'تحميل...' : 'اختر موردًا أو أكثر...'}
                                        disabled={loading}
                                    />
                                )}
                            />
                            {errors.vendorIds && <p className="text-xs text-destructive">{errors.vendorIds.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Label className="mb-2 block">الأصناف المطلوبة</Label>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-3/5">الصنف</TableHead>
                                        <TableHead>الكمية</TableHead>
                                        <TableHead className="w-[50px]"><span className="sr-only">حذف</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>
                                                <Controller
                                                    name={`items.${index}.internalItemId`}
                                                    control={control}
                                                    render={({ field }) => (
                                                        <InlineSearchList
                                                            value={field.value}
                                                            onSelect={field.onChange}
                                                            options={itemOptions}
                                                            placeholder={loading ? 'تحميل...' : 'اختر صنفًا...'}
                                                            disabled={loading}
                                                        />
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr" />
                                            </TableCell>
                                            <TableCell>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                         <div className="flex justify-start mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ id: generateId(), internalItemId: '', quantity: 1 })}>
                                <PlusCircle className="ml-2 h-4 w-4" />
                                إضافة صنف
                            </Button>
                         </div>
                    </div>
                    {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
