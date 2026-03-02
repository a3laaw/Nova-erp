
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
import { 
  Save, 
  Loader2, 
  PlusCircle, 
  Trash2, 
  ShoppingCart, 
  Target, 
  Calculator,
  X,
  Box
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import {
  collection,
  runTransaction,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import type { Vendor, PurchaseOrder, ConstructionProject, Item } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';
import { cleanFirestoreData, formatCurrency, cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';

const itemSchema = z.object({
  uid: z.string(),
  internalItemId: z.string().min(1, 'يجب اختيار مادة.'),
  description: z.string().min(1, 'الوصف مطلوب.'),
  quantity: z.preprocess(
    (v) => parseFloat(String(v || '0')),
    z.number().min(0.01, 'الكمية مطلوبة')
  ),
  unitPrice: z.preprocess(
    (v) => parseFloat(String(v || '0')),
    z.number().min(0, 'السعر مطلوب')
  ),
});

const poSchema = z.object({
  orderDate: z.date({ required_error: 'التاريخ مطلوب.' }),
  vendorId: z.string().min(1, 'المورد مطلوب.'),
  projectId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
});

type PoFormValues = z.infer<typeof poSchema>;

const generateStableId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * صفحة إنشاء أمر شراء جديد:
 * تم تحديثها بنظام الحماية ضد الحفظ المزدوج (Double Save Guard) عبر useRef و useState.
 */
export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [poNumber, setPoNumber] = useState('جاري التوليد...');
  const [poNumberLoaded, setPoNumberLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // نظام الحماية البرمجي لمنع التكرار
  const savingRef = useRef(false);

  // السجلات المرجعية
  const vendorConstraints = useMemo(() => [orderBy('name')], []);
  const projectConstraints = useMemo(() => [orderBy('projectName')], []);
  const itemConstraints = useMemo(() => [orderBy('name')], []);

  const { data: vendors, loading: vendorsLoading } = useSubscription<Vendor>(
    firestore,
    'vendors',
    vendorConstraints
  );
  const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(
    firestore,
    'projects',
    projectConstraints
  );
  const { data: items, loading: itemsLoading } = useSubscription<Item>(
    firestore,
    'items',
    itemConstraints
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<PoFormValues>({
    resolver: zodResolver(poSchema),
    defaultValues: {
      orderDate: new Date(),
      vendorId: '',
      projectId: searchParams.get('projectId') || null,
      items: [{ uid: generateStableId(), internalItemId: '', description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchedItems = useWatch({ control, name: 'items' });

  const totalAmount = useMemo(() => {
    return (watchedItems || []).reduce((sum, item) => 
      sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0
    );
  }, [watchedItems]);

  useEffect(() => {
    if (!firestore || poNumberLoaded) return;
    let cancelled = false;

    const generatePoNumber = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const counterRef = doc(firestore, 'counters', 'purchaseOrders');
        const counterDoc = await getDoc(counterRef);
        let nextNumber = 1;
        if (counterDoc.exists()) {
          const counts = counterDoc.data()?.counts || {};
          nextNumber = (counts[currentYear] || 0) + 1;
        }
        if (!cancelled) {
          setPoNumber(`PO-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
          setPoNumberLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setPoNumber('سيتم التوليد عند الحفظ');
          setPoNumberLoaded(true);
        }
      }
    };
    generatePoNumber();

    return () => {
      cancelled = true;
    };
  }, [firestore, poNumberLoaded]);

  const vendorOptions = useMemo(
    () => (vendors || []).map((v) => ({ value: v.id!, label: v.name, searchKey: v.contactPerson })),
    [vendors]
  );

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: p.id!, label: p.projectName, searchKey: p.projectId })),
    [projects]
  );

  const itemOptions = useMemo(
    () => (items || []).map((i) => ({ value: i.id!, label: i.name, searchKey: i.sku })),
    [items]
  );

  const onSubmit = async (data: PoFormValues) => {
    if (!firestore || !currentUser) return;
    
    // منع الحفظ المزدوج (Double Click Prevention)
    if (savingRef.current) return;
    savingRef.current = true;
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

        const processedItems = data.items.map((item) => ({
          internalItemId: item.internalItemId,
          itemName: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          total: Number(item.quantity) * Number(item.unitPrice),
        }));

        const poData = {
          poNumber: newPoNumber,
          orderDate: data.orderDate,
          vendorId: data.vendorId,
          vendorName: vendor?.name || 'Unknown',
          projectId: data.projectId,
          items: processedItems,
          totalAmount: processedItems.reduce((sum, i) => sum + i.total, 0),
          paymentTerms: data.paymentTerms,
          notes: data.notes,
          status: 'draft' as const,
          createdAt: serverTimestamp(),
        };

        transaction.set(newPoRef, cleanFirestoreData(poData));
        transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
      });

      toast({ title: 'نجاح', description: 'تم إنشاء أمر الشراء بنجاح.' });
      
      // التوجيه الفوري بعد نجاح العملية
      router.push('/dashboard/purchasing/purchase-orders');
    } catch (error) {
      console.error('Error creating PO:', error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء أمر الشراء.' });
      
      // إعادة تفعيل الأزرار في حال الفشل
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  const fullLoading = vendorsLoading || itemsLoading || projectsLoading;

  return (
    <Card className="max-w-5xl mx-auto rounded-3xl border-none shadow-xl overflow-hidden" dir="rtl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader className="bg-muted/30 pb-8 px-8 border-b">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <CardTitle className="text-3xl font-black tracking-tight text-foreground">أمر شراء جديد</CardTitle>
              </div>
              <CardDescription className="text-base font-medium pr-11">حدد المورد والمواد المطلوبة لإنشاء أمر شراء رسمي وربطه بالمشروع.</CardDescription>
            </div>
            <div className="text-left bg-background/50 px-4 py-2 rounded-2xl border shadow-inner">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">رقم الأمر (تقريبي)</Label>
              <div className="font-mono text-xl font-black text-primary">
                {!poNumberLoaded ? <Skeleton className="h-6 w-32" /> : poNumber}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-8">
          {/* Main Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                المورد المستهدف <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="vendorId"
                control={control}
                render={({ field }) => (
                  <InlineSearchList
                    value={field.value}
                    onSelect={field.onChange}
                    options={vendorOptions}
                    placeholder={vendorsLoading ? 'جاري تحميل الموردين...' : 'ابحث عن مورد...'}
                    disabled={vendorsLoading || isSaving}
                    className="h-11 rounded-xl border-2"
                  />
                )}
              />
              {errors.vendorId && <p className="text-xs text-destructive font-bold">{errors.vendorId.message}</p>}
            </div>

            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                تاريخ الطلب <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="orderDate"
                control={control}
                render={({ field }) => <DateInput value={field.value} onChange={field.onChange} disabled={isSaving} className="h-11 rounded-xl" />}
              />
              {errors.orderDate && <p className="text-xs text-destructive font-bold">{errors.orderDate.message}</p>}
            </div>
          </div>

          {/* Project Center Highlighting */}
          <div className="p-6 border-2 border-primary/10 bg-primary/5 rounded-3xl flex items-center gap-6 shadow-sm">
            <div className="bg-primary/10 p-4 rounded-2xl shadow-inner">
              <Target className="text-primary h-8 w-8" />
            </div>
            <div className="grid gap-2 flex-grow">
              <Label className="font-black text-lg text-primary">مركز التكلفة المستهدف (المشروع)</Label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <InlineSearchList 
                    value={field.value || ''} 
                    onSelect={field.onChange} 
                    options={projectOptions}
                    placeholder={projectsLoading ? "جاري تحميل المشاريع..." : "اختر المشروع لتحميل التكاليف عليه (اختياري)..."}
                    disabled={projectsLoading || isSaving}
                    className="bg-background border-primary/20 h-12 text-lg rounded-2xl"
                  />
                )}
              />
            </div>
          </div>

          {/* Items Table Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <Label className="text-xl font-black flex items-center gap-2 text-foreground">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                الأصناف والكميات
              </Label>
              <div className="bg-muted px-4 py-1.5 rounded-full text-xs font-bold border shadow-inner">
                إجمالي البنود: {fields.length}
              </div>
            </div>

            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="h-14 border-b-2">
                    <TableHead className="w-[60px] text-center font-bold text-xs uppercase">إجراء</TableHead>
                    <TableHead className="w-2/5 font-bold text-base">اسم المادة / الصنف المطلوب</TableHead>
                    <TableHead className="text-center font-bold text-base">الكمية</TableHead>
                    <TableHead className="text-center font-bold text-base">سعر الوحدة</TableHead>
                    <TableHead className="text-left font-bold text-base px-6">الإجمالي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => {
                    const item = watchedItems?.[index];
                    const lineTotal = (Number(item?.quantity) || 0) * (Number(item?.unitPrice) || 0);
                    return (
                      <TableRow key={field.id} className="hover:bg-muted/5 transition-colors border-b last:border-0 h-16">
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1 || isSaving}
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </TableCell>
                        <TableCell className="py-2">
                          <Controller
                            name={`items.${index}.internalItemId`}
                            control={control}
                            render={({ field: controllerField }) => (
                              <InlineSearchList
                                value={controllerField.value || ''}
                                onSelect={(val) => {
                                  controllerField.onChange(val);
                                  const selectedMaterial = items?.find(i => i.id === val);
                                  if (selectedMaterial) {
                                    setValue(`items.${index}.description`, selectedMaterial.name);
                                    if (selectedMaterial.costPrice) {
                                      setValue(`items.${index}.unitPrice`, selectedMaterial.costPrice);
                                    }
                                  }
                                }}
                                options={itemOptions}
                                placeholder={itemsLoading ? "جاري التحميل..." : "اختر مادة من المخزون..."}
                                disabled={itemsLoading || isSaving}
                                className="border-none shadow-none focus-visible:ring-0 text-lg font-bold bg-transparent"
                              />
                            )}
                          />
                          {errors.items?.[index]?.internalItemId && (
                            <p className="text-[10px] text-destructive px-3 font-bold">
                              {errors.items[index]?.internalItemId?.message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="any"
                            {...register(`items.${index}.quantity`)}
                            disabled={isSaving}
                            className="dir-ltr text-center border-none shadow-none focus-visible:ring-0 text-xl font-black font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            {...register(`items.${index}.unitPrice`)}
                            disabled={isSaving}
                            className="dir-ltr text-center border-none shadow-none focus-visible:ring-0 text-xl font-black font-mono text-primary"
                          />
                        </TableCell>
                        <TableCell className="text-left font-mono font-black text-lg px-6 bg-muted/5">
                          {formatCurrency(lineTotal)}
                        </TableCell>
                      </TableRow>
                    )})}
                </TableBody>
                <TableFooter className="bg-primary/5">
                  <TableRow className="h-20 border-t-4 border-primary/20">
                    <TableCell colSpan={4} className="text-right px-8 font-black text-xl text-foreground">
                      المجموع الإجمالي للأمر:
                    </TableCell>
                    <TableCell className="text-left font-mono text-2xl font-black text-primary px-6 border-r bg-primary/5">
                      {formatCurrency(totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ uid: generateId(), internalItemId: '', description: '', quantity: 1, unitPrice: 0 })}
                disabled={isSaving}
                className="h-14 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-lg font-bold transition-all gap-2 group"
              >
                <PlusCircle className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                إضافة بند جديد للأمر
              </Button>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70">شروط الدفع</Label>
              <Input
                {...register('paymentTerms')}
                disabled={isSaving}
                placeholder="مثال: دفع كاش، آجل 30 يوم، دفعة مقدمة 50%..."
                className="h-11 rounded-xl border-2"
              />
            </div>
            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70">ملاحظات إضافية للمورد</Label>
              <Textarea
                {...register('notes')}
                disabled={isSaving}
                placeholder="أدخل أي تعليمات خاصة بالتوريد أو ملاحظات..."
                className="rounded-xl border-2 resize-none"
                rows={3}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-4 p-10 border-t bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
            className="h-14 px-10 rounded-2xl font-bold text-lg hover:bg-background"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={isSaving || fullLoading}
            className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all min-w-[240px]"
          >
            {isSaving ? (
              <>
                <Loader2 className="ml-3 h-6 w-6 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="ml-3 h-6 w-6" />
                حفظ وإرسال الطلب
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
