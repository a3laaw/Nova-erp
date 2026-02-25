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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Save, Loader2, PlusCircle, Trash2, Target, FileText, Calculator, X } from 'lucide-react';
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
import type { Vendor, Item, RequestForQuotation, ConstructionProject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Skeleton } from '@/components/ui/skeleton';
import { DateInput } from '@/components/ui/date-input';
import { cleanFirestoreData, cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';

const itemSchema = z.object({
  uid: z.string(),
  internalItemId: z.string().min(1, 'الصنف مطلوب.'),
  itemName: z.string().optional(),
  quantity: z.preprocess(
    (v) => parseFloat(String(v || '0')),
    z.number().min(0.01, 'الكمية مطلوبة')
  ),
});

const rfqSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  vendorIds: z.array(z.string()).min(1, 'يجب اختيار مورد واحد على الأقل.'),
  projectId: z.string().optional().nullable(),
  items: z.array(itemSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type RfqFormValues = z.infer<typeof rfqSchema>;

const generateStableId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

export default function NewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [rfqNumber, setRfqNumber] = useState('جاري التوليد...');
  const [rfqNumberLoaded, setRfqNumberLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const vendorConstraints = useMemo(() => [orderBy('name')], []);
  const itemConstraints = useMemo(() => [orderBy('name')], []);
  const projectConstraints = useMemo(() => [orderBy('projectName')], []);

  const { data: vendors, loading: vendorsLoading } = useSubscription<Vendor>(
    firestore,
    'vendors',
    vendorConstraints
  );
  const { data: items, loading: itemsLoading } = useSubscription<Item>(
    firestore,
    'items',
    itemConstraints
  );
  const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(
    firestore,
    'projects',
    projectConstraints
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<RfqFormValues>({
    resolver: zodResolver(rfqSchema),
    defaultValues: {
      date: new Date(),
      vendorIds: [],
      projectId: searchParams.get('projectId') || null,
      items: [{ uid: generateStableId(), internalItemId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  
  const watchedItems = useWatch({ control, name: 'items' });

  useEffect(() => {
    if (!firestore || rfqNumberLoaded) return;
    let cancelled = false;

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
        if (!cancelled) {
          setRfqNumber(`RFQ-${currentYear}-${String(nextNumber).padStart(4, '0')}`);
          setRfqNumberLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRfqNumber('سيتم التوليد عند الحفظ');
          setRfqNumberLoaded(true);
        }
      }
    };
    generateRfqNumber();

    return () => {
      cancelled = true;
    };
  }, [firestore, rfqNumberLoaded]);

  const vendorOptions: MultiSelectOption[] = useMemo(
    () => (vendors || []).map((v) => ({ value: v.id!, label: v.name })),
    [vendors]
  );
  
  const itemOptions = useMemo(
    () => (items || []).map((i) => ({ value: i.id!, label: i.name, searchKey: i.sku })),
    [items]
  );

  const projectOptions = useMemo(
    () => (projects || []).map((p) => ({ value: p.id!, label: p.projectName, searchKey: p.projectId })),
    [projects]
  );

  const onSubmit = async (data: RfqFormValues) => {
    if (!firestore || !currentUser) return;
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    try {
      const currentItems = items || [];

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

        const processedItems = data.items.map((item) => {
          const selectedItem = currentItems.find((i) => i.id === item.internalItemId);
          return {
            id: generateStableId(),
            internalItemId: item.internalItemId,
            itemName: selectedItem?.name || 'Unknown',
            quantity: Number(item.quantity),
          };
        });

        const rfqData = {
          rfqNumber: newRfqNumber,
          date: data.date,
          vendorIds: data.vendorIds,
          projectId: data.projectId,
          items: processedItems,
          status: 'draft' as const,
          createdAt: serverTimestamp(),
        };

        transaction.set(newRfqRef, cleanFirestoreData(rfqData));
        transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
      });

      toast({ title: 'نجاح', description: 'تم إنشاء طلب التسعير بنجاح.' });
      router.push('/dashboard/purchasing/rfqs');
    } catch (error) {
      console.error('Error creating RFQ:', error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنشاء طلب التسعير.' });
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  };

  return (
    <Card className="max-w-5xl mx-auto rounded-3xl border-none shadow-xl overflow-hidden" dir="rtl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader className="bg-muted/30 pb-8 px-8">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <FileText className="h-6 w-6" />
                </div>
                <CardTitle className="text-3xl font-black tracking-tight">طلب تسعير جديد</CardTitle>
              </div>
              <CardDescription className="text-base font-medium pr-11">حدد الموردين والأصناف المطلوبة لإرسال طلب عرض السعر للمفاضلة.</CardDescription>
            </div>
            <div className="text-left bg-background/50 px-4 py-2 rounded-2xl border shadow-inner">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">رقم الطلب المتوقع</Label>
              <div className="font-mono text-xl font-black text-primary">
                {!rfqNumberLoaded ? <Skeleton className="h-6 w-32" /> : rfqNumber}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 p-8">
          {/* Main Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                الموردون المستهدفون <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="vendorIds"
                control={control}
                render={({ field }) => (
                  <MultiSelect
                    options={vendorOptions}
                    selected={field.value}
                    onChange={field.onChange}
                    placeholder={
                      vendorsLoading && !vendors
                        ? 'جاري تحميل الموردين...'
                        : vendorOptions.length === 0
                          ? 'لا يوجد موردين — أضف من إدارة الموردين'
                          : 'اختر موردًا أو أكثر...'
                    }
                    disabled={vendorsLoading && !vendors}
                    className="rounded-xl"
                  />
                )}
              />
              {errors.vendorIds && (
                <p className="text-xs text-destructive font-bold">{errors.vendorIds.message}</p>
              )}
            </div>

            <div className="grid gap-3">
              <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                تاريخ الطلب <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
              />
              {errors.date && <p className="text-xs text-destructive font-bold">{errors.date.message}</p>}
            </div>
          </div>

          {/* Project Highlighting Box */}
          <div className="p-6 border-2 border-primary/10 bg-primary/5 rounded-3xl flex items-center gap-6 shadow-sm">
            <div className="bg-primary/10 p-4 rounded-2xl shadow-inner">
              <Target className="text-primary h-8 w-8" />
            </div>
            <div className="grid gap-2 flex-grow">
              <Label className="font-black text-lg text-primary">مركز التكلفة المستهدف (مشروع)</Label>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <InlineSearchList 
                    value={field.value || ''} 
                    onSelect={field.onChange} 
                    options={projectOptions}
                    placeholder={projectsLoading ? "جاري تحميل المشاريع..." : "اختر المشروع لربط التكاليف مستقبلاً (اختياري)..."}
                    disabled={projectsLoading}
                    className="bg-background border-primary/20 h-12 text-lg rounded-2xl"
                  />
                )}
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <Label className="text-xl font-black flex items-center gap-2">
                <Calculator className="h-5 w-5 text-muted-foreground" />
                الأصناف والكميات المطلوبة
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
                    <TableHead className="w-3/5 font-bold text-base">بيان الصنف المطلوب</TableHead>
                    <TableHead className="text-center font-bold text-base">الكمية المطلوبة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="hover:bg-muted/5 transition-colors border-b last:border-0">
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-full"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </TableCell>
                      <TableCell className="py-4">
                        <Controller
                          name={`items.${index}.internalItemId`}
                          control={control}
                          render={({ field: controllerField }) => (
                            <InlineSearchList
                              value={controllerField.value}
                              onSelect={controllerField.onChange}
                              options={itemOptions}
                              placeholder={
                                itemsLoading && !items
                                  ? 'جاري تحميل الأصناف...'
                                  : itemOptions.length === 0
                                    ? 'لا توجد أصناف مسجلة'
                                    : 'ابحث عن صنف من المخزون...'
                              }
                              disabled={itemsLoading && !items}
                              className="border-none shadow-none focus-visible:ring-0 bg-transparent text-lg font-bold"
                            />
                          )}
                        />
                        {errors.items?.[index]?.internalItemId && (
                          <p className="text-xs text-destructive mt-1 px-3 font-bold">
                            {errors.items[index]?.internalItemId?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          {...register(`items.${index}.quantity`)}
                          className="dir-ltr text-center border-none shadow-none focus-visible:ring-0 text-xl font-black font-mono text-primary"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive mt-1 font-bold text-center">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ uid: generateStableId(), internalItemId: '', quantity: 1 })}
                className="h-14 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-lg font-bold transition-all gap-2 group"
              >
                <PlusCircle className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                إضافة صنف جديد للطلب
              </Button>
            </div>
          </div>

          {errors.items && (
            <Alert variant="destructive" className="rounded-2xl border-2">
              <AlertTitle>خطأ في المدخلات</AlertTitle>
              <AlertDescription className="font-bold">
                {errors.items.root?.message || errors.items.message || 'يرجى مراجعة بيانات البنود والتأكد من صحتها.'}
              </AlertDescription>
            </Alert>
          )}
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
            disabled={isSaving || (vendorsLoading && !vendors) || (itemsLoading && !items)}
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
                حفظ كمسودة وإرسال
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
