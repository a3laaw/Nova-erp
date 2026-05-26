'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { 
    Save, X, Loader2, PlusCircle, Trash2, LayoutGrid, 
    Calculator, Ruler, Building2, Layers,
    Sparkles,
    Target
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { Client, Quotation, ContractTemplate, SubService, TransactionType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, orderBy, where, limit, doc, getDoc } from 'firebase/firestore';
import { DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { Separator } from '@/components/ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { useSearchParams } from 'next/navigation';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

const itemSchema = z.object({
  id: z.string(),
  description: z.string().optional(), 
  triggerCondition: z.string().min(1, "شرط الاستحقاق مطلوب لكل دفعة"), 
  quantity: z.preprocess((v) => parseFloat(String(v || '1')), z.number().min(0.01)),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)),
  percentage: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
});

const layoutBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['preamble', 'financial_table']),
  title: z.string().optional(),
  content: z.string().optional(),
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
  transactionId: z.string().optional().nullable(),
  subject: z.string().min(1, 'الموضوع مطلوب.'),
  date: z.date({ required_error: "التاريخ مطلوب." }),
  validUntil: z.date({ required_error: "تاريخ الانتهاء مطلوب." }),
  transactionTypeId: z.string().optional().nullable(),
  subServiceId: z.string().optional().nullable(),
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  basementType: z.enum(['none', 'full', 'half', 'vault']).default('none'),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  workNature: z.enum(['labor_only', 'with_materials']).default('labor_only'),
  layoutBlocks: z.array(layoutBlockSchema).default([]),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند مالي واحد على الأقل.'),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => (a === '' || a === null) ? 0 : parseFloat(String(a)), z.number().optional()),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

