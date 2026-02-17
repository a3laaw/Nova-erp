
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import type { Boq, BoqItem, BoqReferenceItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X, PlusCircle, Trash2, Folder, FolderOpen } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { Separator } from '@/components/ui/separator';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string(),
  itemNumber: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string().optional(),
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  notes: z.string().optional(),
  parentId: z.string().nullable(),
  level: z.number(),
  isHeader: z.boolean(),
  itemId: z.string().optional(), // Link to master BoqReferenceItem
});

export const boqFormSchema = z.object({
  name: z.string().min(1, "اسم جدول الكميات مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

// --- Recursive Renderer Component ---
function BoqItemRowRenderer({
  index,
  control,
  register,
  getValues,
  remove,
  insert,
  masterItemsMap,
  loadingMasterItems,
}: any) {
  const { fields } = useFieldArray({ control, name: 'items' });
  const currentItem = fields[index] as BoqFormValues['items'][number];

  const handleAddItem = useCallback((isHeader: boolean) => {
    const allItems = getValues('items');
    let lastDescendantIndex = index;

    const findLastDescendant = (parentId: string) => {
      const children = allItems.map((item: any, i: number) => ({ item, i })).filter(({ item }: any) => item.parentId === parentId);
      for (const { i } of children) {
        lastDescendantIndex = Math.max(lastDescendantIndex, i);
        findLastDescendant(allItems[i].id);
      }
    };
    findLastDescendant(currentItem.id);

    const insertIndex = lastDescendantIndex + 1;

    insert(insertIndex, {
      id: generateId(),
      itemNumber: 'TEMP',
      description: '',
      unit: isHeader ? '' : 'مقطوعية',
      quantity: isHeader ? 0 : 1,
      sellingUnitPrice: 0,
      notes: '',
      parentId: currentItem.id,
      level: currentItem.level + 1,
      isHeader,
    });
  }, [getValues, index, currentItem, insert]);

  const handleRemove = () => {
    const allItems = getValues('items');
    const itemToRemove = allItems[index];
    if (!itemToRemove) return;

    const indicesToRemove: number[] = [index];
    const findDescendants = (parentId: string) => {
      allItems.forEach((item: any, i: number) => {
        if (item.parentId === parentId) {
          indicesToRemove.push(i);
          findDescendants(item.id);
        }
      });
    };

    findDescendants(itemToRemove.id);
    remove(indicesToRemove.sort((a, b) => b - a));
  };
  
  const childFields = useMemo(() => {
    const allFields = getValues('items');
    return allFields
      .map((field: any, i: number) => ({ field, index: i }))
      .filter(({ field }: any) => field.parentId === currentItem.id);
  }, [getValues, currentItem.id, fields]);

  return (
    <div className="space-y-2 pl-4 border-r-2 border-primary/20" style={{ paddingRight: `${currentItem.level * 0.5}rem` }}>
      <Card className="p-4 bg-muted/30">
        <div className="flex items-start gap-2">
          <div className="flex-grow space-y-2">
            <Controller
                name={`items.${index}.itemId`}
                control={control}
                render={({ field }) => (
                    <InlineSearchList
                        value={field.value || ''}
                        onSelect={(value) => {
                            field.onChange(value);
                            const selectedItem = masterItemsMap.get(value);
                            if (selectedItem) {
                                register(`items.${index}.description`).onChange({ target: { value: selectedItem.label }});
                                register(`items.${index}.unit`).onChange({ target: { value: selectedItem.unit || '' }});
                                register(`items.${index}.isHeader`).onChange({ target: { value: selectedItem.isHeader || false }});
                            }
                        }}
                        options={Array.from(masterItemsMap.values()).flat()}
                        placeholder="ابحث أو اختر بندًا..."
                        disabled={loadingMasterItems}
                    />
                )}
            />
            <Textarea {...register(`items.${index}.description`)} placeholder="أو اكتب وصفًا مخصصًا..." className="bg-background" />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleRemove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>

        <div className="flex items-center space-x-2 rtl:space-x-reverse mt-2">
          <Controller
            name={`items.${index}.isHeader`}
            control={control}
            render={({ field }) => (
              <Checkbox id={`isHeader-${index}`} checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor={`isHeader-${index}`}>هذا البند هو قسم رئيسي (عنوان)</Label>
        </div>

        {!currentItem.isHeader && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center mt-2">
            <div className="grid gap-1"><Label>الوحدة</Label><Input {...register(`items.${index}.unit`)} /></div>
            <div className="grid gap-1"><Label>الكمية</Label><Input type="number" step="any" {...register(`items.${index}.quantity`)} /></div>
            <div className="grid gap-1"><Label>سعر الوحدة</Label><Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} /></div>
          </div>
        )}
      </Card>

      {currentItem.isHeader && (
        <div className="pl-4 border-r-2 border-primary/20 space-y-2">
          {childFields.map(({ field, index: childIndex }: any) => (
            <BoqItemRowRenderer
              key={field.id}
              index={childIndex}
              control={control}
              register={register}
              getValues={getValues}
              remove={remove}
              insert={insert}
              masterItemsMap={masterItemsMap}
              loadingMasterItems={loadingMasterItems}
            />
          ))}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => handleAddItem(true)}><PlusCircle className="ml-2 h-4" /> إضافة قسم فرعي</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => handleAddItem(false)}><PlusCircle className="ml-2 h-4" /> إضافة بند عمل</Button>
          </div>
        </div>
      )}
    </div>
  );
}


interface BoqFormProps {
  onSave: (data: BoqFormValues) => void;
  onClose: () => void;
  initialData?: Partial<BoqFormValues> | null;
  isSaving?: boolean;
}

export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
  const isEditing = !!initialData;
  const { firestore } = useFirebase();
  const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);

  const methods = useForm<BoqFormValues>({
    resolver: zodResolver(boqFormSchema),
    defaultValues: initialData || {
      name: '',
      clientName: '',
      status: 'تقديري',
      items: []
    }
  });

  const { control, handleSubmit, register, setValue, getValues, watch, reset, formState: { errors } } = methods;
  const { fields, append, remove, insert } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        items: initialData.items?.map(item => ({ ...item, id: item.id || generateId() }))
      });
    }
  }, [initialData, reset]);

  const masterItemsMap = useMemo(() => {
    const map = new Map<string, { value: string; label: string; unit?: string; isHeader?: boolean; }>();
    if (!masterItems) return map;
    masterItems.forEach(item => {
        map.set(item.id!, {
            value: item.id!,
            label: item.name,
            unit: item.unit,
            isHeader: item.isHeader,
        });
    });
    return map;
}, [masterItems]);


  const handleAddRootItem = (isHeader: boolean) => {
    append({
      id: generateId(),
      itemNumber: '',
      description: '',
      unit: isHeader ? '' : 'مقطوعية',
      quantity: isHeader ? 0 : 1,
      sellingUnitPrice: 0,
      notes: '',
      parentId: null,
      level: 0,
      isHeader,
    });
  };

  const onSubmit = (data: BoqFormValues) => {
    const items = data.items;

    const childMap = new Map<string | null, string[]>();
    items.forEach(item => {
      if (!childMap.has(item.parentId)) {
        childMap.set(item.parentId, []);
      }
      childMap.get(item.parentId)!.push(item.id);
    });

    const sortedRootIds = childMap.get(null) || [];

    const finalItems: BoqFormValues['items'] = [];
    const assignNumbers = (parentId: string | null, parentNumber: string, level: number) => {
      const childrenIds = childMap.get(parentId) || [];
      childrenIds.forEach((childId, index) => {
        const childItem = items.find(i => i.id === childId);
        if (childItem) {
          const newNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
          const updatedItem = { ...childItem, itemNumber: newNumber, level };
          finalItems.push(updatedItem);
          assignNumbers(childId, newNumber, level + 1);
        }
      });
    };

    assignNumbers(null, '', 0);

    onSave({ ...data, items: finalItems });
  };
  
    const watchedItems = watch('items');
    const totalValue = useMemo(() => {
        return (watchedItems || []).reduce((sum, item) => {
            if (item.isHeader) return sum;
            const isLumpSum = item.unit === 'مقطوعية';
            const quantity = isLumpSum ? 1 : (Number(item.quantity) || 0);
            return sum + (quantity * (Number(item.sellingUnitPrice) || 0));
        }, 0);
    }, [watchedItems]);

  const rootItemIndices = useMemo(() => {
    return fields
      .map((field, index) => ({ field, index }))
      .filter(({ field }) => field.parentId === null);
  }, [fields]);

  return (
    <Card dir="rtl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{isEditing ? 'تعديل جدول الكميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
          <CardDescription>
            {isEditing ? `تعديل جدول: ${initialData?.name}` : 'أدخل تفاصيل جدول الكميات لإنشاءه.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} /></div>
            <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>الحالة</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <SelectTrigger><SelectValue placeholder="اختر الحالة..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="تقديري">تقديري</SelectItem>
                      <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                      <SelectItem value="منفذ">منفذ</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <Separator />
          <h3 className="font-semibold text-lg">بنود جدول الكميات</h3>

          <div className="space-y-4">
            {rootItemIndices.map(({ field, index }) => (
              <BoqItemRowRenderer
                key={field.id}
                index={index}
                control={control}
                register={register}
                getValues={getValues}
                remove={remove}
                insert={insert}
                masterItemsMap={masterItemsMap}
                loadingMasterItems={masterItemsLoading}
              />
            ))}
          </div>

          {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
          <div className="flex justify-center mt-4 border-t pt-4">
             <Button type="button" variant="secondary" onClick={() => handleAddRootItem(true)}>
                  <PlusCircle className="ml-2 h-4 w-4"/> إضافة قسم رئيسي
              </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-end gap-4 pt-6 border-t">
          <div className="text-2xl font-bold">
            <span>الإجمالي العام: </span>
            <span className="font-mono">{formatCurrency(totalValue)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving || masterItemsLoading}>
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
              {isEditing ? 'حفظ التعديلات' : 'حفظ'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
