'use client';
import * as React from 'react';
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
import { Loader2, Save, X, PlusCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';


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

interface BoqFormProps {
    onSave: (data: BoqFormValues) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<BoqFormValues> | null;
    isSaving?: boolean;
}

const BoqItemRowRenderer = React.memo(({
  node,
  level,
  parentReferenceId,
  control,
  register,
  setValue,
  onDelete,
  handleAddItem,
  masterItemsMap,
  masterItemsLoading,
  fields,
}: {
  node: BoqFormValues['items'][0] & { _index: number; children: any[] };
  level: number;
  parentReferenceId: string | null;
  control: any;
  register: any;
  setValue: any;
  onDelete: (index: number) => void;
  handleAddItem: (parentId: string | null, isHeader: boolean, insertAtIndex: number) => void;
  masterItemsMap: Map<string | null, any[]>;
  masterItemsLoading: boolean;
  fields: any[];
}) => {
  const item = useWatch({ control, name: `items.${node._index}` });

  const handleMasterItemSelect = (itemId: string) => {
    const allMasterItems = Array.from(masterItemsMap.values()).flat();
    const selectedItem = allMasterItems.find(i => i.value === itemId);
    if (selectedItem) {
        setValue(`items.${node._index}.itemId`, itemId, { shouldValidate: true });
        setValue(`items.${node._index}.description`, selectedItem.label.replace(/^(\s|—)+/, '').trim(), { shouldValidate: true });

        const hasChildren = masterItemsMap.has(itemId);
        const isHeader = selectedItem.isHeader || hasChildren;
        
        setValue(`items.${node._index}.unit`, isHeader ? '' : (selectedItem.unit || 'مقطوعية'), { shouldValidate: true });
        setValue(`items.${node._index}.isHeader`, isHeader, { shouldValidate: true });
    }
  };
  
  const findLastDescendantIndex = (parentIndex: number): number => {
    let lastIndex = parentIndex;
    for (let i = parentIndex + 1; i < fields.length; i++) {
      if (fields[i].parentId === fields[parentIndex].id) {
        lastIndex = findLastDescendantIndex(i);
      } else if (fields[i].level <= fields[parentIndex].level) {
        break;
      }
    }
    return lastIndex;
  };
  
  const handleAddClick = (isHeader: boolean) => {
    const parentIndex = node._index;
    const lastDescendantIndex = findLastDescendantIndex(parentIndex);
    handleAddItem(node.id, isHeader, lastDescendantIndex + 1);
  };


  const lineTotal = item.isHeader ? 0 : (Number(item.quantity) || 0) * (Number(item.sellingUnitPrice) || 0);

  return (
    <div style={{ paddingRight: `${level * 1.5}rem` }} className="space-y-2 border-t first:border-t-0 py-2">
      <div className="flex items-start gap-2">
        <div className="flex-grow space-y-2">
          <div className="flex items-center gap-2">
            <InlineSearchList
                className="w-60"
                value={item.itemId || ''}
                onSelect={handleMasterItemSelect}
                options={masterItemsMap.get(parentReferenceId) || []}
                placeholder={masterItemsLoading ? "تحميل... (يمكنك الكتابة)" : "اختر بندًا مرجعيًا..."}
            />
            <Input {...register(`items.${node._index}.description`)} placeholder="أو اكتب وصفًا مخصصًا..." />
          </div>
          {!item.isHeader && (
            <div className="flex items-center gap-2 pl-8">
              <Input {...register(`items.${node._index}.unit`)} placeholder="الوحدة" className="w-24" />
              <Input type="number" step="any" {...register(`items.${node._index}.quantity`)} placeholder="الكمية" className="w-24" />
              <Input type="number" step="0.001" {...register(`items.${node._index}.sellingUnitPrice`)} placeholder="سعر الوحدة" className="w-24" />
              <div className="font-semibold w-24 text-left font-mono">{formatCurrency(lineTotal)}</div>
            </div>
          )}
        </div>
        <div className="flex items-center">
            {item.isHeader && (
                 <>
                    {level === 0 && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(true)}><PlusCircle className="ml-1 h-4 w-4 text-primary"/> قسم</Button>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(false)}><PlusCircle className="ml-1 h-4 w-4"/> بند</Button>
                </>
            )}
            <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(node._index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="pl-4 border-r pr-4 border-dashed">
          {node.children.map((childNode) => (
            <BoqItemRowRenderer
              key={childNode.id}
              node={childNode}
              level={level + 1}
              parentReferenceId={item.itemId || null}
              control={control}
              register={register}
              setValue={setValue}
              onDelete={onDelete}
              handleAddItem={handleAddItem}
              masterItemsMap={masterItemsMap}
              masterItemsLoading={masterItemsLoading}
              fields={fields}
            />
          ))}
        </div>
      )}
    </div>
  );
});
BoqItemRowRenderer.displayName = 'BoqItemRowRenderer';


