'use client';

import React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, LayoutGrid, Calculator, Ruler, Building2, Layers, Droplets, Zap, Package, ArrowDownLeft, FileSignature } from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { Client, Quotation, ContractTemplate, ConstructionProject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '../ui/separator';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '../ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "الوصف مطلوب"),
  quantity: z.preprocess((v) => parseFloat(String(v || '1')), z.number().min(0.01)),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)),
  percentage: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  condition: z.string().optional(),
  total: z.number().optional(),
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.date({ required_error: "التاريخ مطلوب." }),
  validUntil: z.date({ required_error: "تاريخ الانتهاء مطلوب." }),
  
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
  toiletType: z.enum(['ordinary', 'suspended']).default('ordinary'),
  showerType: z.enum(['ordinary', 'hidden']).default('ordinary'),
  
  suspendedExtensionCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryExtensionCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  suspendedToiletCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryToiletCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  hiddenShowerCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  ordinaryShowerCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),

  electricalPointsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  planReferenceNumber: z.string().optional(),

  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().optional()),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationFormProps {
    onSave: (data: any) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Quotation> | null;
    isSaving?: boolean;
}

export function QuotationForm({ onSave, onClose, initialData = null, isSaving = false }: QuotationFormProps) {
  const isEditing = !!initialData;
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [allTemplates, setAllTemplates] = React.useState<ContractTemplate[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [refDataLoading, setRefDataLoading] = React.useState(true);

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
        date: new Date(),
        validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),
        financialsType: 'fixed',
        totalArea: 0,
        floorsCount: 1,
        basementType: 'none',
        roofExtension: 'none',
        workNature: 'labor_only',
        sanitaryMaterialsIncluded: false,
        sanitaryExtensionType: 'ordinary',
        toiletType: 'ordinary',
        showerType: 'ordinary',
        bathroomsCount: 0,
        suspendedExtensionCount: 0, ordinaryExtensionCount: 0,
        suspendedToiletCount: 0, ordinaryToiletCount: 0,
        hiddenShowerCount: 0, ordinaryShowerCount: 0,
        items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const total_amount = watch("totalAmount");
  const watchedSubject = watch("subject");
  const watchedWorkNature = watch("workNature");

  const watchedSuspendedExt = watch('suspendedExtensionCount');
  const watchedOrdinaryExt = watch('ordinaryExtensionCount');

  React.useEffect(() => {
    const total = (Number(watchedSuspendedExt) || 0) + (Number(watchedOrdinaryExt) || 0);
    setValue('bathroomsCount', total);
  }, [watchedSuspendedExt, watchedOrdinaryExt, setValue]);

  const showSanitary = React.useMemo(() => watchedSubject?.includes('صحي'), [watchedSubject]);
  const showElectrical = React.useMemo(() => watchedSubject?.includes('كهرباء'), [watchedSubject]);
  
  const totalCalculatedAmount = React.useMemo(() => {
    if (financials_type === 'fixed') {
        return (watchedItems || []).reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    }
    return total_amount || 0;
  }, [watchedItems, financials_type, total_amount]);

  React.useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
      setRefDataLoading(true);
      try {
        const [clientsSnap, templatesSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true), limit(200))),
          getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title'))),
        ]);
        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setAllTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
      } catch (error) { console.error(error); } finally { setRefDataLoading(false); }
    };
    fetchRefData();
  }, [firestore]);

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setValue('workNature', template.workNature || 'labor_only');
    setValue('financialsType', template.financials?.type || 'fixed');
    setValue('totalAmount', template.financials?.totalAmount || 0);
    setValue('subject', template.title);
    
    const newItems = template.financials?.milestones?.map(m => ({
      id: generateId(), description: m.name, quantity: 1,
      unitPrice: template.financials?.type === 'fixed' ? Number(m.value) : 0,
      percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
      condition: m.condition || '',
    })) || [];
    replace(newItems);
  };

  const clientOptions = React.useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = React.useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/20 p-6 rounded-3xl border">
          <div className="grid gap-2">
              <Label className="font-bold">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." disabled={isEditing} />
              )} />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold text-primary">استخدام نموذج عقد كمسودة</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً لتوريث طبيعة التعاقد والدفعات..." />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-2 md:col-span-1">
              <Label className="font-bold">موضوع العرض *</Label>
              <Input {...register('subject')} placeholder="مثال: عرض سعر توريد وتركيب..." />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold">التاريخ</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold">صالح لغاية</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
          </div>
      </div>

      <div className="space-y-6">
          <h3 className="text-lg font-black text-foreground border-r-4 border-primary pr-3">المواصفات الفنية والمساحات</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-muted/10 p-6 rounded-3xl border border-dashed items-end">
              <div className="grid gap-2"><Label className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-11 font-mono font-bold" /></div>
              <div className="grid gap-2"><Label>عدد الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-11" /></div>
              <div className="grid gap-2"><Label>توسعة السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
              <div className="grid gap-2"><Label>خيار السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-11 font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">بدون سرداب</SelectItem><SelectItem value="full">سرداب كامل</SelectItem><SelectItem value="half">سرداب نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
              
              {watchedWorkNature !== 'labor_only' && (
                <div className="grid gap-2">
                    <Label className="font-bold text-primary flex items-center gap-2"><FileSignature className="h-3 w-3"/> طبيعة التعاقد</Label>
                    <Controller name="workNature" control={control} render={({field}) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={!!watchedSubject}>
                            <SelectTrigger className="h-11 border-primary/20 bg-primary/5">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="labor_only">عقد مصنعية فقط</SelectItem>
                                <SelectItem value="with_materials">عقد توريد وتنفيذ</SelectItem>
                            </SelectContent>
                        </Select>
                    )}/>
                </div>
              )}
          </div>

          {showSanitary && (
            <div className="space-y-6 animate-in fade-in zoom-in-95">
                {/* إجمالي الأعداد أولاً */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-blue-50/20 p-4 rounded-2xl border border-blue-100 items-center">
                    <div className="grid gap-1.5">
                        <Label className="text-xs font-black text-primary">إجمالي عدد الحمامات</Label>
                        <Input type="number" {...register('bathroomsCount')} readOnly className="h-10 text-center font-black bg-white border-primary/20" />
                    </div>
                    <div className="grid gap-1.5"><Label className="text-xs font-bold text-blue-800 text-center">مطابخ</Label><Input type="number" {...register('kitchensCount')} className="h-10 text-center font-black" /></div>
                    <div className="grid gap-1.5"><Label className="text-xs font-bold text-blue-800 text-center">غرف غسيل</Label><Input type="number" {...register('laundryRoomsCount')} className="h-10 text-center font-black" /></div>
                    {watchedWorkNature === 'with_materials' && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-blue-200">
                            <div className="flex items-center gap-3">
                                <Package className="h-5 w-5 text-blue-600" />
                                <div><p className="font-bold text-[10px] text-blue-900">توريد المواد</p></div>
                            </div>
                            <Controller name="sanitaryMaterialsIncluded" control={control} render={({field}) => (<Switch checked={field.value} onCheckedChange={field.onChange} />)}/>
                        </div>
                    )}
                </div>

                {/* كروت التوزيع ثانياً */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="rounded-2xl border-2 border-blue-100 bg-blue-50/10">
                        <CardHeader className="pb-4 bg-blue-50/50 border-b border-blue-100">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-blue-700">
                                <Droplets className="h-4 w-4"/> توزيع نوع التمديد
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex justify-center gap-4">
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">معلق</Label>
                                <Input type="number" {...register('suspendedExtensionCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">عادي</Label>
                                <Input type="number" {...register('ordinaryExtensionCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 border-blue-100 bg-blue-50/10">
                        <CardHeader className="pb-4 bg-blue-50/50 border-b border-blue-100">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-blue-700">
                                <Package className="h-4 w-4"/> توزيع المراحيض
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex justify-center gap-4">
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">معلق</Label>
                                <Input type="number" {...register('suspendedToiletCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">عادي</Label>
                                <Input type="number" {...register('ordinaryToiletCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-2 border-blue-100 bg-blue-50/10">
                        <CardHeader className="pb-4 bg-blue-50/50 border-b border-blue-100">
                            <CardTitle className="text-xs font-black flex items-center gap-2 text-blue-700">
                                <Droplets className="h-4 w-4"/> توزيع الشاورات
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex justify-center gap-4">
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">مخفي</Label>
                                <Input type="number" {...register('hiddenShowerCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <Label className="text-[10px] font-bold text-muted-foreground">عادي</Label>
                                <Input type="number" {...register('ordinaryShowerCount')} className="h-8 w-16 text-center font-bold" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
          )}

          {showElectrical && (
            <Card className="rounded-2xl border-2 border-yellow-100 bg-yellow-50/10 animate-in fade-in zoom-in-95">
                <CardHeader className="pb-4"><CardTitle className="text-sm font-black flex items-center gap-2 text-yellow-700"><Zap className="h-4 w-4"/> مواصفات الكهرباء (نقاط)</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1.5"><Label className="text-[10px] font-bold">عدد نقاط الكهرباء</Label><Input type="number" {...register('electricalPointsCount')} className="h-9 text-center font-black" /></div>
                    <div className="grid gap-1.5"><Label className="text-[10px] font-bold">رقم مرجع المخطط</Label><Input {...register('planReferenceNumber')} className="h-9 text-center font-mono text-xs" /></div>
                </CardContent>
            </Card>
          )}
      </div>

      <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
              <Label className="text-lg font-black flex items-center gap-2"><Calculator className="h-5 w-5 text-primary"/> تسعير بنود العقد والدفعات</Label>
              <div className="flex items-center gap-4">
                  <Label className="text-xs font-bold">طريقة التسعير:</Label>
                  <Controller name="financialsType" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-32 h-8 rounded-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="fixed">مبلغ ثابت</SelectItem><SelectItem value="percentage">نسبة مئوية</SelectItem></SelectContent>
                      </Select>
                  )} />
              </div>
          </div>

          <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
              <Table>
                  <TableHeader className="bg-muted/50"><TableRow className="h-14 border-b-2"><TableHead className="px-6 font-bold">بيان الدفعة / البند</TableHead><TableHead className="text-center font-bold w-32">{financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                  <TableBody>
                      {fields.map((field, index) => (
                          <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                              <TableCell className="px-4"><Input {...register(`items.${index}.description`)} className="font-bold border-none shadow-none focus-visible:ring-0 text-base" /></TableCell>
                              <TableCell><Input type="number" step="any" {...register(financials_type === 'percentage' ? `items.${index}.percentage` : `items.${index}.unitPrice`)} className="text-center font-black text-xl text-primary border-none shadow-none focus-visible:ring-0" /></TableCell>
                              <TableCell className="text-center"><Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button></TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter className="bg-primary/5">
                      <TableRow className="h-20 border-t-4"><TableCell className="text-right px-12 font-black text-xl">إجمالي قيمة العرض:</TableCell><TableCell className="text-center font-mono text-2xl font-black text-primary">{financials_type === 'fixed' ? formatCurrency(totalCalculatedAmount) : `${totalCalculatedAmount}%`}</TableCell><TableCell /></TableRow>
                  </TableFooter>
              </Table>
          </div>
          <Button type="button" variant="outline" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0 })} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold"><PlusCircle className="h-4 w-4" /> إضافة بند إضافي</Button>
      </div>

      <DialogFooter className="pt-8 border-t">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button type="submit" disabled={isSaving || refDataLoading} className="h-12 px-16 rounded-xl font-black text-lg shadow-xl shadow-primary/30">
              {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin" /> : <Save className="ml-3 h-5 w-5" />}
              حفظ وتوليد المسودة
          </Button>
      </DialogFooter>
    </form>
  );
}
