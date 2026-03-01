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
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { 
  PlusCircle, 
  Trash2, 
  Save, 
  Loader2, 
  LayoutGrid, 
  ShoppingCart,
  Calculator,
  FileText,
  Briefcase,
  Construction,
  ShieldCheck,
  AlertCircle,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import type { ContractTemplate, ContractScopeItem, ContractTerm, ContractFinancialMilestone, Department, TransactionType, ConstructionType } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Badge } from '../ui/badge';
import { InlineSearchList } from '../ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const generateId = () => Math.random().toString(36).substring(2, 9);
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

interface ContractTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  template: ContractTemplate | null;
  initialType: 'Consulting' | 'Execution';
}

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
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const { data: constructionTypes, loading: typesLoading } = useSubscription<ConstructionType>(firestore, 'construction_types', useMemo(() => [orderBy('name')], []));
  
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

  const conditionOptions = useMemo(() => {
    if (templateType === 'Execution') {
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

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!title.trim()) errors.push("عنوان النموذج مطلوب.");
    
    if (financials.milestones.length === 0) {
        errors.push("يجب إضافة دفعة مالية واحدة على الأقل في قسم البنود المالية.");
    } else {
        if (financials.type === 'percentage') {
            if (totalMilestoneValue !== 100) {
                errors.push(`إجمالي نسب الدفعات يجب أن يكون 100% تماماً (الحالي: ${totalMilestoneValue}%).`);
            }
        } else {
            if (financials.totalAmount > 0 && Math.abs(totalMilestoneValue - financials.totalAmount) > 0.001) {
                errors.push(`إجمالي مبالغ الدفعات (${formatCurrency(totalMilestoneValue)}) يجب أن يساوي إجمالي ميزانية النموذج (${formatCurrency(financials.totalAmount)}).`);
            }
        }
    }

    if (templateType === 'Execution' && !constructionTypeId) {
        errors.push("يجب اختيار نوع المقاولات المرتبط لعقود التنفيذ.");
    }

    if (templateType === 'Consulting' && selectedTransactionTypes.length === 0) {
        errors.push("يجب اختيار نوع معاملة واحد على الأقل لعقود الاستشارات.");
    }

    return errors;
  }, [title, financials, totalMilestoneValue, templateType, constructionTypeId, selectedTransactionTypes]);

  const handleSave = async () => {
    if (!firestore || !user) return;
    
    if (validationErrors.length > 0) {
        setShowValidationErrors(true);
        toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'يرجى مراجعة التنبيهات في أعلى النموذج.' });
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
          className="max-w-5xl h-[95vh] flex flex-col p-0 rounded-xl overflow-hidden"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-inline-search-list-portal]') || target.closest('[cmdk-root]')) {
                e.preventDefault();
            }
          }}
        >
            <DialogHeader className={cn(
                "p-4 border-b flex-shrink-0",
                templateType === 'Consulting' ? "border-primary/20 bg-primary/5" : "border-amber-600/20 bg-amber-600/5"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", templateType === 'Consulting' ? "bg-primary text-primary-foreground" : "bg-amber-600 text-white")}>
                        {templateType === 'Execution' ? <Construction className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-bold leading-none">
                            {template ? 'تعديل نموذج' : 'إنشاء نموذج'} {templateType === 'Execution' ? 'عقد مقاولات' : 'عقد استشارات'}
                        </DialogTitle>
                        <DialogDescription className="text-[10px] mt-1">صياغة وتوحيد بنود العقود والدفعات المالية.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <ScrollArea className="flex-grow">
                <div className="p-5 space-y-6 pb-32">
                    
                    {/* Validation Error Alert */}
                    {showValidationErrors && validationErrors.length > 0 && (
                        <Alert variant="destructive" className="rounded-xl border-2 py-2 px-4 shadow-sm animate-in fade-in slide-in-from-top-2 mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle className="font-bold text-sm">تنبيه بالبيانات الناقصة</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc pr-4 mt-1 space-y-0.5 text-[11px] font-semibold">
                                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-muted/5">
                        <div className="grid gap-1.5">
                            <Label className="text-[11px] font-bold text-muted-foreground">عنوان النموذج *</Label>
                            <Input 
                                value={title} 
                                onChange={e => {
                                    setTitle(e.target.value);
                                    if(showValidationErrors) setShowValidationErrors(false);
                                }} 
                                placeholder="أدخل اسماً يميز هذا النموذج..." 
                                className={cn("h-9 text-sm", !title.trim() && showValidationErrors && "border-destructive")}
                            />
                        </div>
                        
                        {templateType === 'Execution' ? (
                            <div className="grid gap-1.5">
                                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                                    <LayoutGrid className="h-3 w-3 text-amber-600" /> نوع المقاولات المرتبط
                                </Label>
                                <InlineSearchList 
                                    value={constructionTypeId}
                                    onSelect={setConstructionTypeId}
                                    options={constructionTypeOptions}
                                    placeholder="اختر النوع..."
                                    className={cn("h-9", !constructionTypeId && showValidationErrors && "border-destructive")}
                                />
                            </div>
                        ) : (
                            <div className="grid gap-1.5">
                                <Label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                                    <Briefcase className="h-3 w-3 text-primary" /> المعاملات المكتبية المرتبطة
                                </Label>
                                <MultiSelect
                                    options={allTransactionTypes}
                                    selected={selectedTransactionTypes}
                                    onChange={setSelectedTransactionTypes}
                                    placeholder="اختر أنواع العمل..."
                                    className={cn(selectedTransactionTypes.length === 0 && showValidationErrors && "border-destructive")}
                                />
                            </div>
                        )}

                        <div className="md:col-span-2 grid gap-1.5">
                            <Label className="text-[11px] font-bold text-muted-foreground">وصف النموذج (اختياري)</Label>
                            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="شرح موجز..." className="h-9 text-xs" />
                        </div>
                    </div>

                    {/* Scope of Work */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <ShoppingCart className={cn("h-4 w-4", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} /> 
                                نطاق العمل (Scope of Work)
                            </h3>
                            <Button size="sm" variant="outline" onClick={addScopeItem} className="h-7 gap-1 text-[10px] font-bold">
                                <PlusCircle className="h-3 w-3 ml-1"/> إضافة بند
                            </Button>
                        </div>
                        <div className="grid gap-3">
                            {scopeOfWork.map((item, index) => (
                                <div key={item.id} className="relative p-3 border rounded-lg bg-card shadow-sm group">
                                    <div className="absolute left-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => removeScopeItem(item.id)} className="h-6 w-6 text-destructive rounded-full hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5"/></Button>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="font-mono text-[9px] h-4 px-1">{index + 1}</Badge>
                                            <Input placeholder="عنوان البند" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} className="h-7 border-none font-bold shadow-none focus-visible:ring-0 p-0 text-sm" />
                                        </div>
                                        <Textarea placeholder="وصف الأعمال..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={1} className="text-[11px] min-h-[40px] resize-none border-none p-0 shadow-none focus-visible:ring-0 leading-relaxed" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financials */}
                    <div className={cn(
                        "p-4 border rounded-xl",
                        templateType === 'Consulting' ? "bg-primary/5 border-primary/10" : "bg-amber-600/5 border-amber-600/10"
                    )}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={cn("text-sm font-bold flex items-center gap-2", templateType === 'Consulting' ? "text-primary" : "text-amber-600")}>
                                <Calculator className="h-4 w-4" /> الدفعات المالية (Milestones)
                            </h3>
                            <Button size="sm" onClick={addMilestone} className="h-7 text-[10px] font-bold px-3">
                                <PlusCircle className="h-3 w-3 ml-1"/> إضافة دفعة
                            </Button>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold opacity-60">نوع العقد المالي</Label>
                                <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                    <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">قيمة ثابتة (بالدينار)</SelectItem>
                                        <SelectItem value="percentage">نسبة مئوية (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1">
                                <Label className="text-[10px] font-bold opacity-60">إجمالي الميزانية (للتحقق)</Label>
                                <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="h-8 text-xs font-bold bg-background" />
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {financials.milestones.map((m, i) => (
                                <div key={m.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-background border rounded-lg shadow-sm">
                                    <div className="col-span-3">
                                        <Input value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="h-7 text-[11px] font-bold border-none shadow-none focus-visible:ring-0 p-0" />
                                    </div>
                                    <div className="col-span-5">
                                        <InlineSearchList 
                                            value={m.condition || ''}
                                            onSelect={v => updateMilestone(m.id, 'condition', v)}
                                            options={conditionOptions}
                                            placeholder={loadingStages ? "تحميل..." : "شرط الاستحقاق..."}
                                            disabled={loadingStages || (templateType === 'Execution' && !constructionTypeId)}
                                            className="h-7 text-[10px] bg-muted/30 border-none px-2"
                                        />
                                    </div>
                                    <div className="col-span-3 flex items-center gap-1.5">
                                        <Input 
                                            type="number" 
                                            value={m.value} 
                                            onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} 
                                            className="h-7 text-xs font-black text-center w-16" 
                                        />
                                        <span className="text-[9px] font-black opacity-50">{financials.type === 'fixed' ? 'KD' : '%'}</span>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => removeMilestone(m.id)} className="h-6 w-6 text-destructive rounded-full"><Trash2 className="h-3 w-3"/></Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {financials.milestones.length > 0 && (
                            <div className="flex justify-between items-center px-2 py-2 mt-3 border-t border-dashed border-muted-foreground/20">
                                <span className="text-[10px] font-bold opacity-60">إجمالي التوزيع:</span>
                                <Badge variant={cn(
                                    (financials.type === 'percentage' && totalMilestoneValue !== 100) || 
                                    (financials.type === 'fixed' && financials.totalAmount > 0 && Math.abs(totalMilestoneValue - financials.totalAmount) > 0.001)
                                    ? "destructive" : "secondary"
                                )} className="font-mono text-[11px] px-2 h-5">
                                    {totalMilestoneValue} {financials.type === 'fixed' ? 'KD' : '%'}
                                </Badge>
                            </div>
                        )}
                    </div>

                    {/* Legal Terms */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <ShieldCheck className={cn("h-4 w-4", templateType === 'Consulting' ? "text-primary" : "text-amber-600")} /> 
                                المواد القانونية والشروط
                            </h3>
                            <Button size="sm" variant="outline" onClick={addTerm} className="h-7 gap-1 text-[10px] font-bold">
                                <PlusCircle className="h-3.5 w-3.5 ml-1"/> إضافة مادة
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex items-start gap-2 group">
                                    <div className="mt-1 h-5 w-5 rounded bg-muted flex items-center justify-center text-[9px] font-black shrink-0">{index + 1}</div>
                                    <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={1} className="flex-grow text-[11px] leading-relaxed resize-none shadow-none min-h-[38px] p-2" placeholder="نص المادة القانونية..."/>
                                    <Button variant="ghost" size="icon" onClick={() => removeTerm(term.id)} className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 rounded-full transition-opacity"><Trash2 className="h-3.5 w-3.5"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t bg-card mt-auto flex-shrink-0">
              <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-10 px-6 text-xs font-bold">إلغاء</Button>
              <Button 
                onClick={handleSave} 
                disabled={isSaving} 
                className={cn(
                    "h-10 px-10 text-sm font-black min-w-[160px] shadow-lg",
                    templateType === 'Consulting' ? "bg-primary" : "bg-amber-600 hover:bg-amber-700"
                )}
              >
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {template ? 'حفظ التعديلات' : 'اعتماد القالب'}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
