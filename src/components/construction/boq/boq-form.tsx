
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller, watch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import type { Boq, BoqItem, BoqReferenceItem } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';


const itemSchema = z.object({
  id: z.string(),
  itemNumber: z.string(),
  description: z.string().min(1, "الوصف مطلوب."),
  unit: z.string(),
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
  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

interface BoqFormProps {
    onSave: (data: BoqFormValues) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<BoqFormValues> | null;
    isSaving?: boolean;
}


// Recursive component to render items
function BoqItemsRenderer({ control, level, parentId, parentNumber }: { control: any, level: number, parentId: string | null, parentNumber: string }) {
    const { fields, append, remove, update } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch({ control, name: 'items' });
    
    const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);
    
    const childItems = useMemo(() => {
      return fields.map((field, index) => ({ field, index })).filter(({ field }) => field.parentId === parentId);
    }, [fields, parentId]);
    
    const handleAddItem = (isHeader: boolean, parentId: string | null, currentLevel: number) => {
      const parentIndex = fields.findIndex(f => f.id === parentId);
      const parentItemNumber = parentId ? fields[parentIndex].itemNumber : '';
      const siblings = fields.filter(f => f.parentId === parentId);
      const newItemNumber = parentId ? `${parentItemNumber}.${siblings.length + 1}` : `${siblings.length + 1}`;

      append({
          id: new Date().toISOString() + Math.random(),
          itemNumber: newItemNumber,
          description: '',
          unit: isHeader ? '' : 'مقطوعية',
          quantity: isHeader ? 0 : 1,
          sellingUnitPrice: 0,
          notes: '',
          parentId,
          level: currentLevel,
          isHeader,
      });
    };
    
    const masterItemOptions = useMemo(() => {
        const parentMasterId = parentId ? watchedItems.find((i: BoqItem) => i.id === parentId)?.itemId : null;
        return (masterItems || [])
            .filter(item => item.parentBoqReferenceItemId === (parentMasterId || null))
            .map(i => ({ value: i.id!, label: i.name }));
    }, [masterItems, parentId, watchedItems]);

    const handleMasterItemSelect = (index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            update(index, {
                ...watchedItems[index],
                itemId: masterItem.id,
                description: masterItem.name,
                unit: masterItem.unit || (masterItem.isHeader ? '' : 'مقطوعية'),
                isHeader: masterItem.isHeader || false,
            });
        }
    };
    
    if (childItems.length === 0) return null;

    return (
      <div className="space-y-4">
        {childItems.map(({ field, index }) => {
          const item = watchedItems[index] || {};
          const isLumpSum = item.unit === 'مقطوعية';
          const total = isLumpSum ? (item.sellingUnitPrice || 0) : (item.quantity || 0) * (item.sellingUnitPrice || 0);

          return (
            <div key={field.id} className="space-y-2">
              <Card className={cn(item.isHeader && "bg-muted/30")}>
                <CardHeader className="flex flex-row items-start gap-4 p-4">
                  <div className="font-bold text-lg">{parentNumber ? `${parentNumber}.${index + 1}` : index + 1}</div>
                  <div className="flex-grow space-y-2">
                    <InlineSearchList
                      value={''}
                      onSelect={(val) => handleMasterItemSelect(index, val)}
                      options={masterItemOptions}
                      placeholder="اختر بندًا مرجعيًا أو اكتب مباشرة..."
                      disabled={masterItemsLoading}
                    />
                    <Textarea {...register(`items.${index}.description`)} className="bg-background font-semibold text-base" />
                    {!item.isHeader && <Textarea {...register(`items.${index}.notes`)} placeholder="ملاحظات على البند..." rows={1} className="bg-background text-sm" />}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                {!item.isHeader && (
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
                      <div className="grid gap-1">
                        <Label>الوحدة</Label>
                        <Input {...register(`items.${index}.unit`)} />
                      </div>
                      <div className="grid gap-1">
                        <Label>الكمية</Label>
                        <Input type="number" step="any" {...register(`items.${index}.quantity`)} disabled={isLumpSum} className="dir-ltr"/>
                      </div>
                      <div className="grid gap-1">
                        <Label>سعر الوحدة</Label>
                        <Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} className="dir-ltr"/>
                      </div>
                      <div className="grid gap-1 text-left">
                        <Label className="text-right">الإجمالي</Label>
                        <div className="h-10 px-3 py-2 font-mono">{formatCurrency(total)}</div>
                      </div>
                    </div>
                  </CardContent>
                )}
                 {item.isHeader && (
                    <CardFooter className="p-4 pt-0">
                         <BoqItemsRenderer control={control} level={level + 1} parentId={field.id} parentNumber={`${parentNumber ? parentNumber + '.' : ''}${index + 1}`} />
                         <Button type="button" variant="ghost" size="sm" onClick={() => handleAddItem(false, field.id, level + 1)} className="mt-2 text-primary"><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند عمل</Button>
                    </CardFooter>
                 )}
              </Card>
            </div>
          );
        })}
      </div>
    );
  }


