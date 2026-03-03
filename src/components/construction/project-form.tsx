
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
import type { ConstructionProject, Client, Employee, AreaRange, Governorate, Area, Item } from '@/lib/types';
import { Loader2, Save, ShieldCheck, PlusCircle, Trash2, Ruler, Building2, MapPin, Layers } from 'lucide-react';
import { DialogFooter } from '../ui/dialog';
import { query, collection, orderBy, where, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '../ui/switch';

const SUBSIDY_TABLE: Record<AreaRange, Record<string, number>> = {
    '100-199': { 'حديد التسليح': 2100, 'طابوق عازل': 600, 'طابوق أسود': 400, 'أسمنت': 500, 'خرسانة جاهزة': 2000, 'تكييف': 2000, 'ألمنيوم': 855, 'مواد اختيارية': 400 },
    '200-299': { 'حديد التسليح': 3150, 'طابوق عازل': 900, 'طابوق أسود': 600, 'أسمنت': 750, 'خرسانة جاهزة': 3000, 'تكييف': 2500, 'ألمنيوم': 1200, 'مواد اختيارية': 600 },
    '300-400': { 'حديد التسليح': 4200, 'طابوق عازل': 1200, 'طابوق أسود': 800, 'أسمنت': 1000, 'خرسانة جاهزة': 4000, 'تكييف': 3000, 'ألمنيوم': 1628, 'مواد اختيارية': 800 },
};

const projectSchema = z.object({
  projectName: z.string().min(1, "اسم المشروع مطلوب."),
  clientId: z.string().min(1, "العميل مطلوب."),
  projectCategory: z.enum(['Private (Subsidized)', 'Private (Non-Subsidized)', 'Commercial', 'Government']),
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  hasBasement: z.boolean().default(false),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  siteAddress: z.object({
      governorate: z.string().min(1, "المحافظة مطلوبة."),
      area: z.string().min(1, "المنطقة مطلوبة."),
      block: z.string().optional(),
      street: z.string().optional(),
      houseNumber: z.string().optional(),
  }),
  subsidyAreaRange: z.enum(['100-199', '200-299', '300-400']).optional(),
  subsidyRequestId: z.string().optional(),
  subsidyExpiryDate: z.date().optional(),
  startDate: z.date(),
  status: z.enum(['مخطط', 'قيد التنفيذ', 'مكتمل', 'معلق']),
  mainEngineerId: z.string().min(1, "المهندس الرئيسي مطلوب."),
  progressPercentage: z.number().default(0),
  subsidyQuotas: z.array(z.any()).optional()
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function ProjectForm({ onSave, onClose, initialData = null, isSaving = false }: ProjectFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const { data: clients = [] } = useSubscription<Client>(firestore, 'clients');
    const { data: engineers = [] } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const { data: allItems = [] } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: governorates = [] } = useSubscription<Governorate>(firestore, 'governorates', [orderBy('name')]);
    
    const [areas, setAreas] = useState<Area[]>([]);
    const [isLoadingAreas, setIsLoadingAreas] = useState(false);

    const { register, handleSubmit, control, watch, reset, setValue } = useForm<ProjectFormValues>({
        resolver: zodResolver(projectSchema),
        defaultValues: {
            projectName: '', clientId: '', projectCategory: 'Private (Non-Subsidized)',
            totalArea: 0, hasBasement: false, floorsCount: 1, roofExtension: 'none',
            siteAddress: { governorate: '', area: '', block: '', street: '', houseNumber: '' },
            startDate: new Date(), status: 'مخطط', mainEngineerId: '', progressPercentage: 0,
            subsidyQuotas: []
        }
    });

    const { fields: quotaFields, replace: replaceQuotas, remove: removeQuota, append: appendQuota } = useFieldArray({ control, name: "subsidyQuotas" });
    const projectCategory = watch('projectCategory');
    const selectedAreaRange = watch('subsidyAreaRange');
    const selectedGov = watch('siteAddress.governorate');

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

    const handleAutoFillQuotas = useCallback(() => {
        if (!selectedAreaRange || projectCategory !== 'Private (Subsidized)') return;
        const decisionData = SUBSIDY_TABLE[selectedAreaRange];
        const newQuotas = Object.entries(decisionData).map(([materialName, amount]) => {
            const systemItem = allItems.find(i => i.name.includes(materialName) || materialName.includes(i.name));
            return {
                itemId: systemItem?.id || `temp-${materialName}`,
                itemName: materialName,
                allocatedAmount: amount,
                allocatedQuantity: 0,
                receivedQuantity: 0,
                consumedQuantity: 0,
                unitPrice: systemItem?.costPrice || 0
            };
        });
        replaceQuotas(newQuotas);
        toast({ title: 'توزيع تلقائي', description: 'تم تعبئة مبالغ الدعم بناءً على المساحة.' });
    }, [selectedAreaRange, projectCategory, allItems, replaceQuotas, toast]);

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
                <div className="grid gap-2">
                    <Label>اسم المشروع (هيكل فني) *</Label>
                    <Input {...register('projectName')} placeholder="مثال: قسيمة السيد محمد - صباح الأحمد" />
                </div>
                <div className="grid gap-2">
                    <Label>المالك / العميل *</Label>
                    <Controller control={control} name="clientId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={clients.map(c => ({ value: c.id!, label: c.nameAr }))} placeholder="اختر عميلاً..." />
                    )} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label>فئة المشروع *</Label>
                    <Controller name="projectCategory" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="h-11 border-2 border-primary/20"><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Private (Subsidized)">سكن خاص (مدعوم)</SelectItem>
                                <SelectItem value="Private (Non-Subsidized)">سكن خاص (تجاري)</SelectItem>
                                <SelectItem value="Commercial">تجاري / استثماري</SelectItem>
                                <SelectItem value="Government">حكومي</SelectItem>
                            </SelectContent>
                        </Select>
                    )}/>
                </div>
                <div className="grid gap-2">
                    <Label>المهندس المشرف *</Label>
                    <Controller control={control} name="mainEngineerId" render={({ field }) => (
                        <InlineSearchList value={field.value} onSelect={field.onChange} options={engineers.map(e => ({ value: e.id!, label: e.fullName }))} placeholder="اختر مهندسًا..." />
                    )} />
                </div>
            </div>

            <Separator />

            <div className="space-y-4 bg-muted/20 p-6 rounded-3xl border-2 border-dashed">
                <h3 className="font-black text-lg flex items-center gap-2 text-foreground"><Layers className="h-5 w-5 text-primary"/> مواصفات البناء</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة (م²)</Label>
                        <Input type="number" {...register('totalArea')} placeholder="0.00" className="h-11 font-mono font-bold" />
                    </div>
                    <div className="grid gap-2">
                        <Label>عدد الأدوار</Label>
                        <Input type="number" {...register('floorsCount')} placeholder="1" className="h-11" />
                    </div>
                    <div className="grid gap-2">
                        <Label>توسعة السطح</Label>
                        <Controller name="roofExtension" control={control} render={({field}) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent>
                            </Select>
                        )}/>
                    </div>
                    <div className="flex items-center justify-between p-2 h-11 border rounded-xl bg-background px-4">
                        <Label htmlFor="hasBasement" className="font-bold cursor-pointer">سرداب (قبو)</Label>
                        <Controller name="hasBasement" control={control} render={({field}) => (
                            <Switch id="hasBasement" checked={field.value} onCheckedChange={field.onChange} />
                        )}/>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="font-black text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/> عنوان الموقع</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>المحافظة *</Label>
                        <Controller control={control} name="siteAddress.governorate" render={({ field }) => (
                            <InlineSearchList value={field.value} onSelect={field.onChange} options={governorates.map(g => ({ value: g.name, label: g.name }))} placeholder="اختر محافظة..." />
                        )} />
                    </div>
                    <div className="grid gap-2">
                        <Label>المنطقة *</Label>
                        <Controller control={control} name="siteAddress.area" render={({ field }) => (
                            <InlineSearchList value={field.value} onSelect={field.onChange} options={areas.map(a => ({ value: a.name, label: a.name }))} placeholder="اختر منطقة..." disabled={!selectedGov || isLoadingAreas} />
                        )} />
                    </div>
                </div>
            </div>

            {projectCategory === 'Private (Subsidized)' && (
                <Card className="border-2 border-primary bg-primary/5 rounded-3xl overflow-hidden">
                    <CardHeader className="bg-primary/10 border-b flex flex-row justify-between items-center">
                        <CardTitle className="text-xl font-black flex items-center gap-2"><ShieldCheck className="h-6 w-6"/> تتبع دعم التموين</CardTitle>
                        <Button type="button" size="sm" onClick={handleAutoFillQuotas} disabled={!selectedAreaRange} className="font-bold">توزيع الحصص آلياً</Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>فئة المساحة للدعم</Label>
                                <Controller name="subsidyAreaRange" control={control} render={({field}) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder="اختر الفئة..." /></SelectTrigger>
                                        <SelectContent><SelectItem value="100-199">100 - 199 م²</SelectItem><SelectItem value="200-299">200 - 299 م²</SelectItem><SelectItem value="300-400">300 - 400 م²</SelectItem></SelectContent>
                                    </Select>
                                )}/>
                            </div>
                            <div className="grid gap-2"><Label>رقم طلب الائتمان</Label><Input {...register('subsidyRequestId')} className="h-11" /></div>
                            <div className="grid gap-2"><Label>تاريخ الانتهاء</Label><Controller name="subsidyExpiryDate" control={control} render={({field}) => <DateInput value={field.value} onChange={field.onChange} className="h-11" />} /></div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
        <DialogFooter className="pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                حفظ هيكل المشروع
            </Button>
        </DialogFooter>
    </form>
  )
}
