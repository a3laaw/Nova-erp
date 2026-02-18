'use client';
import * as React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch, serverTimestamp, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter
} from '@/components/ui/table';


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

type BoqItemWithChildren = BoqFormValues['items'][number] & {
    _index: number;
    children: BoqItemWithChildren[];
    total: number;
    parentReferenceId: string | null;
};


const BoqItemRowRenderer = React.memo(({
    node, level, wbs, parentReferenceId, control, register, setValue, onDelete, onAdd, fields, masterItemsMap, masterItemsLoading
}: {
    node: BoqItemWithChildren;
    level: number;
    wbs: string;
    parentReferenceId: string | null;
    control: any;
    register: any;
    setValue: any;
    onDelete: (index: number) => void;
    onAdd: (parentId: string, isHeader: boolean, insertIndex: number) => void;
    fields: (BoqItem & { id: string })[];
    masterItemsMap: Map<string | null, any[]>;
    masterItemsLoading: boolean;
}) => {
  const item = useWatch({ control, name: `items.${node._index}` });

  const handleMasterItemSelect = (value: string) => {
    const allMasterItems = Array.from(masterItemsMap.values()).flat();
    const selectedItem = allMasterItems.find(i => i.value === value);
    if (selectedItem) {
        setValue(`items.${node._index}.itemId`, value, { shouldValidate: true });
        setValue(`items.${node._index}.description`, selectedItem.label, { shouldValidate: true });
        const hasChildren = masterItemsMap.has(value);
        const isHeader = selectedItem.isHeader || hasChildren;
        setValue(`items.${node._index}.isHeader`, isHeader, { shouldValidate: true });
        setValue(`items.${node._index}.unit`, isHeader ? '' : (selectedItem.unit || 'مقطوعية'), { shouldValidate: true });
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
    onAdd(node.id, isHeader, lastDescendantIndex + 1);
  };
    
    return (
        <React.Fragment>
            <TableRow className={cn(item.isHeader && "bg-muted/50")}>
                <TableCell className="font-mono text-xs text-muted-foreground">{wbs}</TableCell>
                <TableCell style={{ paddingRight: `${level * 1.5 + 1}rem` }}>
                    <InlineSearchList
                        value={item.itemId || ''}
                        onSelect={handleMasterItemSelect}
                        options={masterItemsMap.get(parentReferenceId) || []}
                        placeholder={masterItemsLoading ? "جاري التحميل... (يمكنك الكتابة)" : "اختر بندًا أو اكتب..."}
                    />
                </TableCell>
                <TableCell><Input {...register(`items.${node._index}.unit`)} className="min-w-[80px]" disabled={item.isHeader} /></TableCell>
                <TableCell><Input type="number" step="any" {...register(`items.${node._index}.quantity`)} className="min-w-[80px]" disabled={item.isHeader} /></TableCell>
                <TableCell><Input type="number" step="0.001" {...register(`items.${node._index}.sellingUnitPrice`)} className="min-w-[100px]" disabled={item.isHeader} /></TableCell>
                <TableCell className="text-left font-mono font-semibold">{formatCurrency(node.total)}</TableCell>
                <TableCell>
                    <div className="flex items-center">
                        {item.isHeader && level === 0 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(true)}><PlusCircle className="ml-1 h-4 w-4 text-primary"/> قسم</Button>
                        )}
                        {item.isHeader && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(false)}><PlusCircle className="ml-1 h-4 w-4"/> بند</Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(node._index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {node.children.map((childNode, childIndex) => (
                <BoqItemRowRenderer
                    key={childNode.id}
                    node={childNode}
                    level={level + 1}
                    wbs={`${wbs}.${childIndex + 1}`}
                    parentReferenceId={item.itemId || null}
                    control={control}
                    register={register}
                    setValue={setValue}
                    onDelete={onDelete}
                    onAdd={onAdd}
                    fields={fields}
                    masterItemsMap={masterItemsMap}
                    masterItemsLoading={masterItemsLoading}
                />
            ))}
        </React.Fragment>
    );
});
BoqItemRowRenderer.displayName = 'BoqItemRowRenderer';

