
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
import type { ConstructionProject, Client, Employee, ConstructionType, Item, AreaRange, Governorate, Area } from '@/lib/types';
import { Loader2, Save, X, ShieldCheck, PlusCircle, Trash2, Ruler, Package, Building2, MapPin, Layers } from 'lucide-react';
import { DialogFooter } from '../ui/dialog';
import { query, collection, orderBy, where, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

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
  projectCategory: z.enum(['Private (Subsidized)', 'Private (Non-Subsidized)', 'Commercial', 'Government']),
  
  // حقول البيانات الفنية للمشروع
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  hasBasement: z.boolean().default(false),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),

  // عنوان الموقع
  siteAddress: z.object({
      governorate: z.string().min(1, "المحافظة مطلوبة."),
      area: z.string().min(1, "المنطقة مطلوبة."),
      block: z.string().optional(),
      street: z.string().optional(),
      houseNumber: z.string().optional(),
  }),

  // حقول الدعم الحكومي
  subsidyAreaRange: z.enum(['100-199', '200-299', '300-400']).optional(),
  subsidyRequestId: z.string().optional(),
  subsidyExpiryDate: z.date().optional(),

  constructionTypeId: z.string().optional().nullable(),
  startDate: z.date(),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'مكتمل', 'معلق']),
  mainEngineerId: z.string().min(1, "المهندس الرئيسي مطلوب."),
  progressPercentage: z.preprocess((a) => parseInt(String(a || '0'), 10), z.number().min(0).max(100)),
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
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: governorates = [] } = useSubscription<Governorate>(firestore, 'governorates', [orderBy('name')]);
    
    const [areas, setAreas] = useState<Area[]>([]);
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);

    const subsidyItems = useMemo(() => allItems.filter(i => i.isSubsidyEligible), [allItems]);

    const { register, handleSubmit, control, watch, formState: { errors }, reset, setValue } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '', clientId: '', 
            projectCategory: 'Private (Non-Subsidized)', constructionTypeId: '',
            totalArea: 0, hasBasement: false, floorsCount: 1, roofExtension: 'none',
            siteAddress: { governorate: '', area: '', block: '', street: '', houseNumber: '' },
            startDate: new Date(),
            status: 'مخطط', mainEngineerId: '', progressPercentage: 0,
            subsidyQuotas: []
        }
    });

    const { fields: quotaFields, replace: replaceQuotas, remove: removeQuota, append: appendQuota } = useFieldArray({ control, name: "subsidyQuotas" });
    const projectCategory = watch('projectCategory');
    const selectedAreaRange = watch('subsidyAreaRange');
    const selectedGov = watch('siteAddress.governorate');

    // جلب المناطق عند تغيير المحافظة
    useEffect(() => {
        if (!firestore || !selectedGov) {
            setAreas([]);
            return;
        }
        const govObj = governorates.find(g => g.name === selectedGov);
        if (govObj) {
            setIsLoadingAreas(true);
            getDocs(query(collection(firestore, `governorates/${govObj.id}/areas`), orderBy('name'))).then(snap => {
                setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
            }).finally(() => setIsLoadingAreas(false));
        }
    }, [selectedGov, firestore, governorates]);

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
                subsidyExpiryDate: initialData.subsidyExpiryDate?.toDate ? initialData.subsidyExpiryDate.toDate() : undefined,
            } as any);
        }
    }, [initialData, reset]);

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
    const engineerOptions = useMemo(() => engineers.filter(e=> e.jobTitle?.includes('مهندس')).map(e => ({ value: e.id!, label: e.fullName })), [engineers]);
    const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);
    const itemOptions = useMemo(() => subsidyItems.map(i => ({ value: i.id!, label: i.name })), [subsidyItems]);
    const governorateOptions = useMemo(() => governorates.map(g => ({ value: g.name, label: g.name })), [governorates]);
    const areaOptions = useMemo(() => areas.map(a => ({ value: a.name, label: a.name })), [areas]);

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
            {/* القسم الأساسي */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>اسم المشروع (هيكل فني) *</Label>
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
                    <Label>فئة المشروع *</Label>
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
                    <Label>نوع المقاولات</Label>
                    <Controller control={control} name="constructionTypeId" render={({ field }) => (
                        <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={constructionTypeOptions} placeholder="مثال: هيكل أسود، تشطيب..." />
                    )} />
                </div>
            </div>

            <Separator />

            {/* قسم العنوان والموقع */}
            <div className="space-y-4">
                <h3 className="font-black text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/> عنوان القسيمة والموقع</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>المحافظة *</Label>
                        <Controller control={control} name="siteAddress.governorate" render={({ field }) => (
                            <InlineSearchList value={field.value} onSelect={field.onChange} options={governorateOptions} placeholder="اختر محافظة..." />
                        )} />
                    </div>
                    <div className="grid gap-2">
                        <Label>المنطقة *</Label>
                        <Controller control={control} name="siteAddress.area" render={({ field }) => (
                            <InlineSearchList value={field.value} onSelect={field.onChange} options={areaOptions} placeholder={!selectedGov ? "اختر محافظة أولاً" : isLoadingAreas ? "تحميل..." : "اختر منطقة..."} disabled={!selectedGov || isLoadingAreas} />
                        )} />
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2"><Label>قطعة</Label><Input {...register('siteAddress.block')} placeholder="0" /></div>
                    <div className="grid gap-2"><Label>شارع</Label><Input {...register('siteAddress.street')} placeholder="0" /></div>
                    <div className="grid gap-2"><Label>منزل / قسيمة</Label><Input {...register('siteAddress.houseNumber')} placeholder="0" /></div>
                </div>
            </div>

            <Separator />

            {/* قسم البيانات الفنية للبناء */}
            <div className="space-y-4 bg-muted/20 p-6 rounded-3xl border-2 border-dashed">
                <h3 className="font-black text-lg flex items-center gap-2 text-foreground"><Layers className="h-5 w-5 text-primary"/> مواصفات البناء</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة الإجمالية (م²)</Label>
                        <Input type="number" {...register('totalArea')} placeholder="0.00" className="h-11 font-mono font-bold" />
                    </div>
                    <div className="grid gap-2">
                        <Label>عدد الأدوار</Label>
                        <Input type="number" {...register('floorsCount')} placeholder="1" className="h-11 font-mono" />
                    </div>
                    <div className="grid gap-2">
                        <Label>توسعة السطح</Label>
                        <Controller name="roofExtension" control={control} render={({field}) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">لا يوجد</SelectItem>
                                    <SelectItem value="quarter">ربع دور (سطح)</SelectItem>
                                    <SelectItem value="half">نصف دور (سطح)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}/>
                    </div>
                    <div className="flex items-center justify-between p-2 h-11 border rounded-xl bg-background px-4">
                        <Label htmlFor="hasBasement" className="font-bold cursor-pointer">وجود سرداب (قبو)</Label>
                        <Controller name="hasBasement" control={control} render={({field}) => (
                            <Switch id="hasBasement" checked={field.value} onCheckedChange={field.onChange} />
                        )}/>
                    </div>
                </div>
            </div>

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
                                <Label className="flex items-center gap-2 font-bold">تاريخ انتهاء صلاحية الدعم</Label>
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
                    <Label>تاريخ البدء المخطط</Label>
                    <Controller name="startDate" control={control} render={({field}) => <DateInput value={field.value} onChange={field.onChange} className="h-11"/>} />
                </div>
            </div>
        </div>
        <DialogFooter className="mt-10 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/20 gap-3">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                حفظ هيكل المشروع
            </Button>
        </DialogFooter>
    </form>
  )
}
