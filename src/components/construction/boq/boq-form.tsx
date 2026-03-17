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
  Package,
  FileCheck,
  ChevronLeft
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { CardTitle, CardContent, CardDescription, Card } from '@/components/ui/card';
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
  quantity: z.preprocess((v) => (v === '' || v === null ? undefined : parseFloat(String(v))), z.number().min(0).optional()),
  sellingUnitPrice: z.preprocess((v) => (v === '' || v === null ? undefined : parseFloat(String(v))), z.number().min(0).optional()),
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
        <TableRow className={cn('transition-colors border-b last:border-0 h-24', isHeader ? 'bg-muted/40 font-bold border-b-2' : 'hover:bg-muted/5')}>
          <TableCell className="font-mono text-[10px] text-muted-foreground text-center border-l px-1 w-10">
            {wbs}
          </TableCell>
          <TableCell style={{ paddingRight: `${level * 1.5}rem` }} className="px-4">
            <div className="flex flex-col gap-2 py-2">
              <InlineSearchList
                value={itemId || ''}
                onSelect={handleMasterItemSelect}
                options={masterItemsMap.get(parentReferenceId) || []}
                placeholder={masterItemsLoading ? 'تحميل...' : 'بند مرجعي'}
                className="bg-white/50 shadow-sm h-9 text-xs border-dashed rounded-xl"
              />
              <Textarea
                {...register(`items.${node._index}.description`)}
                placeholder="بيان الأعمال التفصيلي..."
                rows={1}
                className={cn('text-sm mt-0.5 min-h-[44px] bg-white rounded-xl shadow-inner border-none focus-visible:ring-1 focus-visible:ring-primary/30 transition-all resize-none overflow-hidden h-auto font-bold text-gray-800', itemError?.description ? 'ring-1 ring-destructive' : '')}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          </TableCell>
          <TableCell className="px-1 w-20 text-center">
            {!isHeader ? (
              <Input {...register(`items.${node._index}.unit`)} className="h-11 text-center bg-white text-xs font-black rounded-full border-none shadow-inner" placeholder="الوحدة" />
            ) : (
              <span className="text-[10px] text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="px-1 w-24 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="any" 
                {...register(`items.${node._index}.quantity`)} 
                onWheel={(e) => e.currentTarget.blur()}
                className="h-11 dir-ltr text-center font-mono text-lg font-black rounded-full border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                placeholder=""
              />
            ) : (
              <span className="text-base text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="px-1 w-28 text-center">
            {!isHeader ? (
              <Input 
                type="number" 
                step="0.001" 
                {...register(`items.${node._index}.sellingUnitPrice`)} 
                onWheel={(e) => e.currentTarget.blur()}
                className="h-11 dir-ltr text-center font-mono text-sm font-black text-primary rounded-full border-none bg-white shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                placeholder=""
              />
            ) : (
              <span className="text-xs text-muted-foreground/40 font-black">-</span>
            )}
          </TableCell>
          <TableCell className="text-left font-mono font-black border-r bg-muted/5 px-4 w-32">
            <div className={cn('py-1 text-sm tracking-tight truncate', isHeader ? 'text-primary border-b border-primary/20' : 'text-foreground')}>
              {formatCurrency(branchTotal)}
            </div>
          </TableCell>
          <TableCell className="px-4 border-r min-w-[200px]">
            <Textarea
              {...register(`items.${node._index}.notes`)}
              placeholder="ملاحظات..."
              rows={1}
              className="text-xs min-h-[44px] bg-white border-none shadow-inner rounded-2xl px-4 py-3 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all resize-none overflow-hidden h-auto font-medium text-gray-800"
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </TableCell>
          <TableCell className="text-center border-r px-1 w-20">
            <div className="flex items-center justify-center gap-2">
              {isHeader && (
                <Button type="button" size="icon" variant="outline" className="h-9 w-9 rounded-full text-primary border-primary/20 hover:bg-primary/10 shadow-sm" onClick={() => handleAddClick(false)}>
                  <PlusCircle className="h-5 w-5" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-full" onClick={() => onDelete(node._index)}>
                <Trash2 className="h-5 w-5" />
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
    <div className="space-y-6 max-w-full mx-auto" dir="rtl">
      {/* ✨ RECONSTRUCTED GLASS HEADER (MATCHING IMAGE) ✨ */}
      <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect">
        <div className="flex flex-col lg:flex-row justify-between items-center p-8 lg:p-10 gap-8">
          
          {/* Right Side: Title & Icon block (Match Image) */}
          <div className="flex items-center gap-6 order-1 lg:order-2">
            <div className="p-4 bg-primary/10 rounded-[1.5rem] text-primary shadow-inner border border-primary/20">
              <ListTree className="h-10 w-10" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-[#1e1b4b]">مُحرر جداول الكميات</h1>
                  <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
              </div>
              <p className="text-sm font-black text-[#1e1b4b]/60 mt-1 uppercase tracking-widest">إدارة الحصر والتسعير المرجعي والبنود الفنية</p>
            </div>
          </div>

          {/* Left Side: The Smart Pill Stats Box (Match Image) */}
          <div className="flex items-center gap-0 bg-white/40 p-1.5 rounded-full border border-white/60 shadow-xl order-2 lg:order-1 group">
              <div className="bg-[#7209B7] px-10 py-4 rounded-full flex flex-col items-center shadow-2xl transition-all group-hover:brightness-110">
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-[0.2em] leading-none mb-1.5">إجمالي المشروع</span>
                  <div className="text-3xl font-black text-white font-mono leading-none flex items-baseline">
                      <span className="text-xs ml-2 opacity-70 font-normal">KWD</span>
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 3 })}
                  </div>
              </div>
              <div className="px-10 py-4 flex flex-col items-center border-r border-slate-900/10">
                  <span className="text-[10px] font-black text-[#1e1b4b]/50 uppercase tracking-[0.2em] leading-none mb-1.5">عدد البنود</span>
                  <div className="text-3xl font-black text-[#1e1b4b] leading-none">{fields.length}</div>
              </div>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit && onSubmit ? handleSubmit(onSubmit) : undefined}>
        <div className="space-y-8">
          {/* Global Info Section */}
          <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="grid gap-3">
                <Label className="font-black text-xs text-slate-900/60 uppercase pr-2">اسم / مرجع الجدول *</Label>
                <Input className="h-14 text-lg font-black rounded-[1.5rem] border-2 bg-white/80 shadow-inner border-primary/10" {...register('name')} placeholder="مثال: جدول كميات فيلا السيد محمد" />
                {errors.name && <p className="text-xs text-red-600 font-bold px-2">{errors.name.message}</p>}
              </div>
              <div className="grid gap-3">
                <Label className="font-black text-xs text-slate-900/60 uppercase pr-2">العميل (المحتمل)</Label>
                <Input className="h-14 text-lg font-black rounded-[1.5rem] border-2 bg-white/80 shadow-inner border-primary/10" {...register('clientName')} placeholder="أدخل اسم العميل..." />
              </div>
              <div className="grid gap-3">
                <Label className="font-black text-xs text-slate-900/60 uppercase pr-2">الحالة التعاقدية</Label>
                <Controller name="status" control={control} render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-14 rounded-[1.5rem] border-2 bg-white/80 shadow-inner font-black text-lg border-primary/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl" className="rounded-2xl shadow-2xl border-none">
                      <SelectItem value="تقديري">تقديري (Estimate)</SelectItem>
                      <SelectItem value="تعاقدي">تعاقدي (Contractual)</SelectItem>
                      <SelectItem value="منفذ">منفذ (Executed)</SelectItem>
                    </SelectContent>
                  </Select>
                )}/>
              </div>
            </div>
          </Card>

          {/* ✨ GIGANT CRYSTAL TABLE ✨ */}
          <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden glass-effect">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-primary/10">
                <TableRow className="hover:bg-transparent border-none h-16">
                  <TableHead className="text-center font-black text-xs uppercase border-l border-white/20 w-12 text-primary">م</TableHead>
                  <TableHead className="font-black text-sm px-6 text-primary">بيان الأعمال التفصيلي</TableHead>
                  <TableHead className="text-center font-black text-sm border-l border-white/20 w-24 text-primary">الوحدة</TableHead>
                  <TableHead className="text-center font-black text-sm border-l border-white/20 w-28 text-primary">الكمية</TableHead>
                  <TableHead className="text-center font-black text-sm border-l border-white/20 w-32 text-primary">سعر الوحدة</TableHead>
                  <TableHead className="text-left font-black text-sm border-l border-white/20 w-40 text-primary">الإجمالي</TableHead>
                  <TableHead className="font-black text-sm border-l border-white/20 w-full min-w-[300px] text-primary">ملاحظات إجرائية</TableHead>
                  <TableHead className="text-center font-black text-sm w-24 text-primary">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {boqTree.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-80 text-center">
                      <div className="flex flex-col items-center justify-center gap-6 opacity-30">
                        <Package className="h-20 w-20 text-slate-400" />
                        <p className="text-2xl font-black text-slate-900">الجدول فارغ حالياً.</p>
                        <p className="text-sm font-bold">ابدأ بإضافة قسم رئيسي جديد.</p>
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

            <div className="p-12 flex justify-center border-t border-white/20 bg-muted/5">
              <Button
                type="button"
                variant="outline"
                onClick={handleAddRootSection}
                className="h-16 px-16 rounded-3xl border-2 border-dashed border-primary/40 bg-white/20 hover:bg-primary/5 hover:border-primary transition-all font-black text-xl text-primary gap-3 group shadow-xl"
              >
                <PlusCircle className="h-7 w-7 group-hover:scale-110 transition-transform" />
                إضافة قسم رئيسي جديد (WBS)
              </Button>
            </div>
          </Card>

          {/* ✨ ACTION BAR (INSIDE MAIN SCREEN, NON-FIXED) ✨ */}
          <div className="pb-20">
            <Card className="rounded-[3rem] border-none shadow-2xl glass-effect p-8 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6 bg-white/40 px-8 py-4 rounded-full border border-white/60 shadow-inner">
                <Calculator className="h-6 w-6 text-primary" />
                <span className="text-slate-900 font-black text-lg">تم حصر وتثمين {fields.length} بنود بدقة تامة</span>
              </div>
              
              <div className="flex items-center gap-4 w-full md:w-auto">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={onClose} 
                  disabled={isSaving} 
                  className="h-16 px-12 rounded-3xl font-black text-xl text-slate-600 hover:bg-white/20"
                >
                  إلغاء التعديلات
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSaving} 
                  className="h-16 px-20 rounded-[2rem] font-black text-2xl shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all min-w-[350px] bg-[#7209B7] text-white gap-4"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-8 w-8" />
                      اعتماد وحفظ الجدول النهائي
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
