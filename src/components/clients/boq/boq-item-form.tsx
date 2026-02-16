'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { BoqItem, Item } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const boqItemSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب."),
  classification: z.enum(['خرسانة', 'حديد', 'شدات', 'أخرى']).optional(),
  unit: z.string().min(1, "الوحدة مطلوبة."),
  quantity: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().positive("الكمية يجب أن تكون أكبر من صفر.")
  ),
  costUnitPrice: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().min(0, "التكلفة لا يمكن أن تكون سالبة.")
  ),
  sellingUnitPrice: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().min(0, "السعر لا يمكن أن يكون سالبًا.")
  ),
});

type BoqFormValues = z.infer<typeof boqItemSchema>;

interface BoqItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  transactionId: string;
  item: BoqItem | null;
}

export function BoqItemForm({ isOpen, onClose, onSaveSuccess, transactionId, item }: BoqItemFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = !!item;
  
  const { clientId, txId } = useMemo(() => {
    if (!transactionId) return { clientId: null, txId: null };
    const parts = transactionId.split('/');
    return { clientId: parts[0], txId: parts[1] };
  }, [transactionId]);

  const { data: masterItems, loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);


  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<BoqFormValues>({
    resolver: zodResolver(boqItemSchema),
    defaultValues: {
        itemId: '',
    }
  });

  useEffect(() => {
    if (isOpen) {
      if (item) {
        reset({
          itemId: item.itemId,
          description: item.description,
          classification: item.classification,
          unit: item.unit,
          quantity: item.quantity,
          costUnitPrice: item.costUnitPrice,
          sellingUnitPrice: item.sellingUnitPrice,
        });
      } else {
        reset({
          itemId: '',
          description: '',
          classification: undefined,
          unit: '',
          quantity: 1,
          costUnitPrice: 0,
          sellingUnitPrice: 0,
        });
      }
    }
  }, [isOpen, item, reset]);

  const handleMasterItemSelect = (itemId: string) => {
    const selectedItem = masterItems.find(i => i.id === itemId);
    if (selectedItem) {
        setValue('description', selectedItem.name, { shouldValidate: true });
        setValue('unit', selectedItem.unitOfMeasure, { shouldValidate: true });
        setValue('costUnitPrice', selectedItem.costPrice || 0, { shouldValidate: true });
        setValue('sellingUnitPrice', selectedItem.sellingPrice || 0, { shouldValidate: true });
    } else {
        setValue('description', '', { shouldValidate: true });
        setValue('unit', '', { shouldValidate: true });
        setValue('costUnitPrice', 0, { shouldValidate: true });
        setValue('sellingUnitPrice', 0, { shouldValidate: true });
    }
  };
  
  const masterItemOptions = useMemo(() => 
    (masterItems || []).map(i => ({ value: i.id!, label: i.name, searchKey: i.sku }))
  , [masterItems]);


  const onSubmit = async (data: BoqFormValues) => {
    if (!firestore || !clientId || !txId) return;
    setIsSaving(true);

    try {
      const collectionPath = `clients/${clientId}/transactions/${txId}/boq`;
      
      const margin = data.sellingUnitPrice && data.costUnitPrice && data.sellingUnitPrice > 0
        ? ((data.sellingUnitPrice - data.costUnitPrice) / data.sellingUnitPrice) * 100
        : 0;

      const dataToSave = {
        ...data,
        margin: parseFloat(margin.toFixed(2)),
        updatedAt: serverTimestamp(),
      };

      if (isEditing && item?.id) {
        const itemRef = doc(firestore, collectionPath, item.id);
        await updateDoc(itemRef, cleanFirestoreData(dataToSave));
        toast({ title: "نجاح", description: "تم تحديث البند بنجاح." });
      } else {
        const fullData = {
            ...dataToSave,
            itemNumber: 'TEMP',
            executedQuantity: 0,
            createdAt: serverTimestamp(),
        };
        await addDoc(collection(firestore, collectionPath), cleanFirestoreData(fullData));
        toast({ title: "نجاح", description: "تمت إضافة البند بنجاح." });
      }
      
      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving BOQ item:", error);
      toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ البند." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'تعديل بند في جدول الكميات' : 'إضافة بند جديد'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 grid gap-4">
             <div className="grid gap-2">
              <Label>بحث عن صنف (اختياري)</Label>
              <Controller
                name="itemId"
                control={control}
                render={({ field }) => (
                  <InlineSearchList 
                    value={field.value || ''}
                    onSelect={(value) => {
                        field.onChange(value);
                        handleMasterItemSelect(value);
                    }}
                    options={masterItemOptions}
                    placeholder={itemsLoading ? 'تحميل...' : 'ابحث في قائمة الأصناف لتعبئة الحقول...'}
                    disabled={itemsLoading}
                  />
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">وصف البند <span className="text-destructive">*</span></Label>
              <Textarea id="description" {...register('description')} />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="unit">الوحدة <span className="text-destructive">*</span></Label>
                    <Input id="unit" {...register('unit')} required />
                    {errors.unit && <p className="text-xs text-destructive">{errors.unit.message}</p>}
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="classification">التصنيف</Label>
                    <Controller
                        name="classification"
                        control={control}
                        render={({field}) => (
                           <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="اختر تصنيف البند..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="خرسانة">خرسانة</SelectItem>
                                    <SelectItem value="حديد">حديد</SelectItem>
                                    <SelectItem value="شدات">شدات</SelectItem>
                                    <SelectItem value="أخرى">أخرى</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="plannedQuantity">الكمية <span className="text-destructive">*</span></Label>
                    <Input id="plannedQuantity" type="number" step="any" {...register('plannedQuantity')} required />
                    {errors.plannedQuantity && <p className="text-xs text-destructive">{errors.plannedQuantity.message}</p>}
                </div>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50 grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="costUnitPrice">سعر تكلفة الوحدة (د.ك)</Label>
                    <Input id="costUnitPrice" type="number" step="0.001" {...register('costUnitPrice')} />
                    {errors.costUnitPrice && <p className="text-xs text-destructive">{errors.costUnitPrice.message}</p>}
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="sellingUnitPrice">سعر بيع الوحدة (د.ك)</Label>
                    <Input id="sellingUnitPrice" type="number" step="0.001" {...register('sellingUnitPrice')} />
                    {errors.sellingUnitPrice && <p className="text-xs text-destructive">{errors.sellingUnitPrice.message}</p>}
                </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin ml-2" /> : <Save className="ml-2" />}
              {isEditing ? 'حفظ التعديلات' : 'إضافة البند'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

