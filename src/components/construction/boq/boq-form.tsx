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
import { Loader2, Save, X, PlusCircle, Trash2 } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
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
  itemId: z.string().optional(),
});

export const boqFormSchema = z.object({
  name: z.string().min(1, "اسم جدول الكميات مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

// --- Recursive Row Renderer ---
function BoqItemRow({
  control,
  register,
  getValues,
  index,
  remove,
  append,
  masterItems,
  masterItemsLoading,
}: {
  control: any;
  register: any;
  getValues: any;
  index: number;
  remove: (index: number) => void;
  append: (item: any) => void;
  masterItems: BoqReferenceItem[];
  masterItemsLoading: boolean;
}) {
  const currentItem = useWatch({ control, name: `items.${index}` });
  const allItems = useWatch({ control, name: 'items' });

  const parentFormItem = useMemo(() => 
    allItems.find((i: any) => i.id === currentItem.parentId),
    [allItems, currentItem.parentId]
  );
  const parentMasterItemId = parentFormItem?.itemId;

  const itemOptions = useMemo(() => {
    return masterItems
      .filter(item => item.parentBoqReferenceItemId === (parentMasterItemId || null))
      .map(item => ({ value: item.id!, label: item.name }));
  }, [masterItems, parentMasterItemId]);

  const selectedMasterItem = useMemo(() => {
    return masterItems.find(i => i.id === currentItem.itemId);
  }, [masterItems, currentItem.itemId]);
  
  const hasChildrenInMaster = useMemo(() => {
      if(!selectedMasterItem) return false;
      return masterItems.some(i => i.parentBoqReferenceItemId === selectedMasterItem.id);
  }, [selectedMasterItem, masterItems]);

  const handleAddItem = (isHeader: boolean) => {
    append({
      id: generateId(),
      description: '',
      unit: isHeader ? '' : 'مقطوعية',
      quantity: 1,
      sellingUnitPrice: 0,
      parentId: currentItem.id,
      level: currentItem.level + 1,
      isHeader: isHeader,
    });
  };

  const lineTotal = useMemo(() => {
    if (currentItem.isHeader) return 0;
    const qty = currentItem.quantity || 0;
    const price = currentItem.sellingUnitPrice || 0;
    return qty * price;
  }, [currentItem]);
  
  return (
    <div className="border-b last:border-b-0 py-2" style={{ paddingRight: `${currentItem.level * 1.5}rem` }}>
        <div className="flex items-start gap-2">
            <div className="flex-grow space-y-2">
                 <div className="flex items-center gap-2">
                    <div className="w-60">
                        <Controller
                            name={`items.${index}.itemId`}
                            control={control}
                            render={({ field }) => (
                                <InlineSearchList
                                    value={field.value || ''}
                                    onSelect={(value) => {
                                        field.onChange(value);
                                        const selected = masterItems.find(mi => mi.id === value);
                                        if (selected) {
                                            register(`items.${index}.description`).onChange({ target: { value: selected.name }});
                                            register(`items.${index}.unit`).onChange({ target: { value: selected.unit || '' }});
                                            register(`items.${index}.isHeader`).onChange({ target: { value: selected.isHeader || false }});
                                        }
                                    }}
                                    options={itemOptions}
                                    placeholder="اختر بندًا..."
                                    disabled={masterItemsLoading}
                                />
                            )}
                        />
                    </div>
                     <Input {...register(`items.${index}.description`)} placeholder="أو اكتب وصفًا مخصصًا..." />
                </div>
                 {!currentItem.isHeader && (
                    <div className="flex items-center gap-2 pl-8">
                        <Input {...register(`items.${index}.unit`)} placeholder="الوحدة" className="w-24" />
                        <Input type="number" step="any" {...register(`items.${index}.quantity`)} placeholder="الكمية" className="w-24" />
                        <Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} placeholder="سعر الوحدة" className="w-24" />
                        <div className="font-semibold w-24 text-left font-mono">{formatCurrency(lineTotal)}</div>
                    </div>
                 )}
            </div>
            <div className="flex items-center">
                 {hasChildrenInMaster && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleAddItem(false)}>
                        <PlusCircle className="h-4 w-4 text-primary" />
                    </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
        </div>
    </div>
  )
}

// --- Main Form Component ---
export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
  const isEditing = !!initialData;
  const { firestore } = useFirebase();
  const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);

  const methods = useForm<BoqFormValues>({
    resolver: zodResolver(boqFormSchema),
    defaultValues: initialData || { name: '', clientName: '', status: 'تقديري', items: [] },
  });

  const { control, handleSubmit, register, getValues, watch, reset, formState: { errors } } = methods;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        items: initialData.items?.map(item => ({ ...item, id: item.id || generateId() })),
      });
    }
  }, [initialData, reset]);

  const watchedItems = watch('items');
  const totalValue = useMemo(() => 
    (watchedItems || []).reduce((sum, item) => {
        if(item.isHeader) return sum;
        const qty = Number(item.quantity) || 0;
        const price = Number(item.sellingUnitPrice) || 0;
        return sum + qty * price;
    }, 0),
    [watchedItems]
  );
  
  const handleAddRootItem = (isHeader: boolean) => {
    append({
      id: generateId(), itemNumber: '', description: '', unit: isHeader ? '' : 'مقطوعية',
      quantity: isHeader ? 0 : 1, sellingUnitPrice: 0, notes: '',
      parentId: null, level: 0, isHeader, itemId: ''
    });
  };

  const onSubmit = (data: BoqFormValues) => {
    const finalItems: BoqFormValues['items'] = [];
    const childMap = new Map<string | null, string[]>();
    data.items.forEach(item => {
      if (!childMap.has(item.parentId)) childMap.set(item.parentId, []);
      childMap.get(item.parentId)!.push(item.id);
    });

    const processNode = (parentId: string | null, parentNumber: string, level: number) => {
      const childrenIds = childMap.get(parentId) || [];
      childrenIds.forEach((childId, index) => {
        const item = data.items.find(i => i.id === childId);
        if (item) {
          const newNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
          finalItems.push({ ...item, itemNumber: newNumber, level });
          processNode(childId, newNumber, level + 1);
        }
      });
    };
    
    processNode(null, '', 0);

    onSave({ ...data, items: finalItems });
  };
  
  // Logic to render items in tree order
  const renderedTree = useMemo(() => {
    const itemMap = new Map(fields.map((item, index) => [item.id, { ...item, originalIndex: index, children: [] }]));
    const roots: any[] = [];
    
    fields.forEach((item, index) => {
        if (item.parentId && itemMap.has(item.parentId)) {
            itemMap.get(item.parentId)!.children.push(itemMap.get(item.id));
        } else {
            roots.push(itemMap.get(item.id));
        }
    });

    const result: { item: any, originalIndex: number }[] = [];
    const flatten = (nodes: any[]) => {
        for(const node of nodes) {
            result.push({ item: node, originalIndex: node.originalIndex });
            flatten(node.children);
        }
    }
    flatten(roots);
    return result;

  }, [fields]);

  return (
    <Card dir="rtl">
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle>{isEditing ? 'تعديل جدول الكميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
          <CardDescription>{isEditing ? `تعديل جدول: ${initialData?.name}` : 'أدخل تفاصيل جدول الكميات لإنشاءه.'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} /></div>
            <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>الحالة</Label>
              <Controller name="status" control={control} render={({field}) => (
                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent>
                </Select>
              )}/>
            </div>
          </div>
          <Separator />
          <h3 className="font-semibold text-lg">بنود جدول الكميات</h3>
          <div className="border rounded-lg p-2 space-y-2">
            {renderedTree.map(({ item, originalIndex }) => (
                <BoqItemRow
                    key={item.id}
                    index={originalIndex}
                    control={control}
                    register={register}
                    getValues={getValues}
                    remove={remove}
                    append={append}
                    masterItems={masterItems}
                    masterItemsLoading={masterItemsLoading}
                />
            ))}
            {loadingMasterItems && <p className="text-center p-4">جاري تحميل البنود المرجعية...</p>}
            {errors.items && <p className="text-destructive text-sm mt-2 p-2">{errors.items.root?.message || errors.items.message}</p>}
          </div>
           <div className="flex justify-start mt-4">
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
