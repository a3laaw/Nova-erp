
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
    Calculator, Ruler, Building2, Layers, Droplets, 
    Zap, Package, ArrowDownLeft, FileSignature, Sparkles,
    GripVertical,
    ScrollText,
    Target,
    Banknote,
    ArrowUpCircle,
    ArrowDownCircle
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import type { Client, Quotation, ContractTemplate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath, generateStableId } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, orderBy, where, limit, doc, getDoc } from 'firebase/firestore';
import { DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { useAuth } from '@/context/auth-context';
import { Separator } from '../ui/separator';

// --- DnD Kit Imports ---
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const itemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "الوصف مطلوب"),
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
            "group relative flex flex-col gap-4 p-6 rounded-[2.5rem] border-2 transition-all mb-6 animate-in fade-in slide-in-from-right-4 bg-white/60 backdrop-blur-xl border-white/80 shadow-lg hover:border-primary/20",
            block.type === 'financial_table' && "ring-4 ring-primary/5 border-primary/20"
        )}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button {...attributes} {...listeners} type="button" className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-xl transition-colors">
                    <GripVertical className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
                </button>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl", block.type === 'financial_table' ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                        {block.type === 'financial_table' ? <Calculator className="h-4 w-4" /> : <ScrollText className="h-4 w-4" />}
                    </div>
                    <span className="font-black text-[10px] uppercase tracking-widest text-[#1e1b4b] opacity-60">
                        {block.type === 'financial_table' ? 'مصفوفة الدفعات المالية' : `كتلة نصية #${index + 1}`}
                    </span>
                </div>
            </div>
            {block.type === 'preamble' && (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>

        <div className="py-2">
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
  const [refDataLoading, setRefDataLoading] = useState(true);

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
        layoutBlocks: [
            { id: 'initial-table', type: 'financial_table' }
        ],
        items: [{ id: generateStableId(), description: 'الدفعة الأولى عند توقيع العقد', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
  const { fields: blockFields, append: appendBlock, remove: removeBlock, move: moveBlock } = useFieldArray({ control, name: 'layoutBlocks' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const watchedTotalAmount = watch("totalAmount") || 0;

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
    
    setValue('subject', template.title);
    setValue('workNature', template.workNature || 'labor_only');
    setValue('financialsType', template.financials?.type || 'fixed');
    setValue('totalAmount', template.financials?.totalAmount || 0);
    
    const newItems = template.financials?.milestones?.map(m => ({
      id: generateStableId(), 
      description: m.name, 
      quantity: 1,
      unitPrice: template.financials?.type === 'fixed' ? Number(m.value) : 0,
      percentage: template.financials?.type === 'percentage' ? Number(m.value) : 0,
    })) || [];
    replaceItems(newItems);
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = blockFields.findIndex(i => i.id === active.id);
        const newIndex = blockFields.findIndex(i => i.id === over.id);
        moveBlock(oldIndex, newIndex);
    }
  };

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-12 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/40 backdrop-blur-xl p-8 rounded-[2.5rem] border-2 border-white/60 shadow-sm">
          <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-2">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن اسم العميل..." disabled={!!initialData} className="h-12 bg-white rounded-2xl border-2" />
              )} />
          </div>
          <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-primary tracking-widest pr-2 flex items-center gap-2"><Sparkles className="h-3 w-3"/> جلب من القوالب</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً للتعبئة..." className="h-12 border-2 border-primary/20 bg-primary/5 rounded-2xl" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="grid gap-2 md:col-span-1">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-2">موضوع العرض *</Label>
              <Input {...register('subject')} placeholder="عنوان العرض..." className="h-12 rounded-2xl border-2 font-black text-lg text-[#1e1b4b]" />
          </div>
          <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-2">تاريخ العرض</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-12 rounded-2xl border-2" />} />
          </div>
          <div className="grid gap-2">
              <Label className="font-black text-[10px] uppercase text-slate-400 tracking-widest pr-2">صلاحية العرض</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-12 rounded-2xl border-2" />} />
          </div>
      </div>

      <div className="space-y-4">
          <h3 className="text-xl font-black text-[#1e1b4b] flex items-center gap-3 pr-2">
            <Layers className="h-5 w-5 text-indigo-600" /> المواصفات والمساحات
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white/60 backdrop-blur-xl p-8 rounded-[2.5rem] border-2 border-white shadow-xl items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500" />
              <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400">المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-12 font-black text-2xl font-mono border-2 rounded-xl text-center text-indigo-600" /></div>
              <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400">الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-12 font-black text-xl border-2 rounded-xl text-center" /></div>
              <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400">السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
              <div className="grid gap-2"><Label className="text-[10px] font-black uppercase text-slate-400">السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-12 border-2 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون</SelectItem><SelectItem value="full">كامل</SelectItem><SelectItem value="half">نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
          </div>
      </div>

      <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-xl font-black text-[#1e1b4b] flex items-center gap-3">
                <LayoutGrid className="h-5 w-5 text-primary" /> تنظيم هيكل الوثيقة
            </h3>
            <Button type="button" variant="outline" onClick={() => appendBlock({ id: generateStableId(), type: 'preamble', title: '', content: '' })} className="rounded-xl h-10 px-6 font-bold gap-2 border-primary/20 text-primary hover:bg-primary/5">
                <PlusCircle className="h-4 w-4" /> إضافة ديباجة / بند نصي +
            </Button>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={blockFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
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
                                          placeholder="عنوان البند (مثال: الشروط العامة)" 
                                          className="h-10 border-none shadow-none font-black text-xl text-[#1e1b4b] bg-transparent focus-visible:ring-0"
                                      />
                                      <Textarea 
                                          {...register(`layoutBlocks.${index}.content`)} 
                                          placeholder="اكتب نص البند هنا..." 
                                          className="rounded-2xl border-none bg-white/40 shadow-inner text-base font-medium leading-relaxed p-5"
                                          rows={3}
                                      />
                                  </div>
                              ) : (
                                  <div className="space-y-6">
                                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/40 p-4 rounded-3xl border border-white/60">
                                          <div className="flex items-center gap-4">
                                              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Calculator className="h-5 w-5"/></div>
                                              <Label className="text-xl font-black text-[#1e1b4b]">جدول الدفعات المالية</Label>
                                          </div>
                                          <div className="flex items-center gap-3">
                                              <Controller name="financialsType" control={control} render={({ field }) => (
                                                  <Select value={field.value} onValueChange={(v: any) => { field.onChange(v); if(v === 'fixed') setValue('totalAmount', totalCalculatedValue); }}>
                                                      <SelectTrigger className="w-40 h-10 rounded-xl border-none bg-white font-bold text-primary shadow-sm"><SelectValue /></SelectTrigger>
                                                      <SelectContent dir="rtl"><SelectItem value="fixed">مبلغ ثابت (KWD)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                                                  </Select>
                                              )} />
                                              {financials_type === 'percentage' && (
                                                  <div className="flex items-center gap-3 animate-in zoom-in-95">
                                                      <Label className="text-[9px] font-black text-slate-400 uppercase">قيمة العقد:</Label>
                                                      <Input type="number" step="any" {...register('totalAmount')} className="w-28 h-10 bg-white border-none text-center font-black text-lg text-primary rounded-xl shadow-sm" placeholder="0.000" />
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      <div className="border-2 border-white/60 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white/95">
                                          <Table>
                                              <TableHeader className="bg-slate-50 h-12">
                                                <TableRow className="border-none">
                                                    <TableHead className="px-8 font-black text-slate-400 text-right">بيان الدفعة المستحقة</TableHead>
                                                    <TableHead className="text-center font-black text-slate-400 w-64">
                                                        {financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                                    </TableHead>
                                                    <TableHead className="w-16"></TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {itemFields.map((field, itemIdx) => (
                                                      <TableRow key={field.id} className="h-20 border-b last:border-0 hover:bg-primary/[0.02] group/row transition-all">
                                                          <TableCell className="px-8">
                                                            <Input {...register(`items.${itemIdx}.description`)} className="font-bold text-lg border-none shadow-none focus-visible:ring-0 bg-transparent text-[#1e1b4b]" placeholder="مسمى الدفعة..." />
                                                          </TableCell>
                                                          <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                                            <div className="relative flex justify-center">
                                                                <Input 
                                                                    type="number" step="any" 
                                                                    {...register(financials_type === 'percentage' ? `items.${itemIdx}.percentage` : `items.${itemIdx}.unitPrice`)} 
                                                                    className="text-center font-black text-2xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono"
                                                                    placeholder="0"
                                                                />
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/20 font-black text-sm">{financials_type === 'percentage' ? '%' : 'KD'}</span>
                                                            </div>
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(itemIdx)} disabled={itemFields.length <= 1} className="text-red-300 h-9 w-9 rounded-full hover:bg-red-50 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                                <Trash2 className="h-4 w-4"/>
                                                            </Button>
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                              </TableBody>
                                              <TableFooter className="bg-slate-50 h-20">
                                                  <TableRow className="border-none hover:bg-transparent">
                                                    <TableCell className="text-right px-10">
                                                        <p className="text-xl font-black tracking-tight text-slate-800">إجمالي القيمة المعتمدة:</p>
                                                    </TableCell>
                                                    <TableCell className="text-center border-r border-slate-100 bg-white">
                                                        <div className="flex flex-col items-center">
                                                            <div className="text-3xl font-black font-mono text-primary tracking-tighter">
                                                                {financials_type === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                                            </div>
                                                            {financials_type === 'percentage' && totalCalculatedValue !== 100 && (
                                                                <span className="text-[8px] font-black text-red-500 animate-pulse mt-1">المجموع يجب أن يكون 100%</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell />
                                                  </TableRow>
                                              </TableFooter>
                                          </Table>
                                          <div className="p-6 flex justify-center bg-muted/5 border-t">
                                            <Button type="button" variant="ghost" onClick={() => appendItem({ id: generateStableId(), description: `الدفعة رقم ${itemFields.length + 1}`, quantity: 1, unitPrice: 0 })} className="h-11 px-10 rounded-xl border-dashed border-2 font-bold text-primary gap-2 hover:bg-white transition-all">
                                                <PlusCircle className="h-5 w-5" /> إضافة دفعة +
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

      <DialogFooter className="pt-10 border-t flex flex-col md:flex-row gap-6">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-14 px-10 rounded-2xl font-bold text-slate-400">إلغاء المراجعة</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financials_type === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-14 px-16 rounded-[2rem] font-black text-xl shadow-xl flex-1 gap-3"
          >
              {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
              اعتماد وإرسال عرض السعر
          </Button>
      </DialogFooter>
    </form>
  );
}