export function QuotationForm({ onSave, onClose, initialData = null, isSaving = false }: any) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [allTemplates, setAllTemplates] = useState<ContractTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [specificWorkStages, setSpecificWorkStages] = useState<{ value: string, label: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [isPathLoading, setIsPathLoading] = useState(false);
  const [importedTemplateId, setImportedTemplateId] = useState('');

  const tenantId = currentUser?.currentCompanyId;

  const prefilledClientId = searchParams.get('clientId') || '';
  const prefilledTransactionId = searchParams.get('transactionId') || '';

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors, isDirty } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
        date: new Date(),
        validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),
        financialsType: 'fixed',
        clientId: prefilledClientId,
        transactionId: prefilledTransactionId,
        transactionTypeId: '',
        subServiceId: '',
        totalArea: 0,
        floorsCount: 1,
        basementType: 'none',
        roofExtension: 'none',
        workNature: 'labor_only',
        layoutBlocks: [{ id: 'initial-table', type: 'financial_table' }],
        items: [{ id: generateId(), description: 'الدفعة الأولى', triggerCondition: 'عند توقيع العقد', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields: itemFields, replace: replaceItems, remove: removeItem, append: appendItem } = useFieldArray({ control, name: 'items' });
  const { fields: blockFields, replace: replaceBlocks, append: appendBlock, remove: removeBlock } = useFieldArray({ control, name: 'layoutBlocks' });

  const watchedItems = useWatch({ control, name: "items" });
  const financialsType = watch("financialsType");
  const selectedTransactionTypeId = watch("transactionTypeId");
  const selectedSubServiceId = watch("subServiceId");

  useEffect(() => {
    if (initialData) {
        const formattedData: any = {
            ...initialData,
            date: toFirestoreDate(initialData.date) || new Date(),
            validUntil: toFirestoreDate(initialData.validUntil) || new Date(),
            totalArea: Number(initialData.totalArea) || 0,
            floorsCount: Number(initialData.floorsCount) || 1,
            totalAmount: Number(initialData.totalAmount) || 0,
            basementType: initialData.basementType || 'none',
            roofExtension: initialData.roofExtension || 'none',
            workNature: initialData.workNature || 'labor_only',
            transactionId: initialData.transactionId || null,
            items: (initialData.items || []).map((item: any, idx: number) => ({
                ...item,
                id: item.id || generateId(),
                description: item.description || `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unitPrice || item.amount) || 0,
                percentage: Number(item.percentage) || 0,
                triggerCondition: item.triggerCondition || item.condition || '',
            })),
            layoutBlocks: initialData.layoutBlocks && initialData.layoutBlocks.length > 0 
                ? initialData.layoutBlocks 
                : [{ id: 'initial-table', type: 'financial_table' }]
        };
        reset(formattedData);
    } else if (prefilledClientId) {
        setValue('clientId', prefilledClientId);
        setValue('transactionId', prefilledTransactionId);
    }
  }, [initialData, reset, prefilledClientId, prefilledTransactionId, setValue]);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const fetchRefData = async () => {
      setRefDataLoading(true);
      try {
        const clientPath = getTenantPath('clients', tenantId);
        const templatePath = getTenantPath('contractTemplates', tenantId);
        const typesPath = getTenantPath('transactionTypes', tenantId);

        const [clientsSnap, templatesSnapshot, typesSnap] = await Promise.all([
          getDocs(query(collection(firestore, clientPath!), where('isActive', '==', true), limit(200))),
          getDocs(query(collection(firestore, templatePath!), orderBy('title'))),
          getDocs(query(collection(firestore, typesPath!), orderBy('order'))),
        ]);
        setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
        setAllTemplates(templatesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContractTemplate)));
        setTransactionTypes(typesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TransactionType)));
        
        if (prefilledClientId && prefilledTransactionId) {
            const txPath = getTenantPath(`clients/${prefilledClientId}/transactions/${prefilledTransactionId}`, tenantId);
            const txSnap = await getDoc(doc(firestore, txPath!));
            if (txSnap.exists()) {
                const txData = txSnap.data();
                setValue('transactionTypeId', txData.transactionTypeId || '');
                setValue('subServiceId', txData.subServiceId || '');
                setValue('subject', `عرض سعر: ${txData.transactionType}`);
            }
        }
      } catch (error) { console.error("Reference data error:", error); } finally { setRefDataLoading(false); }
    };
    fetchRefData();
  }, [firestore, tenantId, prefilledClientId, prefilledTransactionId, setValue]);

  useEffect(() => {
      if (!selectedTransactionTypeId || !firestore || !tenantId) {
          setSubServices([]);
          return;
      }
      const fetchSubServices = async () => {
          setIsPathLoading(true);
          try {
              const subsPath = getTenantPath(`transactionTypes/${selectedTransactionTypeId}/subServices`, tenantId);
              const snap = await getDocs(query(collection(firestore, subsPath!), orderBy('order')));
              setSubServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService)));
          } finally { setIsPathLoading(false); }
      };
      fetchSubServices();
  }, [selectedTransactionTypeId, firestore, tenantId]);

  useEffect(() => {
      if (!selectedSubServiceId || !selectedTransactionTypeId || !firestore || !tenantId) {
          setSpecificWorkStages([]);
          return;
      }
      const fetchStages = async () => {
          try {
              const stagesPath = getTenantPath(`transactionTypes/${selectedTransactionTypeId}/subServices/${selectedSubServiceId}/workStages`, tenantId);
              const snap = await getDocs(query(collection(firestore, stagesPath!), orderBy('order')));
              const stages = snap.docs.map(d => ({ value: d.data().name, label: d.data().name }));
              setSpecificWorkStages([{ value: 'عند توقيع العقد', label: 'عند توقيع العقد' }, ...stages]);
          } catch (e) { console.error(e); }
      };
      fetchStages();
  }, [selectedSubServiceId, selectedTransactionTypeId, firestore, tenantId]);

  const totalCalculatedValue = useMemo(() => {
    const items = watchedItems || [];
    if (financialsType === 'fixed') {
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    } else {
        return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    }
  }, [watchedItems, financialsType]);

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setImportedTemplateId(templateId);
    
    setValue('subject', template.title, { shouldValidate: true, shouldDirty: true });
    setValue('workNature', template.workNature || 'labor_only', { shouldValidate: true, shouldDirty: true });
    setValue('financialsType', template.financials?.type || 'fixed', { shouldValidate: true, shouldDirty: true });
    setValue('totalAmount', template.financials?.totalAmount || 0, { shouldValidate: true, shouldDirty: true });
    setValue('transactionTypeId', template.transactionTypeId || '', { shouldValidate: true, shouldDirty: true });
    setValue('subServiceId', template.subServiceId || '', { shouldValidate: true, shouldDirty: true });
    
    if (template.financials?.milestones) {
        const newItems = template.financials.milestones.map((m, idx) => ({
            id: generateId(), 
            description: `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
            triggerCondition: m.condition || m.name || '', 
            quantity: 1,
            unitPrice: template.financials?.type === 'fixed' ? Number(m.value) : 0,
            percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
        }));
        replaceItems(newItems);
    }

    const currentBlocks = watch('layoutBlocks') || [];
    if (!currentBlocks.some(b => b.type === 'financial_table')) {
        replaceBlocks([...currentBlocks, { id: 'imported-table', type: 'financial_table' }]);
    }
    
    toast({ title: '✅ تم استيراد القالب والربط المالي' });
  };

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);
  const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.id!, label: t.name })), [transactionTypes]);

  const wbsOptionsForItems = useMemo(() => {
      const currentValues = (watchedItems || []).map(i => i.triggerCondition).filter(Boolean);
      const existingValues = new Set(specificWorkStages.map(s => s.value));
      const fallbacks = currentValues.filter(v => !existingValues.has(v)).map(v => ({ value: v, label: v }));
      return [...specificWorkStages, ...fallbacks];
  }, [specificWorkStages, watchedItems]);

  const onSubmitHandler = (data: any) => {
      onSave(data);
  };

  const onErrorHandler = (errors: any) => {
      console.error("Form Validation Errors:", errors);
      toast({ 
          variant: 'destructive', 
          title: 'بيانات ناقصة أو غير صحيحة', 
          description: 'يرجى مراجعة كافة حقول الدفعات وتأكد من ملء شرط الاستحقاق لكل بند مالي.' 
      });
  };

  return (
    <form onSubmit={handleSubmit(onSubmitHandler, onErrorHandler)} className="space-y-6 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-200 no-print">
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-slate-400 tracking-widest pr-1">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن العميل..." className="h-8" />
              )} />
          </div>
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-primary tracking-widest pr-1 flex items-center gap-1"><Sparkles className="h-3 w-3"/> استيراد قالب مالي جاهز</Label>
              <InlineSearchList 
                value={importedTemplateId} 
                onSelect={handleTemplateSelect} 
                options={templateOptions} 
                placeholder={refDataLoading ? "تحميل القوالب..." : "اختر قالباً للتعبئة آلياً..."} 
                className="h-8 border-primary/20 bg-primary/5 shadow-sm" 
              />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-slate-400 tracking-widest pr-1">موضوع العرض الرسمي *</Label>
              <Input {...register('subject')} placeholder="عنوان العرض..." className="h-9 rounded-xl font-bold text-[#1e1b4b]" />
          </div>
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-slate-400 tracking-widest pr-1">التاريخ</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-9" />} />
          </div>
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-slate-400 tracking-widest pr-1">صلاحية العرض</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-9" />} />
          </div>
      </div>

      <div className="space-y-2">
          <h3 className="text-sm font-black text-[#1e1b4b] flex items-center gap-2 px-1">
              <Layers className="h-4 w-4 text-indigo-600" /> المواصفات والمسار الفني المخطط
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-[2rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500/20" />
              <div className="grid gap-1">
                  <Label className="font-black text-[8px] uppercase text-slate-400 pr-1">الخدمة الرئيسية</Label>
                  <Controller control={control} name="transactionTypeId" render={({ field }) => (
                      <InlineSearchList value={field.value || ''} onSelect={(v) => { field.onChange(v); setValue('subServiceId', ''); }} options={transactionTypeOptions} placeholder="اختر الخدمة..." className="h-8" />
                  )} />
              </div>
              <div className="grid gap-1">
                  <Label className="font-black text-[8px] uppercase text-primary pr-1">الخدمة التفصيلية</Label>
                  <Controller control={control} name="subServiceId" render={({ field }) => (
                      <InlineSearchList 
                        value={field.value || ''} 
                        onSelect={field.onChange} 
                        options={subServices.map(s => ({ value: s.id!, label: s.name }))} 
                        placeholder={isPathLoading ? "تحميل..." : "حدد النوع الفرعي..."} 
                        disabled={!selectedTransactionTypeId || isPathLoading}
                        className="h-8 border-primary/20 bg-primary/5 text-primary" 
                      />
                  )} />
              </div>
              <div className="grid grid-cols-4 gap-2 md:col-span-2 pt-2 border-t border-dashed">
                <div className="grid gap-0.5"><Label className="text-[8px] font-black text-slate-400">المساحة</Label><Input type="number" {...register('totalArea')} className="h-8 font-black text-center text-indigo-600 text-xs" /></div>
                <div className="grid gap-0.5"><Label className="text-[8px] font-black text-slate-400">الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-8 font-black text-center text-xs" /></div>
                <div className="grid gap-0.5"><Label className="text-[8px] font-black text-slate-400">السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-8 font-bold text-xs"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
                <div className="grid gap-0.5"><Label className="text-[8px] font-black text-slate-400">السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-8 font-bold text-xs"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون</SelectItem><SelectItem value="full">كامل</SelectItem><SelectItem value="half">نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
              </div>
          </div>
      </div>

      <div className="space-y-4">
          <div className="flex justify-between items-center px-1 no-print">
            <h3 className="text-sm font-black text-[#1e1b4b] flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" /> أقسام وتنسيق مستند العرض
            </h3>
            <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => appendBlock({ id: generateId(), type: 'preamble', title: 'بند إضافي', content: '' })} className="rounded-xl h-8 px-4 font-bold text-[10px] gap-2 border-primary/20 text-primary">
                    <PlusCircle className="h-3.5 w-3.5" /> إضافة نص +
                </Button>
                {!blockFields.some(b => b.type === 'financial_table') && (
                    <Button type="button" variant="outline" onClick={() => appendBlock({ id: generateId(), type: 'financial_table' })} className="rounded-xl h-8 px-4 font-bold text-[10px] gap-2 border-green-200 text-green-700 bg-green-50">
                        <Calculator className="h-3.5 w-3.5" /> إدراج جدول الدفعات
                    </Button>
                )}
            </div>
          </div>
          
          <div className="space-y-4">
              {blockFields.map((block, index) => (
                  <div key={block.id} className="p-6 rounded-[2rem] border-2 bg-white shadow-md hover:border-primary/20 transition-all">
                      {block.type === 'preamble' ? (
                          <div className="space-y-3">
                              <div className="flex justify-between items-center mb-1">
                                  <Badge variant="outline" className="text-[8px] font-black uppercase opacity-40">بند تحريري مخصص</Badge>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(index)} className="h-7 w-7 text-red-400 rounded-full hover:bg-red-50"><Trash2 className="h-3.5 w-3.5"/></Button>
                              </div>
                              <Input {...register(`layoutBlocks.${index}.title`)} placeholder="عنوان البند (مثال: الشروط العامة)..." className="h-9 border-none font-black text-lg text-[#1e1b4b] bg-transparent focus-visible:ring-0 px-0" />
                              <Textarea {...register(`layoutBlocks.${index}.content`)} placeholder="اكتب نص البند هنا..." className="rounded-2xl border-none bg-slate-50/50 shadow-inner text-base font-medium leading-relaxed p-6" rows={3} />
                          </div>
                      ) : (
                          <div className="space-y-5">
                              <div className="flex justify-between items-center bg-primary/5 p-5 rounded-2xl border border-primary/10">
                                  <div className="flex items-center gap-3">
                                      <div className="p-2 bg-white rounded-xl shadow-sm text-primary"><Calculator className="h-5 w-5"/></div>
                                      <Label className="text-base font-black text-[#1e1b4b]">دفعات الاستحقاق المالية المعتمدة</Label>
                                  </div>
                                  <div className="flex items-center gap-4 no-print">
                                      <div className="grid gap-1">
                                          <Label className="text-[8px] font-black uppercase text-slate-400 text-center">نظام التسعير</Label>
                                          <Controller name="financialsType" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="w-36 h-8 rounded-xl border-none bg-white font-black text-primary text-xs shadow-md"><SelectValue /></SelectTrigger>
                                                <SelectContent dir="rtl" className="text-xs"><SelectItem value="fixed">مبلغ ثابت (KWD)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                                            </Select>
                                          )} />
                                      </div>
                                      <div className="grid gap-1">
                                          <Label className="text-[8px] font-black uppercase text-slate-400 text-center">إجمالي قيمة العقد</Label>
                                          <Input type="number" step="any" {...register('totalAmount')} readOnly={financialsType === 'fixed'} className={cn("w-24 h-8 border-none text-center font-black text-base text-primary rounded-xl shadow-md", financialsType === 'fixed' ? "bg-muted/50" : "bg-white")} />
                                      </div>
                                  </div>
                              </div>

                              <div className="border-2 border-slate-100 rounded-[2.2rem] overflow-hidden shadow-xl bg-white/50">
                                  <Table>
                                      <TableHeader className="bg-slate-900 h-12">
                                        <TableRow className="border-none">
                                            <TableHead className="w-20 text-center font-black text-[10px] text-white/40 border-l border-white/10">#</TableHead>
                                            <TableHead className="px-6 font-black text-xs text-white text-right">شرط الاستحقاق (WBS LINK)</TableHead>
                                            <TableHead className="text-center font-black text-xs text-white w-48">
                                                {financialsType === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                            </TableHead>
                                            <TableHead className="w-16 no-print"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {itemFields.map((field, itemIdx) => (
                                              <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-primary/[0.02] group/row transition-all">
                                                  <TableCell className="text-center bg-slate-50/50 border-l">
                                                      <Badge variant="secondary" className="font-black text-[10px] px-3 h-6 rounded-full bg-white text-slate-500 border shadow-sm">{itemIdx + 1}</Badge>
                                                  </TableCell>
                                                  <TableCell className="px-6">
                                                      <div className="flex flex-col gap-1">
                                                          <Controller control={control} name={`items.${itemIdx}.triggerCondition`} render={({ field: condField }) => (
                                                            <InlineSearchList 
                                                                value={condField.value} 
                                                                onSelect={condField.onChange} 
                                                                options={wbsOptionsForItems} 
                                                                placeholder="اربط بمرحلة أو اكتب شرطاً مخصصاً..." 
                                                                allowCustomValue={true}
                                                                className={cn("font-black text-xs border-dashed border-2 text-primary h-9 bg-white", errors.items?.[itemIdx]?.triggerCondition ? "border-red-500" : "border-primary/20")} 
                                                            />
                                                          )} />
                                                          <span className="text-[8px] font-black text-slate-300 uppercase pr-2">دفعة {arabicOrdinals[itemIdx] || (itemIdx+1)}</span>
                                                      </div>
                                                  </TableCell>
                                                  <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                                      <Input 
                                                        type="number" step="any" 
                                                        {...register(financialsType === 'percentage' ? `items.${itemIdx}.percentage` : `items.${itemIdx}.unitPrice`)} 
                                                        className="text-center font-black text-3xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono h-10" 
                                                        placeholder="" 
                                                      />
                                                  </TableCell>
                                                  <TableCell className="text-center no-print">
                                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(itemIdx)} disabled={itemFields.length <= 1} className="h-8 w-8 text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover/row:opacity-100 transition-all"><Trash2 className="h-4 w-4"/></Button>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                      <TableFooter className="bg-primary/5 h-16">
                                          <TableRow className="border-none hover:bg-transparent">
                                            <TableCell colSpan={2} className="text-right px-10"><p className="text-base font-black text-slate-900 tracking-tight">إجمالي قيمة العرض:</p></TableCell>
                                            <TableCell className="text-center border-r border-slate-200 bg-white">
                                                <div className="text-2xl font-black font-mono tracking-tighter text-primary">
                                                    {financialsType === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                                </div>
                                            </TableCell>
                                            <TableCell className="no-print" />
                                          </TableRow>
                                      </TableFooter>
                                  </Table>
                                  <div className="p-4 flex justify-center bg-muted/5 border-t border-dashed no-print">
                                      <Button type="button" variant="ghost" onClick={() => appendItem({ id: generateId(), triggerCondition: '', quantity: 1, unitPrice: 0, description: `الدفعة ${arabicOrdinals[itemFields.length] || (itemFields.length+1)}` })} className="h-10 px-8 rounded-xl border-dashed border-2 font-bold text-xs text-primary gap-2 hover:bg-white shadow-sm">
                                          <PlusCircle className="h-4 w-4" /> إضافة دفعة استحقاق يدوية +
                                      </Button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              ))}
          </div>
      </div>

      <DialogFooter className="pt-10 border-t flex flex-col md:flex-row gap-4 no-print items-center">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-14 px-12 rounded-2xl font-bold text-slate-400">إلغاء</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financialsType === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-16 px-20 rounded-[2.5rem] font-black text-2xl shadow-2xl shadow-primary/30 flex-1 gap-4 transition-all hover:scale-[1.02] bg-[#7209B7] text-white border-none"
          >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
              اعتماد
          </Button>
      </DialogFooter>
    </form>
  );
}