export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
  const isEditing = !!initialData;
  const { firestore } = useFirebase();
  
  const { data: masterItemsData, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);
  
  const [itemIndexToDelete, setItemIndexToDelete] = React.useState<number | null>(null);

  const { control, handleSubmit, register, getValues, watch, reset, setValue, formState: { errors } } = useForm<BoqFormValues>({
    resolver: zodResolver(boqFormSchema),
    defaultValues: initialData || { name: '', clientName: '', status: 'تقديري', items: [] },
  });

  const { fields, append, remove, insert } = useFieldArray({ control, name: 'items' });
  const watchedItems = watch('items');
  
  const masterItemsMap = React.useMemo(() => {
    const map = new Map<string | null, any[]>();
    (masterItemsData || []).forEach(item => {
        const parentId = item.parentBoqReferenceItemId || null;
        if (!map.has(parentId)) map.set(parentId, []);
        map.get(parentId)!.push({ value: item.id!, label: item.name, ...item });
    });
    if (map.has(null)) {
        map.get(null)!.sort((a,b) => (a.order ?? 99) - (b.order ?? 99));
    }
    return map;
  }, [masterItemsData]);
  
  const { boqTree, totalValue } = React.useMemo(() => {
    const items = watchedItems || [];
    const map = new Map<string, BoqFormValues['items'][0] & { _index: number; children: any[] }>();
    const roots: (BoqFormValues['items'][0] & { _index: number; children: any[] })[] = [];
    let total = 0;

    items.forEach((item, index) => {
      map.set(item.id, { ...item, _index: index, children: [] });
      const itemTotal = (item.quantity || 0) * (item.sellingUnitPrice || 0);
      if (!item.isHeader) {
          total += itemTotal;
      }
    });

    items.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId);
        if (parent) parent.children.push(map.get(item.id)!);
      } else {
        roots.push(map.get(item.id)!);
      }
    });
    
    return { boqTree: roots, totalValue: total };
  }, [watchedItems]);
  
  React.useEffect(() => {
    if (initialData) {
      reset({
        ...initialData,
        items: initialData.items?.map(item => ({ ...item, id: item.id || generateId() })),
      });
    }
  }, [initialData, reset]);
  
  const handleAddItem = (parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
    const parentLevel = parentId ? fields.find(f => f.id === parentId)?.level ?? -1 : -1;
    insert(insertAtIndex, {
      id: generateId(), description: '', unit: isHeader ? '' : 'مقطوعية',
      quantity: 1, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1,
      isHeader: isHeader, itemId: '',
    });
  };
  
  const handleConfirmDelete = () => {
    if (itemIndexToDelete === null) return;
    
    const itemToRemove = fields[itemIndexToDelete];
    const descendantIndices: number[] = [];
    const findDescendants = (parentId: string) => {
        fields.forEach((field, idx) => {
            if (field.parentId === parentId) {
                descendantIndices.push(idx);
                findDescendants(field.id);
            }
        });
    };
    findDescendants(itemToRemove.id);
    
    const indicesToRemove = [itemIndexToDelete, ...descendantIndices].sort((a,b) => b-a);
    indicesToRemove.forEach(i => remove(i));
    setItemIndexToDelete(null);
  };
  
  const handleAddRootItem = (isHeader: boolean) => {
    append({
        id: generateId(), description: '', unit: isHeader ? '' : 'مقطوعية',
        quantity: 1, sellingUnitPrice: 0, parentId: null, level: 0,
        isHeader: isHeader, itemId: '',
    });
  };

  const onSubmit = (data: BoqFormValues) => {
    onSave(data);
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
          
          <div className="space-y-4">
            {boqTree.length === 0 ? (
                <div className="text-center p-4 text-muted-foreground">ابدأ بإضافة قسم رئيسي.</div>
            ) : (
             boqTree.map(node => (
              <BoqItemRowRenderer
                key={node.id}
                node={node}
                level={0}
                parentReferenceId={null}
                control={control}
                register={register}
                setValue={setValue}
                onDelete={setItemIndexToDelete}
                handleAddItem={handleAddItem}
                masterItemsMap={masterItemsMap}
                masterItemsLoading={masterItemsLoading}
                fields={fields}
                insert={insert}
              />
            ))
            )}
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
      
       <AlertDialog open={itemIndexToDelete !== null} onOpenChange={() => setItemIndexToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف هذا البند وجميع البنود الفرعية التابعة له بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">
                        نعم، قم بالحذف
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </Card>
  );
}
