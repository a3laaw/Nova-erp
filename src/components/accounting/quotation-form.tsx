
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

/**
 * مكون الكتلة القابلة للسحب (Sortable Block)
 * يدعم النوع النصي (Preamble) أو الكتلة المالية (Table)
 */
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
            "group relative flex flex-col gap-4 p-8 rounded-[3rem] border-2 transition-all mb-6 animate-in fade-in slide-in-from-right-4",
            block.type === 'financial_table' 
                ? "bg-slate-900 border-primary shadow-2xl" 
                : "bg-white border-slate-100 shadow-sm hover:border-primary/20"
        )}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button {...attributes} {...listeners} type="button" className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-xl transition-colors">
                    <GripVertical className={cn("h-6 w-6", block.type === 'financial_table' ? "text-white/40" : "text-slate-300")} />
                </button>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl", block.type === 'financial_table' ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                        {block.type === 'financial_table' ? <Calculator className="h-5 w-5" /> : <ScrollText className="h-5 w-5" />}
                    </div>
                    <span className={cn("font-black text-sm uppercase tracking-widest", block.type === 'financial_table' ? "text-white/60" : "text-slate-400")}>
                        {block.type === 'financial_table' ? 'كتلة الدفعات المالية' : `بند ديباجة #${index + 1}`}
                    </span>
                </div>
            </div>
            {block.type === 'preamble' && (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                    <Trash2 className="h-5 w-5" />
                </Button>
            )}
        </div>

        {block.type === 'preamble' ? (
            <div className="space-y-4">
                <Input 
                    {...register(`layoutBlocks.${index}.title`)} 
                    placeholder="عنوان البند (مثال: الشروط العامة)" 
                    className="h-12 border-none shadow-none font-black text-2xl text-[#1e1b4b] bg-transparent focus-visible:ring-0"
                />
                <Textarea 
                    {...register(`layoutBlocks.${index}.content`)} 
                    placeholder="اكتب نص البند هنا..." 
                    className="rounded-[2rem] border-none bg-slate-50/50 shadow-inner min-h-[120px] text-xl font-medium leading-relaxed p-6"
                    rows={4}
                />
            </div>
        ) : (
            <div className="py-2">
                {children}
            </div>
        )}
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

  // ✨ محرك الحساب التلقائي (Auto-Sum) ✨
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-10 rounded-[3.5rem] border-2 border-dashed shadow-inner">
          <div className="grid gap-3">
              <Label className="font-black text-slate-700 pr-2">العميل المستهدف *</Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن اسم العميل..." disabled={!!initialData} className="h-14 border-2 shadow-sm rounded-2xl" />
              )} />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-primary pr-2 flex items-center gap-2"><Sparkles className="h-4 w-4"/> ملء آلي من القوالب</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً لتعبئة الدفعات..." className="h-14 border-2 border-primary/20 bg-primary/5 rounded-2xl" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="grid gap-3 md:col-span-1">
              <Label className="font-black text-[#1e1b4b] pr-2">موضوع العرض / الخدمة *</Label>
              <Input {...register('subject')} placeholder="عنوان العرض..." className="h-14 rounded-2xl border-2 font-black text-2xl text-primary shadow-sm" />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-slate-500 pr-2">تاريخ العرض</Label>
              <Controller name="date" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-14 rounded-2xl border-2 shadow-sm" />} />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-slate-500 pr-2">صلاحية العرض لغاية</Label>
              <Controller name="validUntil" control={control} render={({ field }) => <DateInput value={field.value} onChange={field.onChange} className="h-14 rounded-2xl border-2 shadow-sm" />} />
          </div>
      </div>

      <div className="space-y-6">
          <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
            <Layers className="h-7 w-7 text-indigo-600" /> المواصفات والمساحات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-white p-10 rounded-[3rem] border-2 shadow-xl items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600" />
              <div className="grid gap-2"><Label className="font-black text-slate-500">المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-14 font-black text-4xl font-mono border-2 rounded-2xl text-center text-indigo-600" /></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">عدد الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-14 font-black text-3xl border-2 rounded-2xl text-center" /></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">توسعة السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-14 border-2 rounded-2xl font-black text-xl"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">خيار السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-14 border-2 rounded-2xl font-black text-xl"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون سرداب</SelectItem><SelectItem value="full">سرداب كامل</SelectItem><SelectItem value="half">سرداب نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
          </div>
      </div>

      {/* 🧩 مصفوفة الكتل القابلة لإعادة الترتيب 🧩 */}
      <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-primary pr-4 flex items-center gap-3">
                <LayoutGrid className="h-7 w-7 text-primary" /> تنظيم هيكل وثيقة العرض
            </h3>
            <Button type="button" onClick={() => appendBlock({ id: generateStableId(), type: 'preamble', title: '', content: '' })} className="rounded-2xl h-12 px-8 font-black gap-2 shadow-lg shadow-primary/20">
                <PlusCircle className="h-5 w-5" /> إضافة بند نصي جديد +
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
                              {block.type === 'financial_table' && (
                                  <div className="space-y-8 p-4">
                                      <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                                          <div className="flex items-center gap-4">
                                              <div className="p-3 bg-white/10 rounded-2xl text-white shadow-inner"><Calculator className="h-8 w-8"/></div>
                                              <Label className="text-3xl font-black text-white tracking-tighter">جدول الدفعات المالية</Label>
                                          </div>
                                          <div className="flex items-center gap-3 bg-white/10 p-2 rounded-[2rem] border border-white/20 backdrop-blur-md">
                                              <div className="flex items-center bg-black/20 px-6 py-2 rounded-[1.5rem] gap-3">
                                                  <Label className="text-[10px] font-black uppercase text-white/60">نظام الحساب:</Label>
                                                  <Controller name="financialsType" control={control} render={({ field }) => (
                                                      <Select value={field.value} onValueChange={field.onChange}>
                                                          <SelectTrigger className="w-48 h-10 rounded-xl border-none bg-white font-black text-primary"><SelectValue /></SelectTrigger>
                                                          <SelectContent dir="rtl"><SelectItem value="fixed">مبالغ ثابتة</SelectItem><SelectItem value="percentage">نسب مئوية %</SelectItem></SelectContent>
                                                      </Select>
                                                  )} />
                                              </div>
                                              {financials_type === 'percentage' && (
                                                  <div className="bg-primary px-8 py-2 rounded-[1.5rem] flex items-center gap-4 text-white shadow-xl animate-in zoom-in-95">
                                                      <Label className="text-[10px] font-black uppercase text-white/70">إجمالي العقد</Label>
                                                      <Input type="number" step="any" {...register('totalAmount')} className="w-32 h-10 bg-white/20 border-white/40 text-center font-black text-2xl text-white font-mono rounded-xl focus-visible:ring-0" placeholder="0.000" />
                                                  </div>
                                              )}
                                          </div>
                                      </div>

                                      <div className="border-4 border-white/10 rounded-[3.5rem] overflow-hidden shadow-2xl bg-white animate-in zoom-in-95 duration-700">
                                          <Table>
                                              <TableHeader className="bg-slate-900 text-white h-16">
                                                <TableRow className="border-none">
                                                    <TableHead className="px-12 font-black text-lg text-white">بيان الدفعة المستحقة</TableHead>
                                                    <TableHead className="text-center font-black text-lg text-white w-72">
                                                        {financials_type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                                    </TableHead>
                                                    <TableHead className="w-24 text-center"></TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                  {itemFields.map((field, itemIdx) => (
                                                      <TableRow key={field.id} className="h-28 border-b last:border-0 hover:bg-primary/[0.03] transition-all group">
                                                          <TableCell className="px-12">
                                                            <Input {...register(`items.${itemIdx}.description`)} className="font-black text-3xl border-none shadow-none focus-visible:ring-0 bg-transparent text-[#1e1b4b] placeholder:italic placeholder:opacity-10" placeholder="مسمى الدفعة..." />
                                                          </TableCell>
                                                          <TableCell className="bg-primary/[0.02] border-r border-primary/5">
                                                            <div className="relative">
                                                                <Input 
                                                                    type="number" step="any" 
                                                                    {...register(financials_type === 'percentage' ? `items.${itemIdx}.percentage` : `items.${itemIdx}.unitPrice`)} 
                                                                    className="text-center font-black text-5xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono tracking-tighter"
                                                                    placeholder="0"
                                                                />
                                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-xl">{financials_type === 'percentage' ? '%' : 'KD'}</span>
                                                            </div>
                                                          </TableCell>
                                                          <TableCell className="text-center pr-8">
                                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(itemIdx)} disabled={itemFields.length <= 1} className="text-red-400 h-12 w-12 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Trash2 className="h-7 w-7"/>
                                                            </Button>
                                                          </TableCell>
                                                      </TableRow>
                                                  ))}
                                              </TableBody>
                                              <TableFooter className="bg-slate-900 text-white h-32">
                                                  <TableRow className="border-none hover:bg-slate-900">
                                                    <TableCell className="text-right px-12">
                                                        <p className="text-4xl font-black tracking-tighter text-white">إجمالي قيمة التعاقد:</p>
                                                        <p className="text-xs font-bold text-white/40 mt-1 uppercase tracking-widest">Total Sovereign Assessment</p>
                                                    </TableCell>
                                                    <TableCell className="text-center bg-white/5 border-r border-white/10">
                                                        <div className="flex flex-col items-center">
                                                            <div className="text-6xl font-black font-mono text-primary tracking-tighter drop-shadow-[0_0_20px_rgba(255,122,0,0.3)]">
                                                                {financials_type === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                                            </div>
                                                            {financials_type === 'percentage' && (
                                                                <Badge variant="outline" className={cn("mt-2 font-black text-[10px] px-6 border-2", totalCalculatedValue === 100 ? "bg-green-500 text-white border-none" : "bg-red-500/10 text-red-500 animate-pulse")}>
                                                                    {totalCalculatedValue === 100 ? "مكتمل (100%)" : "خلل في النسب"}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell />
                                                  </TableRow>
                                              </TableFooter>
                                          </Table>
                                          <div className="p-8 flex justify-center bg-muted/5 border-t">
                                            <Button type="button" variant="ghost" onClick={() => appendItem({ id: generateStableId(), description: `الدفعة رقم ${itemFields.length + 1}`, quantity: 1, unitPrice: 0 })} className="h-14 px-12 rounded-2xl border-dashed border-2 font-black text-xl text-primary gap-3 hover:bg-white transition-all">
                                                <PlusCircle className="h-6 w-6" /> إضافة دفعة مالية +
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

      <DialogFooter className="pt-16 border-t flex flex-col md:flex-row gap-8">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-16 px-12 rounded-[2rem] font-black text-xl text-slate-400 hover:text-red-600">إلغاء المراجعة</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financials_type === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-24 px-40 rounded-[3rem] font-black text-4xl shadow-[0_20px_80px_-15px_rgba(255,122,0,0.4)] flex-1 gap-6 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none transition-all active:scale-95"
          >
              {isSaving ? <Loader2 className="h-12 w-12 animate-spin" /> : <Save className="h-12 w-12" />}
              اعتماد وحفظ العرض النهائي
          </Button>
      </DialogFooter>
    </form>
  );
}
