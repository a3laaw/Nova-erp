'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    Banknote
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
  condition: z.string().optional(),
  total: z.number().optional(),
});

const preambleItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "عنوان البند مطلوب"),
  content: z.string().min(1, "نص الديباجة مطلوب"),
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
  
  preamble: z.array(preambleItemSchema).default([]),
  items: z.array(itemSchema).min(1, 'يجب إضافة بند مالي واحد على الأقل.'),
  notes: z.string().optional(),
  financialsType: z.enum(['fixed', 'percentage']),
  totalAmount: z.preprocess((a) => (a === '' || a === null) ? 0 : parseFloat(String(a)), z.number().optional()),
});

type QuotationFormValues = z.infer<typeof quotationSchema>;

/**
 * مكون بند الديباجة القابل للسحب (Sortable Preamble Item)
 */
function SortablePreambleItem({ id, index, register, remove }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
        ref={setNodeRef} 
        style={style} 
        className="group relative flex flex-col gap-4 p-6 rounded-[2rem] bg-white border-2 border-slate-100 shadow-sm hover:border-primary/20 transition-all mb-4 animate-in fade-in slide-in-from-right-4"
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button {...attributes} {...listeners} type="button" className="cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-xl transition-colors">
                    <GripVertical className="h-5 w-5 text-slate-300 group-hover:text-primary" />
                </button>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-6 w-6 rounded-full flex items-center justify-center p-0 font-mono text-[10px] bg-slate-50">{index + 1}</Badge>
                    <Input 
                        {...register(`preamble.${index}.title`)} 
                        placeholder="عنوان البند (مثال: نطاق الأعمال)" 
                        className="border-none shadow-none font-black text-[#1e1b4b] bg-transparent focus-visible:ring-0 text-lg w-64"
                    />
                </div>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full h-8 w-8 transition-colors">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
        <Textarea 
            {...register(`preamble.${index}.content`)} 
            placeholder="اكتب تفاصيل البند هنا..." 
            className="rounded-2xl border-none bg-slate-50/50 shadow-inner min-h-[100px] text-base font-medium leading-relaxed p-4"
            rows={3}
        />
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
        preamble: [],
        items: [{ id: generateStableId(), description: 'الدفعة الأولى عند توقيع العقد', quantity: 1, unitPrice: 0 }]
    }
  });

  const { fields: itemFields, append: appendItem, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
  const { fields: preambleFields, append: appendPreamble, remove: removePreamble, move: movePreamble } = useFieldArray({ control, name: 'preamble' });

  const watchedItems = useWatch({ control, name: "items" });
  const financials_type = watch("financialsType");
  const watchedTotalAmount = watch("totalAmount") || 0;

  // ✨ محرك الحساب الذكي المعتمد ✨
  const totalCalculatedValue = useMemo(() => {
    const items = watchedItems || [];
    if (financials_type === 'fixed') {
        // جمع مبالغ الدفعات آلياً
        return items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
    } else {
        // جمع النسب المئوية للتحقق (يجب أن يكون 100%)
        return items.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0);
    }
  }, [watchedItems, financials_type]);

  // تحديث الإجمالي الكلي في النموذج عند تغيير البنود في وضع المبلغ الثابت
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
      condition: m.condition || '',
    })) || [];
    replaceItems(newItems);
  };

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = preambleFields.findIndex(i => i.id === active.id);
        const newIndex = preambleFields.findIndex(i => i.id === over.id);
        movePreamble(oldIndex, newIndex);
    }
  };

  const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr })), [clients]);
  const templateOptions = useMemo(() => allTemplates.map(t => ({ value: t.id!, label: t.title })), [allTemplates]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-10 rounded-[3.5rem] border-2 border-dashed shadow-inner">
          <div className="grid gap-3">
              <Label className="font-black text-slate-700 pr-2 flex items-center gap-2">العميل المستهدف * <Badge variant="outline" className="text-[8px] font-black bg-white">ID REQ</Badge></Label>
              <Controller control={control} name="clientId" render={({ field }) => (
                  <InlineSearchList value={field.value} onSelect={field.onChange} options={clientOptions} placeholder="ابحث عن اسم العميل..." disabled={!!initialData} className="h-14 border-2 shadow-sm rounded-2xl" />
              )} />
          </div>
          <div className="grid gap-3">
              <Label className="font-black text-primary pr-2 flex items-center gap-2"><Sparkles className="h-4 w-4"/> توريث بيانات من نموذج عقد</Label>
              <InlineSearchList value="" onSelect={handleTemplateSelect} options={templateOptions} placeholder="اختر قالباً لتعبئة الدفعات آلياً..." className="h-14 border-2 border-primary/20 bg-primary/5 rounded-2xl" />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div className="grid gap-3 md:col-span-1">
              <Label className="font-black text-[#1e1b4b] pr-2">موضوع العرض / الخدمة *</Label>
              <Input {...register('subject')} placeholder="مثال: عرض سعر إشراف هندسي..." className="h-14 rounded-2xl border-2 font-black text-2xl text-primary shadow-sm" />
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

      {/* 📜 قسم الديباجة والبنود القانونية 📜 */}
      <div className="space-y-6">
          <div className="flex justify-between items-center px-4">
            <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-primary pr-4 flex items-center gap-3">
                <ScrollText className="h-7 w-7 text-primary" /> ديباجة وبنود العقد الفنية
            </h3>
            <Button type="button" onClick={() => appendPreamble({ id: generateStableId(), title: '', content: '' })} variant="outline" className="rounded-xl border-dashed border-2 font-black gap-2 h-10 px-6">
                <PlusCircle className="h-4 w-4" /> إضافة بند ديباجة
            </Button>
          </div>
          
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={preambleFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                      {preambleFields.length === 0 ? (
                          <div className="p-16 text-center border-4 border-dashed rounded-[3rem] bg-muted/5 opacity-30 grayscale transition-all">
                              <ScrollText className="h-16 w-16 mx-auto mb-4" />
                              <p className="font-black text-xl">الديباجة فارغة؛ أضف بنوداً فنية أو قانونية لتظهر في العرض.</p>
                          </div>
                      ) : (
                          preambleFields.map((field, index) => (
                              <SortablePreambleItem 
                                  key={field.id} 
                                  id={field.id} 
                                  index={index} 
                                  register={register} 
                                  remove={removePreamble} 
                              />
                          ))
                      )}
                  </div>
              </SortableContext>
          </DndContext>
      </div>

      <div className="space-y-6">
          <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
            <Layers className="h-7 w-7 text-indigo-600" /> المواصفات الإنشائية والمساحات
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-white p-10 rounded-[3rem] border-2 shadow-xl items-end relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-indigo-600" />
              <div className="grid gap-2"><Label className="font-black text-slate-500 flex items-center gap-2"><Ruler className="h-4 w-4 text-indigo-600"/> المساحة (م²)</Label><Input type="number" {...register('totalArea')} className="h-14 font-black text-4xl font-mono border-2 rounded-2xl text-center text-indigo-600 shadow-inner" /></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">عدد الأدوار</Label><Input type="number" {...register('floorsCount')} className="h-14 font-black text-3xl border-2 rounded-2xl text-center text-[#1e1b4b] shadow-inner" /></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">توسعة السطح</Label><Controller name="roofExtension" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-14 border-2 rounded-2xl font-black text-xl text-[#1e1b4b] shadow-inner"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">لا يوجد</SelectItem><SelectItem value="quarter">ربع دور</SelectItem><SelectItem value="half">نصف دور</SelectItem></SelectContent></Select>)}/></div>
              <div className="grid gap-2"><Label className="font-black text-slate-500">خيار السرداب</Label><Controller name="basementType" control={control} render={({field}) => (<Select onValueChange={field.onChange} value={field.value}><SelectTrigger className="h-14 border-2 rounded-2xl font-black text-xl text-[#1e1b4b] shadow-inner"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="none">بدون سرداب</SelectItem><SelectItem value="full">سرداب كامل</SelectItem><SelectItem value="half">سرداب نص</SelectItem><SelectItem value="vault">قبو</SelectItem></SelectContent></Select>)}/></div>
          </div>
      </div>

      {/* 💰 قسم التسعير والذكاء المالي 💰 */}
      <div className="space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6 px-4">
              <Label className="text-3xl font-black flex items-center gap-3 text-[#1e1b4b] border-r-8 border-primary pr-4 tracking-tighter">
                <Calculator className="h-8 w-8 text-primary"/> تسعير الدفعات المالية للمشروع
              </Label>
              <div className="flex items-center gap-2 bg-white p-2 rounded-[2rem] border-2 shadow-xl ring-8 ring-primary/5">
                  <div className="flex items-center bg-muted/30 px-6 py-2 rounded-[1.5rem] border gap-3">
                      <Label className="text-[10px] font-black uppercase text-slate-500">طريقة التسعير المعتمدة:</Label>
                      <Controller name="financialsType" control={control} render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger className="w-48 h-10 rounded-xl border-primary/20 bg-white font-black text-primary text-base shadow-sm"><SelectValue /></SelectTrigger>
                              <SelectContent dir="rtl"><SelectItem value="fixed">مبالغ ثابتة (د.ك)</SelectItem><SelectItem value="percentage">نسب مئوية (%)</SelectItem></SelectContent>
                          </Select>
                      )} />
                  </div>
                  
                  {financials_type === 'percentage' && (
                      <div className="bg-primary px-8 py-2 rounded-[1.5rem] flex items-center gap-4 text-white shadow-xl animate-in zoom-in-95">
                          <Label className="text-[10px] font-black uppercase text-white/70">إجمالي قيمة العقد *</Label>
                          <Input 
                            type="number" 
                            step="any"
                            {...register('totalAmount')}
                            className="w-32 h-10 bg-white/20 border-white/40 text-center font-black text-2xl text-white font-mono rounded-xl shadow-inner focus-visible:ring-0"
                            placeholder="0.000"
                          />
                      </div>
                  )}
              </div>
          </div>

          <div className="border-4 border-white rounded-[3.5rem] overflow-hidden shadow-2xl bg-white animate-in zoom-in-95 duration-700">
              <Table>
                  <TableHeader className="bg-slate-900 text-white h-16">
                    <TableRow className="border-none">
                        <TableHead className="px-12 font-black text-lg text-white">بيان الدفعة المستحقة</TableHead>
                        <TableHead className="text-center font-black text-lg text-white w-72">
                            {financials_type === 'percentage' ? 'النسبة المئوية (%)' : 'المبلغ المعتمد (د.ك)'}
                        </TableHead>
                        <TableHead className="w-24 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {itemFields.map((field, index) => (
                          <TableRow key={field.id} className="h-28 border-b last:border-0 hover:bg-primary/[0.03] transition-all group">
                              <TableCell className="px-12">
                                <Input {...register(`items.${index}.description`)} className="font-black text-3xl border-none shadow-none focus-visible:ring-0 bg-transparent text-[#1e1b4b] placeholder:italic placeholder:opacity-10" placeholder="اذكر مسمى الدفعة..." />
                              </TableCell>
                              <TableCell className="bg-primary/[0.02] border-r border-primary/5">
                                <div className="relative">
                                    <Input 
                                        type="number" 
                                        step="any" 
                                        {...register(financials_type === 'percentage' ? `items.${index}.percentage` : `items.${index}.unitPrice`)} 
                                        className="text-center font-black text-5xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono tracking-tighter"
                                        placeholder="0"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/30 font-black text-xl">{financials_type === 'percentage' ? '%' : 'KD'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center pr-8">
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={itemFields.length <= 1} className="text-red-400 h-12 w-12 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="h-7 w-7"/>
                                </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
                  <TableFooter className="bg-slate-900 text-white h-32">
                      <TableRow className="border-none hover:bg-slate-900">
                        <TableCell className="text-right px-12">
                            <p className="text-4xl font-black tracking-tighter text-white">إجمالي قيمة عرض السعر:</p>
                            <p className="text-xs font-bold text-white/40 mt-1 uppercase tracking-widest">Grand Total Value Assessment</p>
                        </TableCell>
                        <TableCell className="text-center bg-white/5 border-r border-white/10">
                            <div className="flex flex-col items-center">
                                <div className="text-6xl font-black font-mono text-primary tracking-tighter drop-shadow-[0_0_20px_rgba(255,122,0,0.3)]">
                                    {financials_type === 'fixed' ? formatCurrency(totalCalculatedValue) : `${totalCalculatedValue}%`}
                                </div>
                                {financials_type === 'percentage' && (
                                    <Badge variant="outline" className={cn(
                                        "mt-2 font-black text-[10px] px-6 border-2",
                                        totalCalculatedValue === 100 ? "bg-green-500 text-white border-none" : "bg-red-500/10 text-red-500 border-red-500/30 animate-pulse"
                                    )}>
                                        {totalCalculatedValue === 100 ? "مكتمل (100%)" : "خلل في النسب"}
                                    </Badge>
                                )}
                            </div>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                  </TableFooter>
              </Table>
          </div>
          
          <div className="flex justify-center pt-8">
            <Button type="button" variant="outline" onClick={() => appendItem({ id: generateStableId(), description: `الدفعة رقم ${itemFields.length + 1}`, quantity: 1, unitPrice: 0 })} className="h-16 px-24 rounded-[2.5rem] border-dashed border-4 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all gap-5 font-black text-2xl text-primary group shadow-xl bg-white/50">
                <PlusCircle className="h-8 w-8 group-hover:rotate-90 transition-transform" /> إضافة دفعة إضافية
            </Button>
          </div>
      </div>

      <DialogFooter className="pt-16 pb-20 border-t flex flex-col md:flex-row gap-8">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving} className="h-16 px-12 rounded-[2rem] font-black text-xl text-slate-400 hover:text-[#1e1b4b] hover:bg-slate-100">إلغاء المراجعة</Button>
          <Button 
            type="submit" 
            disabled={isSaving || refDataLoading || (financials_type === 'percentage' && totalCalculatedValue !== 100)} 
            className="h-20 px-40 rounded-[3rem] font-black text-4xl shadow-[0_20px_80px_-15px_rgba(255,122,0,0.4)] flex-1 gap-6 bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white border-none transition-all active:scale-95 hover:brightness-110"
          >
              {isSaving ? <Loader2 className="h-12 w-12 animate-spin" /> : <Save className="h-12 w-12" />}
              اعتماد وإصدار العرض
          </Button>
      </DialogFooter>
    </form>
  );
}
