'use client';
import * as React from 'react';
import { useFieldArray, Controller, useWatch } from 'react-hook-form';
import type { BoqItem, BoqReferenceItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

const generateId = () => Math.random().toString(36).substring(2, 9);

type BoqItemWithChildren = BoqItem & {
    uid: string;
    _index: number;
    children: BoqItemWithChildren[];
    total: number;
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
    fields: any[];
    masterItemsMap: Map<string | null, any[]>;
    masterItemsLoading: boolean;
}) => {
  const item = useWatch({ control, name: `items.${node._index}` });

  const handleMasterItemSelect = (value: string) => {
    const allMasterItems = Array.from(masterItemsMap.values()).flat();
    const selectedItem = allMasterItems.find(i => i.value === value);
    if (selectedItem) {
        setValue(`items.${node._index}.itemId`, value, { shouldValidate: true, shouldDirty: true });
        setValue(`items.${node._index}.description`, selectedItem.label, { shouldValidate: true, shouldDirty: true });
        
        const hasChildren = masterItemsMap.has(value);
        const isHeader = selectedItem.isHeader || hasChildren;
        setValue(`items.${node._index}.isHeader`, isHeader, { shouldValidate: true, shouldDirty: true });
        setValue(`items.${node._index}.unit`, isHeader ? '' : (selectedItem.unit || 'مقطوعية'), { shouldValidate: true, shouldDirty: true });
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
            <TableRow className={cn(item.isHeader && "bg-muted/50")}>
                <TableCell className="font-mono text-xs text-muted-foreground">{wbs}</TableCell>
                <TableCell style={{ paddingRight: `${level * 1.5}rem` }}>
                     <div className="flex flex-col gap-2 min-w-[300px]">
                        <InlineSearchList
                            value={item.itemId || ''}
                            onSelect={handleMasterItemSelect}
                            options={masterItemsMap.get(parentReferenceId) || []}
                            placeholder={masterItemsLoading ? "تحميل..." : "اختر بندًا مرجعيًا..."}
                        />
                        <Textarea
                            {...register(`items.${node._index}.description`)}
                            placeholder="الوصف التفصيلي للبند..."
                            rows={1}
                            className="text-sm mt-1"
                        />
                    </div>
                </TableCell>
                <TableCell><Input {...register(`items.${node._index}.unit`)} className="min-w-[80px]" disabled={item.isHeader} /></TableCell>
                <TableCell><Input type="number" step="any" {...register(`items.${node._index}.quantity`)} className="min-w-[80px] dir-ltr" disabled={item.isHeader} /></TableCell>
                <TableCell><Input type="number" step="0.001" {...register(`items.${node._index}.sellingUnitPrice`)} className="min-w-[100px] dir-ltr" disabled={item.isHeader} /></TableCell>
                <TableCell className="text-left font-mono font-semibold">{formatCurrency(node.total)}</TableCell>
                <TableCell>
                    <Textarea {...register(`items.${node._index}.notes`)} placeholder="ملاحظات..." className="min-w-[150px]" rows={1} />
                </TableCell>
                <TableCell>
                    <div className="flex items-center">
                        {item.isHeader && (level === 0 || !item.parentId) && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(true)} title="إضافة قسم فرعي"><PlusCircle className="ml-1 h-4 w-4 text-primary"/> قسم</Button>
                        )}
                        {item.isHeader && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleAddClick(false)} title="إضافة بند عمل"><PlusCircle className="ml-1 h-4 w-4"/> بند</Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(node._index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

export function BoqForm({ onClose, isSaving, isEditing, control, register, errors, setValue, watch, masterItemsData, masterItemsLoading }: any) {
    const { fields, remove, insert, append } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');

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
            if (parent) {
                parent.children.push(item);
            } else {
                roots.push(item);
            }
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

    const handleAddRootItem = () => {
        append({
            uid: generateId(), description: '', unit: '', quantity: 1,
            sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '', notes: ''
        });
    };

    const handleAddItem = (parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
        const parentLevel = parentId ? watchedItems.find((f:any) => f.uid === parentId)?.level ?? -1 : -1;
        insert(insertAtIndex, {
          uid: generateId(), description: '', unit: isHeader ? '' : 'مقطوعية',
          quantity: 1, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1,
          isHeader: isHeader, itemId: '', notes: '',
        });
    };

    return (
        <div className="space-y-6">
            <CardHeader>
                <CardTitle>{isEditing ? 'تعديل جدول كميات' : 'إنشاء جدول كميات جديد'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid md:grid-cols-3 gap-4">
                    <div className="grid gap-2"><Label>اسم/مرجع جدول الكميات *</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
                    <div className="grid gap-2"><Label>اسم العميل (المحتمل)</Label><Input {...register('clientName')} /></div>
                    <div className="grid gap-2">
                        <Label>الحالة</Label>
                        <Controller name="status" control={control} render={({field}) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="تقديري">تقديري</SelectItem>
                                    <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                                    <SelectItem value="منفذ">منفذ</SelectItem>
                                </SelectContent>
                            </Select>
                        )}/>
                    </div>
                </div>
                <Separator />
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">م</TableHead>
                                <TableHead className="w-1/3">بيان الأعمال</TableHead>
                                <TableHead>الوحدة</TableHead>
                                <TableHead>الكمية</TableHead>
                                <TableHead>سعر الوحدة</TableHead>
                                <TableHead className="text-left">الإجمالي</TableHead>
                                <TableHead>الملاحظات</TableHead>
                                <TableHead className="w-24">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {boqTree.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24">ابدأ بإضافة قسم رئيسي.</TableCell></TableRow>
                            ) : boqTree.map((node, index) => (
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
                                    fields={watchedItems}
                                    masterItemsMap={masterItemsMap}
                                    masterItemsLoading={masterItemsLoading}
                                />
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-lg bg-muted/50">
                                <TableCell colSpan={5}>الإجمالي العام</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(grandTotal)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    <div className="flex justify-center p-4 border-t">
                        <Button type="button" variant="ghost" onClick={handleAddRootItem}>
                            <PlusCircle className="ml-2 h-4 w-4"/> إضافة قسم رئيسي
                        </Button>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2 border-t pt-6">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ جدول الكميات'}
                </Button>
            </CardFooter>
        </div>
    );
}
