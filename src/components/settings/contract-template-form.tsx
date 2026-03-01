'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { 
  PlusCircle, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  Loader2, 
  Search, 
  LayoutGrid, 
  Sparkles,
  ShoppingCart,
  Calculator,
  FileText,
  Briefcase,
  Construction
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import type { ContractTemplate, ContractScopeItem, ContractTerm, ContractFinancialMilestone, Department, TransactionType, WorkStage, ConstructionType } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Badge } from '../ui/badge';
import { InlineSearchList } from '../ui/inline-search-list';

interface ContractTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  template: ContractTemplate | null;
  initialType: 'Consulting' | 'Execution';
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractTemplateForm({ isOpen, onClose, onSaveSuccess, template, initialType }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // النوع الآن محدد من البداية ولا يمكن تغييره داخل النموذج
  const [templateType] = useState<'Consulting' | 'Execution'>(template?.templateType || initialType);
  
  const [constructionTypeId, setConstructionTypeId] = useState('');
  const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<string[]>([]);
  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<ContractTerm[]>([]);
  const [financials, setFinancials] = useState<ContractTemplate['financials']>({
    type: 'fixed',
    totalAmount: 0,
    discount: 0,
    milestones: [],
  });
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);

  const [allTransactionTypes, setAllTransactionTypes] = useState<MultiSelectOption[]>([]);
  const [allWorkStages, setAllWorkStages] = useState<MultiSelectOption[]>([]);
  const [loadingRefData, setLoadingRefData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 1. جلب أنواع المقاولات المرجعية (Standard)
  const { data: constructionTypes, loading: typesLoading } = useSubscription<ConstructionType>(firestore, 'construction_types', [orderBy('name')]);
  
  // 2. جلب مراحل العمل للنوع المختار (في حال عقود التنفيذ)
  const [constructionStages, setConstructionStages] = useState<MultiSelectOption[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  const fetchConstructionStages = useCallback(async (typeId: string) => {
    if (!firestore || !typeId) {
        setConstructionStages([]);
        return;
    }
    setLoadingStages(true);
    try {
        const q = query(collection(firestore, `construction_types/${typeId}/stages`), orderBy('order'));
        const snap = await getDocs(q);
        const stages = snap.docs.map(doc => ({
            value: doc.data().name,
            label: doc.data().name
        }));
        setConstructionStages(stages);
    } catch (e) {
        console.error("Error fetching construction stages:", e);
    } finally {
        setLoadingStages(false);
    }
  }, [firestore]);

  useEffect(() => {
    if (templateType === 'Execution' && constructionTypeId) {
        fetchConstructionStages(constructionTypeId);
    }
  }, [constructionTypeId, fetchConstructionStages, templateType]);

  useEffect(() => {
    const fetchRefData = async () => {
      if (!firestore) return;
      setLoadingRefData(true);
      try {
        const types: MultiSelectOption[] = [];
        const transTypesSnapshot = await getDocs(query(collection(firestore, 'transactionTypes')));
        const uniqueTypeNames = new Set<string>();
        transTypesSnapshot.forEach(typeDoc => {
            const typeName = typeDoc.data().name;
            if (typeName && !uniqueTypeNames.has(typeName)) {
                types.push({ value: typeName, label: typeName });
                uniqueTypeNames.add(typeName);
            }
        });
        setAllTransactionTypes(types.sort((a,b) => a.label.localeCompare(b.label, 'ar')));
        
        const officeStagesSnapshot = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const uniqueStages = new Map<string, MultiSelectOption>();
        officeStagesSnapshot.forEach(stageDoc => {
          const stageName = stageDoc.data().name;
          if (stageName && !uniqueStages.has(stageName)) {
              uniqueStages.set(stageName, { value: stageName, label: stageName });
          }
        });
        setAllWorkStages(Array.from(uniqueStages.values()).sort((a,b) => a.label.localeCompare(b.label, 'ar')).map(s => ({ value: s.value, label: s.label })));

      } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب البيانات المرجعية.' });
      } finally {
        setLoadingRefData(false);
      }
    };
    if (isOpen) {
        fetchRefData();
    }
  }, [firestore, toast, isOpen]);
  
  useEffect(() => {
    if (template) {
        setTitle(template.title);
        setDescription(template.description || '');
        setConstructionTypeId(template.constructionTypeId || '');
        setSelectedTransactionTypes(template.transactionTypes || []);
        setScopeOfWork(template.scopeOfWork || []);
        setTermsAndConditions(template.termsAndConditions || []);
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses(template.openClauses || []);
    } else {
        setTitle('');
        setDescription('');
        setConstructionTypeId('');
        setSelectedTransactionTypes([]);
        setScopeOfWork([]);
        setTermsAndConditions([]);
        setFinancials({ type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses([]);
    }
  }, [template, isOpen]);

  const conditionOptions = useMemo(() => {
    if (templateType === 'Execution' && constructionStages.length > 0) {
        return constructionStages;
    }
    return allWorkStages;
  }, [templateType, constructionStages, allWorkStages]);


  const addScopeItem = () => setScopeOfWork(prev => [...prev, { id: generateId(), title: '', description: '' }]);
  const updateScopeItem = (id: string, field: 'title' | 'description', value: string) => {
    setScopeOfWork(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeScopeItem = (id: string) => setScopeOfWork(prev => prev.filter(item => item.id !== id));
  
  const addTerm = () => setTermsAndConditions(prev => [...prev, { id: generateId(), text: '' }]);
  const updateTerm = (id: string, value: string) => {
    setTermsAndConditions(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeTerm = (id: string) => setTermsAndConditions(prev => prev.filter(term => term.id !== id));

  const addMilestone = () => {
    setFinancials(prev => {
      const newIndex = prev.milestones.length;
      const newName = `الدفعة ${milestoneNames[newIndex] || `(${newIndex + 1})`}`;
      return {
        ...prev,
        milestones: [...prev.milestones, { id: generateId(), name: newName, condition: '', value: 0 }]
      };
    });
  };
  const updateMilestone = (id: string, field: keyof ContractFinancialMilestone, value: string | number) => {
    setFinancials(prev => ({ ...prev, milestones: prev.milestones.map(m => m.id === id ? { ...m, [field]: value } : m) }));
  };
  const removeMilestone = (id: string) => {
    setFinancials(prev => ({ ...prev, milestones: prev.milestones.filter(m => m.id !== id) }));
  };
  
  const totalMilestoneValue = useMemo(() => financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0), [financials.milestones]);

  const handleSave = async () => {
    if (!firestore || !user) return;
    if (!title) {
        toast({ variant: 'destructive', title: 'حقل مطلوب', description: 'الرجاء إدخال عنوان للنموذج.' });
        return;
    }
    setIsSaving(true);
    try {
        const templateData: Omit<ContractTemplate, 'id'> = {
            title,
            description,
            templateType,
            constructionTypeId: templateType === 'Execution' ? constructionTypeId : null,
            transactionTypes: templateType === 'Consulting' ? selectedTransactionTypes : [],
            scopeOfWork,
            termsAndConditions,
            financials,
            openClauses,
            createdAt: template?.createdAt || serverTimestamp(),
            createdBy: template?.createdBy || user.id,
        };
        
        if (template?.id) {
            await updateDoc(doc(firestore, 'contractTemplates', template.id), cleanFirestoreData(templateData));
            toast({ title: 'نجاح', description: 'تم تحديث النموذج بنجاح.' });
        } else {
            await addDoc(collection(firestore, 'contractTemplates'), cleanFirestoreData(templateData));
            toast({ title: 'نجاح', description: 'تم إنشاء النموذج بنجاح.' });
        }
        onSaveSuccess();
        onClose();
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ النموذج.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          dir="rtl"
          className="max-w-4xl h-[90vh] flex flex-col p-0 rounded-[2.5rem] overflow-hidden"
        >
            <DialogHeader className="p-8 border-b bg-muted/10 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        {templateType === 'Execution' ? <Construction className="h-8 w-8" /> : <Briefcase className="h-8 w-8" />}
                    </div>
                    <div>
                        <DialogTitle className="text-2xl font-black">
                            {template ? 'تعديل نموذج' : 'إنشاء نموذج'} {templateType === 'Execution' ? 'عقد مقاولات' : 'عقد استشارات'}
                        </DialogTitle>
                        <DialogDescription>توحيد وربط نماذج العقود بالقوائم المرجعية المناسبة لنوع العمل المختار.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
            <ScrollArea className="flex-grow bg-muted/5">
                <div className="p-8 space-y-10">
                    <section className="space-y-6 p-8 border rounded-[2rem] bg-card shadow-sm">
                        <h3 className="font-black text-lg flex items-center gap-2"><FileText className="text-primary h-5 w-5" /> البيانات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-2">
                                <Label htmlFor="template-title" className="font-bold text-sm text-foreground/70">عنوان النموذج *</Label>
                                <Input id="template-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد هيكل أسود مع المواد" className="h-12 rounded-xl text-lg font-bold border-2" />
                            </div>
                            
                            {templateType === 'Execution' ? (
                                <div className="grid gap-2">
                                    <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4" /> نوع المقاولات (Standard List)
                                    </Label>
                                    <InlineSearchList 
                                        value={constructionTypeId}
                                        onSelect={setConstructionTypeId}
                                        options={constructionTypeOptions}
                                        placeholder={typesLoading ? "جاري التحميل..." : "اختر نوع المقاولات..."}
                                        className="h-12 rounded-xl border-2"
                                    />
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" /> أنواع المعاملات المكتبية المرتبطة
                                    </Label>
                                    <MultiSelect
                                        options={allTransactionTypes}
                                        selected={selectedTransactionTypes}
                                        onChange={setSelectedTransactionTypes}
                                        placeholder={loadingRefData ? "تحميل..." : "اختر نوع معاملة أو أكثر..."}
                                        disabled={loadingRefData}
                                        className="rounded-xl border-2"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="template-description" className="font-bold text-sm text-foreground/70">وصف النموذج وملاحظات إضافية</Label>
                            <Textarea id="template-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="rounded-xl border-2 resize-none" placeholder="شرح موجز لاستخدامات هذا القالب..." />
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="font-black text-lg flex items-center gap-2 text-foreground"><ShoppingCart className="text-primary h-5 w-5" /> نطاق العمل (Scope of Work)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addScopeItem} className="rounded-xl gap-2 font-bold border-2 border-dashed border-primary/30 hover:border-primary"><PlusCircle className="h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className="space-y-4">
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="flex items-start gap-3 p-6 border-2 border-muted bg-card rounded-3xl shadow-sm hover:shadow-md transition-all group">
                                    <span className="pt-2 font-black text-primary font-mono text-xl">{index + 1}.</span>
                                    <div className="flex-grow space-y-4">
                                        <Input placeholder="عنوان البند الرئيسي" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} className="font-black border-none shadow-none focus-visible:ring-0 text-xl p-0 h-auto" />
                                        <Textarea placeholder="شرح تفصيلي لما سيتم تنفيذه ضمن هذا البند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} className="text-sm border-none shadow-none focus-visible:ring-0 bg-muted/10 rounded-xl p-4 resize-none" />
                                    </div>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeScopeItem(item.id)} className="h-10 w-10 text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-destructive/10"><Trash2 className="h-5 w-5"/></Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-6 p-8 border-2 border-primary/10 rounded-[2.5rem] bg-primary/5 shadow-inner relative overflow-hidden">
                        <div className="absolute top-0 left-0 p-12 opacity-5 pointer-events-none">
                            <Calculator className="h-40 w-40 text-primary" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="font-black text-xl flex items-center gap-3 text-primary"><Calculator className="h-6 w-6" /> البنود المالية وتوزيع الدفعات</h3>
                                <Button variant="default" size="sm" type="button" onClick={addMilestone} className="rounded-xl gap-2 font-black shadow-lg shadow-primary/20"><PlusCircle className="h-4 w-4"/> إضافة دفعة جديدة</Button>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-8 mb-8">
                                <div className="grid gap-3">
                                    <Label className="font-bold text-xs text-primary/70 uppercase tracking-widest">نوع العقد المالي</Label>
                                    <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                        <SelectTrigger className="h-12 rounded-2xl border-2 bg-background font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">قيمة ثابتة (مبالغ بالدينار)</SelectItem>
                                            <SelectItem value="percentage">نسبة مئوية (توزيع حصص %)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-3">
                                    <Label className="font-bold text-xs text-primary/70 uppercase tracking-widest">إجمالي الميزانية (للنسب)</Label>
                                    <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="dir-ltr text-center h-12 font-black text-xl rounded-2xl bg-background border-2" />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {financials.milestones.map((m, i) => (
                                    <div key={m.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-background rounded-[1.5rem] border-2 shadow-sm group hover:border-primary/30 transition-all">
                                        <div className="col-span-3">
                                            <Input value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="h-10 font-black text-sm border-none shadow-none focus-visible:ring-0 px-0" />
                                        </div>
                                        <div className="col-span-5">
                                            <Select value={m.condition || '_NONE_'} onValueChange={v => updateMilestone(m.id, 'condition', v === '_NONE_' ? '' : v)}>
                                                <SelectTrigger className={cn("h-10 border-none shadow-none focus-visible:ring-0 rounded-xl bg-muted/30 px-4 font-bold text-xs", !m.condition && "text-muted-foreground italic")}>
                                                    <SelectValue placeholder="شرط الاستحقاق..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="_NONE_">بدون شرط (سداد يدوي)</SelectItem>
                                                    {conditionOptions.map(stage => (
                                                        <SelectItem key={stage.value} value={stage.value}>
                                                            <div className="flex items-center gap-2">
                                                                <Sparkles className="h-3 w-3 text-blue-500" />
                                                                {stage.label}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="col-span-3 flex items-center gap-3">
                                            <Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="dir-ltr text-center h-10 font-black text-lg text-primary border-2 border-primary/10 rounded-xl bg-muted/10 w-24" />
                                            <span className="text-[10px] font-black text-muted-foreground uppercase">{financials.type === 'fixed' ? 'KD' : '%'}</span>
                                        </div>
                                        <div className="col-span-1 flex justify-center">
                                            <Button variant="ghost" size="icon" type="button" onClick={() => removeMilestone(m.id)} className="h-10 w-10 text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {financials.milestones.length > 0 && (
                                <div className={cn(
                                    "flex justify-between items-center p-6 rounded-3xl mt-6 border-2 transition-all",
                                    (financials.type === 'percentage' && totalMilestoneValue !== 100) ? "bg-red-50 border-red-200" : "bg-white border-primary/20 shadow-lg"
                                )}>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">إجمالي الدفعات الموزعة</span>
                                        <p className={cn("text-3xl font-black font-mono", (financials.type === 'percentage' && totalMilestoneValue !== 100) ? "text-red-600" : "text-primary")}>
                                            {totalMilestoneValue} {financials.type === 'fixed' ? 'KD' : '%'}
                                        </p>
                                    </div>
                                    {financials.type === 'percentage' && totalMilestoneValue !== 100 && (
                                        <div className="text-left text-red-700 animate-pulse">
                                            <AlertCircle className="h-10 w-10 ml-auto mb-1" />
                                            <p className="font-black text-sm">يجب أن يكون المجموع 100% بالضبط</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="space-y-6 px-2">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg flex items-center gap-2"><ShieldCheck className="text-primary h-5 w-5" /> الشروط والأحكام القانونية</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addTerm} className="rounded-xl gap-2 font-bold border-2 border-dashed border-primary/30 hover:border-primary"><PlusCircle className="h-4 w-4"/> إضافة شرط قانوني</Button>
                        </div>
                        <div className="space-y-4">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex items-start gap-4 p-4 bg-white rounded-2xl border-2 border-muted hover:border-primary/20 transition-all group shadow-sm">
                                    <span className="pt-2 font-black text-muted-foreground font-mono text-lg">{index + 1}.</span>
                                    <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow border-none shadow-none focus-visible:ring-0 bg-transparent text-sm font-medium leading-relaxed resize-none" placeholder="اكتب نص المادة القانونية هنا..."/>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeTerm(term.id)} className="h-9 w-9 text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>
            <DialogFooter className="p-8 border-t bg-card flex-shrink-0">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSaving} className="h-14 px-10 rounded-2xl font-black text-lg hover:bg-muted">إلغاء</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || (financials.type === 'percentage' && totalMilestoneValue !== 100)} className="h-14 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 transition-all min-w-[240px]">
                {isSaving ? <Loader2 className="ml-3 h-6 w-6 animate-spin" /> : <Save className="ml-3 h-6 w-6" />}
                {template ? 'حفظ التعديلات' : 'اعتماد النموذج'}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