export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
    const isEditing = !!initialData;
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const { data: masterItemsData, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);
    const [itemIndexToDelete, setItemIndexToDelete] = React.useState<number | null>(null);

    const { control, handleSubmit, register, watch, reset, setValue, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: initialData || { name: '', clientName: '', status: 'تقديري', items: [] },
    });

    const { fields, append, remove, insert } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');
    
    React.useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                items: initialData.items?.map(item => ({ ...item, id: item.id || generateId() })),
            });
        }
    }, [initialData, reset]);
    
    const masterItemsMap = React.useMemo(() => {
        const map = new Map<string | null, any[]>();
        (masterItemsData || []).forEach(item => {
            const parentId = item.parentBoqReferenceItemId || null;
            if (!map.has(parentId)) map.set(parentId, []);
            map.get(parentId)!.push({ value: item.id!, label: item.name, ...item });
        });
        map.forEach(value => value.sort((a,b) => (a.order ?? 99) - (b.order ?? 99) || a.label.localeCompare(b.label, 'ar')));
        return map;
    }, [masterItemsData]);
    
    const { boqTree, grandTotal } = React.useMemo(() => {
        const items = watchedItems || [];
        const itemsWithChildren: BoqItemWithChildren[] = items.map((item, index) => ({
            ...item,
            _index: index,
            children: [],
            total: 0,
            parentReferenceId: null
        }));
        
        const map = new Map(itemsWithChildren.map(item => [item.id, item]));
        const roots: BoqItemWithChildren[] = [];

        itemsWithChildren.forEach(item => {
            if (item.parentId && map.has(item.parentId)) {
                const parent = map.get(item.parentId)!;
                parent.children.push(item);
                item.parentReferenceId = parent.itemId || null;
            } else {
                item.parentReferenceId = null;
                roots.push(item);
            }
        });

        function calculateTotals(nodes: BoqItemWithChildren[]): number {
            let total = 0;
            for (const node of nodes) {
                if (node.isHeader) {
                    node.total = calculateTotals(node.children);
                } else {
                    node.total = (Number(node.quantity) || 0) * (Number(node.sellingUnitPrice) || 0);
                }
                total += node.total;
            }
            return total;
        }

        const grandTotal = calculateTotals(roots);
        
        return { boqTree: roots, grandTotal };
    }, [watchedItems]);

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

    const handleAddRootItem = () => {
        append({
            id: generateId(), description: '', unit: '', quantity: 1,
            sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '',
        });
    };

    const onSubmit = (data: BoqFormValues) => { onSave(data); };
    
    return (
        <Card dir="rtl">
            <form onSubmit={handleSubmit(onSubmit)}>
                <CardHeader>
                    <CardTitle>{isEditing ? 'تعديل جدول الكميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} /></div>
                        <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
                        <div className="grid gap-2"><Label>الحالة</Label><Controller name="status" control={control} render={({field}) => (<Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent></Select>)}/></div>
                    </div>
                    <Separator />
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">م</TableHead>
                                    <TableHead className="w-2/5">بيان الأعمال</TableHead>
                                    <TableHead>الوحدة</TableHead>
                                    <TableHead>الكمية</TableHead>
                                    <TableHead>سعر الوحدة</TableHead>
                                    <TableHead className="text-left">الإجمالي</TableHead>
                                    <TableHead className="w-24">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {boqTree.length === 0 ? (
                                    <TableRow><TableCell colSpan={7} className="text-center h-24">ابدأ بإضافة قسم رئيسي.</TableCell></TableRow>
                                ) : boqTree.map((node, index) => (
                                    <BoqItemRowRenderer 
                                        key={node.id} 
                                        node={node} 
                                        level={0} 
                                        wbs={`${index + 1}`}
                                        parentReferenceId={null}
                                        control={control}
                                        register={register}
                                        setValue={setValue}
                                        onDelete={setItemIndexToDelete}
                                        onAdd={handleAddItem}
                                        fields={fields}
                                        masterItemsMap={masterItemsMap}
                                        masterItemsLoading={masterItemsLoading}
                                    />
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold text-lg bg-muted/50">
                                    <TableCell colSpan={5}>الإجمالي العام</TableCell>
                                    <TableCell colSpan={2} className="text-left font-mono">{formatCurrency(grandTotal)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                         <div className="flex justify-center p-2 border-t">
                            <Button type="button" variant="ghost" onClick={handleAddRootItem}>
                                <PlusCircle className="ml-2 h-4"/> إضافة قسم رئيسي
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving || masterItemsLoading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                </CardFooter>
            </form>
            <AlertDialog open={itemIndexToDelete !== null} onOpenChange={() => setItemIndexToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف هذا البند وجميع البنود الفرعية التابعة له.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90">نعم، قم بالحذف</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
