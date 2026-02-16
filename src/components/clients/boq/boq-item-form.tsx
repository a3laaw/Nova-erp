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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { Loader2, Save } from 'lucide-react';
import type { BoqItem, Item } from '@/lib/types';
import { cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';


const boqItemSchema = z.object({
  itemId: z.string().optional(), // Now optional, as description is primary
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string().min(1, "الوحدة مطلوبة."),
  plannedQuantity: z.preprocess(
    (a) => parseFloat(String(a).replace(/,/g, '')),
    z.number().positive("الكمية يجب أن تكون أكبر من صفر.")
  ),
  plannedUnitPrice: z.preprocess(
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
  });

  useEffect(() => {
    if (isOpen) {
      if (item) {
        reset({
          itemId: item.itemId,
          description: item.description,
          unit: item.unit,
          plannedQuantity: item.plannedQuantity,
          plannedUnitPrice: item.plannedUnitPrice,
        });
      } else {
        reset({
          description: '',
          unit: '',
          plannedQuantity: 1,
          plannedUnitPrice: 0,
        });
      }
    }
  }, [isOpen, item, reset]);

  const handleMasterItemSelect = (itemId: string) => {
    const selectedItem = masterItems.find(i => i.id === itemId);
    if (selectedItem) {
        setValue('itemId', itemId);
        setValue('description', selectedItem.name);
        setValue('unit', selectedItem.unitOfMeasure);
        setValue('plannedUnitPrice', selectedItem.sellingPrice || 0);
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
      
      const dataToSave = {
        ...data,
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
              <InlineSearchList 
                value={''}
                onSelect={handleMasterItemSelect}
                options={masterItemOptions}
                placeholder={itemsLoading ? 'تحميل...' : 'ابحث في قائمة الأصناف لتعبئة الحقول...'}
                disabled={itemsLoading}
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
                    <Label htmlFor="plannedQuantity">الكمية المخططة <span className="text-destructive">*</span></Label>
                    <Input id="plannedQuantity" type="number" step="any" {...register('plannedQuantity')} required />
                    {errors.plannedQuantity && <p className="text-xs text-destructive">{errors.plannedQuantity.message}</p>}
                </div>
            </div>
             <div className="grid gap-2">
                <Label htmlFor="plannedUnitPrice">سعر الوحدة المخطط (د.ك) <span className="text-destructive">*</span></Label>
                <Input id="plannedUnitPrice" type="number" step="0.001" {...register('plannedUnitPrice')} required />
                {errors.plannedUnitPrice && <p className="text-xs text-destructive">{errors.plannedUnitPrice.message}</p>}
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
```
  <change>
    <file>src/lib/default-reference-data.ts</file>
    <content><![CDATA[
import type { Department, Job, Governorate, Area, TransactionType, WorkStage, ItemCategory } from '@/lib/types';

export const defaultDepartments: Omit<Department, 'id'>[] = [
  { name: 'القسم المعماري', order: 1, activityTypes: ['consulting'] },
  { name: 'القسم الإنشائي', order: 2, activityTypes: ['consulting', 'construction'] },
  { name: 'قسم الكهرباء', order: 3, activityTypes: ['consulting', 'construction'] },
  { name: 'قسم الميكانيك', order: 4, activityTypes: ['consulting', 'construction'] },
  { name: 'الإدارة', order: 5, activityTypes: ['consulting', 'construction', 'sales'] },
  { name: 'المحاسبة', order: 6, activityTypes: ['consulting', 'construction', 'sales'] },
  { name: 'الموارد البشرية', order: 7, activityTypes: ['consulting', 'construction', 'sales'] },
  { name: 'سكرتارية', order: 8, activityTypes: ['consulting', 'construction', 'sales'] },
];

export const defaultJobs: Record<string, Omit<Job, 'id'>[]> = {
  'القسم المعماري': [
    { name: 'مهندس معماري', order: 1 },
    { name: 'رسام معماري', order: 2 },
  ],
  'القسم الإنشائي': [
    { name: 'مهندس مدني', order: 1 },
  ],
  'الإدارة': [
      { name: 'مدير عام', order: 1 },
  ],
  'سكرتارية': [
      { name: 'سكرتير تنفيذي', order: 1 },
  ],
  'المحاسبة': [
      { name: 'محاسب', order: 1 },
      { name: 'مدير مالي', order: 2 },
  ],
  'الموارد البشرية': [
      { name: 'مسؤول موارد بشرية', order: 1 },
  ],
};

export const defaultGovernorates: Omit<Governorate, 'id'>[] = [
    { name: 'العاصمة', order: 1 },
    { name: 'حولي', order: 2 },
    { name: 'الفروانية', order: 3 },
    { name: 'الأحمدي', order: 4 },
    { name: 'الجهراء', order: 5 },
    { name: 'مبارك الكبير', order: 6 },
];

export const defaultAreas: Record<string, Omit<Area, 'id'>[]> = {
    'العاصمة': [
        { name: 'مدينة الكويت', order: 1 }, { name: 'دسمان', order: 2 }, { name: 'الشرق', order: 3 }, { name: 'الصوابر', order: 4 }, { name: 'المرقاب', order: 5 }, { name: 'القبلة', order: 6 }, { name: 'الصالحية', order: 7 }, { name: 'بنيد القار', order: 8 }, { name: 'الدعية', order: 9 }, { name: 'المنصورية', order: 10 }, { name: 'ضاحية عبدالله السالم', order: 11 }, { name: 'النزهة', order: 12 }, { name: 'الفيحاء', order: 13 }, { name: 'الشامية', order: 14 }, { name: 'الروضة', order: 15 }, { name: 'العديلية', order: 16 }, { name: 'الخالدية', order: 17 }, { name: 'كيفان', order: 18 }, { name: 'القادسية', order: 19 }, { name: 'قرطبة', order: 20 }, { name: 'السرة', order: 21 }, { name: 'اليرموك', order: 22 }, { name: 'الشويخ', order: 23 }, { name: 'غرناطة', order: 24 }, { name: 'الصليبيخات', order: 25 }, { name: 'الدوحة', order: 26 }, { name: 'النهضة', order: 27 }, { name: 'القيروان', order: 28 }, { name: 'شمال غرب الصليبيخات', order: 29 },
    ],
    'حولي': [
        { name: 'حولي', order: 1 }, { name: 'الشعب', order: 2 }, { name: 'السالمية', order: 3 }, { name: 'الرميثية', order: 4 }, { name: 'الجابرية', order: 5 }, { name: 'مشرف', order: 6 }, { name: 'بيان', order: 7 }, { name: 'البدع', order: 8 }, { name: 'النقرة', order: 9 }, { name: 'ميدان حولي', order: 10 }, { name: 'جنوب السرة', order: 11 }, { name: 'الزهراء', order: 12 }, { name: 'حطين', order: 13 }, { name: 'السلام', order: 14 }, { name: 'الشهداء', order: 15 }, { name: 'الصديق', order: 16 },
    ]
};

export const defaultTransactionTypes: (Omit<TransactionType, 'id'> & { departmentNames: string[] })[] = [
    { name: 'تصميم بلدية (سكن خاص)', departmentNames: ['القسم المعماري'], order: 1, activityType: 'consulting' },
    { name: 'تصميم كهرباء', departmentNames: ['قسم الكهرباء'], order: 2, activityType: 'consulting' },
    { name: 'تصميم إنشائي', departmentNames: ['القسم الإنشائي'], order: 3, activityType: 'consulting' },
    { name: 'إشراف على التنفيذ', departmentNames: ['القسم المعماري', 'القسم الإنشائي'], order: 4, activityType: 'consulting' },
    { name: 'تصميم واجهات', departmentNames: ['القسم المعماري'], order: 5, activityType: 'consulting' },
    { name: 'تصميم ديكور داخلي', departmentNames: ['القسم المعماري'], order: 6, activityType: 'consulting' },
];

export const defaultWorkStages: Record<string, (Omit<WorkStage, 'id'> & { nextStageNames?: string[], allowedDuringStagesNames?: string[] })[]> = {
    'القسم المعماري': [
        { name: 'استفسارات عامة', order: 1, stageType: 'sequential', trackingType: 'none', allowedRoles: [], nextStageNames: ['توقيع العقد'] },
        { name: 'توقيع العقد', order: 2, stageType: 'sequential', trackingType: 'none', allowedRoles: [], nextStageNames: ['تسليم المخططات الابتدائية'] },
        { name: 'تسليم المخططات الابتدائية', order: 3, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 10, allowedRoles: ['مهندس معماري'], nextStageNames: ['تسليم المخططات النهائية'] },
        { name: 'تعديلات المالك', order: 4, stageType: 'parallel', trackingType: 'occurrence', maxOccurrences: 3, allowedDuringStagesNames: ['تسليم المخططات الابتدائية'], enableModificationTracking: true, allowedRoles: ['مهندس معماري'] },
        { name: 'تسليم المخططات النهائية', order: 5, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 7, allowedRoles: ['مهندس معماري'], nextStageNames: [] },
    ],
    'القسم الإنشائي': [
        { name: 'التصميم الإنشائي', order: 1, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 14, allowedRoles: ['مهندس مدني'], nextStageNames: ['مراجعة البلدية'] },
        { name: 'مراجعة البلدية', order: 2, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 5, allowedRoles: [] },
    ],
};

export const defaultItemCategories: Omit<ItemCategory, 'id'>[] = [
    { name: 'مواد غذائية', parentCategoryId: null, order: 1 },
    { name: 'مواد استهلاكية', parentCategoryId: null, order: 2 },
    { name: 'خدمات', parentCategoryId: null, order: 3 },
    { name: 'مواد بناء', parentCategoryId: null, order: 4 },
    { name: 'مواد تشطيبات', parentCategoryId: null, order: 5 },
];

    