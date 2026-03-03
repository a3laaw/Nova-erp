
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
import type { ConstructionProject, Client, Employee, ConstructionType, Item, AreaRange, ContractTemplate } from '@/lib/types';
import { Loader2, Save, X, ShieldCheck, PlusCircle, Trash2, CalendarClock, Ruler, FileSignature, Calculator } from 'lucide-react';
import { DialogFooter } from '../ui/dialog';
import { query, collection, getDocs, orderBy, where } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';

// جدول قرار 222 لسنة 2024 - مبالغ الدعم بالدينار
const SUBSIDY_TABLE: Record<AreaRange, Record<string, number>> = {
    '100-199': { 'حديد التسليح': 2100, 'طابوق عازل': 600, 'طابوق أسود': 400, 'أسمنت': 500, 'خرسانة جاهزة': 2000, 'تكييف': 2000, 'ألمنيوم': 855, 'مواد اختيارية': 400 },
    '200-299': { 'حديد التسليح': 3150, 'طابوق عازل': 900, 'طابوق أسود': 600, 'أسمنت': 750, 'خرسانة جاهزة': 3000, 'تكييف': 2500, 'ألمنيوم': 1200, 'مواد اختيارية': 600 },
    '300-400': { 'حديد التسليح': 4200, 'طابوق عازل': 1200, 'طابوق أسود': 800, 'أسمنت': 1000, 'خرسانة جاهزة': 4000, 'تكييف': 3000, 'ألمنيوم': 1628, 'مواد اختيارية': 800 },
};

const quotaSchema = z.object({
    itemId: z.string().min(1, "الصنف مطلوب"),
    itemName: z.string(),
    allocatedAmount: z.number().min(0),
    allocatedQuantity: z.number().default(0),
    receivedQuantity: z.number().default(0),
    consumedQuantity: z.number().default(0),
    unitPrice: z.number().min(0)
});

