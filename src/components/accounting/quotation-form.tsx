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
import { Textarea } from '../ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { Separator } from '../ui/separator';
import { toFirestoreDate } from '@/services/date-converter';
import { useSearchParams } from 'next/navigation';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string(),
  description: z.string().optional(), 
  triggerCondition: z.string().min(1, "شرط الاستحقاق مطلوب"), 
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
  transactionTypeId: z.string().min(1, "الخدمة الرئيسية مطلوبة"),
  subServiceId: z.string().min(1, "الخدمة التفصيلية مطلوبة"),
  totalArea: z.preprocess((v) => parseFloat(String(v || '0')), z.number().min(0)),
  basementType: z.enum(['none', 'full', 'half', 'vault']).default('none'),
  floorsCount: z.preprocess((v) => parseInt(String(v || '1'), 10), z.number().min(1)),
  roofExtension: z.enum(['none', 'quarter', 'half']).default('none'),
  workNature: z.enum(['labor_only', 'with_materials']).default('labor_only'),
  layoutBlocks: z.array(layoutBlockSchema).default([]),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند مالي واحد على الأقل.'),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => (a === '' || a === null) ? 0 : parseFloat(String(a)), z.number().optional()),
  transactionType: z.string().optional(),
  subServiceName: z.string().optional(),
  assignedEngineerId: z.string().optional(),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

