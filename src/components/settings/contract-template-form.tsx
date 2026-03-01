
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Save, 
  Loader2, 
  LayoutGrid, 
  Sparkles,
  ShoppingCart,
  Calculator,
  FileText,
  Briefcase,
  Construction,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import type { ContractTemplate, ContractScopeItem, ContractTerm, ContractFinancialMilestone, Department, TransactionType, WorkStage, ConstructionType } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Badge } from '../ui/badge';
import { InlineSearchList } from '../ui/inline-search-list';

const generateId = () => Math.random().toString(36).substring(2, 9);
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractTemplateForm({ isOpen, onClose, onSaveSuccess, template, initialType }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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

  const { data: constructionTypes, loading: typesLoading } = useSubscription<ConstructionType>(firestore, 'construction_types', [orderBy('name')]);
  
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
        setConstructionTypeId(template.constructionTypeId || '');
        setSelectedTransactionTypes(template.transactionTypes || []);
        setScopeOfWork(template.scopeOfWork || []);
        setTermsAndConditions(template.termsAndConditions || []);
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses(template.openClauses || []);
    }
  }, [template, isOpen]);

  // CRITICAL FIX: Ensure condition options are strictly filtered by template type
  const conditionOptions = useMemo(() => {
    if (templateType === 'Execution') {
        return constructionStages; // ONLY show construction stages
    }
    return allWorkStages; // ONLY show office/consulting stages
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
          className={cn(
            "max-w-4xl h-[90vh] flex flex-col p-0 rounded-[2.5rem] overflow-hidden border-4 transition-colors duration-500",
            templateType === 'Consulting' ? "border-primary/20 bg-sky-50/10" : "border-amber-600/20 bg-amber-50/10"
          )}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-inline-search-list-portal]')) {
                e.preventDefault();
            }
          }}
        >
            <DialogHeader className={cn(
                "p-8 border-b flex-shrink-0 transition-colors duration-500",
                templateType === 'Consulting' ? "bg-primary/5" : "bg-amber-600/5"
            )}>
                <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-2xl transition-colors", templateType === 'Consulting' ? "bg-primary/10 text-primary" : "bg-amber-600/10 text-amber-600")}>
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
            <ScrollArea className="flex-grow">
                <div className="p-8 space-y-10">
                    <section className={cn(
                        "space-y-6 p-8 border rounded-[2rem] bg-card shadow-sm transition-colors",
                        templateType === 'Execution' ? "border-amber-600/10" : "border-primary/10"
                    )}>
                        <h3 className={cn("font-black text-lg flex items-center gap-2", templateType === 'Consulting' ? "text-primary" : "text-amber-600")}>
                            <FileText className="h-5 w-5" /> البيانات الأساسية للنموذج
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid gap-2">
                                <Label htmlFor="template-title" className="font-bold text-sm text-foreground/70">عنوان النموذج *</Label>
                                <Input 
                                    id="template-title" 
                                    value={title} 
                                    onChange={e => setTitle(e.target.value)} 
                                    placeholder="مثال: عقد هيكل أسود مع المواد" 
                                    className={cn("h-12 rounded-xl text-lg font-bold border-2", templateType === 'Execution' ? "focus:border-amber-600" : "focus:border-primary")} 
                                />
                            </div>
                            
                            {templateType === 'Execution' ? (
                                <div className="grid gap-2">
                                    <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                                        <LayoutGrid className="h-4 w-4 text-amber-600" /> نوع المقاولات المعتمد *
                                    </Label>
                                    <InlineSearchList 
                                        value={constructionTypeId}
                                        onSelect={setConstructionTypeId}
                                        options={constructionTypeOptions}
                                        placeholder={typesLoading ? "جاري التحميل..." : "اختر نوع المقاولات..."}
                                        className="h-12 rounded-xl border-2 border-amber-600/20"
                                    />
                                    <p className="text-[10px] text-amber-700/70 italic">عند الاختيار، سيتم جلب مراحل العمل الفنية لهذا النوع آلياً.</p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label className="font-bold text-sm text-foreground/70 flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-primary" /> أنواع المعاملات المكتبية المرتبطة
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
                            <Label htmlFor="template-description" className="font-bold text-sm text-foreground/70">وصف النموذج</Label>
                            <Textarea id="template-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="rounded-xl border-2 resize-none" placeholder="شرح موجز لاستخدامات هذا القالب..." />
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                            <h3 className="font-black text-lg flex items-center gap-2 text-foreground">
                                <ShoppingCart className={cn("h-5 w-5", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} /> 
                                نطاق العمل (Scope of Work)
                            </h3>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                type="button" 
                                onClick={addScopeItem} 
                                className={cn("rounded-xl gap-2 font-bold border-2 border-dashed", templateType === 'Consulting' ? "border-primary/30 hover:border-primary text-primary" : "border-amber-600/30 hover:border-amber-600 text-amber-600")}
                            >
                                <PlusCircle className="h-4 w-4"/> إضافة بند عمل
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="flex items-start gap-3 p-6 border-2 border-muted bg-card rounded-3xl shadow-sm hover:shadow-md transition-all group">
                                    <span className={cn("pt-2 font-black font-mono text-xl", templateType === 'Consulting' ? "text-primary" : "text-amber-600")}>{index + 1}.</span>
                                    <div className="flex-grow space-y-4">
                                        <Input placeholder="عنوان البند الرئيسي" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} className="font-black border-none shadow-none focus-visible:ring-0 text-xl p-0 h-auto bg-transparent" />
                                        <Textarea placeholder="شرح تفصيلي لما سيتم تنفيذه ضمن هذا البند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} className="text-sm border-none shadow-none focus-visible:ring-0 bg-muted/10 rounded-xl p-4 resize-none" />
                                    </div>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeScopeItem(item.id)} className="h-10 w-10 text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-destructive/10"><Trash2 className="h-5 w-5"/></Button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={cn(
                        "space-y-6 p-8 border-2 rounded-[2.5rem] shadow-inner relative overflow-hidden",
                        templateType === 'Consulting' ? "border-primary/10 bg-primary/5" : "border-amber-600/10 bg-amber-600/5"
                    )}>
                        <div className="absolute top-0 left-0 p-12 opacity-5 pointer-events-none">
                            <Calculator className={cn("h-40 w-40", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} />
                        </div>
                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className={cn("font-black text-xl flex items-center gap-3", templateType === 'Consulting' ? "text-primary" : "text-amber-600")}>
                                    <Calculator className="h-6 w-6" /> الدفعات المالية (Milestones)
                                </h3>
                                <Button 
                                    variant="default" 
                                    size="sm" 
                                    type="button" 
                                    onClick={addMilestone} 
                                    className={cn("rounded-xl gap-2 font-black shadow-lg", templateType === 'Consulting' ? "bg-primary shadow-primary/20" : "bg-amber-600 hover:bg-amber-700 shadow-amber-200")}
                                >
                                    <PlusCircle className="h-4 w-4"/> إضافة دفعة
                                </Button>
                            </div>
                            
                            <div className="grid md:grid-cols-2 gap-8 mb-8">
                                <div className="grid gap-3">
                                    <Label className="font-bold text-xs opacity-70 uppercase tracking-widest">نوع العقد المالي</Label>
                                    <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                        <SelectTrigger className="h-12 rounded-2xl border-2 bg-background font-bold"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">قيمة ثابتة (مبالغ بالدينار)</SelectItem>
                                            <SelectItem value="percentage">نسبة مئوية (توزيع حصص %)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-3">
                                    <Label className="font-bold text-xs opacity-70 uppercase tracking-widest">إجمالي الميزانية (للنسب)</Label>
                                    <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="dir-ltr text-center h-12 font-black text-xl rounded-2xl bg-background border-2" />
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                {financials.milestones.map((m, i) => (
                                    <div key={m.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-background rounded-[1.5rem] border-2 shadow-sm group transition-all">
                                        <div className="col-span-3">
                                            <Input value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="h-10 font-black text-sm border-none shadow-none focus-visible:ring-0 px-0 bg-transparent" />
                                        </div>
                                        <div className="col-span-5">
                                            <InlineSearchList 
                                                value={m.condition || ''}
                                                onSelect={v => updateMilestone(m.id, 'condition', v)}
                                                options={conditionOptions}
                                                placeholder={loadingStages ? "جاري التحميل..." : "شرط استحقاق الدفعة..."}
                                                disabled={loadingStages || (templateType === 'Execution' && !constructionTypeId)}
                                                className="h-10 border-none shadow-none focus-visible:ring-0 rounded-xl bg-muted/30 px-4 font-bold text-xs"
                                            />
                                        </div>
                                        <div className="col-span-3 flex items-center gap-3">
                                            <Input 
                                                type="number" 
                                                value={m.value} 
                                                onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} 
                                                className={cn("dir-ltr text-center h-10 font-black text-lg border-2 border-muted rounded-xl bg-muted/10 w-24", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} 
                                            />
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
                                    (financials.type === 'percentage' && totalMilestoneValue !== 100) ? "bg-red-50 border-red-200" : "bg-white shadow-lg",
                                    (financials.type === 'percentage' && totalMilestoneValue === 100 && templateType === 'Consulting') ? "border-primary/20" : "",
                                    (financials.type === 'percentage' && totalMilestoneValue === 100 && templateType === 'Execution') ? "border-amber-600/20" : ""
                                )}>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground">إجمالي الدفعات الموزعة</span>
                                        <p className={cn("text-3xl font-black font-mono", (financials.type === 'percentage' && totalMilestoneValue !== 100) ? "text-red-600" : (templateType === 'Consulting' ? "text-primary" : "text-amber-600"))}>
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
                            <h3 className="font-black text-lg flex items-center gap-2">
                                <ShieldCheck className={cn("h-5 w-5", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} /> 
                                الشروط والأحكام القانونية
                            </h3>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                type="button" 
                                onClick={addTerm} 
                                className={cn("rounded-xl gap-2 font-bold border-2 border-dashed", templateType === 'Consulting' ? "border-primary/30 hover:border-primary text-primary" : "border-amber-600/30 hover:border-amber-600 text-amber-600")}
                            >
                                <PlusCircle className="h-4 w-4"/> إضافة مادة قانونية
                            </Button>
                        </div>
                        <div className="space-y-4">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex items-start gap-4 p-4 bg-white rounded-2xl border-2 border-muted hover:border-primary/20 transition-all group shadow-sm">
                                    <span className={cn("pt-2 font-black font-mono text-lg", templateType === 'Consulting' ? "text-primary" : "text-amber-600")}>{index + 1}.</span>
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
              <Button 
                type="button" 
                onClick={handleSave} 
                disabled={isSaving || (financials.type === 'percentage' && totalMilestoneValue !== 100)} 
                className={cn(
                    "h-14 px-16 rounded-2xl font-black text-xl shadow-2xl transition-all min-w-[240px]",
                    templateType === 'Consulting' ? "bg-primary shadow-primary/30" : "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                )}
              >
                {isSaving ? <Loader2 className="ml-3 h-6 w-6 animate-spin" /> : <Save className="ml-3 h-6 w-6" />}
                {template ? 'حفظ التعديلات' : 'اعتماد النموذج'}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
