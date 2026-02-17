'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, runTransaction, getDoc } from 'firebase/firestore';
import type { Boq, BoqItem, BoqReferenceItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2 } from 'lucide-react';
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
  itemId: z.string().optional(), // Link to BoqReferenceItem
});

export const boqFormSchema = z.object({
  name: z.string().min(1, "اسم جدول الكميات مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

interface BoqItemRowProps {
  index: number;
  control: any;
  register: any;
  getValues: any;
  setValue: any;
  remove: (index: number) => void;
  insert: (index: number, value: any) => void;
  masterItemsMap: Map<string, BoqReferenceItem>;
  masterItemsByParent: Map<string | null, BoqReferenceItem[]>;
  loadingMasterItems: boolean;
  fields: any[]; // all fields from useFieldArray
}

function BoqItemRow({ index, control, register, getValues, setValue, remove, insert, masterItemsMap, masterItemsByParent, loadingMasterItems, fields }: BoqItemRowProps) {
  const item = useWatch({ control, name: `items.${index}` });

  const selectedMasterItem = useMemo(() => {
    return item.itemId ? masterItemsMap.get(item.itemId) : null;
  }, [item.itemId, masterItemsMap]);

  const hasChildrenInMaster = useMemo(() => {
    if (!selectedMasterItem) return false;
    return masterItemsByParent.has(selectedMasterItem.id!);
  }, [selectedMasterItem, masterItemsByParent]);

  const itemOptions = useMemo(() => {
    const parentId = item.parentId;
    const parentFormItem = fields.find(f => f.id === parentId);
    const parentMasterId = parentFormItem?.itemId || null;
    return (masterItemsByParent.get(parentMasterId) || []).map(i => ({ value: i.id!, label: i.name }));
  }, [item.parentId, fields, masterItemsByParent]);

  const handleAddItem = (isHeader: boolean) => {
    let lastDescendantIndex = index;
    for (let i = index + 1; i < fields.length; i++) {
        if (fields[i].level > item.level) {
            lastDescendantIndex = i;
        } else {
            break;
        }
    }
    insert(lastDescendantIndex + 1, {
      id: generateId(),
      description: '',
      unit: isHeader ? '' : 'مقطوعية',
      quantity: 1,
      sellingUnitPrice: 0,
      parentId: item.id,
      level: item.level + 1,
      isHeader: isHeader,
    });
  };
  
  const handleRemove = () => {
    const idsToRemove = new Set<string>([item.id]);
    const indicesToRemove: number[] = [];

    const findChildrenRecursive = (parentId: string) => {
        fields.forEach((field, idx) => {
            if (field.parentId === parentId) {
                idsToRemove.add(field.id);
                indicesToRemove.push(idx);
                findChildrenRecursive(field.id);
            }
        });
    };

    findChildrenRecursive(item.id);
    indicesToRemove.push(index);
    
    // Sort indices in descending order to avoid issues with shifting array
    indicesToRemove.sort((a,b) => b - a);
    indicesToRemove.forEach(i => remove(i));
  };


  const lineTotal = useMemo(() => {
    if (item.isHeader) return 0;
    const qty = Number(item.quantity) || 0;
    const price = Number(item.sellingUnitPrice) || 0;
    return qty * price;
  }, [item]);

  return (
    <div className="border-b last:border-b-0 py-2" style={{ paddingRight: `${item.level * 1.5}rem` }}>
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
                                        const selected = masterItemsMap.get(value);
                                        if (selected) {
                                            setValue(`items.${index}.description`, selected.name, { shouldValidate: true });
                                            setValue(`items.${index}.unit`, selected.unit || (selected.isHeader ? '' : 'مقطوعية'), { shouldValidate: true });
                                            setValue(`items.${index}.isHeader`, selected.isHeader || false, { shouldValidate: true });
                                        }
                                    }}
                                    options={itemOptions}
                                    placeholder="اختر بندًا..."
                                    disabled={loadingMasterItems}
                                />
                            )}
                        />
                    </div>
                     <Input {...register(`items.${index}.description`)} placeholder="أو اكتب وصفًا مخصصًا..." />
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                         <Checkbox {...register(`items.${index}.isHeader`)} />
                         <Label>بند رئيسي</Label>
                      </div>
                </div>
                 {!item.isHeader && (
                    <div className="flex items-center gap-2 pl-8">
                        <Input {...register(`items.${index}.unit`)} placeholder="الوحدة" className="w-24" />
                        <Input type="number" step="any" {...register(`items.${index}.quantity`)} placeholder="الكمية" className="w-24" />
                        <Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} placeholder="سعر الوحدة" className="w-24" />
                        <div className="font-semibold w-24 text-left font-mono">{formatCurrency(lineTotal)}</div>
                    </div>
                 )}
            </div>
            <div className="flex items-center">
                 {item.isHeader && (
                    <>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddItem(true)}><PlusCircle className="ml-1 h-4 w-4 text-primary"/> قسم فرعي</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddItem(false)}><PlusCircle className="ml-1 h-4 w-4"/> بند عمل</Button>
                    </>
                 )}
                <Button type="button" variant="ghost" size="icon" onClick={handleRemove}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
            </div>
        </div>
    </div>
  )
}


interface BoqFormProps {
    onSave: (data: BoqFormValues) => Promise<void>;
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
    defaultValues: initialData || { name: '', clientName: '', status: 'تقديري', items: [] },
  });

  const { control, handleSubmit, register, getValues, watch, reset, setValue, formState: { errors } } = methods;
  const { fields, append, remove, insert } = useFieldArray({ control, name: 'items' });

  const masterItemsMap = useMemo(() => {
    return new Map((masterItems || []).map(i => [i.id!, i]));
  }, [masterItems]);
  
  const masterItemsByParent = useMemo(() => {
    const map = new Map<string | null, BoqReferenceItem[]>();
    (masterItems || []).forEach(item => {
        const parentId = item.parentBoqReferenceItemId || null;
        if (!map.has(parentId)) map.set(parentId, []);
        map.get(parentId)!.push(item);
    });
    return map;
  }, [masterItems]);

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
  
  const handleAddRootItem = () => {
    append({
      id: generateId(), itemNumber: '', description: '', unit: '',
      quantity: 0, sellingUnitPrice: 0, notes: '',
      parentId: null, level: 0, isHeader: true, itemId: ''
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
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent>
                </Select>
              )}/>
            </div>
          </div>
          <Separator />
          <h3 className="font-semibold text-lg">بنود جدول الكميات</h3>
          <div className="border rounded-lg p-2 space-y-2">
            {fields.map((field, index) => (
                <BoqItemRow
                    key={field.id}
                    index={index}
                    control={control}
                    register={register}
                    getValues={getValues}
                    setValue={setValue}
                    remove={remove}
                    insert={insert}
                    masterItemsMap={masterItemsMap}
                    masterItemsByParent={masterItemsByParent}
                    loadingMasterItems={masterItemsLoading}
                    fields={fields}
                />
            ))}
             {errors.items && <p className="text-destructive text-sm mt-2 p-2">{errors.items.root?.message || errors.items.message}</p>}
          </div>
           <div className="flex justify-start mt-4 border-t pt-4">
                <Button type="button" variant="secondary" onClick={handleAddRootItem}>
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
```