const projectSchema = z.object({
  projectName: z.string().min(1, "اسم المشروع مطلوب."),
  clientId: z.string().min(1, "العميل مطلوب."),
  projectType: z.enum(['استشاري', 'تنفيذي', 'مختلط']),
  projectCategory: z.enum(['Private (Subsidized)', 'Private (Non-Subsidized)', 'Commercial', 'Government']),
  
  // حقول الدعم الحكومي
  subsidyAreaRange: z.enum(['100-199', '200-299', '300-400']).optional(),
  subsidyRequestId: z.string().optional(),
  subsidyExpiryDate: z.date().optional(),

  // الارتباط بالنماذج والعقود
  constructionTypeId: z.string().optional().nullable(),
  contractTemplateId: z.string().optional().nullable(),
  
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
    const { toast } = useToast();

    const { data: clients = [] } = useSubscription<Client>(firestore, 'clients');
    const { data: engineers = [] } = useSubscription<Employee>(firestore, 'employees');
    const { data: constructionTypes = [] } = useSubscription<ConstructionType>(firestore, 'construction_types', [orderBy('name')]);
    const { data: allTemplates = [] } = useSubscription<ContractTemplate>(firestore, 'contractTemplates');
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    
    const subsidyItems = useMemo(() => allItems.filter(i => i.isSubsidyEligible), [allItems]);

    // فلترة قوالب عقود المقاولات فقط
    const executionTemplates = useMemo(() => 
        allTemplates.filter(t => t.templateType === 'Execution'),
    [allTemplates]);

    const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '', clientId: '', projectType: 'تنفيذي', 
            projectCategory: 'Private (Non-Subsidized)', constructionTypeId: '',
            contractTemplateId: '',
            contractValue: 0, startDate: new Date(), endDate: new Date(), 
            status: 'مخطط', mainEngineerId: '', progressPercentage: 0,
            subsidyQuotas: []
        }
    });

    const { fields: quotaFields, replace: replaceQuotas, remove: removeQuota, append: appendQuota } = useFieldArray({ control, name: "subsidyQuotas" });
    const projectCategory = watch('projectCategory');
    const selectedAreaRange = watch('subsidyAreaRange');
    const selectedTemplateId = watch('contractTemplateId');

    // تحديث قيمة العقد آلياً عند اختيار قالب بـ "قيمة ثابتة"
    useEffect(() => {
        if (selectedTemplateId) {
            const template = executionTemplates.find(t => t.id === selectedTemplateId);
            if (template && template.financials?.type === 'fixed') {
                setValue('contractValue', template.financials.totalAmount || 0);
            }
        }
    }, [selectedTemplateId, executionTemplates, setValue]);

    const handleAutoFillQuotas = useCallback(() => {
        if (!selectedAreaRange || projectCategory !== 'Private (Subsidized)') return;

        const decisionData = SUBSIDY_TABLE[selectedAreaRange];
        const newQuotas: any[] = [];

        Object.entries(decisionData).forEach(([materialName, amount]) => {
            const systemItem = subsidyItems.find(i => i.name.includes(materialName) || materialName.includes(i.name));
            newQuotas.push({
                itemId: systemItem?.id || `temp-${materialName}`,
                itemName: materialName,
                allocatedAmount: amount,
                allocatedQuantity: 0,
                receivedQuantity: 0,
                consumedQuantity: 0,
                unitPrice: systemItem?.costPrice || 0
            });
        });

        replaceQuotas(newQuotas);
        toast({ title: 'تم التوزيع التلقائي', description: `تم تعبئة مبالغ الدعم بناءً على مساحة ${selectedAreaRange} م² وفق قرار 222.` });
    }, [selectedAreaRange, projectCategory, subsidyItems, replaceQuotas, toast]);

    useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                startDate: initialData.startDate?.toDate ? initialData.startDate.toDate() : new Date(),
                endDate: initialData.endDate?.toDate ? initialData.endDate.toDate() : new Date(),
                subsidyExpiryDate: initialData.subsidyExpiryDate?.toDate ? initialData.subsidyExpiryDate.toDate() : undefined,
            });
        }
    }, [initialData, reset]);

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const engineerOptions = useMemo(() => engineers.filter(e=> e.jobTitle?.includes('مهندس')).map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);
    const templateOptions = useMemo(() => executionTemplates.map(t => ({ value: t.id!, label: t.title })), [executionTemplates]);
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
                    <Input {...register('projectName')} placeholder="مثال: فيلا السيد محمد - هيكل أسود" />
                </div>
                <div className="grid gap-2">
                    <Label>المالك / العميل *</Label>
                    <Controller control={control} name="clientId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="اختر عميلاً..." />
                    )} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>فئة المشروع (من حيث الاستحقاق الحكومي) *</Label>
                    <Controller name="projectCategory" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="font-bold border-2 border-primary/20 h-11"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Private (Subsidized)">سكن خاص (مدعوم من التموين)</SelectItem>
                                <SelectItem value="Private (Non-Subsidized)">سكن خاص (تجاري)</SelectItem>
                                <SelectItem value="Commercial">تجاري / استثماري</SelectItem>
                                <SelectItem value="Government">مشروع حكومي</SelectItem>
                            </SelectContent>
                        </Select>
                    )}/>
                </div>
                <div className="grid gap-2">
                    <Label>نوع المقاولات المنفذة</Label>
                    <Controller control={control} name="constructionTypeId" render={({ field }) => (
                        <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={constructionTypeOptions} placeholder="مثال: هيكل أسود، تشطيب..." />
                    )} />
                </div>
            </div>

            {/* --- ربط العقد من النماذج --- */}
            <Card className="border-2 border-dashed rounded-[2rem] bg-muted/50 p-6 space-y-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileSignature className="h-6 w-6"/></div>
                    <div>
                        <CardTitle className="text-lg font-black">الربط مع نماذج العقود</CardTitle>
                        <CardDescription>اختر نموذج العقد المعتمد للمقاولات لبرمجة الدفعات والقيود آلياً.</CardDescription>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid gap-2">
                        <Label className="font-bold">نموذج العقد المستهدف *</Label>
                        <Controller control={control} name="contractTemplateId" render={({ field }) => (
                            <InlineSearchList 
                                value={field.value || ''} 
                                onSelect={field.onChange} 
                                options={templateOptions} 
                                placeholder="اختر من القوالب المرجعية..." 
                            />
                        )} />
                    </div>
                    <div className="grid gap-2">
                        <Label className="font-bold">إجمالي قيمة العقد (المبلغ المتفق عليه)</Label>
                        <div className="relative">
                            <Input type="number" step="0.001" {...register('contractValue')} className="h-11 font-mono text-xl font-black text-primary pl-12" />
                            <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-30" />
                        </div>
                    </div>
                </div>
            </Card>

            {projectCategory === 'Private (Subsidized)' && (
                <Card className="border-2 border-primary shadow-lg rounded-[2rem] overflow-hidden bg-primary/5">
                    <CardHeader className="bg-primary/10 border-b">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black flex items-center gap-2">
                                    <ShieldCheck className="text-primary h-6 w-6" />
                                    وحدة تتبع الدعم الإنشائي (قرار 222/2024)
                                </CardTitle>
                                <CardDescription>أتمتة حصص المالك ومتابعة صلاحية طلب بنك الائتمان.</CardDescription>
                            </div>
                            <Button type="button" onClick={handleAutoFillQuotas} disabled={!selectedAreaRange} className="rounded-xl font-bold gap-2">
                                <PlusCircle className="h-4 w-4"/> توزيع الحصص آلياً
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-white rounded-2xl border shadow-inner">
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold"><Ruler className="h-4 w-4 text-primary"/> مساحة القسيمة (م²)</Label>
                                <Controller name="subsidyAreaRange" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="border-2 h-11"><SelectValue placeholder="اختر المساحة..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="100-199">100 - 199 م²</SelectItem>
                                            <SelectItem value="200-299">200 - 299 م²</SelectItem>
                                            <SelectItem value="300-400">300 - 400 م²</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}/>
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold">رقم طلب الائتمان</Label>
                                <Input {...register('subsidyRequestId')} placeholder="00000000" className="dir-ltr h-11" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="flex items-center gap-2 font-bold"><CalendarClock className="h-4 w-4 text-red-600"/> تاريخ انتهاء الصلاحية</Label>
                                <Controller name="subsidyExpiryDate" control={control} render={({field}) => <DateInput value={field.value} onChange={field.onChange} className="h-11" />} />
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <Label className="font-black text-lg">تفاصيل حصص المواد الموزعة</Label>
                            <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>المادة المدعومة</TableHead>
                                            <TableHead className="text-center">مبلغ الدعم (دينار)</TableHead>
                                            <TableHead className="text-center">سعر السوق التقديري</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {quotaFields.map((field, index) => (
                                            <TableRow key={field.id} className="hover:bg-muted/5 h-14">
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
                                                                className="border-none shadow-none font-bold"
                                                            />
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input type="number" {...register(`subsidyQuotas.${index}.allocatedAmount`, { valueAsNumber: true })} className="text-center font-black text-primary border-none shadow-none focus-visible:ring-0" />
                                                </TableCell>
                                                <TableCell>
                                                    <Input type="number" step="0.001" {...register(`subsidyQuotas.${index}.unitPrice`, { valueAsNumber: true })} className="text-center border-none shadow-none opacity-60 focus-visible:ring-0" />
                                                </TableCell>
                                                <TableCell>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeQuota(index)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-2 rounded-xl h-11 gap-2" onClick={() => appendQuota({ itemId: '', itemName: '', allocatedAmount: 0, allocatedQuantity: 0, receivedQuantity: 0, consumedQuantity: 0, unitPrice: 0 })}>
                                <PlusCircle className="h-4 w-4" /> إضافة مادة مخصصة للدعم
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="grid gap-2">
                    <Label>المهندس المشرف *</Label>
                    <Controller control={control} name="mainEngineerId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={engineerOptions} placeholder="اختر مهندس المواقع..." />
                    )} />
                </div>
                <div className="grid gap-2">
                    <Label>تاريخ الانتهاء المتوقع</Label>
                    <Controller name="endDate" control={control} render={({field}) => <DateInput value={field.value} onChange={field.onChange} className="h-11"/>} />
                </div>
            </div>
        </div>
        <DialogFooter className="mt-10 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-3">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                اعتماد العقد وبدء المشروع
            </Button>
        </DialogFooter>
    </form>
  )
}
