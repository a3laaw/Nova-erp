'use client';

import React from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { 
    Save, X, Loader2, PlusCircle, Trash2, LayoutGrid, 
    Calculator, Ruler, Building2, Layers, Droplets, 
    Zap, Package, ArrowDownLeft, FileSignature, Sparkles 
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { Client, Quotation, ContractTemplate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, orderBy, where, limit } from 'firebase/firestore';
import { DialogFooter } from '@/components/ui/dialog';
import { Switch } from '../ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { useAuth } from '@/context/auth-context';

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
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [allTemplates, setAllTemplates] = React.useState<ContractTemplate[]>([]);
  const [clients, setClients] = React.useState<Client[]>([]);
  const [refDataLoading, setRefDataLoading] = React.useState(true);

  const tenantId = currentUser?.currentCompanyId;

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
        bathroomsCount: 0,
        items: [{ id: generateId(), description: '', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const watchedSubject = watch("subject");

  const totalCalculatedAmount = React.useMemo(() => {
    const items = watchedItems || [];
    if (financials_type === 'fixed') {
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    }
    // 🛡️ إصلاح منطق النسبة المئوية: حساب المجموع آلياً
    return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
  }, [watchedItems, financials_type]);

  React.useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchRefData = async () => {
      setRefDataLoading(true);
      try {
        const clientPath = getTenantPath('clients', tenantId);
        const templatePath = getTenantPath('contractTemplates', tenantId);

        const [clientsSnap, templatesSnapshot] = await Promise.all([
          getDocs(query(collection(firestore, clientPath!), where('isActive', '==', true), limit(200))),
          getDocs(query(collection(firestore, templatePath!), orderBy('title'))),
        ]);
        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setAllTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
      } catch (error) { console.error(error); } finally { setRefDataLoading(false); }
    };
    fetchRefData();
  }, [firestore, tenantId]);

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setValue('workNature', template.workNature || 'labor_only');
    setValue('financialsType', template.financials?.type || 'fixed');
    setValue('totalAmount', template.financials?.totalAmount || 0);
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
  };

  const clientOptions = React.useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = React.useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-muted/20 p-8 rounded-[2.5rem] border-2 border-dashed">
          <div className="grid gap-3">
              <Label className="font-black text-gray-700 pr-2 flex items-center gap-2">العميل المستهدف * <Badge variant="outline" className="text-[8px] font-black bg-white">ID REQ</Badge></Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن اسم العميل..." disabled={isEditing} className="h-12 border-2 shadow-sm rounded-2xl" />
              )} />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-primary pr-2 flex items-center gap-2"><Sparkles className="h-4 w-4"/> استخدام نموذج عقد كمسودة</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً لتوريث الدفعات..." className="h-12 border-2 border-primary/20 bg-primary/5 rounded-2xl" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="grid gap-3 md:col-span-1">
              <Label className="font-black text-gray-700 pr-2">موضوع العرض *</Label>
              <Input {...register('subject')} placeholder="مثال: عرض سعر هيكل أسود..." className="h-12 rounded-2xl border-2 font-bold text-lg" />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-gray-700 pr-2">تاريخ العرض</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-12" />} />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-gray-700 pr-2">صالح لغاية</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-12" />} />
          </div>
      </div>

      <div className="space-y-6">
          <h3 className="text-xl font-black text-[#1e1b4b] border-r-8 border-primary pr-4 flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" /> المواصفات الفنية والمساحات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-white p-8 rounded-[2.5rem] border-2 shadow-inner items-end">
              <div className="grid gap-2"><Label className="font-bold flex items-center gap-2"><Ruler className="h-4 w-4 text-primary"/> المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-12 font-black text-2xl font-mono border-2 rounded-2xl text-center" /></div>
              <div className="grid gap-2"><Label className="font-bold">عدد الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-12 font-black text-xl border-2 rounded-2xl text-center" /></div>
              <div className="grid gap-2"><Label className="font-bold">توسعة السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-12 border-2 rounded-2xl font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
              <div className="grid gap-2"><Label className="font-bold">خيار السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-12 border-2 rounded-2xl font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون سرداب</SelectItem><SelectItem value="full">سرداب كامل</SelectItem><SelectItem value="half">سرداب نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
          </div>
      </div>

      <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
              <Label className="text-2xl font-black flex items-center gap-3 text-[#1e1b4b] border-r-8 border-primary pr-4">
                <Calculator className="h-7 w-7 text-primary"/> تسعير بنود العقد والدفعات
              </Label>
              <div className="flex items-center gap-4 bg-white p-2 px-6 rounded-full border-2 shadow-sm">
                  <Label className="text-xs font-black uppercase text-muted-foreground">طريقة التسعير:</Label>
                  <Controller name="financialsType" control={control} render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-40 h-10 rounded-full border-primary/20 bg-primary/5 font-black text-primary"><SelectValue /></SelectTrigger>
                          <SelectContent dir="rtl"><SelectItem value="fixed">مبلغ ثابت (د.ك)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                      </Select>
                  )} />
              </div>
          </div>

          <div className="border-2 rounded-[3rem] overflow-hidden shadow-2xl bg-white animate-in zoom-in-95 duration-500">
              <Table>
                  <TableHeader className="bg-muted/50 h-16 border-b-2">
                    <TableRow className="border-none">
                        <TableHead className="px-10 font-black text-base">بيان الدفعة / البند</TableHead>
                        <TableHead className="text-center font-black text-base w-48">{financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead>
                        <TableHead className="w-20 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {fields.map((field, index) => (
                          <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-primary/[0.02] transition-colors group">
                              <TableCell className="px-10">
                                <Input {...register(`items.${index}.description`)} className="font-black text-xl border-none shadow-none focus-visible:ring-0 bg-transparent" placeholder="اذكر مسمى الدفعة..." />
                              </TableCell>
                              <TableCell className="bg-primary/[0.02]">
                                <Input 
                                    type="number" 
                                    step="any" 
                                    {...register(financials_type === 'percentage' ? `items.${index}.percentage` : `items.${index}.unitPrice`)} 
                                    className="text-center font-black text-3xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono"
                                />
                              </TableCell>
                              <TableCell className="text-center pr-6">
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1} className="text-destructive rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="h-5 w-5"/>
                                </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter className="bg-slate-900 text-white h-24">
                      <TableRow className="border-none hover:bg-slate-900">
                        <TableCell className="text-right px-12 font-black text-2xl">إجمالي قيمة العرض:</TableCell>
                        <TableCell className="text-center font-mono text-4xl font-black text-primary">
                            {financials_type === 'fixed' ? formatCurrency(totalCalculatedAmount) : `${totalCalculatedAmount}%`}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                  </TableFooter>
              </Table>
          </div>
          <div className="flex justify-center pt-4">
            <Button type="button" variant="outline" onClick={() => append({ id: generateId(), description: '', quantity: 1, unitPrice: 0 })} className="h-14 px-20 rounded-2xl border-dashed border-4 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all gap-3 font-black text-xl text-primary group">
                <PlusCircle className="h-6 w-6 group-hover:rotate-90 transition-transform" /> إضافة دفعة مالية
            </Button>
          </div>
      </div>

      <DialogFooter className="pt-10 border-t flex flex-col md:flex-row gap-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-14 px-10 rounded-2xl font-bold">إلغاء وإغلاق</Button>
          <Button type="submit" disabled={isSaving || refDataLoading} className="h-16 px-24 rounded-3xl font-black text-2xl shadow-2xl shadow-primary/30 flex-1 gap-4 bg-primary text-white border-none transition-all active:scale-95">
              {isSaving ? <Loader2 className="h-8 w-8 animate-spin" /> : <Save className="h-8 w-8" />}
              اعتماد وحفظ عرض السعر
          </Button>
      </DialogFooter>
    </form>
  );
}