/**
 * نموذج عرض السعر (V10.0):
 * - تم تحصين المزامنة الصفرية لضمان عدم ضياع شروط الاستحقاق والمواصفات الفنية.
 */
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

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<QuotationFormValues>({
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

  const { fields: itemFields, replace: replaceItems } = useFieldArray({ control, name: 'items' });
  const { fields: blockFields, replace: replaceBlocks, append: appendBlock, remove: removeBlock } = useFieldArray({ control, name: 'layoutBlocks' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const selectedTransactionTypeId = watch("transactionTypeId");
  const selectedSubServiceId = watch("subServiceId");

  // ✨ محرك المزامنة الصفرية: حقن البيانات القديمة قسرياً عند التعديل
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
        setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        setAllTemplates(templatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContractTemplate)));
        setTransactionTypes(typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransactionType)));
        
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
      } catch (error) { console.error(error); } finally { setRefDataLoading(false); }
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
    if (financials_type === 'fixed') {
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    } else {
        return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    }
  }, [watchedItems, financials_type]);

  const handleSaveInternal = async (data: QuotationFormValues) => {
      const selectedType = transactionTypes.find(t => t.id === data.transactionTypeId);
      const selectedSub = subServices.find(s => s.id === data.subServiceId);
      const clientObj = clients.find(c => c.id === data.clientId);

      const enhancedData = {
          ...data,
          transactionType: selectedType?.name || data.transactionType,
          subServiceName: selectedSub?.name || data.subServiceName,
          assignedEngineerId: clientObj?.assignedEngineer || data.assignedEngineerId || null
      };
      
      await onSave(enhancedData);
  };

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
    
    toast({ title: '✅ تم استيراد القالب' });
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

  return (
    <form onSubmit={handleSubmit(handleSaveInternal)} className="space-y-6 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-3xl border border-slate-200 no-print">
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-slate-400 tracking-widest pr-1">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن العميل..." className="h-8" />
              )} />
          </div>
          <div className="grid gap-1">
              <Label className="font-black text-[9px] uppercase text-primary tracking-widest pr-1 flex items-center gap-1"><Sparkles className="h-3 w-3"/> استيراد قالب مالي</Label>
              <InlineSearchList 
                value={importedTemplateId} 
                onSelect={handleTemplateSelect} 
                options={templateOptions} 
                placeholder={refDataLoading ? "تحميل القوالب..." : "اختر قالباً للتعبئة آلياً..."} 
                className="h-8 border-primary/20 bg-primary/5" 
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
              <Layers className="h-4 w-4 text-indigo-600" /> المواصفات والمسار الفني
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-[2rem] border-2 border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500/20" />
              <div className="grid gap-1">
                  <Label className="font-black text-[8px] uppercase text-slate-400 pr-1">الخدمة الرئيسية *</Label>
                  <Controller control={control} name="transactionTypeId" render={({ field }) => (
                      <InlineSearchList value={field.value} onSelect={(v) => { field.onChange(v); setValue('subServiceId', ''); }} options={transactionTypeOptions} placeholder="اختر الخدمة..." className="h-8" />
                  )} />
              </div>
              <div className="grid gap-1">
                  <Label className="font-black text-[8px] uppercase text-primary pr-1">الخدمة التفصيلية *</Label>
                  <Controller control={control} name="subServiceId" render={({ field }) => (
                      <InlineSearchList 
                        value={field.value} 
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
                <LayoutGrid className="h-4 w-4 text-primary" /> أقسام العرض المالي
            </h3>
            <Button type="button" variant="outline" onClick={() => appendBlock({ id: generateId(), type: 'preamble', title: '', content: '' })} className="rounded-xl h-8 px-4 font-bold text-[10px] gap-2 border-primary/20 text-primary">
                <PlusCircle className="h-3.5 w-3.5" /> إضافة نص +
            </Button>
          </div>
          
          <div className="space-y-3">
              {blockFields.map((block, index) => (
                  <div key={block.id} className="p-5 rounded-[2rem] border bg-white shadow-sm hover:border-primary/20 mb-4">
                      {block.type === 'preamble' ? (
                          <div className="space-y-2">
                              <div className="flex justify-between items-center mb-2">
                                  <Badge variant="ghost" className="text-[8px] font-black uppercase opacity-40">بند نصي</Badge>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(index)} className="h-6 w-6 text-red-400 rounded-full"><Trash2 className="h-3 w-3"/></Button>
                              </div>
                              <Input {...register(`layoutBlocks.${index}.title`)} placeholder="عنوان البند..." className="h-8 border-none font-black text-base text-[#1e1b4b] bg-transparent focus-visible:ring-0 px-0" />
                              <Textarea {...register(`layoutBlocks.${index}.content`)} placeholder="نص البند..." className="rounded-xl border-none bg-slate-50/50 shadow-inner text-sm font-medium leading-relaxed p-4" rows={2} />
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                  <div className="flex items-center gap-2">
                                      <Calculator className="h-4 w-4 text-primary"/>
                                      <Label className="text-sm font-black text-[#1e1b4b]">دفعات الاستحقاق المالية</Label>
                                  </div>
                                  <div className="flex items-center gap-3 no-print">
                                      <Controller name="financialsType" control={control} render={({ field }) => (
                                          <Select value={field.value} onValueChange={field.onChange}>
                                              <SelectTrigger className="w-32 h-7 rounded-lg border-none bg-white font-black text-primary text-[10px] shadow-sm"><SelectValue /></SelectTrigger>
                                              <SelectContent dir="rtl" className="text-xs"><SelectItem value="fixed">مبلغ ثابت (KD)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                                          </Select>
                                      )} />
                                      <Input type="number" step="any" {...register('totalAmount')} readOnly={financials_type === 'fixed'} className={cn("w-20 h-7 border-none text-center font-black text-sm text-primary rounded-lg shadow-sm", financials_type === 'fixed' ? "bg-muted/50" : "bg-white")} />
                                  </div>
                              </div>

                              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                                  <Table className="table-fixed">
                                      <TableHeader className="bg-slate-50 h-8">
                                        <TableRow className="border-none">
                                            <TableHead className="w-20 text-center font-black text-[9px] text-slate-400 border-l border-white/20">#</TableHead>
                                            <TableHead className="px-4 font-black text-[9px] text-slate-400 text-right">شرط الاستحقاق (WBS)</TableHead>
                                            <TableHead className="text-center font-black text-[9px] text-slate-400 w-40">
                                                {financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                            </TableHead>
                                            <TableHead className="w-10 no-print"></TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                          {itemFields.map((field, itemIdx) => (
                                              <TableRow key={field.id} className="h-12 border-b last:border-0 hover:bg-primary/[0.01] group/row transition-all">
                                                  <TableCell className="text-center bg-slate-50/30 border-l"><Badge variant="secondary" className="font-black text-[8px] px-2 h-5 rounded-full bg-white text-slate-400 border">{itemIdx + 1}</Badge></TableCell>
                                                  <TableCell className="px-4">
                                                      <Controller control={control} name={`items.${itemIdx}.triggerCondition`} render={({ field: condField }) => (
                                                          <InlineSearchList 
                                                            value={condField.value} 
                                                            onSelect={condField.onChange} 
                                                            options={wbsOptionsForItems} 
                                                            placeholder="اربط بمرحلة..." 
                                                            allowCustomValue={true}
                                                            className="font-bold text-xs border-dashed border-primary/20 text-primary h-7" 
                                                          />
                                                      )} />
                                                  </TableCell>
                                                  <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                                      <Input type="number" step="any" {...register(financials_type === 'percentage' ? `items.${itemIdx}.percentage` : `items.${itemIdx}.unitPrice`)} className="text-center font-black text-base text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono h-8" placeholder="0" />
                                                  </TableCell>
                                                  <TableCell className="text-center no-print">
                                                      <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(index)} disabled={itemFields.length <= 1} className="h-6 w-6 text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover/row:opacity-100"><Trash2 className="h-3 w-3"/></Button>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                      <TableFooter className="bg-slate-50 h-12">
                                          <TableRow className="border-none hover:bg-transparent">
                                            <TableCell colSpan={2} className="text-right px-8"><p className="text-xs font-black text-slate-800">إجمالي قيمة العرض:</p></TableCell>
                                            <TableCell className="text-center border-r border-slate-100 bg-white">
                                                <div className="text-lg font-black font-mono tracking-tighter text-primary">
                                                    {financials_type === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                                </div>
                                            </TableCell>
                                            <TableCell className="no-print" />
                                          </TableRow>
                                      </TableFooter>
                                  </Table>
                              </div>
                          </div>
                      )}
                  </div>
              ))}
          </div>
      </div>

      <DialogFooter className="pt-8 border-t flex flex-col md:flex-row gap-4 no-print items-center">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-11 px-8 rounded-xl font-bold text-slate-400">إلغاء</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financials_type === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl flex-1 gap-3 transition-all hover:scale-[1.01] bg-[#7209B7] text-white border-none"
          >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              اعتماد وحفظ العرض المالي
          </Button>
      </DialogFooter>
    </form>
  );
}
