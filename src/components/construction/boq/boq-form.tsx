'use client';

import * as React from 'react';
import { useFieldArray, Controller, useWatch, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import type { BoqItem, BoqReferenceItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X, PlusCircle, Trash2, ListTree, Calculator } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- Schema Definitions ---
export const itemSchema = z.object({
  id: z.string(),
  uid: z.string(),
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
  name: z.string().min(1, "اسم الجدول مطلوب."),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

type BoqItemWithChildren = BoqFormValues['items'][number] & {
    _index: number;
    children: BoqItemWithChildren[];
    total: number;
};

// --- Row Renderer Component ---
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
    fields: any[];
    masterItemsMap: Map<string | null, any[]>;
    masterItemsLoading: boolean;
}) => {
  const item = useWatch({ control, name: `items.${node._index}` });

  const handleMasterItemSelect = (value: string) => {
    const allMasterItems = Array.from(masterItemsMap.values()).flat();
    const selectedItem = allMasterItems.find(i => i.value === value);
    if (selectedItem) {
        setValue(`items.${node._index}.itemId`, value, { shouldDirty: true });
        setValue(`items.${node._index}.description`, selectedItem.label, { shouldDirty: true });
        
        const hasChildrenInMaster = masterItemsMap.has(value);
        const isHeader = selectedItem.isHeader || hasChildrenInMaster;
        
        setValue(`items.${node._index}.isHeader`, isHeader, { shouldDirty: true });
        setValue(`items.${node._index}.unit`, isHeader ? '' : (selectedItem.unit || 'مقطوعية'), { shouldDirty: true });
    }
  };
    
  const findLastDescendantIndex = (parentIndex: number): number => {
    let lastIndex = parentIndex;
    for (let i = parentIndex + 1; i < fields.length; i++) {
        if (fields[i].parentId === fields[parentIndex].uid) {
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
    onAdd(node.uid, isHeader, lastDescendantIndex + 1);
  };
    
    return (
        <React.Fragment>
            <TableRow className={cn(item.isHeader && "bg-muted/50 font-bold")}>
                <TableCell className="font-mono text-xs text-muted-foreground w-16">{wbs}</TableCell>
                <TableCell style={{ paddingRight: `${level * 2}rem` }} className="min-w-[350px]">
                     <div className="flex flex-col gap-2">
                        <InlineSearchList
                            value={item.itemId || ''}
                            onSelect={handleMasterItemSelect}
                            options={masterItemsMap.get(parentReferenceId) || []}
                            placeholder={masterItemsLoading ? "تحميل..." : "اختر بندًا مرجعيًا..."}
                        />
                        <Textarea
                            {...register(`items.${node._index}.description`)}
                            placeholder="بيان الأعمال التفصيلي..."
                            rows={1}
                            className="text-sm mt-1 min-h-[38px] resize-none focus:min-h-[80px] transition-all"
                        />
                    </div>
                </TableCell>
                <TableCell className="w-24">
                    <Input {...register(`items.${node._index}.unit`)} className="h-9" disabled={item.isHeader} />
                </TableCell>
                <TableCell className="w-24">
                    <Input type="number" step="any" {...register(`items.${node._index}.quantity`)} className="h-9 dir-ltr text-center" disabled={item.isHeader} />
                </TableCell>
                <TableCell className="w-32">
                    <Input type="number" step="0.001" {...register(`items.${node._index}.sellingUnitPrice`)} className="h-9 dir-ltr text-center" disabled={item.isHeader} />
                </TableCell>
                <TableCell className="text-left font-mono font-bold w-32">
                    <div className={cn(item.isHeader ? "text-primary border-b border-primary/20 pb-1" : "")}>
                        {formatCurrency(node.total)}
                    </div>
                </TableCell>
                <TableCell className="min-w-[200px]">
                    <Textarea {...register(`items.${node._index}.notes`)} placeholder="ملاحظات..." className="h-9 min-h-[38px] text-xs resize-none" rows={1} />
                </TableCell>
                <TableCell className="w-24 text-center">
                    <div className="flex items-center justify-center gap-1">
                        {item.isHeader && (
                            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => handleAddClick(false)} title="إضافة بند عمل">
                                <PlusCircle className="h-4 w-4"/>
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(node._index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {node.children.map((childNode, childIndex) => (
                <BoqItemRowRenderer
                    key={childNode.uid}
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

// --- Main Form Component ---
export function BoqForm({ initialData, onSave, onClose, isSaving }: { initialData?: Partial<BoqFormValues> | null, onSave: (data: BoqFormValues) => Promise<void>, onClose: () => void, isSaving: boolean }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const masterItemsConstraints = React.useMemo(() => [orderBy('name')], []);
    const { data: masterItemsData, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', masterItemsConstraints);

    const { control, handleSubmit, register, watch, reset, setValue, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: [{ id: '', uid: generateId(), description: '', unit: '', quantity: 1, sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '', notes: '' }],
        },
    });

    const { fields, remove, insert, append, replace } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');

    React.useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                items: initialData.items?.map(item => ({ ...item, id: item.id || '', uid: item.uid || generateId() })) || [],
            });
        }
    }, [initialData, reset]);

    const masterItemsMap = React.useMemo(() => {
        const map = new Map<string | null, any[]>();
        (masterItemsData || []).forEach((item: BoqReferenceItem) => {
            const parentId = item.parentBoqReferenceItemId || null;
            if (!map.has(parentId)) map.set(parentId, []);
            map.get(parentId)!.push({ value: item.id!, label: item.name, ...item });
        });
        return map;
    }, [masterItemsData]);

    const { boqTree, grandTotal } = React.useMemo(() => {
        const items = watchedItems || [];
        const itemsWithChildren: BoqItemWithChildren[] = items.map((item: any, index: number) => ({
            ...item,
            _index: index,
            children: [],
            total: 0,
        }));
        
        const map = new Map(itemsWithChildren.map(item => [item.uid, item]));
        const roots: BoqItemWithChildren[] = [];

        itemsWithChildren.forEach(item => {
            const parent = item.parentId ? map.get(item.parentId) : null;
            if (parent) parent.children.push(item);
            else roots.push(item);
        });

        function calculateNodeTotal(node: BoqItemWithChildren): number {
            if (node.isHeader) {
                node.total = node.children.reduce((sum, child) => sum + calculateNodeTotal(child), 0);
            } else {
                node.total = (Number(node.quantity) || 0) * (Number(node.sellingUnitPrice) || 0);
            }
            return node.total;
        }

        const grandTotalValue = roots.reduce((sum, rootNode) => sum + calculateNodeTotal(rootNode), 0);
        return { boqTree: roots, grandTotal: grandTotalValue };
    }, [watchedItems]);

    const handleAddRootSection = () => {
        append({ id: '', uid: generateId(), description: '', unit: '', quantity: 1, sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '', notes: '' });
    };

    const handleAddItem = React.useCallback((parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
        const parent = fields.find(f => f.uid === parentId);
        const parentLevel = parent ? parent.level : -1;
        insert(insertAtIndex, {
          id: '', uid: generateId(), description: '', unit: isHeader ? '' : 'مقطوعية',
          quantity: 1, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1,
          isHeader: isHeader, itemId: '', notes: '',
        });
    }, [fields, insert]);

    if (masterItemsLoading && !initialData) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>جاري تحميل البيانات المرجعية...</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit(onSave)}>
            <div className="space-y-6">
                <CardHeader className="border-b bg-muted/20 pb-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full text-primary"><ListTree className="h-6 w-6" /></div>
                            <div>
                                <CardTitle className="text-2xl">تحرير جدول كميات هندسي</CardTitle>
                                <CardDescription>إدارة البنود، الحصر، والتسعير بنظام الهيكل الإنشائي (WBS).</CardDescription>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <Label className="text-xs text-muted-foreground mb-1">الإجمالي العام</Label>
                            <div className="text-3xl font-extrabold text-primary font-mono tracking-tighter">{formatCurrency(grandTotal)}</div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="grid md:grid-cols-3 gap-6 p-6 bg-background">
                        <div className="grid gap-2"><Label className="font-semibold">اسم / مرجع الجدول *</Label><Input {...register('name')} placeholder="مثال: جدول كميات فيلا السيد محمد" /></div>
                        <div className="grid gap-2"><Label className="font-semibold">العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
                        <div className="grid gap-2">
                            <Label className="font-semibold">الحالة التعاقدية</Label>
                            <Controller name="status" control={control} render={({field}) => (
                                <Select onValueChange={field.onChange} value={field.value}><SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent>
                                </Select>
                            )}/>
                        </div>
                    </div>

                    <div className="border-y overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-16">م</TableHead>
                                    <TableHead className="min-w-[350px]">بيان الأعمال</TableHead>
                                    <TableHead className="w-24">الوحدة</TableHead>
                                    <TableHead className="w-24 text-center">الكمية</TableHead>
                                    <TableHead className="w-32 text-center">سعر الوحدة</TableHead>
                                    <TableHead className="w-32 text-left">الإجمالي</TableHead>
                                    <TableHead className="min-w-[200px]">ملاحظات</TableHead>
                                    <TableHead className="w-24 text-center">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {boqTree.map((node, index) => (
                                    <BoqItemRowRenderer 
                                        key={node.uid} 
                                        node={node} 
                                        level={0} 
                                        wbs={`${index + 1}`}
                                        parentReferenceId={null}
                                        control={control}
                                        register={register}
                                        setValue={setValue}
                                        onDelete={(idx) => remove(idx)}
                                        onAdd={handleAddItem}
                                        fields={fields}
                                        masterItemsMap={masterItemsMap}
                                        masterItemsLoading={masterItemsLoading}
                                    />
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="font-extrabold text-lg">
                                    <TableCell colSpan={5} className="text-right py-6">الإجمالي العام:</TableCell>
                                    <TableCell className="text-left font-mono text-primary py-6">{formatCurrency(grandTotal)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <div className="flex justify-center p-6 bg-muted/5"><Button type="button" variant="secondary" onClick={handleAddRootSection} className="h-12 px-8"><PlusCircle className="ml-2 h-5 w-5 text-primary"/> إضافة قسم جديد</Button></div>
                </CardContent>

                <CardFooter className="flex justify-end gap-3 border-t p-6 bg-background sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} size="lg">إلغاء</Button>
                    <Button type="submit" disabled={isSaving} size="lg" className="px-10">{isSaving ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : <Save className="ml-2 h-5 w-5" />} حفظ الجدول</Button>
                </CardFooter>
            </div>
        </form>
    );
}
