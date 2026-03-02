
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import type { ConstructionProject, Client, Employee, ConstructionType, Item } from '@/lib/types';
import { Loader2, Save, X, ShieldCheck, PlusCircle, Trash2 } from 'lucide-react';
import { DialogFooter } from '../ui/dialog';
import { query, collection, getDocs, orderBy, where } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

const quotaSchema = z.object({
    itemId: z.string().min(1, "الصنف مطلوب"),
    itemName: z.string(),
    allocatedQuantity: z.number().min(0),
    receivedQuantity: z.number().default(0),
    consumedQuantity: z.number().default(0),
    unitPrice: z.number().min(0)
});

const projectSchema = z.object({
  projectName: z.string().min(1, "اسم المشروع مطلوب."),
  clientId: z.string().min(1, "العميل مطلوب."),
  projectType: z.enum(['استشاري', 'تنفيذي', 'مختلط']),
  projectCategory: z.enum(['Private (Subsidized)', 'Private (Non-Subsidized)', 'Commercial', 'Government']),
  constructionTypeId: z.string().optional().nullable(),
  contractValue: z.preprocess((a) => parseFloat(String(a || '0')), z.number().min(0)),
  startDate: z.date(),
  endDate: z.date(),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'مكتمل', 'معلق']),
  mainEngineerId: z.string().min(1, "المهندس الرئيسي مطلوب."),
  progressPercentage: z.preprocess((a) => parseInt(String(a || '0'), 10), z.number().min(0).max(100)),
  linkedTransactionId: z.string().optional(),
  subsidyQuotas: z.array(quotaSchema).optional()
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormProps {
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  initialData?: Partial<ConstructionProject> | null;
  isSaving?: boolean;
}

export function ProjectForm({ onSave, onClose, initialData = null, isSaving = false }: ProjectFormProps) {
    const { firestore } = useFirebase();

    const { data: clients = [], loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');
    const { data: engineers = [], loading: engineersLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: constructionTypes = [] } = useSubscription<ConstructionType>(firestore, 'construction_types', [orderBy('name')]);
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    
    // فلترة الأصناف التي تصلح للمدعوم
    const subsidyItems = useMemo(() => allItems.filter(i => i.isSubsidyEligible), [allItems]);

    const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '', clientId: '', projectType: 'تنفيذي', 
            projectCategory: 'Private (Non-Subsidized)', constructionTypeId: '',
            contractValue: 0, startDate: new Date(), endDate: new Date(), 
            status: 'مخطط', mainEngineerId: '', progressPercentage: 0,
            subsidyQuotas: []
        }
    });

    const { fields: quotaFields, append: appendQuota, remove: removeQuota } = useFieldArray({ control, name: "subsidyQuotas" });
    const projectCategory = watch('projectCategory');
    const selectedClientId = watch('clientId');

    useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                startDate: initialData.startDate?.toDate ? initialData.startDate.toDate() : new Date(),
                endDate: initialData.endDate?.toDate ? initialData.endDate.toDate() : new Date(),
            });
        }
    }, [initialData, reset]);

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const engineerOptions = useMemo(() => engineers.filter(e=> e.jobTitle?.includes('مهندس')).map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);
    const itemOptions = useMemo(() => subsidyItems.map(i => ({ value: i.id!, label: i.name })), [subsidyItems]);

    const onSubmit = (data: ProjectFormValues) => {
        const client = clients.find(c => c.id === data.clientId);
        const engineer = engineers.find(e => e.id === data.mainEngineerId);
        onSave({ 
            ...data, 
            clientName: client?.nameAr, 
            mainEngineerName: engineer?.fullName,
        });
    };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>اسم المشروع *</Label>
                    <Input {...register('projectName')} />
                </div>
                <div className="grid gap-2">
                    <Label>العميل *</Label>
                    <Controller control={control} name="clientId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="اختر عميلاً..." />
                    )} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>نوع المشروع (من حيث الاستحقاق الحكومي) *</Label>
                    <Controller name="projectCategory" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="font-bold border-2 border-primary/20"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Private (Subsidized)">سكن خاص (مدعوم من التموين)</SelectItem>
                                <SelectItem value="Private (Non-Subsidized)">سكن خاص (غير مدعوم)</SelectItem>
                                <SelectItem value="Commercial">تجاري / استثماري</SelectItem>
                                <SelectItem value="Government">مشروع حكومي</SelectItem>
                            </SelectContent>
                        </Select>
                    )}/>
                </div>
                <div className="grid gap-2">
                    <Label>نوع المقاولات</Label>
                    <Controller control={control} name="constructionTypeId" render={({ field }) => (
                        <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={constructionTypeOptions} placeholder="اختر نوع المشروع..." />
                    )} />
                </div>
            </div>

            {/* --- محرك حصص مواد البناء المدعومة --- */}
            {projectCategory === 'Private (Subsidized)' && (
                <Card className="border-2 border-dashed border-primary shadow-lg rounded-3xl overflow-hidden bg-primary/5">
                    <CardHeader className="bg-primary/10">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ShieldCheck className="text-primary h-5 w-5" />
                            رصيد حصص المواد المدعومة (التموين الإنشائي)
                        </CardTitle>
                        <CardDescription>أدخل الكميات المخصصة من وزارة التجارة لهذا المشروع.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>المادة المدعومة</TableHead>
                                    <TableHead className="text-center">الكمية المخصصة</TableHead>
                                    <TableHead className="text-center">سعر السوق (للتقييم)</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotaFields.map((field, index) => (
                                    <TableRow key={field.id}>
                                        <TableCell>
                                            <Controller
                                                control={control}
                                                name={`subsidyQuotas.${index}.itemId`}
                                                render={({ field: f }) => (
                                                    <InlineSearchList
                                                        value={f.value}
                                                        onSelect={(v) => {
                                                            f.onChange(v);
                                                            const item = subsidyItems.find(it => it.id === v);
                                                            if (item) {
                                                                setValue(`subsidyQuotas.${index}.itemName`, item.name);
                                                                setValue(`subsidyQuotas.${index}.unitPrice`, item.costPrice || 0);
                                                            }
                                                        }}
                                                        options={itemOptions}
                                                        placeholder="اختر مادة..."
                                                    />
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" {...register(`subsidyQuotas.${index}.allocatedQuantity`, { valueAsNumber: true })} className="text-center font-bold" />
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" step="0.001" {...register(`subsidyQuotas.${index}.unitPrice`, { valueAsNumber: true })} className="text-center" />
                                        </TableCell>
                                        <TableCell>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeQuota(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Button type="button" variant="outline" size="sm" className="mt-4 w-full border-dashed" onClick={() => appendQuota({ itemId: '', itemName: '', allocatedQuantity: 0, receivedQuantity: 0, consumedQuantity: 0, unitPrice: 0 })}>
                            <PlusCircle className="ml-2 h-4 w-4" /> إضافة مادة للرصيد
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>المهندس الرئيسي *</Label>
                    <Controller control={control} name="mainEngineerId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={engineerOptions} placeholder="اختر مهندسًا..." />
                    )} />
                </div>
                <div className="grid gap-2">
                    <Label>قيمة العقد</Label>
                    <Input type="number" step="0.001" {...register('contractValue')} className="font-mono" />
                </div>
            </div>
        </div>
        <DialogFooter className="mt-6 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                حفظ المشروع
            </Button>
        </DialogFooter>
    </form>
  )
}
