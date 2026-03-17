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
  Info,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { CardTitle, CardContent, CardDescription } from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldErrors,
} from 'react-hook-form';

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
  quantity: z.preprocess((v) => (v === '' ? 0 : parseFloat(String(v || '0'))), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => (v === '' ? 0 : parseFloat(String(v || '0'))), z.number().min(0)),
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
      if (!isHeader) {
        return (Number(quantity) || 0) * (Number(price) || 0);
      }

      const sumBranch = (parentUid: string): number => {
        let total = 0;
        watchedItems.forEach((item) => {
          if (item.parentId === parentUid) {
            if (item.isHeader) {
              total += sumBranch(item.uid);
            } else {
              total += (Number(item.quantity) || 0) * (Number(item.sellingUnitPrice) || 0);
            }
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
          if (watchedItems[i].parentId === watchedItems[parentIndex].uid) {
            lastIndex = findLastDescendantIndex(i);
          } else if (watchedItems[i].level <= watchedItems[parentIndex].level) {
            break;
          }
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

    const itemError = errors?.items?.[node._index];

    return (
      <React.Fragment>
        <TableRow className={cn('transition-colors border-b last:border-0', isHeader ? 'bg-muted/40 font-bold border-b-2' : 'hover:bg-muted/20')}>
          <TableCell className="font-mono text-[10px] text-muted-foreground text-center border-l px-1 w-10">
            {wbs}
          </TableCell>
          <TableCell style={{ paddingRight: `${level * 1.2}rem` }} className="px-2">
            <div className="flex flex-col gap-1.5 py-1">
              <InlineSearchList
                value={itemId || ''}
                onSelect={handleMasterItemSelect}
                options={masterItemsMap.get(parentReferenceId) || []}
                placeholder={masterItemsLoading ? 'تحميل...' : 'بند مرجعي'}
                className="bg-background shadow-sm h-8 text-xs border-dashed"
              />
              <Textarea
                {...register(`items.${node._index}.description`)}
                placeholder="بيان الأعمال..."
                rows={1}
                className={cn('text-xs mt-0.5 min-h-[34px] border-muted focus:border-primary transition-all resize-none overflow-hidden h-auto font-bold text-gray-800', itemError?.description ? 'border-destructive' : '')}
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
              <Input {...register(`items.${node._index}.unit`)} className="h-9 text-center bg-background text-[10px] font-bold rounded-lg border-none shadow-inner" placeholder="الوحدة" />
            ) : (
              <span className="text-[10px] text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="px-1 w-20 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="any" 
                {...register(`items.${node._index}.quantity`)} 
                onWheel={(e) => e.currentTarget.blur()}
                className="h-9 dir-ltr text-center font-mono text-base font-black rounded-lg border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            ) : (
              <span className="text-base text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="px-1 w-24 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="0.001" 
                {...register(`items.${node._index}.sellingUnitPrice`)} 
                onWheel={(e) => e.currentTarget.blur()}
                className="h-9 dir-ltr text-center font-mono text-xs font-black text-primary rounded-lg border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
              />
            ) : (
              <span className="text-xs text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="text-left font-mono font-black border-r bg-muted/10 px-2 w-28">
            <div className={cn('py-1 text-xs tracking-tight truncate', isHeader ? 'text-primary border-b border-primary/20' : 'text-foreground')}>
              {formatCurrency(branchTotal)}
            </div>
          </TableCell>
          <TableCell className="px-2 border-r w-40">
            <Textarea
              {...register(`items.${node._index}.notes`)}
              placeholder="ملاحظات..."
              rows={1}
              className="text-[10px] min-h-[36px] bg-white border-none shadow-inner rounded-2xl px-3 py-2 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all resize-none overflow-hidden h-auto font-medium text-gray-800"
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
                <Button type="button" size="icon" variant="outline" className="h-7 w-7 text-primary border-primary/20 hover:bg-primary/10" onClick={() => handleAddClick(false)} title="إضافة بند عمل">
                  <PlusCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => onDelete(node._index)}>
                <Trash2 className="h-3.5 w-3.5" />
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
    append({ uid: generateStableId(), description: '', unit: '', quantity: undefined as any, sellingUnitPrice: undefined as any, parentId: null, level: 0, isHeader: true, itemId: '' });
  }, [append]);

  const handleAddItem = React.useCallback((parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
    const parentItem = watchedItems?.find((f: any) => f.uid === parentId);
    const parentLevel = parentItem ? parentItem.level : -1;
    insert(insertAtIndex, { uid: generateStableId(), description: '', unit: isHeader ? '' : 'مقطوعية', quantity: undefined as any, sellingUnitPrice: undefined as any, parentId: parentId, level: parentLevel + 1, isHeader: isHeader, itemId: '' });
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

  return (
    <div className="bg-background">
      <div className="space-y-0">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b shadow-sm p-4">
          <div className="flex justify-between items-center max-w-full px-2 mx-auto">
            {/* Left Side: Stats (Numbers) - The Image Style Pill */}
            <div className="flex items-center gap-1 bg-white/50 p-1.5 rounded-full border shadow-sm">
                <div className="bg-primary px-6 py-2.5 rounded-full flex flex-col items-center">
                    <span className="text-[8px] font-black text-white/70 uppercase tracking-widest leading-none">إجمالي المشروع</span>
                    <div className="text-xl font-black text-white font-mono leading-none mt-1">
                        <span className="text-[10px] ml-1">KWD</span>
                        {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                    </div>
                </div>
                <div className="px-4 py-2 flex flex-col items-center">
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none">عدد البنود</span>
                    <div className="text-lg font-black text-slate-800 leading-none mt-1">{fields.length}</div>
                </div>
            </div>

            {/* Right Side: Title/Icon (Speech) */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <CardTitle className="text-xl font-black tracking-tight text-slate-900 flex items-center justify-end gap-2">
                    مُحرر جداول الكميات
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </CardTitle>
                <CardDescription className="text-[10px] font-bold">إدارة الحصر والتسعير المرجعي والبنود الفنية</CardDescription>
              </div>
              <div className="p-2.5 bg-primary/10 rounded-2xl text-primary shadow-inner">
                <ListTree className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit && onSubmit ? handleSubmit(onSubmit) : undefined}>
          <CardContent className="p-0 max-w-full mx-auto mt-4 px-2 pb-32">
            <div className="grid md:grid-cols-3 gap-4 p-6 mb-4 border rounded-[2rem] bg-card shadow-sm">
              <div className="grid gap-1.5">
                <Label className="font-black text-[10px] text-muted-foreground uppercase pr-1">اسم / مرجع الجدول *</Label>
                <Input style={{borderRadius: '1.25rem'}} {...register('name')} placeholder="مثال: جدول كميات فيلا السيد محمد" className={cn('h-10 text-base font-bold border-2', errors.name ? 'border-destructive' : '')} />
                {errors.name && <p className="text-[10px] text-destructive px-1">{errors.name.message}</p>}
              </div>
              <div className="grid gap-1.5">
                <Label className="font-black text-[10px] text-muted-foreground uppercase pr-1">العميل (المحتمل)</Label>
                <Input style={{borderRadius: '1.25rem'}} {...register('clientName')} className="h-10" placeholder="أدخل اسم العميل..." />
              </div>
              <div className="grid gap-1.5">
                <Label className="font-black text-[10px] text-muted-foreground uppercase pr-1">الحالة التعاقدية</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 rounded-[1.25rem] border-2 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="تقديري">تقديري</SelectItem>
                      <SelectItem value="تعاقدي">تعاقدي</SelectItem>
                      <SelectItem value="منفذ">منفذ</SelectItem>
                    </SelectContent>
                  </Select>
                )}/>
              </div>
            </div>

            <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-2xl bg-card border-slate-200">
              <Table className="w-full border-collapse">
                <TableHeader className="bg-primary/10 text-primary">
                  <TableRow className="hover:bg-transparent border-none h-12">
                    <TableHead className="text-center font-black text-[10px] uppercase text-primary border-l border-primary/10 w-10">م</TableHead>
                    <TableHead className="font-black text-xs text-primary px-4">بيان الأعمال التفصيلي</TableHead>
                    <TableHead className="text-center font-black text-xs text-primary border-l border-primary/10 w-16">الوحدة</TableHead>
                    <TableHead className="text-center font-black text-xs text-primary border-l border-primary/10 w-20">الكمية</TableHead>
                    <TableHead className="text-center font-black text-xs text-primary border-l border-primary/10 w-24">سعر الوحدة</TableHead>
                    <TableHead className="text-left font-black text-xs text-primary border-l border-primary/10 w-28">الإجمالي</TableHead>
                    <TableHead className="font-black text-xs text-primary border-l border-primary/10 w-40">ملاحظات</TableHead>
                    <TableHead className="text-center font-black text-xs text-primary w-16">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boqTree.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
                          <Info className="h-12 w-12 opacity-20" />
                          <p className="font-bold">الجدول فارغ حالياً. ابدأ بإضافة قسم رئيسي لتنظيم حصر الكميات.</p>
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
            </div>

            <div className="flex justify-center p-8">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRootSection}
                className="h-12 px-10 rounded-2xl border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 transition-all font-black text-primary gap-2 group"
              >
                <PlusCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                إضافة قسم رئيسي جديد (WBS)
              </Button>
            </div>
          </CardContent>

          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t shadow-[0_-10px_30px_rgba(0,0,0,0.1)] no-print">
            <div className="max-w-7xl mx-auto flex justify-between items-center p-5 px-8">
              <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground bg-muted/50 px-5 py-2 rounded-full border">
                <Calculator className="h-4 w-4 text-primary" />
                <span className="text-slate-900 font-black">تم حصر وتثمين {fields.length} بنود بدقة</span>
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-11 px-8 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-11 px-14 rounded-xl font-black text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[220px]">
                  {isSaving ? (
                    <>
                      <Loader2 className="ml-3 h-5 w-5 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="ml-3 h-5 w-5" />
                      حفظ الجدول النهائي
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
