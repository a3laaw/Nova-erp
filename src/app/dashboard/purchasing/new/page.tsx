'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Vendor, PurchaseOrder } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';

const itemSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0.01, "الكمية مطلوبة")),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0, "السعر مطلوب")),
});

const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, "المورد مطلوب"),
  orderDate: z.string().min(1, "تاريخ الطلب مطلوب"),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export default function NewPurchaseOrderPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loadingRefs, setLoadingRefs] = useState(true);
    const [poNumber, setPoNumber] = useState('جاري التوليد...');
    const [isSaving, setIsSaving] = useState(false);

    const { register, handleSubmit, control, formState: { errors } } = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema),
        mode: 'onChange',
        defaultValues: {
            orderDate: new Date().toISOString().split('T')[0],
            items: [{ description: '', quantity: 1, unitPrice: 0 }],
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: "items" });
    const watchedItems = useWatch({ control, name: "items" });
    const totalAmount = useMemo(() =>
        (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0),
        [watchedItems]
    );

    useEffect(() => {
        if (!firestore) return;
        
        const fetchInitialData = async () => {
            setLoadingRefs(true);
            try {
                const [vendorsSnap, counterSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'vendors'), orderBy('name'))),
                    getDoc(doc(firestore, 'counters', 'purchaseOrders'))
                ]);

                setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
                
                const currentYear = new Date().getFullYear();
                let nextNumber = 1;
                if (counterSnap.exists()) {
                    const counts = counterSnap.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                setPoNumber(`PO-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات الأولية.' });
            } finally {
                setLoadingRefs(false);
            }
        };
        fetchInitialData();
    }, [firestore, toast]);

    const vendorOptions = useMemo(() => vendors.map(v => ({ value: v.id!, label: v.name, searchKey: v.contactPerson })), [vendors]);

    const onSubmit = async (data: PurchaseOrderFormValues) => {
        if (!firestore || !currentUser || loadingRefs) return;
        setIsSaving(true);
        let newPoId = '';
        try {
            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const counterRef = doc(firestore, 'counters', 'purchaseOrders');
                const counterDoc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (counterDoc.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                
                const newPoNumber = `PO-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
                
                const newPoRef = doc(collection(firestore, 'purchaseOrders'));
                newPoId = newPoRef.id;
                
                const vendor = vendors.find(v => v.id === data.vendorId);
                
                const processedItems = data.items.map(item => ({
                    ...item,
                    total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                }));
                const totalAmount = processedItems.reduce((sum, item) => sum + item.total, 0);

                const poData: Omit<PurchaseOrder, 'id'> = {
                    poNumber: newPoNumber,
                    orderDate: new Date(data.orderDate),
                    vendorId: data.vendorId,
                    vendorName: vendor?.name || '',
                    items: processedItems,
                    totalAmount,
                    paymentTerms: data.paymentTerms,
                    notes: data.notes,
                    status: 'draft',
                    createdAt: serverTimestamp(),
                };

                transaction.set(newPoRef, cleanFirestoreData(poData));
                transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });
            
            toast({ title: 'نجاح', description: 'تم إنشاء أمر الشراء كمسودة.' });
            router.push('/dashboard/purchasing');

        } catch (error) {
            console.error("Error creating purchase order:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء أمر الشراء.' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>أمر شراء جديد</CardTitle>
                            <CardDescription>أدخل تفاصيل أمر الشراء للمورد.</CardDescription>
                        </div>
                        <div className="text-right">
                            <Label>رقم أمر الشراء</Label>
                            <div className="font-mono text-lg font-semibold h-7">
                                {loadingRefs ? <Skeleton className="h-6 w-24" /> : poNumber}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label>المورد <span className="text-destructive">*</span></Label>
                            <Controller
                                control={control}
                                name="vendorId"
                                render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value} 
                                        onSelect={field.onChange} 
                                        options={vendorOptions}
                                        placeholder={loadingRefs ? "تحميل..." : "اختر موردًا..."}
                                        disabled={loadingRefs}
                                    />
                                )}
                            />
                            {errors.vendorId && <p className="text-xs text-destructive">{errors.vendorId.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="orderDate">تاريخ الطلب <span className="text-destructive">*</span></Label>
                            <Controller
                                name="orderDate"
                                control={control}
                                render={({ field }) => <Input type="date" {...field} />}
                            />
                            {errors.orderDate && <p className="text-xs text-destructive">{errors.orderDate.message}</p>}
                        </div>
                    </div>

                    <div>
                        <Label className="mb-2 block">البنود</Label>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-2/5">الوصف</TableHead>
                                    <TableHead className="w-1/6">الكمية</TableHead>
                                    <TableHead className="w-1/6">سعر الوحدة</TableHead>
                                    <TableHead className="w-1/6 text-left">الإجمالي</TableHead>
                                    <TableHead className="w-[50px]"><span className="sr-only">حذف</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.map((field, index) => {
                                    const item = watchedItems?.[index] || {};
                                    const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
                                    return (
                                    <TableRow key={field.id}>
                                        <TableCell><Input {...register(`items.${index}.description`)} placeholder="وصف البند..."/></TableCell>
                                        <TableCell><Input type="number" {...register(`items.${index}.quantity`)} className="dir-ltr" /></TableCell>
                                        <TableCell><Input type="number" {...register(`items.${index}.unitPrice`)} className="dir-ltr" /></TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(lineTotal)}</TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={3} className="font-bold text-lg">الإجمالي</TableCell>
                                    <TableCell className="font-bold font-mono text-lg text-left">{formatCurrency(totalAmount)}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                        <div className="flex justify-start mt-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}>
                                <PlusCircle className="ml-2 h-4 w-4" />
                                إضافة بند
                            </Button>
                        </div>
                    </div>
                    {errors.items && <p className="text-xs text-destructive">{errors.items.message || errors.items.root?.message}</p>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="paymentTerms">شروط الدفع</Label>
                            <Input id="paymentTerms" {...register('paymentTerms')} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea id="notes" {...register('notes')} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loadingRefs}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
