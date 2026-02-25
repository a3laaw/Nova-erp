'use client';

import * as React from 'react';
import { useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch, serverTimestamp, orderBy } from 'firebase/firestore';
import type { BoqItem, BoqReferenceItem, SubcontractorType, CompanyActivityType, TransactionType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, PlusCircle, Trash2, ListTree, Calculator, Info, Minus, Plus } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

const generateId = () => Math.random().toString(36).substring(2, 9);

// --- Schema Definitions ---
export const itemSchema = z.object({
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

// --- Row Renderer ---
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
  const itemData = useWatch({
    control,
    name: `items.${node._index}`,
  });

  const lineTotal = React.useMemo(() => {
    if (itemData.isHeader) return node.total;
    return (Number(itemData.quantity) || 0) * (Number(itemData.sellingUnitPrice) || 0);
  }, [itemData.isHeader, itemData.quantity, itemData.sellingUnitPrice, node.total]);

  const handleMasterItemSelect = (value: string) => {
    const allMasterItems = Array.from(masterItemsMap.values()).flat();
    const selectedItem = allMasterItems.find(i => i.value === value);
    if (selectedItem) {
        setValue(`items.${node._index}.itemId`, value, { shouldDirty: true });
        setValue(`items.${node._index}.description`, selectedItem.label, { shouldDirty: true });
        const isHeader = selectedItem.isHeader || masterItemsMap.has(value);
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
            <TableRow className={cn(
                "transition-colors",
                itemData.isHeader ? "bg-muted/40 font-bold border-b-2" : "hover:bg-muted/20"
            )}>
                <TableCell className="font-mono text-xs text-muted-foreground w-12 text-center border-l px-1">{wbs}</TableCell>
                <TableCell style={{ paddingRight: `${level * 1.5}rem` }} className="min-w-[300px] px-2">
                     <div className="flex flex-col gap-2 py-1">
                        <InlineSearchList
                            value={itemData.itemId || ''}
                            onSelect={handleMasterItemSelect}
                            options={masterItemsMap.get(parentReferenceId) || []}
                            placeholder={masterItemsLoading ? "تحميل..." : "ابحث عن بند مرجعي..."}
                            className="bg-background shadow-sm h-9"
                        />
                        <Textarea
                            {...register(`items.${node._index}.description`)}
                            placeholder="بيان الأعمال التفصيلي..."
                            rows={1}
                            className="text-sm mt-1 min-h-[38px] border-muted focus:border-primary transition-all"
                        />
                    </div>
                </TableCell>
                <TableCell className="min-w-[100px] px-1">
                    <Input 
                        {...register(`items.${node._index}.unit`)} 
                        className="h-10 text-center bg-background text-sm font-semibold px-1" 
                        disabled={itemData.isHeader} 
                        placeholder="الوحدة" 
                    />
                </TableCell>
                <TableCell className="min-w-[120px] px-1">
                    <Input 
                        type="number" 
                        step="any" 
                        {...register(`items.${node._index}.quantity`)} 
                        className="h-10 dir-ltr text-center font-mono text-lg font-bold px-1" 
                        disabled={itemData.isHeader} 
                    />
                </TableCell>
                <TableCell className="min-w-[150px] px-1">
                    <Input 
                        type="number" 
                        step="0.001" 
                        {...register(`items.${node._index}.sellingUnitPrice`)} 
                        className="h-10 dir-ltr text-center font-mono text-lg font-bold text-primary px-1" 
                        disabled={itemData.isHeader} 
                    />
                </TableCell>
                <TableCell className="text-left font-mono font-bold min-w-[180px] border-r bg-muted/10 px-2">
                    <div className={cn(
                        "py-1 text-lg tracking-tight truncate",
                        itemData.isHeader ? "text-primary border-b-2 border-primary/20" : "text-foreground"
                    )}>
                        {formatCurrency(lineTotal)}
                    </div>
                </TableCell>
                <TableCell className="min-w-[180px] px-2">
                    <Textarea 
                        {...register(`items.${node._index}.notes`)} 
                        placeholder="ملاحظات..." 
                        className="h-10 min-h-[40px] text-xs bg-transparent border-transparent hover:border-muted focus:bg-background transition-all" 
                        rows={1} 
                    />
                </TableCell>
                <TableCell className="w-20 text-center border-r px-1">
                    <div className="flex items-center justify-center gap-1">
                        {itemData.isHeader && (
                            <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10" onClick={() => handleAddClick(false)} title="إضافة بند عمل">
                                <PlusCircle className="h-4 w-4"/>
                            </Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onDelete(node._index)}>
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
                    parentReferenceId={itemData.itemId || null}
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
export function BoqForm({ 
    onClose, 
    isSaving, 
    isEditing,
    control,
    register,
    setValue,
    watch,
    errors
}: { 
    onClose: () => void, 
    isSaving: boolean,
    isEditing: boolean,
    control: any,
    register: any,
    setValue: any,
    watch: any,
    errors: any
}) {
    const { firestore } = useFirebase();

    const masterItemsConstraints = React.useMemo(() => [orderBy('name')], []);
    const { data: masterItemsData, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', masterItemsConstraints);

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
        append({ uid: generateId(), description: '', unit: '', quantity: 1, sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '', notes: '' });
    };

    const handleAddItem = React.useCallback((parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
        const parent = fields.find(f => f.uid === parentId);
        const parentLevel = parent ? (parent as any).level : -1;
        insert(insertAtIndex, {
          uid: generateId(), description: '', unit: isHeader ? '' : 'مقطوعية',
          quantity: 1, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1,
          isHeader: isHeader, itemId: '', notes: '',
        });
    }, [fields, insert]);

    if (masterItemsLoading && !isEditing) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium animate-pulse">جاري تحميل البيانات المرجعية والهياكل الإنشائية...</p>
            </div>
        );
    }

    return (
        <div className="bg-background">
            <div className="space-y-0">
                <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b shadow-sm p-6">
                    <div className="flex justify-between items-center max-w-full px-4 mx-auto">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-inner">
                                <ListTree className="h-7 w-7" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-extrabold tracking-tight">مُحرر جداول الكميات</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                    إدارة الحصر والتسعير بنظام الهيكل الإنشائي (WBS)
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-8 bg-muted/30 px-6 py-3 rounded-2xl border border-muted-foreground/10">
                            <div className="flex flex-col items-start">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">إجمالي المشروع</Label>
                                <div className="text-3xl font-black text-primary font-mono tabular-nums tracking-tighter">
                                    {formatCurrency(grandTotal)}
                                </div>
                            </div>
                            <Separator orientation="vertical" className="h-10 mx-4" />
                            <div className="flex flex-col items-start">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">عدد البنود</Label>
                                <div className="text-2xl font-bold font-mono text-foreground/80">{fields.length}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <CardContent className="p-0 max-w-full mx-auto mt-6 px-4">
                    <div className="grid md:grid-cols-3 gap-8 p-8 mb-6 border rounded-3xl bg-card shadow-sm">
                        <div className="grid gap-2">
                            <Label className="font-bold text-sm text-foreground/70">اسم / مرجع الجدول *</Label>
                            <Input {...register('name')} placeholder="مثال: جدول كميات فيلا السيد محمد" className="h-11 text-lg border-2" />
                            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold text-sm text-foreground/70">العميل (المحتمل)</Label>
                            <Input {...register('clientName')} className="h-11" placeholder="أدخل اسم العميل..." />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold text-sm text-foreground/70">الحالة التعاقدية</Label>
                            <Controller name="status" control={control} render={({field}) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="h-11 border-2"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="تقديري">تقديري</SelectItem>
                                        <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                                        <SelectItem value="منفذ">منفذ</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}/>
                        </div>
                    </div>

                    <div className="border rounded-3xl overflow-hidden shadow-xl bg-card">
                        <div className="overflow-x-auto">
                            <Table className="w-full border-collapse">
                                <TableHeader className="bg-muted/80 backdrop-blur-sm">
                                    <TableRow className="hover:bg-transparent border-b-2">
                                        <TableHead className="w-12 text-center font-bold text-xs uppercase px-1">م</TableHead>
                                        <TableHead className="min-w-[300px] font-bold py-4 px-2">بيان الأعمال التفصيلي</TableHead>
                                        <TableHead className="min-w-[100px] text-center font-bold px-1">الوحدة</TableHead>
                                        <TableHead className="min-w-[120px] text-center font-bold px-1">الكمية</TableHead>
                                        <TableHead className="min-w-[150px] text-center font-bold px-1">سعر الوحدة</TableHead>
                                        <TableHead className="min-w-[180px] text-left font-bold border-r px-2">الإجمالي</TableHead>
                                        <TableHead className="min-w-[180px] font-bold px-2">ملاحظات</TableHead>
                                        <TableHead className="w-20 text-center font-bold border-r px-1">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {boqTree.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-64 text-center">
                                                <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                                    <Info className="h-12 w-12 opacity-20" />
                                                    <p>الجدول فارغ حالياً. ابدأ بإضافة قسم رئيسي من الأسفل.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        boqTree.map((node, index) => (
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
                                        ))
                                    )}
                                </TableBody>
                                <TableFooter className="bg-primary/5">
                                    <TableRow className="font-black text-xl hover:bg-transparent">
                                        <TableCell colSpan={5} className="text-right py-8 px-8">الإجمالي العام لجدول الكميات:</TableCell>
                                        <TableCell className="text-left font-mono text-primary py-8 border-r bg-primary/5 px-2">
                                            <div className="flex flex-col">
                                                <span className="text-2xl">{formatCurrency(grandTotal)}</span>
                                                <span className="text-[10px] font-normal text-muted-foreground mt-1">فقط لا غير</span>
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={2}></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
                    
                    <div className="flex justify-center p-12 mb-24">
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={handleAddRootSection} 
                            className="h-14 px-10 rounded-2xl shadow-lg border-2 border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-lg font-bold group"
                        >
                            <PlusCircle className="ml-3 h-6 w-6 text-primary group-hover:scale-110 transition-transform"/> 
                            إضافة قسم رئيسي جديد (WBS)
                        </Button>
                    </div>
                </CardContent>

                <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t shadow-[0_-10px_20px_rgba(0,0,0,0.05)] no-print">
                    <div className="max-w-7xl mx-auto flex justify-between items-center p-6 px-10">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border">
                            <Calculator className="h-4 w-4" />
                            تم حساب {fields.length} بنود بدقة هندسية
                        </div>
                        <div className="flex gap-4">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                            <Button 
                                type="submit" 
                                disabled={isSaving} 
                                className="h-12 px-12 rounded-xl font-extrabold text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[200px]"
                            >
                                {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin" /> : <Save className="ml-3 h-5 w-5" />} 
                                {isSaving ? 'جاري الحفظ...' : 'حفظ الجدول'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
