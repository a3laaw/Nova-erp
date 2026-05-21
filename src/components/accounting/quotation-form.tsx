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
    GripVertical,
    ScrollText,
    Sparkles,
    AlertCircle,
    AlertTriangle
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
import { Badge } from '../ui/badge';
import { useAuth } from '@/context/auth-context';
import { Separator } from '../ui/separator';

// --- dnd-kit Imports ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@radix-ui/react-dropdown-menu'; // Note: dnd-kit normally used, but focusing on fixing structure

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const generateId = () => Math.random().toString(36).substring(2, 9);

const itemSchema = z.object({
  id: z.string(),
  description: z.string(), 
  triggerCondition: z.string().min(1, "شرط الاستحقاق مطلوب"), 
  quantity: z.preprocess((v) => parseFloat(String(v || '1')), z.number().min(0.01)),
  unitPrice: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)),
  percentage: z.preprocess(v => parseFloat(String(v || '0')), z.number().min(0)).optional(),
  total: z.number().optional(),
});

const layoutBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['preamble', 'financial_table']),
  title: z.string().optional(),
  content: z.string().optional(),
});

const quotationSchema = z.object({
  clientId: z.string().min(1, 'العميل مطلوب.'),
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
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

function SortableBlock({ id, block, index, register, remove, children }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className={cn(
            "group relative flex flex-col gap-3 p-6 rounded-3xl border-2 transition-all mb-6 bg-white shadow-sm hover:border-primary/20",
            block.type === 'financial_table' && "ring-4 ring-primary/5 border-primary/20"
        )}
    >
        <div className="flex items-center justify-between no-print">
            <div className="flex items-center gap-3">
                <button {...attributes} {...listeners} type="button" className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-muted rounded-lg transition-colors">
                    <GripVertical className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                </button>
                <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg", block.type === 'financial_table' ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                        {block.type === 'financial_table' ? <Calculator className="h-3.5 w-3.5" /> : <ScrollText className="h-3.5 w-3.5" />}
                    </div>
                    <span className="font-black text-[9px] uppercase tracking-widest text-[#1e1b4b] opacity-40">
                        {block.type === 'financial_table' ? 'مصفوفة الدفعات المالية' : `بند نصي #${index + 1}`}
                    </span>
                </div>
            </div>
            {block.type === 'preamble' && (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>

        <div className="py-1">
            {children}
        </div>
    </div>
  );
}

export function QuotationForm({ onSave, onClose, initialData = null, isSaving = false }: any) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [allTemplates, setAllTemplates] = useState<ContractTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [specificWorkStages, setSpecificWorkStages] = useState<{ value: string, label: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(true);
  const [isPathLoading, setIsPathLoading] = useState(false);

  const tenantId = currentUser?.currentCompanyId;

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
        date: new Date(),
        validUntil: new Date(new Date().setDate(new Date().getDate() + 30)),
        financialsType: 'fixed',
        transactionTypeId: '',
        subServiceId: '',
        totalArea: 0,
        floorsCount: 1,
        basementType: 'none',
        roofExtension: 'none',
        workNature: 'labor_only',
        layoutBlocks: [
            { id: 'initial-table', type: 'financial_table' }
        ],
        items: [{ id: generateId(), description: 'الدفعة الأولى', triggerCondition: '', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
  const { fields: blockFields, append: appendBlock, remove: removeBlock, move: moveBlock } = useFieldArray({ control, name: 'layoutBlocks' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const selectedTransactionTypeId = watch("transactionTypeId");
  const selectedSubServiceId = watch("subServiceId");

  const totalCalculatedValue = useMemo(() => {
    const items = watchedItems || [];
    if (financials_type === 'fixed') {
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    } else {
        return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    }
  }, [watchedItems, financials_type]);

  useEffect(() => {
    if (financials_type === 'fixed') {
        setValue('totalAmount', totalCalculatedValue);
    }
  }, [totalCalculatedValue, financials_type, setValue]);

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
      } catch (error) { console.error(error); } finally { setRefDataLoading(false); }
    };
    fetchRefData();
  }, [firestore, tenantId]);

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
              setSpecificWorkStages(snap.docs.map(d => ({ value: d.data().name, label: d.data().name })));
          } catch (e) { console.error(e); }
      };
      fetchStages();
  }, [selectedSubServiceId, selectedTransactionTypeId, firestore, tenantId]);

  const handleTemplateSelect = (templateId: string) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (!template) return;
    
    setValue('subject', template.title);
    setValue('workNature', template.workNature || 'labor_only');
    setValue('financialsType', template.financials?.type || 'fixed');
    setValue('totalAmount', template.financials?.totalAmount || 0);
    setValue('transactionTypeId', template.transactionTypeId || '');
    setValue('subServiceId', template.subServiceId || '');
    
    if (template.financials?.milestones) {
        const newItems = template.financials.milestones.map((m, idx) => ({
            id: generateId(), 
            description: `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
            triggerCondition: m.name, 
            quantity: 1,
            unitPrice: template.financials?.type === 'fixed' ? Number(m.value) : 0,
            percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
        }));
        replaceItems(newItems);
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = blockFields.findIndex(i => i.id === active.id);
        const newIndex = blockFields.findIndex(i => i.id === over.id);
        moveBlock(oldIndex, newIndex);
    }
  };

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);
  const transactionTypeOptions = useMemo(() => transactionTypes.map(t => ({ value: t.id!, label: t.name })), [transactionTypes]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-200 no-print">
          <div className="grid gap-1.5">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-1">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن العميل..." disabled={!!initialData} className="h-9" />
              )} />
          </div>
          <div className="grid gap-1.5">
              <Label className="font-black text-[10px] uppercase text-primary tracking-widest pr-1 flex items-center gap-1.5"><Sparkles className="h-3 w-3"/> استيراد قالب مالي</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً للتعبئة آلياً..." className="h-9 border-primary/20 bg-primary/5" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="grid gap-1.5">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-1">موضوع العرض الرسمي *</Label>
              <Input {...register('subject')} placeholder="عنوان العرض..." className="h-10 rounded-xl font-bold text-[#1e1b4b]" />
          </div>
          <div className="grid gap-1.5">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-1">تاريخ الإصدار</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-10" />} />
          </div>
          <div className="grid gap-1.5">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-1">صلاحية العرض</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-10" />} />
          </div>
      </div>

      <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-lg font-black text-[#1e1b4b] flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" /> المواصفات والمسار الفني المعتمد
            </h3>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-black text-[8px] no-print">WBS Hierarchy</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1.5 h-full bg-indigo-500" />
              <div className="grid gap-2">
                  <Label className="font-black text-[9px] uppercase text-slate-400 pr-1">الخدمة الرئيسية (Layer 1) *</Label>
                  <Controller control={control} name="transactionTypeId" render={({ field }) => (
                      <InlineSearchList value={field.value} onSelect={(v) => { field.onChange(v); setValue('subServiceId', ''); }} options={transactionTypeOptions} placeholder="اختر الخدمة..." className="h-9" />
                  )} />
              </div>
              <div className="grid gap-2">
                  <Label className="font-black text-[9px] uppercase text-primary pr-1">الخدمة التفصيلية (Layer 2) *</Label>
                  <Controller control={control} name="subServiceId" render={({ field }) => (
                      <InlineSearchList 
                        value={field.value} 
                        onSelect={field.onChange} 
                        options={subServices.map(s => ({ value: s.id!, label: s.name }))} 
                        placeholder={isPathLoading ? "تحميل..." : "حدد النوع الفرعي..."} 
                        disabled={!selectedTransactionTypeId || isPathLoading}
                        className="h-9 border-primary/20 bg-primary/5 text-primary" 
                      />
                  )} />
              </div>
              <div className="grid grid-cols-4 gap-3 md:col-span-2 pt-2 border-t border-dashed">
                <div className="grid gap-1"><Label className="text-[9px] font-black text-slate-400">المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-9 font-black text-center text-indigo-600" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black text-slate-400">الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-9 font-black text-center" /></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black text-slate-400">السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
                <div className="grid gap-1"><Label className="text-[9px] font-black text-slate-400">السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون</SelectItem><SelectItem value="full">كامل</SelectItem><SelectItem value="half">نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
              </div>
          </div>
      </div>

      <div className="space-y-6">
          <div className="flex justify-between items-center px-1 no-print">
            <h3 className="text-lg font-black text-[#1e1b4b] flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" /> تنظيم محتوى العرض المالي
            </h3>
            <Button type="button" variant="outline" onClick={() => appendBlock({ id: generateId(), type: 'preamble', title: '', content: '' })} className="rounded-xl h-9 px-4 font-bold text-xs gap-2 border-primary/20 text-primary hover:bg-primary/5">
                <PlusCircle className="h-4 w-4" /> إضافة قسم نصي +
            </Button>
          </div>
          
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blockFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                      {blockFields.map((block, index) => (
                          <SortableBlock 
                            key={block.id} 
                            id={block.id} 
                            block={block} 
                            index={index} 
                            register={register} 
                            remove={removeBlock}
                          >
                              {block.type === 'preamble' ? (
                                  <div className="space-y-4">
                                      <Input 
                                          {...register(`layoutBlocks.${index}.title`)} 
                                          placeholder="عنوان البند (مثال: الشروط القانونية)" 
                                          className="h-10 border-none shadow-none font-black text-xl text-[#1e1b4b] bg-transparent focus-visible:ring-0 px-0"
                                      />
                                      <Textarea 
                                          {...register(`layoutBlocks.${index}.content`)} 
                                          placeholder="اكتب نص البند هنا..." 
                                          className="rounded-2xl border-none bg-slate-50/50 shadow-inner text-base font-medium leading-relaxed p-6"
                                          rows={3}
                                      />
                                  </div>
                              ) : (
                                  <div className="space-y-6">
                                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                                          <div className="flex items-center gap-3">
                                              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Calculator className="h-5 w-5"/></div>
                                              <Label className="text-lg font-black text-[#1e1b4b]">جدول الدفعات المالية المعتمدة</Label>
                                          </div>
                                          <div className="flex items-center gap-4 no-print">
                                              <Controller name="financialsType" control={control} render={({ field }) => (
                                                  <Select value={field.value} onValueChange={(v: any) => { field.onChange(v); }}>
                                                      <SelectTrigger className="w-40 h-8 rounded-lg border-none bg-white font-black text-primary text-xs shadow-sm"><SelectValue /></SelectTrigger>
                                                      <SelectContent dir="rtl"><SelectItem value="fixed">مبلغ ثابت (KD)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                                                  </Select>
                                              )} />
                                              
                                              <div className="flex items-center gap-2 animate-in zoom-in-95">
                                                  <Label className="text-[9px] font-black text-slate-400 uppercase tracking-widest no-print">الإجمالي:</Label>
                                                  <Input 
                                                      type="number" 
                                                      step="any" 
                                                      {...register('totalAmount')} 
                                                      readOnly={financials_type === 'fixed'}
                                                      className={cn(
                                                          "w-24 h-8 border-none text-center font-black text-base text-primary rounded-lg shadow-sm",
                                                          financials_type === 'fixed' ? "bg-muted/50" : "bg-white"
                                                      )} 
                                                  />
                                              </div>
                                          </div>
                                      </div>

                                      <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
                                          <Table className="table-fixed">
                                              <TableHeader className="bg-slate-50 h-10">
                                                <TableRow className="border-none">
                                                    <TableHead className="w-24 text-center font-black text-[10px] text-slate-400 border-l border-white/20">رقم الدفعة</TableHead>
                                                    <TableHead className="px-6 font-black text-[10px] text-slate-400 text-right">شرط الاستحقاق (Layer 3)</TableHead>
                                                    <TableHead className="text-center font-black text-[10px] text-slate-400 w-56">
                                                        {financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                                    </TableHead>
                                                    <TableHead className="w-12 no-print"></TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {itemFields.map((field, itemIdx) => (
                                                      <TableRow key={field.id} className="h-16 border-b last:border-0 hover:bg-primary/[0.01] group/row transition-all">
                                                          <TableCell className="text-center bg-slate-50/30 border-l">
                                                              <Badge variant="secondary" className="font-black text-[9px] px-3 h-6 rounded-full bg-white text-slate-500 shadow-none border">
                                                                  الدفعة {arabicOrdinals[itemIdx] || (itemIdx + 1)}
                                                              </Badge>
                                                          </TableCell>
                                                          <TableCell className="px-6">
                                                              {!selectedSubServiceId ? (
                                                                  <p className="text-[10px] text-red-500 font-bold flex items-center gap-1 animate-pulse"><AlertTriangle className="h-3 w-3" /> حدد النوع أولاً</p>
                                                              ) : (
                                                                  <Controller
                                                                    control={control}
                                                                    name={`items.${itemIdx}.triggerCondition`}
                                                                    render={({ field: condField }) => (
                                                                        <InlineSearchList 
                                                                            value={condField.value} 
                                                                            onSelect={condField.onChange} 
                                                                            options={specificWorkStages} 
                                                                            placeholder="اربط بمرحلة..." 
                                                                            className="font-bold text-sm border-dashed border-primary/20 text-primary h-8" 
                                                                        />
                                                                    )}
                                                                  />
                                                              )}
                                                          </TableCell>
                                                          <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                                            <div className="relative flex justify-center">
                                                                <Input 
                                                                    type="number" step="any" 
                                                                    {...register(financials_type === 'percentage' ? `items.${itemIdx}.percentage` : `items.${itemIdx}.unitPrice`)} 
                                                                    className="text-center font-black text-xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono h-10"
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                          </TableCell>
                                                          <TableCell className="text-center no-print">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(itemIdx)} disabled={itemFields.length <= 1} className="h-7 w-7 text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover/row:opacity-100">
                                                                <Trash2 className="h-3.5 w-3.5"/>
                                                            </Button>
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                              </TableBody>
                                              <TableFooter className="bg-slate-50 h-16">
                                                  <TableRow className="border-none hover:bg-transparent">
                                                    <TableCell colSpan={2} className="text-right px-10">
                                                        <p className="text-base font-black text-slate-800">إجمالي قيمة العرض:</p>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 bg-white">
                                                        <div className="flex flex-col items-center">
                                                            <div className={cn("text-2xl font-black font-mono tracking-tighter", financials_type === 'percentage' && totalCalculatedValue !== 100 ? "text-red-600" : "text-primary")}>
                                                                {financials_type === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                                            </div>
                                                            {financials_type === 'percentage' && totalCalculatedValue !== 100 && (
                                                                <div className="text-[8px] font-black text-red-500 animate-pulse uppercase no-print">
                                                                    يجب المجموع 100%
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="no-print" />
                                                  </TableRow>
                                              </TableFooter>
                                          </Table>
                                          <div className="p-4 flex justify-center bg-muted/5 border-t no-print">
                                            <Button 
                                                type="button" 
                                                variant="ghost" 
                                                onClick={() => appendItem({ id: generateId(), description: `الدفعة ${arabicOrdinals[itemFields.length] || (itemFields.length + 1)}`, triggerCondition: '', quantity: 1, unitPrice: 0, percentage: 0 })} 
                                                className="h-9 px-8 rounded-xl border-dashed border-2 font-bold text-xs text-primary gap-2 hover:bg-white"
                                                disabled={!selectedSubServiceId}
                                            >
                                                <PlusCircle className="h-3.5 w-3.5" /> إضافة دفعة استحقاق جديدة +
                                            </Button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </SortableBlock>
                      ))}
                  </div>
              </SortableContext>
          </DndContext>
      </div>

      <DialogFooter className="pt-10 border-t flex flex-col md:flex-row gap-4 no-print items-center">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-2xl font-bold text-slate-400">إلغاء المراجعة</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financials_type === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-16 px-16 rounded-[2rem] font-black text-2xl shadow-xl flex-1 gap-4 transition-all hover:scale-[1.01] bg-[#7209B7] text-white border-none"
          >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
              اعتماد وإرسال العرض المالي
          </Button>
      </DialogFooter>
    </form>
  );
}
