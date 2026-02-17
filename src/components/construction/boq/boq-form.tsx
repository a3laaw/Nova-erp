
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray, Controller, watch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, orderBy, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, ArrowUp, ArrowDown, ClipboardCheck } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import type { Boq, BoqItem, BoqReferenceItem, TransactionType, CompanyActivityType, SubcontractorType } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { useDebounce } from 'use-debounce';

const generateId = () => Math.random().toString(36).substring(2, 9);

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

function BoqItemsRenderer({ control, level, parentId, parentNumber, itemIndex, onAddItem, onMasterItemSelect, masterItems, masterItemsLoading }: any) {
    const { remove, update } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch({ control, name: 'items' });
    
    const currentItem = watchedItems[itemIndex];
    if (!currentItem) return null;

    const childItems = useMemo(() => {
        return watchedItems
            .map((field: any, index: number) => ({ field, index }))
            .filter(({ field }: any) => field.parentId === currentItem.id);
    }, [watchedItems, currentItem.id]);
    
    const isLumpSum = currentItem.unit === 'مقطوعية';
    const total = isLumpSum ? (currentItem.sellingUnitPrice || 0) : (currentItem.quantity || 0) * (currentItem.sellingUnitPrice || 0);

    const masterItemOptions = useMemo(() => {
        const parentMasterId = parentId ? watchedItems.find((i: BoqItem) => i.id === parentId)?.itemId : null;
        return (masterItems || [])
            .filter((item: BoqReferenceItem) => item.parentBoqReferenceItemId === (parentMasterId || null))
            .map((i: BoqReferenceItem) => ({ value: i.id!, label: i.name }));
    }, [masterItems, parentId, watchedItems]);

    return (
        <Card key={currentItem.id} className="bg-muted/30 p-4 space-y-4">
           <div className="flex items-start gap-4">
               <div className="font-bold text-lg pt-2">{parentNumber ? `${parentNumber}.${itemIndex + 1}` : itemIndex + 1}</div>
               <div className="flex-grow space-y-2">
                    <InlineSearchList 
                        value={''}
                        onSelect={(val) => onMasterItemSelect(itemIndex, val)}
                        options={masterItemOptions}
                        placeholder="اختر بندًا مرجعيًا أو اكتب مباشرة..."
                        disabled={masterItemsLoading}
                    />
                    <Textarea {...register(`items.${itemIndex}.description`)} className="bg-background font-semibold text-base" />
                    {!currentItem.isHeader && <Textarea {...register(`items.${itemIndex}.notes`)} placeholder="ملاحظات على البند..." rows={1} className="bg-background text-sm" />}
               </div>
               <Button type="button" variant="ghost" size="icon" onClick={() => remove(itemIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
           </div>
           
           {!currentItem.isHeader && (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-center pr-8">
               <div className="grid gap-1">
                 <Label>الوحدة</Label>
                 <Input {...register(`items.${itemIndex}.unit`)} />
               </div>
               <div className="grid gap-1">
                 <Label>الكمية</Label>
                 <Input type="number" step="any" {...register(`items.${itemIndex}.quantity`)} disabled={isLumpSum} className="dir-ltr"/>
               </div>
               <div className="grid gap-1">
                 <Label>سعر الوحدة</Label>
                 <Input type="number" step="0.001" {...register(`items.${itemIndex}.sellingUnitPrice`)} className="dir-ltr"/>
               </div>
               <div className="grid gap-1 text-left">
                 <Label className="text-right">الإجمالي</Label>
                 <div className="h-10 px-3 py-2 font-mono">{formatCurrency(total)}</div>
               </div>
             </div>
           )}
           {currentItem.isHeader && (
              <div className="pr-8 space-y-2">
                {childItems.map(({ field, index: childIndex }: any) => (
                     <BoqItemsRenderer 
                        key={field.id}
                        control={control}
                        level={level + 1}
                        parentId={currentItem.id}
                        parentNumber={currentItem.itemNumber}
                        itemIndex={childIndex}
                        onAddItem={onAddItem}
                        onMasterItemSelect={onMasterItemSelect}
                        masterItems={masterItems}
                        masterItemsLoading={masterItemsLoading}
                     />
                ))}
                 <Button type="button" variant="ghost" size="sm" onClick={() => onAddItem(currentItem.id, false)} className="mt-2 text-primary"><PlusCircle className="ml-2 h-4"/> إضافة بند عمل</Button>
             </div>
           )}
        </Card>
    );
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

    const { control, handleSubmit, formState: { errors }, watch, setValue, reset, getValues } = methods;

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: "items"
    });

    const watchedItems = watch('items');

    useEffect(() => {
        if (initialData) {
            reset(initialData);
        }
    }, [initialData, reset]);

    const handleAddItem = useCallback((parentId: string | null, isHeader: boolean) => {
        const currentItems = getValues('items');
        let newIndex = 0;
        let lastSiblingIndex = -1;

        if (parentId) {
            for(let i = currentItems.length - 1; i >= 0; i--) {
                if (currentItems[i].parentId === parentId) {
                    lastSiblingIndex = i;
                    break;
                }
            }
            if(lastSiblingIndex === -1) {
                lastSiblingIndex = currentItems.findIndex(item => item.id === parentId);
            }
        } else {
            for(let i = currentItems.length - 1; i >= 0; i--) {
                if (currentItems[i].parentId === null) {
                    lastSiblingIndex = i;
                    break;
                }
            }
        }
        
        newIndex = lastSiblingIndex !== -1 ? lastSiblingIndex + 1 : currentItems.length;
        
        const parentItem = parentId ? currentItems.find(item => item.id === parentId) : null;
        const level = parentItem ? parentItem.level + 1 : 0;
        
        const newItem: BoqItem = {
            id: generateId(),
            itemNumber: 'TEMP',
            description: '',
            unit: isHeader ? '' : 'مقطوعية',
            quantity: isHeader ? 0 : 1,
            sellingUnitPrice: 0,
            notes: '',
            parentId: parentId,
            level: level,
            isHeader: isHeader,
        };

        append(newItem);

    }, [append, getValues]);


    const handleMasterItemSelect = useCallback((index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            const currentItem = getValues(`items.${index}`);
            update(index, {
                ...currentItem,
                itemId: masterItem.id,
                description: masterItem.name,
                unit: masterItem.unit || (masterItem.isHeader ? '' : 'مقطوعية'),
                isHeader: masterItem.isHeader || false,
            });
        }
    }, [masterItems, getValues, update]);
    
    const totalValue = useMemo(() => {
        return (watchedItems || []).reduce((sum, item) => {
            if (item.isHeader) return sum;
            const isLumpSum = item.unit === 'مقطوعية';
            const quantity = isLumpSum ? 1 : (item.quantity || 0);
            return sum + (quantity * (item.sellingUnitPrice || 0));
        }, 0);
    }, [watchedItems]);

    const onSubmit = (data: BoqFormValues) => {
        onSave(data);
    };
    
    const rootItems = useMemo(() => {
        return fields.map((field, index) => ({ field, index })).filter(({ field }) => field.parentId === null);
    }, [fields]);
    
    useEffect(() => {
        const items = getValues('items');
        if (!items) return;

        const itemMap = new Map(items.map((item, index) => [item.id, { ...item, originalIndex: index }]));
        const childrenMap = new Map<string, string[]>();
        const newOrder: any[] = [];
        
        items.forEach(item => {
            if (item.parentId) {
                if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
                childrenMap.get(item.parentId)!.push(item.id);
            }
        });

        function processNode(itemId: string) {
            const item = itemMap.get(itemId);
            if (!item) return;

            newOrder.push(items[item.originalIndex]);

            const children = childrenMap.get(itemId);
            if (children) {
                children.forEach(childId => processNode(childId));
            }
        }
        
        items.forEach(item => {
            if (!item.parentId) {
                processNode(item.id);
            }
        });

    }, [fields, getValues]);

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
                            {rootItems.map(({ field, index }) => (
                                <BoqItemsRenderer 
                                    key={field.id}
                                    control={control}
                                    level={0}
                                    parentId={null}
                                    parentNumber=""
                                    itemIndex={index}
                                    onAddItem={handleAddItem}
                                    onMasterItemSelect={handleMasterItemSelect}
                                    masterItems={masterItems}
                                    masterItemsLoading={masterItemsLoading}
                                />
                            ))}
                        </div>

                         {errors.items && <p className="text-destructive text-sm mt-2">{errors.items?.root?.message || errors.items?.message}</p>}
                        <div className="flex justify-center mt-4">
                           <Button type="button" variant="secondary" onClick={() => handleAddItem(null, true)}>
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