export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
    const isEditing = !!initialData;
    const { firestore } = useFirebase();
    const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: initialData || {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: []
        }
    });

    useEffect(() => {
        if (initialData) {
            setValue('name', initialData.name || '');
            setValue('clientName', initialData.clientName || '');
            setValue('status', initialData.status || 'تقديري');
            setValue('items', initialData.items || []);
        }
    }, [initialData, setValue]);

    const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
    const watchedItems = watch('items');

    const totalValue = useMemo(() => {
        return watchedItems.reduce((sum, item) => {
            if (item.isHeader) return sum;
            const isLumpSum = item.unit === 'مقطوعية';
            const quantity = isLumpSum ? 1 : (item.quantity || 0);
            return sum + (quantity * (item.sellingUnitPrice || 0));
        }, 0);
    }, [watchedItems]);

    const rootItems = useMemo(() => {
        return fields.map((field, index) => ({ field, index })).filter(({ field }) => field.parentId === null);
    }, [fields]);
    
     const updateItemNumbering = () => {
        const items = watch('items'); // get fresh data
        const newItems = [...items];

        const itemMap = new Map(newItems.map(item => [item.id, item]));
        const childrenMap = new Map<string, string[]>();

        newItems.forEach(item => {
            if (item.parentId) {
                if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
                childrenMap.get(item.parentId)!.push(item.id);
            }
        });

        const rootItemsForNumbering = newItems.filter(item => !item.parentId);

        const numberItem = (itemId: string, parentNumber: string, index: number) => {
            const item = itemMap.get(itemId);
            if (!item) return;

            const newItemNumber = parentNumber ? `${parentNumber}.${index + 1}` : `${index + 1}`;
            if (item.itemNumber !== newItemNumber) {
                setValue(`items.${items.findIndex(i => i.id === itemId)}.itemNumber`, newItemNumber);
            }
            
            const children = childrenMap.get(itemId) || [];
            children.forEach((childId, childIndex) => {
                numberItem(childId, newItemNumber, childIndex);
            });
        };
        
        rootItemsForNumbering.forEach((root, index) => numberItem(root.id, '', index));
    };

    useEffect(() => {
        updateItemNumbering();
    }, [fields, setValue]);


    const handleAddItem = (isHeader: boolean, parentId: string | null = null) => {
        let level = 0;
        if (parentId) {
            const parent = fields.find(f => f.id === parentId);
            if (parent) {
                level = parent.level + 1;
            }
        }
        
        const siblings = fields.filter(f => f.parentId === parentId);
        
        append({
            id: new Date().toISOString() + Math.random(),
            itemNumber: 'TEMP', // Will be calculated by useEffect
            description: '',
            unit: isHeader ? '' : 'مقطوعية',
            quantity: isHeader ? 0 : 1,
            sellingUnitPrice: 0,
            notes: '',
            parentId,
            level,
            isHeader,
        });
    };
    
    const handleMasterItemSelect = (index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            update(index, {
                ...watchedItems[index],
                itemId: masterItem.id,
                description: masterItem.name,
                unit: masterItem.unit || (masterItem.isHeader ? '' : 'مقطوعية'),
                isHeader: masterItem.isHeader || false,
            });
        }
    };
    
    const masterItemOptions = useMemo(() => {
        const usedRootIds = new Set(
            watchedItems
                .filter((item: BoqItem) => !item.parentId)
                .map((item: BoqItem) => item.itemId)
        );
        return (masterItems || [])
            .filter(item => !item.parentBoqReferenceItemId && !usedRootIds.has(item.id))
            .map(i => ({ value: i.id!, label: i.name }));
    }, [masterItems, watchedItems]);

    const getChildMasterItemOptions = (parentId: string | null) => {
        if (!masterItems || !parentId) return [];
        const parentBoqItem = watchedItems.find((i: BoqItem) => i.id === parentId);
        const parentMasterId = parentBoqItem?.itemId;
        return masterItems
            .filter(i => i.parentBoqReferenceItemId === parentMasterId)
            .map(i => ({ value: i.id!, label: i.name }));
    };


    const onSubmit = (data: BoqFormValues) => {
        onSave(data);
    };

    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>{isEditing ? 'تعديل جدول الكميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
                    <CardDescription>
                        {isEditing ? `تعديل جدول: ${initialData?.name}` : 'أدخل تفاصيل جدول الكميات لإنشاءه.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} /></div>
                            <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="grid gap-2"><Label>الحالة</Label><Controller name="status" control={control} render={({field}) => ( <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent></Select>)}/></div>
                        </div>
                        
                        <Separator />
                        <h3 className="font-semibold text-lg">بنود جدول الكميات</h3>

                        <div className="space-y-4">
                            {rootItems.map(({ field: rootItem, index: rootIndex }) => (
                               <Card key={rootItem.id} className="bg-muted/30 p-4 space-y-4">
                                   <div className="flex items-start gap-4">
                                       <div className="font-bold text-lg pt-2">{watchedItems[rootIndex]?.itemNumber}</div>
                                       <div className="flex-grow space-y-2">
                                            <InlineSearchList 
                                                value={''}
                                                onSelect={(val) => handleMasterItemSelect(rootIndex, val)}
                                                options={masterItemOptions}
                                                placeholder="اختر بندًا رئيسيًا أو اكتب مباشرة..."
                                                disabled={masterItemsLoading}
                                            />
                                            <Textarea {...register(`items.${rootIndex}.description`)} className="bg-background font-semibold text-base" />
                                            <Textarea {...register(`items.${rootIndex}.notes`)} placeholder="ملاحظات على القسم الرئيسي..." rows={1} className="bg-background text-sm" />
                                       </div>
                                       <Button type="button" variant="ghost" size="icon" onClick={() => remove(rootIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                   </div>
                                   
                                   <div className="pr-8 space-y-2">
                                        <BoqItemsRenderer control={control} level={1} parentId={rootItem.id} parentNumber={watchedItems[rootIndex]?.itemNumber} />
                                   </div>

                                   <div className="pr-8">
                                       <Button type="button" variant="ghost" size="sm" onClick={() => handleAddItem(false, rootItem.id, 1)} className="text-primary"><PlusCircle className="ml-2 h-4"/> إضافة بند عمل</Button>
                                   </div>
                               </Card>
                            ))}
                        </div>

                         {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                        <div className="flex justify-center mt-4">
                           <Button type="button" variant="secondary" onClick={() => handleAddItem(true, null, 0)}>
                                <PlusCircle className="ml-2 h-4 w-4"/> إضافة قسم رئيسي
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-4 pt-6 border-t">
                    <div className="text-2xl font-bold">
                        <span>الإجمالي العام: </span>
                        <span className="font-mono">{formatCurrency(totalValue)}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ'}
                        </Button>
                    </div>
                </CardFooter>
            </form>
        </Card>
    );
}
