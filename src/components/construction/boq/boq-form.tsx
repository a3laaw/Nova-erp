'use client';
import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray, Controller, watch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Save, X, PlusCircle, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { Boq, BoqItem, BoqReferenceItem } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

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

export function BoqForm({ onSave, onClose, initialData, isSaving = false }: BoqFormProps) {
    const { firestore } = useFirebase();
    const { data: masterItems, loading: masterItemsLoading } = useSubscription<BoqReferenceItem>(firestore, 'boqReferenceItems', [orderBy('name')]);
    const isEditing = !!initialData;

    const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<BoqFormValues>({
        resolver: zodResolver(boqFormSchema),
        defaultValues: initialData || {
            name: '',
            clientName: '',
            status: 'تقديري',
            items: [{ id: 'root-1', itemNumber: '1.0', description: '', unit: '', quantity: 0, sellingUnitPrice: 0, notes: '', parentId: null, level: 0, isHeader: false }]
        }
    });

    useEffect(() => {
        if (initialData) {
            setValue('name', initialData.name || '');
            setValue('clientName', initialData.clientName || '');
            setValue('status', initialData.status || 'تقديري');
            setValue('items', initialData.items || []);
        }
    }, [initialData, setValue]);

    const { fields, append, remove, update } = useFieldArray({ control, name: 'items' });
    const watchedItems = watch('items');

    const totalValue = useMemo(() => {
        return watchedItems.reduce((sum, item) => {
            if (item.isHeader) return sum;
            const isLumpSum = item.unit === 'مقطوعية';
            const quantity = isLumpSum ? 1 : (item.quantity || 0);
            return sum + (quantity * (item.sellingUnitPrice || 0));
        }, 0);
    }, [watchedItems]);

    const handleAddItem = (isHeader: boolean, parentId: string | null = null) => {
        let level = 0;
        let parentNumber = '';
        if (parentId) {
            const parentIndex = fields.findIndex(f => f.id === parentId);
            if (parentIndex > -1) {
                level = fields[parentIndex].level + 1;
                parentNumber = fields[parentIndex].itemNumber;
            }
        }
        
        const siblings = fields.filter(f => f.parentId === parentId);
        const newItemNumber = parentId ? `${parentNumber}.${siblings.length + 1}` : `${siblings.length + 1}.0`;

        append({
            id: new Date().toISOString() + Math.random(),
            itemNumber: newItemNumber,
            description: '',
            unit: isHeader ? '' : 'مقطوعية',
            quantity: isHeader ? 0 : 1,
            sellingUnitPrice: 0,
            notes: '',
            parentId,
            level,
            isHeader,
        });
    };
    
    const handleMasterItemSelect = (index: number, masterItemId: string) => {
        const masterItem = masterItems.find(i => i.id === masterItemId);
        if (masterItem) {
            setValue(`items.${index}.description`, masterItem.name);
            setValue(`items.${index}.unit`, masterItem.unit || '');
            setValue(`items.${index}.isHeader`, masterItem.isHeader || false);
        }
    };
    
    const onSubmit = (data: BoqFormValues) => {
        onSave(data);
    };
    
    const masterItemOptions = useMemo(() => (masterItems || []).map(i => ({value: i.id!, label: i.name})), [masterItems]);
    
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
                            <div className="grid gap-2">
                                <Label htmlFor="name">اسم/مرجع جدول الكميات *</Label>
                                <Input id="name" {...register('name')} />
                                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="clientName">اسم العميل (المحتمل)</Label>
                                <Input id="clientName" {...register('clientName')} />
                            </div>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="status">الحالة</Label>
                                <Controller name="status" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                        
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-2/5">بيان الأعمال</TableHead>
                                        <TableHead>الوحدة</TableHead>
                                        <TableHead>الكمية</TableHead>
                                        <TableHead>سعر الوحدة</TableHead>
                                        <TableHead className="text-left">الإجمالي</TableHead>
                                        <TableHead className="w-[100px]">الإجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {fields.map((field, index) => {
                                        const item = watchedItems[index] || {};
                                        const isLumpSum = item.unit === 'مقطوعية';
                                        const total = isLumpSum ? (item.sellingUnitPrice || 0) : (item.quantity || 0) * (item.sellingUnitPrice || 0);

                                        return (
                                        <TableRow key={field.id} className={item.isHeader ? 'bg-muted/30' : ''}>
                                            <TableCell style={{ paddingRight: `${item.level * 2}rem` }}>
                                                <InlineSearchList 
                                                    placeholder='اختر بندًا أو اكتب مباشرة...'
                                                    value={item.id}
                                                    onSelect={(val) => handleMasterItemSelect(index, val)}
                                                    options={masterItemOptions}
                                                    disabled={masterItemsLoading}
                                                />
                                                <Textarea {...register(`items.${index}.description`)} rows={2} className="mt-1"/>
                                            </TableCell>
                                            <TableCell>
                                                <Input {...register(`items.${index}.unit`)} placeholder="م3، م2،..." disabled={item.isHeader} />
                                            </TableCell>
                                            <TableCell><Input type="number" step="any" {...register(`items.${index}.quantity`)} className="dir-ltr" disabled={isLumpSum || item.isHeader} /></TableCell>
                                            <TableCell><Input type="number" step="0.001" {...register(`items.${index}.sellingUnitPrice`)} className="dir-ltr" disabled={item.isHeader} /></TableCell>
                                            <TableCell className="text-left font-mono">{formatCurrency(total)}</TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={() => handleAddItem(false, field.id)}><PlusCircle className="h-4 w-4"/></Button>
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                                <TableFooter><TableRow className="bg-muted text-base font-bold"><TableCell colSpan={4}>الإجمالي</TableCell><TableCell colSpan={2} className="text-left font-mono">{formatCurrency(totalValue)}</TableCell></TableRow></TableFooter>
                            </Table>
                        </div>
                        {errors.items && <p className="text-destructive text-sm mt-2">{errors.items.root?.message || errors.items.message}</p>}
                        <Button type="button" variant="outline" onClick={() => handleAddItem(true, null)}><PlusCircle className="ml-2 h-4 w-4"/> إضافة بند رئيسي</Button>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                        {isEditing ? 'حفظ التعديلات' : 'حفظ'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
