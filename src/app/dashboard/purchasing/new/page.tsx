
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Save, X, Loader2, PlusCircle, Trash2, Building2, Target } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, runTransaction, doc, getDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import type { Vendor, PurchaseOrder, ConstructionProject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useAuth } from '@/context/auth-context';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';

const itemSchema = z.object({
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0.01, "الكمية مطلوبة")),
  unitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0, "السعر مطلوب")),
});

const purchaseOrderSchema = z.object({
  vendorId: z.string().min(1, "المورد مطلوب"),
  projectId: z.string().optional().nullable(),
  orderDate: z.date({ required_error: 'تاريخ الطلب مطلوب' }),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

export default function NewPurchaseOrderPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [projects, setProjects] = useState<ConstructionProject[]>([]);
    const [loadingRefs, setLoadingRefs] = useState(true);
    const [poNumber, setPoNumber] = useState('جاري التوليد...');
    const [isSaving, setIsSaving] = useState(false);

    const { register, handleSubmit, control, formState: { errors }, reset, setValue } = useForm<PurchaseOrderFormValues>({
        resolver: zodResolver(purchaseOrderSchema),
        mode: 'onChange',
        defaultValues: {
            orderDate: new Date(),
            items: [{ description: '', quantity: 1, unitPrice: 0 }],
            projectId: null,
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
                const [vendorsSnap, projectsSnap, counterSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'vendors'), orderBy('name'))),
                    getDocs(query(collection(firestore, 'projects'), orderBy('projectName'))),
                    getDoc(doc(firestore, 'counters', 'purchaseOrders'))
                ]);

                setVendors(vendorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
                setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConstructionProject)));
                
                const currentYear = new Date().getFullYear();
                let nextNumber = 1;
                if (counterSnap.exists()) {
                    const counts = counterDoc.data()?.counts || {};
                    nextNumber = (counts[currentYear] || 0) + 1;
                }
                setPoNumber(`PO-${currentYear}-${String(nextNumber).padStart(4, '0')}`);

                const preselectedProjectId = searchParams.get('projectId');
                if (preselectedProjectId) {
                    setValue('projectId', preselectedProjectId);
                }

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات الأولية.' });
            } finally {
                setLoadingRefs(false);
            }
        };
        fetchInitialData();
    }, [firestore, toast, setValue, searchParams]);

    const vendorOptions = useMemo(() => vendors.map(v => ({ value: v.id!, label: v.name, searchKey: v.contactPerson })), [vendors]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.projectName, searchKey: p.projectId })), [projects]);

    const onSubmit = async (data: PurchaseOrderFormValues) => {
        if (!firestore || !currentUser || loadingRefs) return;
        setIsSaving(true);
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
                
                const vendor = vendors.find(v => v.id === data.vendorId);
                
                const processedItems = data.items.map(item => ({
                    ...item,
                    total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
                }));
                const totalAmount = processedItems.reduce((sum, item) => sum + item.total, 0);

                const poData: Omit<PurchaseOrder, 'id'> = {
                    poNumber: newPoNumber,
                    orderDate: data.orderDate,
                    vendorId: data.vendorId,
                    vendorName: vendor?.name || '',
                    projectId: data.projectId || null,
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
            
            toast({ title: 'نجاح', description: 'تم إنشاء أمر الشراء بنجاح.' });
            if (data.projectId) {
                router.push(`/dashboard/construction/projects/${data.projectId}`);
            } else {
                router.push('/dashboard/purchasing/purchase-orders');
            }

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
                            <CardDescription>أدخل تفاصيل أمر الشراء للمورد وحدد مركز التكلفة المراد التحميل عليه.</CardDescription>
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
                                render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
                            />
                            {errors.orderDate && <p className="text-xs text-destructive">{errors.orderDate.message}</p>}
                        </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-primary/5 flex items-center gap-4">
                        <div className="bg-primary/10 p-2 rounded-lg"><Target className="text-primary h-5 w-5" /></div>
                        <div className="grid gap-2 flex-grow">
                            <Label className="font-bold">مركز التكلفة المستهدف (مشروع)</Label>
                            <Controller
                                control={control}
                                name="projectId"
                                render={({ field }) => (
                                    <InlineSearchList 
                                        value={field.value || ''} 
                                        onSelect={field.onChange} 
                                        options={projectOptions}
                                        placeholder="اختر المشروع لربط التكاليف مستقبلاً..."
                                        disabled={loadingRefs}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="mb-2 block font-bold">بنود التوريد</Label>
                        <div className="border rounded-xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
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
                                            <TableCell><Input {...register(`items.${index}.description`)} placeholder="وصف البند..." className="border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr text-center border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell><Input type="number" step="0.001" {...register(`items.${index}.unitPrice`)} className="dir-ltr text-center border-none shadow-none focus-visible:ring-0" /></TableCell>
                                            <TableCell className="text-left font-mono font-bold">{formatCurrency(lineTotal)}</TableCell>
                                            <TableCell>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                                <TableFooter className="bg-muted/20">
                                    <TableRow>
                                        <TableCell colSpan={3} className="font-black text-lg py-6 px-8">المجموع الإجمالي لأمر الشراء:</TableCell>
                                        <TableCell className="font-black font-mono text-xl text-left text-primary px-3">{formatCurrency(totalAmount)}</TableCell>
                                        <TableCell />
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <div className="flex justify-start mt-4">
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })} className="rounded-xl">
                                <PlusCircle className="ml-2 h-4 w-4" />
                                إضافة بند جديد
                            </Button>
                        </div>
                    </div>
                    {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                        <div className="grid gap-2">
                            <Label htmlFor="paymentTerms">شروط الدفع</Label>
                            <Input id="paymentTerms" {...register('paymentTerms')} placeholder="مثال: آجل 30 يوم" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات إضافية</Label>
                            <Textarea id="notes" {...register('notes')} rows={3} placeholder="أي تعليمات خاصة للمورد..." />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 p-8 border-t bg-muted/10">
                    <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || loadingRefs} className="h-12 px-12 rounded-xl font-black text-lg shadow-lg shadow-primary/20">
                        {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin"/> : <Save className="ml-3 h-5 w-5"/>}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ وإرسال'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
