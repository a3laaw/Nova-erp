'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Save, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import {
  collection,
  runTransaction,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
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
  quantity: z.preprocess(
    (v) => parseFloat(String(v || '0')),
    z.number().min(0.01, 'الكمية مطلوبة')
  ),
});

const rfqSchema = z.object({
  date: z.date({ required_error: 'التاريخ مطلوب.' }),
  vendorIds: z.array(z.string()).min(1, 'يجب اختيار مورد واحد على الأقل.'),
  items: z.array(itemSchema).min(1, 'يجب إضافة صنف واحد على الأقل.'),
});

type RfqFormValues = z.infer<typeof rfqSchema>;

const generateTempId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

export default function NewRfqPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [rfqNumber, setRfqNumber] = useState('جاري التوليد...');
  const [rfqNumberLoaded, setRfqNumberLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  // تثبيت constraints في useMemo لمنع إعادة الاشتراك كل render
  const vendorConstraints = useMemo(() => [orderBy('name')], []);
  const itemConstraints = useMemo(() => [orderBy('name')], []);

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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RfqFormValues>({
    resolver: zodResolver(rfqSchema),
    defaultValues: {
      date: new Date(),
      vendorIds: [],
      items: [{ id: generateTempId(), internalItemId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // توليد رقم الطلب مرة واحدة فقط مع cleanup
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, rfqNumberLoaded]);

  // تحويل الخيارات مع حماية من null
  const vendorOptions: MultiSelectOption[] = useMemo(
    () =>
      (vendors || [])
        .filter((v) => v.id)
        .map((v) => ({ value: v.id!, label: v.name || 'بدون اسم' })),
    [vendors]
  );

  const itemOptions = useMemo(
    () =>
      (items || [])
        .filter((i) => i.id)
        .map((i) => ({
          value: i.id!,
          label: i.name || 'بدون اسم',
          searchKey: i.sku || '',
        })),
    [items]
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
            id: generateTempId(),
            internalItemId: item.internalItemId,
            itemName: selectedItem?.name || 'Unknown',
            quantity: Number(item.quantity),
          };
        });

        const rfqData = {
          rfqNumber: newRfqNumber,
          date: data.date,
          vendorIds: data.vendorIds,
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
    <Card className="max-w-4xl mx-auto" dir="rtl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>طلب تسعير جديد (RFQ)</CardTitle>
              <CardDescription>حدد الموردين والأصناف المطلوبة لإرسال طلب عرض السعر.</CardDescription>
            </div>
            <div className="text-right">
              <Label>رقم الطلب المتوقع</Label>
              <div className="font-mono text-lg font-semibold h-7 text-primary">
                {!rfqNumberLoaded ? <Skeleton className="h-6 w-32" /> : rfqNumber}
                <span className="text-[10px] text-muted-foreground block font-normal">(يتأكد عند الحفظ)</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid gap-2">
              <Label>
                تاريخ الطلب <span className="text-destructive">*</span>
              </Label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />}
              />
              {errors.date && <p className="text-xs text-destructive font-bold">{errors.date.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>
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
                  />
                )}
              />
              {errors.vendorIds && (
                <p className="text-xs text-destructive font-bold">{errors.vendorIds.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block font-bold">الأصناف والكميات المطلوبة</Label>
            <div className="border rounded-xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-3/5">الصنف</TableHead>
                    <TableHead>الكمية المطلوبة</TableHead>
                    <TableHead className="w-[50px]">
                      <span className="sr-only">حذف</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="hover:bg-transparent">
                      <TableCell>
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
                                    ? 'لا توجد أصناف — أضف من المخزون'
                                    : 'اختر صنفًا من المخزون...'
                              }
                              disabled={itemsLoading && !items}
                              className="border-none shadow-none focus-visible:ring-0"
                            />
                          )}
                        />
                        {errors.items?.[index]?.internalItemId && (
                          <p className="text-xs text-destructive mt-1 px-2 font-bold">
                            {errors.items[index]?.internalItemId?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="any"
                          {...register(`items.${index}.quantity`)}
                          className="dir-ltr text-center border-none shadow-none focus-visible:ring-0 font-bold"
                        />
                        {errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive mt-1 font-bold">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-start mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ id: generateTempId(), internalItemId: '', quantity: 1 })}
                className="rounded-xl"
              >
                <PlusCircle className="ml-2 h-4 w-4" />
                إضافة صنف للطلب
              </Button>
            </div>
          </div>
          {errors.items && (
            <p className="text-destructive text-sm mt-2 font-bold text-center">
              {errors.items.root?.message || errors.items.message}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2 p-8 border-t bg-muted/10">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSaving}
            className="h-12 px-8 rounded-xl font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="h-12 px-12 rounded-xl font-black text-lg shadow-lg shadow-primary/20"
          >
            {isSaving ? (
              <Loader2 className="ml-3 h-5 w-5 animate-spin" />
            ) : (
              <Save className="ml-3 h-5 w-5" />
            )}
            {isSaving ? 'جاري الحفظ...' : 'حفظ كمسودة'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
