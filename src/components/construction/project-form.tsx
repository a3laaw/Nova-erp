
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useSubscription } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import type { ConstructionProject, Client, Employee, AreaRange, Governorate, Area, Item } from '@/lib/types';
import { Loader2, Save, ShieldCheck, Ruler, Building2, MapPin, Layers, Droplets, Zap, Package, FileSignature } from 'lucide-react';
import { query, collection, orderBy, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

const projectSchema = z.object({
  projectName: z.string().min(1, "اسم المشروع مطلوب."),
  clientId: z.string().min(1, "العميل مطلوب."),
  projectCategory: z.enum(['Private (Subsidized)', 'Private (Non-Subsidized)', 'Commercial', 'Government']),
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  basementType: z.enum(['none', 'full', 'half', 'vault']).default('none'),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  workNature: z.enum(['labor_only', 'with_materials']).default('labor_only'),
  
  bathroomsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  kitchensCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  laundryRoomsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  sanitaryMaterialsIncluded: z.boolean().default(false),
  sanitaryExtensionType: z.enum(['ordinary', 'suspended']).default('ordinary'),
  
  suspendedExtensionCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryExtensionCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  suspendedToiletCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryToiletCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  hiddenShowerCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryShowerCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),

  electricalPointsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  planReferenceNumber: z.string().optional(),

  siteAddress: z.object({
      governorate: z.string().min(1, "المحافظة مطلوبة."),
      area: z.string().min(1, "المنطقة مطلوبة."),
      block: z.string().optional(),
      street: z.string().optional(),
      houseNumber: z.string().optional(),
  }),
  startDate: z.date(),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'مكتمل', 'معلق']),
  mainEngineerId: z.string().min(1, "المهندس الرئيسي مطلوب."),
  progressPercentage: z.number().default(0),
  subsidyQuotas: z.array(z.any()).optional()
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
    const { data: engineers = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: governorates = [] } = useSubscription<Governorate>(firestore, 'governorates', [orderBy('name')]);
    
    const [areas, setAreas] = useState<Area[]>([]);
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);

    const { register, handleSubmit, control, watch, reset, setValue } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '', clientId: '', projectCategory: 'Private (Non-Subsidized)',
            totalArea: 0, basementType: 'none', floorsCount: 1, roofExtension: 'none',
            workNature: 'labor_only',
            bathroomsCount: 0, kitchensCount: 0, laundryRoomsCount: 0, 
            sanitaryMaterialsIncluded: false,
            sanitaryExtensionType: 'ordinary',
            suspendedExtensionCount: 0, ordinaryExtensionCount: 0,
            suspendedToiletCount: 0, ordinaryToiletCount: 0,
            hiddenShowerCount: 0, ordinaryShowerCount: 0,
            siteAddress: { governorate: '', area: '', block: '', street: '', houseNumber: '' },
            startDate: new Date(), status: 'مخطط', mainEngineerId: '', progressPercentage: 0,
        }
    });

    const selectedGov = watch('siteAddress.governorate');
    const watchedWorkNature = watch('workNature');
    const watchedProjectName = watch('projectName');

    const watchedSuspendedExt = watch('suspendedExtensionCount');
    const watchedOrdinaryExt = watch('ordinaryExtensionCount');

    const showSanitary = useMemo(() => watchedProjectName?.includes('صحي'), [watchedProjectName]);
    const showElectrical = useMemo(() => watchedProjectName?.includes('كهرباء'), [watchedProjectName]);

    useEffect(() => {
        const total = (Number(watchedSuspendedExt) || 0) + (Number(watchedOrdinaryExt) || 0);
        setValue('bathroomsCount', total);
    }, [watchedSuspendedExt, watchedOrdinaryExt, setValue]);

    useEffect(() => {
        if (!firestore || !selectedGov) return;
        const govObj = governorates.find(g => g.name === selectedGov);
        if (govObj) {
            setIsLoadingAreas(true);
            getDocs(query(collection(firestore, `governorates/${govObj.id}/areas`), orderBy('name'))).then(snap => {
                setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
            }).finally(() => setIsLoadingAreas(false));
        }
    }, [selectedGov, firestore, governorates]);

    useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                startDate: initialData.startDate?.toDate ? initialData.startDate.toDate() : new Date(),
            } as any);
        }
    }, [initialData, reset]);

    const onSubmit = (data: ProjectFormValues) => {
        const client = clients.find(c => c.id === data.clientId);
        onSave({ ...data, clientName: client?.nameAr });
    };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>اسم المشروع *</Label><Input {...register('projectName')} /></div>
                <div className="grid gap-2"><Label>المالك / العميل *</Label><Controller control={control} name="clientId" render={({ field }) => (
                    <InlineSearchList value={field.value} onSelect={field.onChange} options={clients.map(c => ({ value: c.id!, label: c.nameAr }))} placeholder="اختر عميلاً..." />
                )} /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>فئة المشروع *</Label><Controller name="projectCategory" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11 border-2 border-primary/20"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Private (Subsidized)">سكن خاص (مدعوم)</SelectItem><SelectItem value="Private (Non-Subsidized)">سكن خاص (تجاري)</SelectItem><SelectItem value="Commercial">تجاري / استثماري</SelectItem><SelectItem value="Government">حكومي</SelectItem></SelectContent></Select>)}/></div>
                <div className="grid gap-2"><Label>المهندس المشرف *</Label><Controller control={control} name="mainEngineerId" render={({ field }) => (<InlineSearchList value={field.value} onSelect={field.onChange} options={engineers.map(e => ({ value: e.id!, label: e.fullName }))} placeholder="اختر مهندسًا..." />)} /></div>
            </div>

            <div className="space-y-4 bg-muted/20 p-6 rounded-3xl border-2 border-dashed">
                <h3 className="font-black text-lg flex items-center gap-2 text-foreground"><Layers className="h-5 w-5 text-primary"/> مواصفات البناء</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="grid gap-2"><Label className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-11 font-mono font-bold" /></div>
                    <div className="grid gap-2"><Label>عدد الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-11" /></div>
                    <div className="grid gap-2"><Label>توسعة السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
                    <div className="grid gap-2"><Label>خيار السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون سرداب</SelectItem><SelectItem value="full">سرداب كامل</SelectItem><SelectItem value="half">سرداب نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
                    
                    {watchedWorkNature !== 'labor_only' && (
                        <div className="grid gap-2">
                            <Label className="font-bold text-primary flex items-center gap-2"><FileSignature className="h-3 w-3"/> طبيعة التعاقد</Label>
                            <Controller name="workNature" control={control} render={({field}) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="h-11 border-primary/20 bg-primary/5">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="labor_only">عقد مصنعية فقط</SelectItem>
                                        <SelectItem value="with_materials">عقد مع المواد</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}/>
                        </div>
                    )}
                </div>
            </div>

            {showSanitary && (
                <Card className="rounded-2xl border-2 border-blue-100 bg-blue-50/10">
                    <CardHeader className="pb-4 border-b border-blue-100 bg-blue-50/50">
                        <CardTitle className="text-sm font-black flex items-center gap-2 text-blue-700"><Droplets className="h-4 w-4" /> مواصفات عقد وتوزيع أعداد الصحي</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="grid gap-1.5"><Label className="text-xs font-black text-primary">إجمالي عدد الحمامات</Label><Input type="number" {...register('bathroomsCount')} readOnly className="h-10 text-center font-black bg-muted/50 border-primary/20" /></div>
                            <div className="grid gap-1.5"><Label className="text-xs font-bold text-blue-800 text-center">مطابخ</Label><Input type="number" {...register('kitchensCount')} className="h-10 text-center font-black" /></div>
                            <div className="grid gap-1.5"><Label className="text-xs font-bold text-blue-800 text-center">غرف غسيل</Label><Input type="number" {...register('laundryRoomsCount')} className="h-10 text-center font-black" /></div>
                            <div className="grid gap-1.5">
                                <Label className="text-xs font-bold text-blue-800 text-center">نوع التمديد المعتمد</Label>
                                <Controller name="sanitaryExtensionType" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="h-10 font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ordinary">تمديد عادي</SelectItem>
                                            <SelectItem value="suspended">تمديد معلق</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}/>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-3 flex flex-col items-center">
                                <Label className="font-black text-blue-900 text-center block w-full text-[11px]">توزيع نوع التمديد (حمامات)</Label>
                                <div className="flex gap-2 justify-center w-full">
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">تمديد معلق</Label>
                                        <Input type="number" {...register('suspendedExtensionCount')} className="h-8 w-16 text-center border-blue-200 p-0" />
                                    </div>
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">تمديد عادي</Label>
                                        <Input type="number" {...register('ordinaryExtensionCount')} className="h-8 w-16 text-center p-0" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-3 flex flex-col items-center">
                                <Label className="font-black text-blue-900 text-center block w-full text-[11px]">توزيع نوع المراحيض</Label>
                                <div className="flex gap-2 justify-center w-full">
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">مرحاض معلق</Label>
                                        <Input type="number" {...register('suspendedToiletCount')} className="h-8 w-16 text-center border-blue-200 p-0" />
                                    </div>
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">مرحاض عادي</Label>
                                        <Input type="number" {...register('ordinaryToiletCount')} className="h-8 w-16 text-center p-0" />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-white rounded-xl border border-blue-100 space-y-3 flex flex-col items-center">
                                <Label className="font-black text-blue-900 text-center block w-full text-[11px]">توزيع نوع الشاورات</Label>
                                <div className="flex gap-2 justify-center w-full">
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">شاور مخفي</Label>
                                        <Input type="number" {...register('hiddenShowerCount')} className="h-8 w-16 text-center border-blue-200 p-0" />
                                    </div>
                                    <div className="space-y-1 flex flex-col items-center">
                                        <Label className="text-[9px] text-muted-foreground whitespace-nowrap">شاور عادي</Label>
                                        <Input type="number" {...register('ordinaryShowerCount')} className="h-8 w-16 text-center p-0" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {watchedWorkNature === 'with_materials' && (
                            <div className="p-4 bg-blue-600/5 rounded-xl border border-blue-200 flex items-center justify-between animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-3">
                                    <Package className="h-5 w-5 text-blue-600" />
                                    <div><p className="font-bold text-blue-900">توريد المواد الأساسية</p><p className="text-[10px] text-blue-700">هل يشمل العقد توريد المواد من قبل الشركة؟</p></div>
                                </div>
                                <Controller name="sanitaryMaterialsIncluded" control={control} render={({field}) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)}/>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {showElectrical && (
                <Card className="rounded-2xl border-2 border-yellow-100 bg-yellow-50/10">
                    <CardHeader className="pb-4"><CardTitle className="text-sm font-black flex items-center gap-2 text-yellow-700"><Zap className="h-4 w-4" /> مواصفات الكهرباء</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold">عدد نقاط الكهرباء</Label><Input type="number" {...register('electricalPointsCount')} className="h-10 text-center font-black" /></div>
                        <div className="grid gap-1.5"><Label className="text-[10px] font-bold">رقم مرجع المخطط</Label><Input {...register('planReferenceNumber')} className="h-10 text-center" /></div>
                    </CardContent>
                </Card>
            )}
        </div>
        <DialogFooter className="pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />} حفظ هيكل المشروع
            </Button>
        </DialogFooter>
    </form>
  )
}
