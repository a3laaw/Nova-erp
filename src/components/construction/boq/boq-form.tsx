
'use client';

import * as React from 'react';
import { useFieldArray, Controller, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy } from 'firebase/firestore';
import type { BoqReferenceItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Save,
  PlusCircle,
  Trash2,
  ListTree,
  Calculator,
  X,
  AlertTriangle,
  Package
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldErrors,
} from 'react-hook-form';
import { useToast } from '@/hooks/use-toast';

const generateStableId = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

export const itemSchema = z.object({
  uid: z.string(),
  itemNumber: z.string().optional(),
  description: z.string().min(1, 'الوصف مطلوب.'),
  unit: z.string().optional(),
  quantity: z.preprocess((v) => (v === '' || v === null ? 0 : parseFloat(String(v))), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => (v === '' || v === null ? 0 : parseFloat(String(v))), z.number().min(0)),
  notes: z.string().optional(),
  parentId: z.string().nullable(),
  level: z.number(),
  isHeader: z.boolean(),
  itemId: z.string().optional(),
});

export const boqFormSchema = z.object({
  name: z.string().min(1, 'اسم الجدول مطلوب.'),
  clientName: z.string().optional(),
  status: z.enum(['تقديري', 'تعاقدي', 'منفذ']),
  items: z.array(itemSchema),
});

export type BoqFormValues = z.infer<typeof boqFormSchema>;

type BoqItemWithChildren = BoqFormValues['items'][number] & {
  _index: number;
  children: BoqItemWithChildren[];
};

