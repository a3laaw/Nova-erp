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
  CalendarDays,
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
import { DateInput } from '@/components/ui/date-input';

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
  quantity: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  sellingUnitPrice: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  notes: z.string().optional(),
  parentId: z.string().nullable(),
  level: z.number(),
  isHeader: z.boolean(),
  itemId: z.string().optional(),
  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
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

    const lineTotal = React.useMemo(() => {
      if (isHeader) return 0;
      return (Number(quantity) || 0) * (Number(price) || 0);
    }, [isHeader, quantity, price]);

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
        <TableRow className={cn('transition-colors', isHeader ? 'bg-muted/40 font-bold border-b-2' : 'hover:bg-muted/20')}>
          <TableCell className="font-mono text-xs text-muted-foreground text-center border-l px-1">
            {wbs}
          </TableCell>
          <TableCell style={{ paddingRight: `${level * 1.5}rem` }} className="px-2">
            <div className="flex flex-col gap-2 py-1">
              <InlineSearchList
                value={itemId || ''}
                onSelect={handleMasterItemSelect}
                options={masterItemsMap.get(parentReferenceId) || []}
                placeholder={masterItemsLoading ? 'تحميل...' : 'ابحث عن بند...'}
                className="bg-background shadow-sm h-9"
              />
              <Textarea
                {...register(`items.${node._index}.description`)}
                placeholder="بيان الأعمال..."
                rows={1}
                className={cn('text-sm mt-1 min-h-[38px] border-muted focus:border-primary transition-all', itemError?.description ? 'border-destructive' : '')}
              />
            </div>
          </TableCell>
          <TableCell className="px-1">
            <div className="space-y-1">
                <Controller
                    control={control}
                    name={`items.${node._index}.startDate`}
                    render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-8 text-[10px]" placeholder="البدء"/>}
                />
                <Controller
                    control={control}
                    name={`items.${node._index}.endDate`}
                    render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-8 text-[10px]" placeholder="الانتهاء"/>}
                />
            </div>
          </TableCell>
          <TableCell className="px-1">
            <Input {...register(`items.${node._index}.unit`)} className="h-10 text-center bg-background text-sm font-semibold" disabled={isHeader} placeholder="الوحدة" />
          </TableCell>
          <TableCell className="px-1">
            <Input type="number" step="any" {...register(`items.${node._index}.quantity`)} className="h-10 dir-ltr text-center font-mono text-lg font-bold min-w-[80px]" disabled={isHeader} />
          </TableCell>
          <TableCell className="px-1">
            <Input type="number" step="0.001" {...register(`items.${node._index}.sellingUnitPrice`)} className="h-10 dir-ltr text-center font-mono text-lg font-bold text-primary min-w-[120px]" disabled={isHeader} />
          </TableCell>
          <TableCell className="text-left font-mono font-bold border-r bg-muted/10 px-3">
            <div className={cn('py-1 text-lg tracking-tight truncate min-w-[140px]', isHeader ? 'text-primary border-b-2 border-primary/20' : 'text-foreground')}>
              {isHeader ? '-' : formatCurrency(lineTotal)}
            </div>
          </TableCell>
          <TableCell className="text-center border-r px-1">
            <div className="flex items-center justify-center gap-1">
              {isHeader && (
                <Button type="button" size="icon" variant="outline" className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10" onClick={() => handleAddClick(false)} title="إضافة بند عمل">
                  <PlusCircle className="h-4 w-4" />
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
    append({ uid: generateStableId(), description: '', unit: '', quantity: 1, sellingUnitPrice: 0, parentId: null, level: 0, isHeader: true, itemId: '', notes: '', startDate: null, endDate: null });
  }, [append]);

  const handleAddItem = React.useCallback((parentId: string | null, isHeader: boolean, insertAtIndex: number) => {
    const parentItem = watchedItems?.find((f: any) => f.uid === parentId);
    const parentLevel = parentItem ? parentItem.level : -1;
    insert(insertAtIndex, { uid: generateStableId(), description: '', unit: isHeader ? '' : 'مقطوعية', quantity: 1, sellingUnitPrice: 0, parentId: parentId, level: parentLevel + 1, isHeader: isHeader, itemId: '', notes: '', startDate: null, endDate: null });
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
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b shadow-sm p-6">
          <div className="flex justify-between items-center max-w-full px-4 mx-auto">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary shadow-inner"><ListTree className="h-7 w-7" /></div>
              <div><CardTitle className="text-2xl font-extrabold tracking-tight">مُحرر جداول الكميات</CardTitle><CardDescription className="flex items-center gap-2"><span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />إدارة الحصر والتسعير والجدولة</CardDescription></div>
            </div>
            <div className="flex items-center gap-8 bg-muted/30 px-6 py-3 rounded-2xl border">
              <div className="flex flex-col items-start"><Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">إجمالي المشروع</Label><div className="text-3xl font-black text-primary font-mono tabular-nums">{formatCurrency(grandTotal)}</div></div>
              <Separator orientation="vertical" className="h-10 mx-4" />
              <div className="flex flex-col items-start"><Label className="text-[10px] uppercase font-bold text-muted-foreground mb-1">عدد البنود</Label><div className="text-2xl font-bold font-mono text-foreground/80">{fields.length}</div></div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit && onSubmit ? handleSubmit(onSubmit) : undefined}>
          <CardContent className="p-0 max-w-full mx-auto mt-6 px-4 pb-32">
            <div className="grid md:grid-cols-3 gap-8 p-8 mb-6 border rounded-3xl bg-card shadow-sm">
              <div className="grid gap-2"><Label className="font-bold text-sm text-foreground/70">اسم / مرجع الجدول *</Label><Input {...register('name')} placeholder="مثال: جدول كميات فيلا السيد محمد" className={cn('h-11 text-lg border-2', errors.name ? 'border-destructive' : '')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
              <div className="grid gap-2"><Label className="font-bold text-sm text-foreground/70">العميل (المحتمل)</Label><Input {...register('clientName')} className="h-11" placeholder="أدخل اسم العميل..." /></div>
              <div className="grid gap-2"><Label className="font-bold text-sm text-foreground/70">الحالة التعاقدية</Label><Controller name="status" control={control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11 border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="تقديري">تقديري</SelectItem><SelectItem value="تعاقدي">تعاقدي</SelectItem><SelectItem value="منفذ">منفذ</SelectItem></SelectContent></Select>)}/></div>
            </div>

            <div className="border rounded-3xl overflow-hidden shadow-xl bg-card">
              <div className="overflow-x-auto">
                <Table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup><col className="w-12" /><col className="min-w-[300px]" /><col className="w-32" /><col className="w-24" /><col className="w-24" /><col className="w-32" /><col className="w-40" /><col className="w-20" /></colgroup>
                  <TableHeader className="bg-muted/80 backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-b-2 h-14">
                      <TableHead className="text-center font-bold text-xs uppercase px-1">م</TableHead>
                      <TableHead className="font-bold px-2">بيان الأعمال</TableHead>
                      <TableHead className="text-center font-bold px-1"><CalendarDays className="h-4 w-4 mx-auto"/></TableHead>
                      <TableHead className="text-center font-bold px-1">الوحدة</TableHead>
                      <TableHead className="text-center font-bold px-1">الكمية</TableHead>
                      <TableHead className="text-center font-bold px-1">سعر الوحدة</TableHead>
                      <TableHead className="text-left font-bold border-r px-3">الإجمالي</TableHead>
                      <TableHead className="text-center font-bold border-r px-1">إجراء</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {boqTree.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="h-64 text-center"><div className="flex flex-col items-center justify-center gap-4 text-muted-foreground"><Info className="h-12 w-12 opacity-20" /><p>الجدول فارغ حالياً.</p></div></TableCell></TableRow>
                    ) : (
                      boqTree.map((node, index) => (
                        <BoqItemRowRenderer key={node.uid} node={node} level={0} wbs={`${index + 1}`} parentReferenceId={null} control={control} register={register} setValue={setValue} onDelete={handleDelete} onAdd={handleAddItem} watchedItems={watchedItems || []} masterItemsMap={masterItemsMap} masterItemsLoading={masterItemsLoading} errors={errors} />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-center p-12">
              <Button type="button" variant="secondary" onClick={handleAddRootSection} className="h-14 px-10 rounded-2xl shadow-lg border-2 border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-lg font-bold group">
                <PlusCircle className="ml-3 h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                إضافة قسم رئيسي جديد (WBS)
              </Button>
            </div>
          </CardContent>

          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-xl border-t shadow-[0_-10px_20px_rgba(0,0,0,0.05)] no-print">
            <div className="max-w-7xl mx-auto flex justify-between items-center p-6 px-10">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full border"><Calculator className="h-4 w-4" />تم حساب {fields.length} بنود بدقة</div>
              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
                <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-extrabold text-lg shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all min-w-[200px]">
                  {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin" /> : <Save className="ml-3 h-5 w-5" />}
                  {isSaving ? 'جاري الحفظ...' : 'حفظ الجدول والجدول الزمني'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}