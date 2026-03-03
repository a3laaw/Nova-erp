
'use client';

import React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Save, X, Loader2, PlusCircle, Trash2, LayoutGrid, Calculator, Building2, Layers, Ruler, Droplets, Zap } from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { Client, Quotation, ContractTemplate, ConstructionType, ConstructionProject } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { InlineSearchList, type SearchOption } from '@/components/ui/inline-search-list';
import { Textarea } from '@/components/ui/textarea';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { collection, getDocs, query, collectionGroup, orderBy, where, limit } from 'firebase/firestore';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

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
  projectId: z.string().optional().nullable(),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.date({ required_error: "التاريخ مطلوب." }),
  validUntil: z.date({ required_error: "تاريخ الانتهاء مطلوب." }),
  
  // المواصفات الفنية المتعاقد عليها
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  hasBasement: z.boolean().default(false),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  bathroomsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  kitchensCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  laundryRoomsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  electricalPointsCount: z.preprocess((v) => parseInt(String(v || '0'), 10), z.number().min(0)).optional(),
  planReferenceNumber: z.string().optional(),

  items: z.array(itemSchema).min(1, 'يجب إضافة بند واحد على الأقل.'),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
  transactionTypeId: z.string().optional(),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => parseFloat(String(a || '0')), z.number().optional()),
  scopeOfWork: z.array(z.any()).optional(),
  termsAndConditions: z.array(z.any()).optional(),
  openClauses: z.array(z.any()).optional(),
  templateDescription: z.string().optional(),
  templateId: z.string().optional(),
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
  const [projects, setProjects] = React.useState<ConstructionProject[]>([]);
  const [refDataLoading, setRefDataLoading] = React.useState(true);

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
        date: new Date(),
        validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),
        financialsType: 'fixed',
        totalArea: 0,
        floorsCount: 1,
        hasBasement: false,
        roofExtension: 'none',
        items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const financials_type = watch("financialsType");
  const total_amount = watch("totalAmount");
  const selectedClientId = watch("clientId");
  
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
        const [clientsSnap, templatesSnapshot, projectsSnap] = await Promise.all([
          getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true), limit(200))),
          getDocs(query(collection(firestore, 'contractTemplates'), orderBy('title'))),
          getDocs(query(collection(firestore, 'projects'), where('status', '==', 'مخطط')))
        ]);

        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setAllTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
        setProjects(projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConstructionProject)));

      } catch (error) {
        console.error("Error fetching reference data:", error);
      } finally {
        setRefDataLoading(false);
      }
    };
    fetchRefData();
  }, [firestore]);

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;

    setValue('financialsType', template.financials?.type || 'fixed');
    setValue('totalAmount', template.financials?.totalAmount || 0);
    setValue('templateDescription', template.description || '');
    setValue('scopeOfWork', template.scopeOfWork || []);
    setValue('termsAndConditions', template.termsAndConditions || []);
    setValue('openClauses', template.openClauses || []);
    setValue('subject', template.title);

    const newItems = template.financials?.milestones?.map(m => ({
      id: generateId(),
      description: m.name,
      quantity: 1,
      unitPrice: template.financials?.type === 'fixed' ? Number(m.value) : 0,
      percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
      condition: m.condition || '',
    })) || [];

    replace(newItems);
    toast({ title: 'تم تحميل النموذج', description: 'يمكنك الآن تعديل الأسعار والبنود كما ترغب.' });
  };

  const clientOptions = React.useMemo(() => clients.map(c => ({ value: c.id, label: c.nameAr })), [clients]);
  const projectOptions = React.useMemo(() => 
    projects.filter(p => p.clientId === selectedClientId).map(p => ({ value: p.id!, label: p.projectName })),
  [projects, selectedClientId]);
  const templateOptions = React.useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-muted/20 p-6 rounded-3xl border">
          <div className="grid gap-2">
              <Label className="font-bold">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن عميل..." disabled={isEditing} />
              )} />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold">ربط بهيكل مشروع (اختياري)</Label>
              <Controller control={control} name="projectId" render={({ field }) => (
                  <InlineSearchList value={field.value || ''} onSelect={field.onChange} options={projectOptions} placeholder="اختر المشروع..." disabled={!selectedClientId} />
              )} />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold text-primary">استخدام نموذج عقد كمسودة</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً للتعبئة السريعة..." />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-2 md:col-span-1">
              <Label className="font-bold">موضوع العرض *</Label>
              <Input {...register('subject')} placeholder="مثال: عرض سعر توريد وتركيب..." />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold">تاريخ العرض</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
          </div>
          <div className="grid gap-2">
              <Label className="font-bold">صالح لغاية</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} />} />
          </div>
      </div>

      {/* --- قسم المواصفات الفنية داخل عرض السعر --- */}
      <div className="space-y-6">
          <h3 className="text-lg font-black flex items-center gap-2 text-foreground border-r-4 border-primary pr-3">المواصفات الفنية المتفق عليها</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-muted/10 p-6 rounded-3xl border border-dashed">
              <div className="grid gap-2">
                  <Label className="flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة الإجمالية (م²)</Label>
                  <Input type="number" {...register('totalArea')} placeholder="0.00" className="h-10 font-mono font-bold" />
              </div>
              <div className="grid gap-2">
                  <Label>عدد الأدوار</Label>
                  <Input type="number" {...register('floorsCount')} placeholder="1" className="h-10" />
              </div>
              <div className="grid gap-2">
                  <Label>توسعة السطح</Label>
                  <Controller name="roofExtension" control={control} render={({field}) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent>
                      </Select>
                  )}/>
              </div>
              <div className="flex items-center justify-between p-2 h-10 border rounded-xl bg-background px-4 shadow-sm">
                  <Label htmlFor="hasBasement" className="font-bold cursor-pointer">سرداب</Label>
                  <Controller name="hasBasement" control={control} render={({field}) => (
                      <Switch id="hasBasement" checked={field.value} onCheckedChange={field.onChange} />
                  )}/>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 border-2 border-blue-100 bg-blue-50/10 rounded-2xl space-y-4">
                  <Label className="font-black text-blue-700 flex items-center gap-2"><Droplets className="h-4 w-4"/> مواصفات الصحي</Label>
                  <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-1.5"><Label className="text-[10px] font-bold">حمامات</Label><Input type="number" {...register('bathroomsCount')} className="h-9 text-center" /></div>
                      <div className="grid gap-1.5"><Label className="text-[10px] font-bold">مطابخ</Label><Input type="number" {...register('kitchensCount')} className="h-9 text-center" /></div>
                      <div className="grid gap-1.5"><Label className="text-[10px] font-bold">غرف غسيل</Label><Input type="number" {...register('laundryRoomsCount')} className="h-9 text-center" /></div>
                  </div>
              </div>
              <div className="p-6 border-2 border-yellow-100 bg-yellow-50/10 rounded-2xl space-y-4">
                  <Label className="font-black text-yellow-700 flex items-center gap-2"><Zap className="h-4 w-4"/> مواصفات الكهرباء</Label>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5"><Label className="text-[10px] font-bold">عدد النقاط (بناءً على المخطط)</Label><Input type="number" {...register('electricalPointsCount')} className="h-9 text-center" /></div>
                      <div className="grid gap-1.5"><Label className="text-[10px] font-bold">رقم مرجع المخطط</Label><Input {...register('planReferenceNumber')} className="h-9 text-center font-mono text-xs" placeholder="Ref-000" /></div>
                  </div>
              </div>
          </div>
      </div>

      <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
              <Label className="text-lg font-black flex items-center gap-2"><Calculator className="h-5 w-5 text-primary"/> تسعير بنود العقد والدفعات</Label>
              <div className="flex items-center gap-4">
                  <Label className="text-xs font-bold">طريقة التسعير:</Label>
                  <Controller name="financialsType" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-32 h-8 rounded-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="fixed">مبالغ ثابتة</SelectItem>
                              <SelectItem value="percentage">نسبة مئوية</SelectItem>
                          </SelectContent>
                      </Select>
                  )} />
              </div>
          </div>

          <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
              <Table>
                  <TableHeader className="bg-muted/50">
                      <TableRow className="h-14 border-b-2">
                          <TableHead className="px-6 font-bold">بيان الدفعة / البند</TableHead>
                          <TableHead className="text-center font-bold w-32">{financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead>
                          <TableHead className="w-12"></TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {fields.map((field, index) => (
                          <TableRow key={field.id} className="h-16 border-b last:border-0">
                              <TableCell className="px-4">
                                  <Input {...register(`items.${index}.description`)} className="font-bold border-none shadow-none focus-visible:ring-0 text-base" placeholder="وصف الدفعة..." />
                              </TableCell>
                              <TableCell>
                                  <Input 
                                    type="number" step="any" 
                                    {...register(financials_type === 'percentage' ? `items.${index}.percentage` : `items.${index}.unitPrice`)} 
                                    className="text-center font-black text-xl text-primary border-none shadow-none focus-visible:ring-0" 
                                  />
                              </TableCell>
                              <TableCell className="text-center">
                                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter className="bg-primary/5">
                      <TableRow className="h-20 border-t-4">
                          <TableCell className="text-right px-12 font-black text-xl">إجمالي قيمة العرض:</TableCell>
                          <TableCell className="text-center font-mono text-2xl font-black text-primary">
                              {financials_type === 'fixed' ? formatCurrency(totalCalculatedAmount) : `${totalCalculatedAmount}%`}
                          </TableCell>
                          <TableCell />
                      </TableRow>
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