const BoqItemRowRenderer = React.memo(
  ({
    node,
    level,
    wbs,
    parentReferenceId,
    control,
    register,
    setValue,
    onDelete,
    onAdd,
    watchedItems,
    masterItemsMap,
    masterItemsLoading,
    errors,
  }: {
    node: BoqItemWithChildren;
    level: number;
    wbs: string;
    parentReferenceId: string | null;
    control: Control<BoqFormValues>;
    register: UseFormRegister<BoqFormValues>;
    setValue: UseFormSetValue<BoqFormValues>;
    onDelete: (index: number) => void;
    onAdd: (parentId: string, isHeader: boolean, insertIndex: number) => void;
    watchedItems: BoqFormValues['items'];
    masterItemsMap: Map<string | null, any[]>;
    masterItemsLoading: boolean;
    errors: FieldErrors<BoqFormValues>;
  }) => {
    const quantity = useWatch({ control, name: `items.${node._index}.quantity` });
    const price = useWatch({ control, name: `items.${node._index}.sellingUnitPrice` });
    const isHeader = useWatch({ control, name: `items.${node._index}.isHeader` });
    const itemId = useWatch({ control, name: `items.${node._index}.itemId` });

    const branchTotal = React.useMemo(() => {
      if (!isHeader) return (Number(quantity) || 0) * (Number(price) || 0);
      const sumBranch = (parentUid: string): number => {
        let total = 0;
        watchedItems.forEach((item) => {
          if (item.parentId === parentUid) {
            if (item.isHeader) total += sumBranch(item.uid);
            else total += (Number(item.quantity) || 0) * (Number(item.sellingUnitPrice) || 0);
          }
        });
        return total;
      };
      return sumBranch(node.uid);
    }, [isHeader, quantity, price, watchedItems, node.uid]);

    const handleMasterItemSelect = React.useCallback(
      (value: string) => {
        const allMasterItems = Array.from(masterItemsMap.values()).flat();
        const selectedItem = allMasterItems.find((i) => i.value === value);
        if (selectedItem) {
          setValue(`items.${node._index}.itemId`, value, { shouldDirty: true });
          setValue(`items.${node._index}.description`, selectedItem.label, { shouldDirty: true });
          const shouldBeHeader = selectedItem.isHeader || masterItemsMap.has(value);
          setValue(`items.${node._index}.isHeader`, shouldBeHeader, { shouldDirty: true });
          setValue(`items.${node._index}.unit`, shouldBeHeader ? '' : selectedItem.unit || 'مقطوعية', { shouldDirty: true });
        }
      },
      [masterItemsMap, node._index, setValue]
    );

    const findLastDescendantIndex = React.useCallback(
      (parentIndex: number): number => {
        let lastIndex = parentIndex;
        for (let i = parentIndex + 1; i < watchedItems.length; i++) {
          if (watchedItems[i].parentId === watchedItems[parentIndex].uid) lastIndex = findLastDescendantIndex(i);
          else if (watchedItems[i].level <= watchedItems[parentIndex].level) break;
        }
        return lastIndex;
      },
      [watchedItems]
    );

    const handleAddClick = React.useCallback(
      (headerMode: boolean) => {
        const lastDescendantIndex = findLastDescendantIndex(node._index);
        onAdd(node.uid, headerMode, lastDescendantIndex + 1);
      },
      [findLastDescendantIndex, node._index, node.uid, onAdd]
    );

    const itemError = (errors?.items as any)?.[node._index];

    return (
      <React.Fragment>
        <TableRow className={cn('transition-colors border-b last:border-0 h-auto', isHeader ? 'bg-muted/40 font-bold' : 'hover:bg-muted/5')}>
          <TableCell className="font-mono text-[9px] text-muted-foreground text-center border-l px-1 w-10">
            {wbs}
          </TableCell>
          <TableCell style={{ paddingRight: `${level * 1.2}rem` }} className="px-2 py-1.5 min-w-[300px]">
            <div className="flex flex-col gap-1.5">
              <InlineSearchList
                value={itemId || ''}
                onSelect={handleMasterItemSelect}
                options={masterItemsMap.get(parentReferenceId) || []}
                placeholder={masterItemsLoading ? '...' : 'مرجع'}
                className="bg-white/50 shadow-sm h-7 text-[10px] border-dashed rounded-lg"
              />
              <Textarea
                {...register(`items.${node._index}.description`)}
                placeholder="بيان الأعمال..."
                rows={1}
                className={cn('text-[11px] leading-tight bg-white rounded-lg shadow-inner border-none focus-visible:ring-1 focus-visible:ring-primary/30 transition-all resize-none overflow-hidden h-auto font-bold text-gray-800', itemError?.description ? 'ring-2 ring-destructive' : '')}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          </TableCell>
          <TableCell className="px-1 w-16 text-center">
            {!isHeader ? (
              <Input {...register(`items.${node._index}.unit`)} className="h-8 text-center bg-white text-[10px] font-black rounded-lg border-none shadow-inner" placeholder="وحدة" />
            ) : <span className="text-[10px] text-muted-foreground/40 font-black">-</span>}
          </TableCell>
          <TableCell className="px-1 w-20 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="any" 
                {...register(`items.${node._index}.quantity`)} 
                onWheel={(e) => e.currentTarget.blur()} 
                className="h-8 dir-ltr text-center font-mono text-sm font-black rounded-lg border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            ) : <span className="text-xs text-muted-foreground/40 font-black">-</span>}
          </TableCell>
          <TableCell className="px-1 w-24 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="0.001" 
                {...register(`items.${node._index}.sellingUnitPrice`)} 
                onWheel={(e) => e.currentTarget.blur()} 
                className="h-8 dir-ltr text-center font-mono text-[11px] font-black text-primary rounded-lg border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            ) : <span className="text-xs text-muted-foreground/40 font-black">-</span>}
          </TableCell>
          <TableCell className="text-left font-mono font-black border-r bg-muted/5 px-3 w-32">
            <div className={cn('py-1 text-[11px] truncate', isHeader ? 'text-primary border-b border-primary/20' : 'text-foreground')}>
              {formatCurrency(branchTotal)}
            </div>
          </TableCell>
          <TableCell className="px-2 border-r w-48">
            <Textarea
              {...register(`items.${node._index}.notes`)}
              placeholder="ملاحظات..."
              rows={1}
              className="text-[10px] min-h-[30px] bg-white border-none shadow-inner rounded-full px-4 py-1.5 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all resize-none overflow-hidden h-auto font-medium"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </TableCell>
          <TableCell className="text-center border-r px-1 w-16">
            <div className="flex items-center justify-center gap-1">
              {isHeader && (
                <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg text-primary border-primary/20" onClick={() => handleAddClick(false)}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive rounded-lg" onClick={() => onDelete(node._index)}>
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
            parentReferenceId={itemId || null}
            control={control}
            register={register}
            setValue={setValue}
            onDelete={onDelete}
            onAdd={onAdd}
            watchedItems={watchedItems}
            masterItemsMap={masterItemsMap}
            masterItemsLoading={masterItemsLoading}
            errors={errors}
          />
        ))}
      </React.Fragment>
    );
  }
);
BoqItemRowRenderer.displayName = 'BoqItemRowRenderer';

