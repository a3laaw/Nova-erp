
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, ArrowUp, ArrowDown, Save, Loader2, Search, LayoutGrid, Sparkles } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import type { ContractTemplate, ContractScopeItem, ContractTerm, ContractFinancialMilestone, Department, TransactionType, WorkStage, ConstructionType, ConstructionWorkStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Badge } from '../ui/badge';
import { InlineSearchList } from '../ui/inline-search-list';

interface ContractTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  template: ContractTemplate | null;
  initialType?: 'Consulting' | 'Execution';
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً', 'حادي عشر', 'ثاني عشر', 'ثالث عشر', 'رابع عشر', 'خامس عشر'];
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractTemplateForm({ isOpen, onClose, onSaveSuccess, template, initialType }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<'Consulting' | 'Execution'>('Consulting');
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
  
  // 2. جلب مراحل العمل للنوع المختار
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
    if (constructionTypeId) {
        fetchConstructionStages(constructionTypeId);
    }
  }, [constructionTypeId, fetchConstructionStages]);

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
        setAllWorkStages(Array.from(uniqueStages.values()).sort((a,b) => a.label.localeCompare(b.label, 'ar')));

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
        setTemplateType(template.templateType || initialType || 'Consulting');
        setConstructionTypeId(template.constructionTypeId || '');
        setSelectedTransactionTypes(template.transactionTypes || []);
        setScopeOfWork(template.scopeOfWork || []);
        setTermsAndConditions(template.termsAndConditions || []);
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses(template.openClauses || []);
    } else {
        setTitle('');
        setDescription('');
        setTemplateType(initialType || 'Consulting');
        setConstructionTypeId('');
        setSelectedTransactionTypes([]);
        setScopeOfWork([]);
        setTermsAndConditions([]);
        setFinancials({ type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses([]);
    }
  }, [template, isOpen, initialType]);

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
  const reorderScopeItem = (index: number, direction: 'up' | 'down') => {
      const newItems = [...scopeOfWork];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newItems.length) return;
      [newItems[index], newItems[newIndex]] = [newItems[newIndex], newItems[index]];
      setScopeOfWork(newItems);
  };


  const addTerm = () => setTermsAndConditions(prev => [...prev, { id: generateId(), text: '' }]);
  const updateTerm = (id: string, value: string) => {
    setTermsAndConditions(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeTerm = (id: string) => setTermsAndConditions(prev => prev.filter(term => term.id !== id));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
    const newTerms = [...termsAndConditions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newTerms.length) return;
    [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
    setTermsAndConditions(newTerms);
  };

  const addOpenClause = () => setOpenClauses(prev => [...prev, { id: generateId(), text: '' }]);
  const updateOpenClause = (id: string, value: string) => {
    setOpenClauses(prev => prev.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeOpenClause = (id: string) => setOpenClauses(prev => prev.filter(term => term.id !== id));
  const reorderOpenClause = (index: number, direction: 'up' | 'down') => {
    const newClauses = [...openClauses];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newClauses.length) return;
    [newClauses[index], newClauses[newIndex]] = [newClauses[newIndex], newClauses[index]];
    setOpenClauses(newClauses);
  };

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
            transactionTypes: selectedTransactionTypes,
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
          className="max-w-4xl h-[90vh] flex flex-col p-0"
        >
            <DialogHeader className="p-6 border-b flex-shrink-0">
                <DialogTitle className="text-2xl font-black">{template ? 'تعديل نموذج عقد' : 'إنشاء نموذج عقد جديد'}</DialogTitle>
                <DialogDescription>اربط القالب بنوع المقاولات الصحيح لجلب مراحل العمل آلياً.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-grow">
                <div className="p-6 space-y-10">
                    <section className="space-y-6 p-6 border rounded-3xl bg-muted/10 shadow-sm">
                        <h3 className="font-black text-lg flex items-center gap-2"><PlusCircle className="text-primary h-5 w-5" /> البيانات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="template-title" className="font-bold">عنوان النموذج *</Label>
                                <Input id="template-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد هيكل أسود مع المواد" className="h-11 rounded-xl" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="template-type" className="font-bold">نوع النموذج</Label>
                                <Select value={templateType} onValueChange={(v) => setTemplateType(v as any)}>
                                    <SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Consulting">استشاري (مكتب هندسي)</SelectItem>
                                        <SelectItem value="Execution">تنفيذي (مقاولات)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {templateType === 'Execution' && (
                            <div className="grid gap-3 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 animate-in fade-in zoom-in-95">
                                <Label className="font-black text-primary flex items-center gap-2">
                                    <LayoutGrid className="h-4 w-4" /> ربط بنوع المقاولات (Standard)
                                </Label>
                                <InlineSearchList 
                                    value={constructionTypeId}
                                    onSelect={setConstructionTypeId}
                                    options={constructionTypeOptions}
                                    placeholder={typesLoading ? "جاري التحميل..." : "اختر نوع المقاولات لجلب المراحل..."}
                                    className="bg-background h-11"
                                />
                                <p className="text-[10px] text-muted-foreground italic">عند اختيار النوع، ستظهر مراحل عمله الشجرية في قائمة شروط الدفعات بالأسفل.</p>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label htmlFor="template-description" className="font-bold">وصف النموذج</Label>
                            <Textarea id="template-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold">ربط بأنواع المعاملات</Label>
                             <MultiSelect
                                options={allTransactionTypes}
                                selected={selectedTransactionTypes}
                                onChange={setSelectedTransactionTypes}
                                placeholder={loadingRefData ? "تحميل..." : "اختر نوعًا أو أكثر..."}
                                disabled={loadingRefData}
                                className="rounded-xl"
                            />
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg flex items-center gap-2"><ShoppingCart className="text-primary h-5 w-5" /> نطاق العمل (Scope of Work)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addScopeItem} className="rounded-xl gap-2 font-bold"><PlusCircle className="h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className="space-y-4">
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="flex items-start gap-3 p-4 border rounded-2xl bg-white shadow-sm hover:shadow-md transition-all">
                                <span className="pt-2 font-black text-primary font-mono">{index + 1}.</span>
                                <div className="flex-grow space-y-3">
                                    <Input placeholder="عنوان البند (مثال: أعمال الحفر)" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} className="font-bold" />
                                    <Textarea placeholder="وصف تفصيلي لما يغطيه هذا البند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} className="text-sm" />
                                </div>
                                    <div className="flex flex-col gap-1">
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => reorderScopeItem(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => reorderScopeItem(index, 'down')} disabled={index === scopeOfWork.length - 1}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" type="button" onClick={() => removeScopeItem(item.id)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <Separator />

                    <section className="space-y-6 p-6 border rounded-3xl bg-primary/5 shadow-sm">
                        <div className="flex justify-between items-center">
                             <h3 className="font-black text-lg flex items-center gap-2"><Calculator className="text-primary h-5 w-5" /> البنود المالية والدفعات</h3>
                             <Button variant="outline" size="sm" type="button" onClick={addMilestone} className="rounded-xl gap-2 font-bold bg-white"><PlusCircle className="h-4 w-4"/> إضافة دفعة</Button>
                        </div>
                         <div className="grid md:grid-cols-2 gap-6">
                            <div className="grid gap-2">
                                <Label className="font-bold">نوع العقد المالي</Label>
                                <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                    <SelectTrigger className="h-11 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">قيمة ثابتة (مبالغ محددة)</SelectItem>
                                        <SelectItem value="percentage">نسبة مئوية (توزيع حصص)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold">إجمالي قيمة العقد (لحساب النسب)</Label>
                                <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="dir-ltr text-left h-11 font-mono font-bold rounded-xl bg-background" />
                            </div>
                        </div>
                        
                        <div className="space-y-3 mt-6">
                            {financials.milestones.map((m, i) => (
                                 <div key={m.id} className="grid grid-cols-12 gap-3 items-center p-3 bg-background rounded-2xl border shadow-sm group">
                                    <div className="col-span-3">
                                        <Input value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="h-9 font-bold border-none shadow-none focus-visible:ring-0" />
                                    </div>
                                    <div className="col-span-5">
                                        <Select value={m.condition || '_NONE_'} onValueChange={v => updateMilestone(m.id, 'condition', v === '_NONE_' ? '' : v)}>
                                            <SelectTrigger className={cn("h-9 border-none shadow-none focus-visible:ring-0", !m.condition && "text-muted-foreground italic")}>
                                                <SelectValue placeholder="اختر شرط الاستحقاق..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="_NONE_">بدون شرط (يدوي)</SelectItem>
                                                {conditionOptions.map(stage => (
                                                    <SelectItem key={stage.value} value={stage.value}>
                                                        <div className="flex items-center gap-2">
                                                            {templateType === 'Execution' && <Sparkles className="h-3 w-3 text-blue-500" />}
                                                            {stage.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-3 flex items-center gap-2">
                                        <Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="dir-ltr text-left h-9 font-black text-primary" />
                                        <span className="text-[10px] font-black text-muted-foreground uppercase">{financials.type === 'fixed' ? 'KWD' : '%'}</span>
                                    </div>
                                    <div className="col-span-1 flex justify-center">
                                        <Button variant="ghost" size="icon" type="button" onClick={() => removeMilestone(m.id)} className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                 </div>
                            ))}
                        </div>
                         {financials.milestones.length > 0 && (
                            <div className="flex justify-between items-center px-6 py-4 bg-primary/10 rounded-2xl mt-4">
                                <span className="font-black text-primary">مجموع الدفعات الموزعة:</span>
                                <div className="text-right">
                                    <span className="text-2xl font-black font-mono text-primary">{totalMilestoneValue} {financials.type === 'fixed' ? 'KD' : '%'}</span>
                                    {financials.type === 'percentage' && totalMilestoneValue !== 100 && <p className="text-[10px] font-bold text-red-600 animate-pulse">تحذير: يجب أن يكون المجموع 100%</p>}
                                </div>
                            </div>
                         )}
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg flex items-center gap-2"><FileText className="text-primary h-5 w-5" /> الشروط والأحكام</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addTerm} className="rounded-xl gap-2 font-bold"><PlusCircle className="h-4 w-4"/> إضافة شرط</Button>
                        </div>
                         <div className="space-y-3">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex items-start gap-3 p-3 bg-muted/5 rounded-2xl border hover:border-primary/30 transition-colors">
                                <span className="pt-2 font-black text-muted-foreground font-mono">{index + 1}.</span>
                                <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow border-none shadow-none focus-visible:ring-0 bg-transparent text-sm" placeholder="اكتب نص الشرط القانوني هنا..."/>
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'up')} disabled={index === 0} className="h-7 w-7"><ArrowUp className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'down')} disabled={index === termsAndConditions.length - 1} className="h-7 w-7"><ArrowDown className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeTerm(term.id)} className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3"/></Button>
                                </div>
                                </div>
                            ))}
                         </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-lg flex items-center gap-2">بنود إضافية (اختياري)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addOpenClause} className="rounded-xl gap-2 font-bold"><PlusCircle className="h-4 w-4"/> إضافة بند</Button>
                        </div>
                        <div className='space-y-3'>
                            {openClauses.map((clause, index) => (
                                <div key={clause.id} className="flex items-center gap-3 p-3 bg-background rounded-2xl border">
                                   <span className="font-black text-muted-foreground font-mono">{index + 1}.</span>
                                   <Textarea value={clause.text} onChange={(e) => updateOpenClause(clause.id, e.target.value)} rows={2} className="flex-grow border-none shadow-none focus-visible:ring-0 bg-transparent text-sm" placeholder={`نص البند الإضافي ${index + 1}`}/>
                                   <div className="flex flex-col gap-1">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'up')} disabled={index === 0}><ArrowUp className="h-3 w-3"/></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'down')} disabled={index === openClauses.length - 1}><ArrowDown className="h-3 w-3"/></Button>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeOpenClause(clause.id)} className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3"/></Button>
                                   </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>
            <DialogFooter className="p-6 border-t bg-muted/10 flex-shrink-0">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSaving} className="h-12 px-8 rounded-xl font-bold">إلغاء</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/20 transition-all min-w-[200px]">
                {isSaving ? <Loader2 className="ml-3 h-5 w-5 animate-spin" /> : <Save className="ml-3 h-5 w-5" />}
                {template ? 'حفظ التعديلات' : 'إنشاء النموذج'}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