export function BoqForm({
  onClose,
  isSaving,
  isEditing,
  control,
  register,
  setValue,
  watch,
  errors,
  handleSubmit,
  onSubmit,
}: {
  onClose: () => void;
  isSaving: boolean;
  isEditing: boolean;
  control: Control<BoqFormValues>;
  register: UseFormRegister<BoqFormValues>;
  setValue: UseFormSetValue<BoqFormValues>;
  watch: UseFormWatch<BoqFormValues>;
  errors: FieldErrors<BoqFormValues>;
  handleSubmit?: any;
  onSubmit?: (data: BoqFormValues) => void;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const watchedItems = useWatch({ control, name: "items" });

  const { data: masterItemsData, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);
  const { fields, remove, insert, append } = useFieldArray({ control, name: 'items' });

  const masterItemsMap = React.useMemo(() => {
    const map = new Map<string | null, any[]>();
    (masterItemsData || []).forEach((item: BoqReferenceItem) => {
      const pId = item.parentBoqReferenceItemId || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push({ value: item.id!, label: item.name, ...item });
    });
    return map;
  }, [masterItemsData]);

  const { boqTree, grandTotal } = React.useMemo(() => {
    const items = watchedItems || [];
    const itemsWithChildren: BoqItemWithChildren[] = items.map((item: any, index: number) => ({ ...item, _index: index, children: [] }));
    const map = new Map(itemsWithChildren.map((item) => [item.uid, item]));
    const roots: BoqItemWithChildren[] = [];

    itemsWithChildren.forEach((item) => {
      const parent = item.parentId ? map.get(item.parentId) : null;
      if (parent) parent.children.push(item);
      else roots.push(item);
    });

    let totalSum = 0;
    items.forEach((item: any) => { if (!item.isHeader) totalSum += (Number(item.quantity) || 0) * (Number(item.sellingUnitPrice) || 0); });
    return { boqTree: roots, grandTotal: totalSum };
  }, [watchedItems]);

  const handleAddRootSection = React.useCallback(() => {
    append({ uid: generateStableId(), description: '', unit: '', quantity: 0, sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '' });
  }, [append]);

  const handleAddItem = React.useCallback((parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
    const parentItem = watchedItems?.find((f: any) => f.uid === parentId);
    const parentLevel = parentItem ? parentItem.level : -1;
    insert(insertAtIndex, { uid: generateStableId(), description: '', unit: isHeader ? '' : 'مقطوعية', quantity: 0, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1, isHeader: isHeader, itemId: '' });
  }, [watchedItems, insert]);

  const handleDelete = React.useCallback((index: number) => {
    const itemToDelete = watchedItems?.[index];
    if (!itemToDelete) { remove(index); return; }
    const indicesToRemove: number[] = [index];
    const findDescendants = (parentUid: string) => {
      watchedItems?.forEach((item, idx) => { if (item.parentId === parentUid) { indicesToRemove.push(idx); findDescendants(item.uid); } });
    };
    findDescendants(itemToDelete.uid);
    const sortedIndices = [...new Set(indicesToRemove)].sort((a, b) => b - a);
    sortedIndices.forEach((idx) => remove(idx));
  }, [watchedItems, remove]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!handleSubmit || !onSubmit) return;
    handleSubmit(onSubmit, (err: any) => {
        console.error("Validation Error:", err);
        toast({ variant: 'destructive', title: 'بيانات غير مكتملة', description: 'يرجى مراجعة بيان الأعمال والتأكد من إدخال الوصف لجميع البنود.' });
    })(e);
  };

  return (
    <div className="space-y-4 w-full" dir="rtl">
      <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden glass-effect">
        <div className="flex flex-col lg:flex-row justify-between items-center p-6 lg:px-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20"><ListTree className="h-7 w-7" /></div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-[#1e1b4b]">مُحرر المقايسة</h1>
                  <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-[#1e1b4b]/60 mt-0.5 uppercase tracking-widest">إدارة الحصر والتسعير المرجعي</p>
            </div>
          </div>

          <div className="flex items-center gap-0 bg-white/40 p-1 rounded-full border border-white/60 shadow-lg group">
              <div className="bg-[#7209B7] px-6 py-2.5 rounded-full flex flex-col items-center shadow-xl transition-all group-hover:brightness-110">
                  <span className="text-[8px] font-black text-white/80 uppercase tracking-widest leading-none mb-1">الإجمالي</span>
                  <div className="text-xl font-black text-white font-mono leading-none flex items-baseline">
                      <span className="text-[9px] ml-1 opacity-70 font-normal">KWD</span>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                  </div>
              </div>
              <div className="px-6 py-2.5 flex flex-col items-center border-r border-slate-900/10">
                  <span className="text-[8px] font-black text-[#1e1b4b]/50 uppercase tracking-widest leading-none mb-1">البنود</span>
                  <div className="text-xl font-black text-[#1e1b4b] leading-none">{fields.length}</div>
              </div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleFormSubmit}>
        <div className="space-y-4">
          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden glass-effect p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black text-slate-900/60 uppercase pr-1">الاسم / المرجع *</Label>
                <Input className="h-10 text-sm font-black rounded-xl border-2 bg-white/80 shadow-inner border-primary/10" {...register('name')} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black text-slate-900/60 uppercase pr-1">العميل</Label>
                <Input className="h-10 text-sm font-black rounded-xl border-2 bg-white/80 shadow-inner border-primary/10" {...register('clientName')} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black text-slate-900/60 uppercase pr-1">الحالة</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 rounded-xl border-2 bg-white/80 shadow-inner font-black text-sm border-primary/10"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl" className="rounded-xl shadow-2xl border-none">
                      <SelectItem value="تقديري">تقديري</SelectItem>
                      <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                      <SelectItem value="منفذ">منفذ</SelectItem>
                    </SelectContent>
                  </Select>
                )}/>
              </div>
            </div>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden glass-effect">
            <Table className="w-full border-collapse table-fixed">
              <TableHeader className="bg-primary/5">
                <TableRow className="hover:bg-transparent border-none h-12">
                  <TableHead className="text-center font-black text-[10px] uppercase border-l border-white/20 w-10 text-primary">م</TableHead>
                  <TableHead className="font-black text-xs px-4 text-primary">بيان الأعمال التفصيلي</TableHead>
                  <TableHead className="text-center font-black text-xs border-l border-white/20 w-16 text-primary">وحدة</TableHead>
                  <TableHead className="text-center font-black text-xs border-l border-white/20 w-20 text-primary">كمية</TableHead>
                  <TableHead className="text-center font-black text-xs border-l border-white/20 w-24 text-primary">السعر</TableHead>
                  <TableHead className="text-left font-black text-xs border-l border-white/20 w-32 text-primary">الإجمالي</TableHead>
                  <TableHead className="font-black text-xs border-l border-white/20 w-48 text-primary">ملاحظات</TableHead>
                  <TableHead className="text-center font-black text-xs w-16 text-primary">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqTree.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-64 text-center opacity-30"><Package className="h-12 w-12 mx-auto mb-2" /><p className="font-black">الجدول فارغ.</p></TableCell></TableRow>
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
                      onDelete={handleDelete}
                      onAdd={handleAddItem}
                      watchedItems={watchedItems || []}
                      masterItemsMap={masterItemsMap}
                      masterItemsLoading={masterItemsLoading}
                      errors={errors}
                    />
                  ))
                )}
              </TableBody>
            </Table>

            <div className="p-8 flex justify-center border-t border-white/20 bg-muted/5">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRootSection}
                className="h-12 px-12 rounded-2xl border-2 border-dashed border-primary/40 bg-white/20 hover:bg-primary/5 hover:border-primary transition-all font-black text-lg text-primary gap-2"
              >
                <PlusCircle className="h-5 w-5" /> إضافة قسم رئيسي
              </Button>
            </div>
          </Card>

          <div className="pb-10 pt-4 flex justify-center">
            <Card className="rounded-full border-none shadow-2xl glass-effect py-3 px-8 flex items-center justify-between gap-8 min-w-[50%]">
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSaving} className="h-10 px-8 rounded-full font-black text-sm shadow-xl bg-[#7209B7] text-white gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} اعتماد وحفظ
                </Button>
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-9 px-4 rounded-full font-bold text-xs text-slate-600 hover:bg-white/20">إلغاء</Button>
              </div>
              <div className="flex items-center gap-3">
                  <p className="text-[10px] font-black text-[#1e1b4b] text-right leading-none">تم حصر <br/><span className="text-primary text-sm font-black">{fields.length} بنود</span></p>
                  <div className="p-2 bg-primary/10 rounded-xl"><Calculator className="h-4 w-4 text-primary" /></div>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
