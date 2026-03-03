
/**
 * @fileOverview نموذج إنشاء وتعديل قوالب العقود (استشارات ومقاولات).
 * يتميز بتصميم مكثف (Compact UI) وفصل بصري كامل بين الأقسام.
 */

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

  // جلب البيانات المرجعية للمقاولات
  const { data: constructionTypes, loading: typesLoading } = useSubscription<ConstructionType>(firestore, 'construction_types', useMemo(() => [orderBy('name')], []));
  const [constructionStages, setConstructionStages] = useState<MultiSelectOption[]>([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // تعريف خيارات أنواع المقاولات للقائمة المنسدلة
  const constructionTypeOptions = useMemo(() => 
    constructionTypes.map(t => ({ value: t.id!, label: t.name })),
    [constructionTypes]
  );

  // دالة جلب مراحل المقاولات بناءً على النوع المختار
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

  // جلب أنواع المعاملات المكتبية ومراحل العمل
  useEffect(() => {
    const fetchRefData = async () => {
      if (!firestore) return;
      setLoadingRefData(true);
      try {
        const types: MultiSelectOption[] = [];
        const transTypesSnapshot = await getDocs(query(collection(firestore, 'transactionTypes')));
        transTypesSnapshot.forEach(doc => {
            const name = doc.data().name;
            if (name) types.push({ value: name, label: name });
        });
        setAllTransactionTypes(types.sort((a,b) => a.label.localeCompare(b.label, 'ar')));
        
        const officeStagesSnapshot = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const uniqueStages = new Map<string, MultiSelectOption>();
        officeStagesSnapshot.forEach(doc => {
          const name = doc.data().name;
          if (name && !uniqueStages.has(name)) uniqueStages.set(name, { value: name, label: name });
        });
        setAllWorkStages(Array.from(uniqueStages.values()).sort((a,b) => a.label.localeCompare(b.label, 'ar')));
      } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في جلب البيانات' });
      } finally {
        setLoadingRefData(false);
      }
    };
    if (isOpen) fetchRefData();
  }, [firestore, toast, isOpen]);
  
  useEffect(() => {
    if (template && isOpen) {
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

  // تحديد خيارات شروط الدفع بناءً على المسار (ميداني أم مكتبي)
  const conditionOptions = useMemo(() => {
    return templateType === 'Execution' ? constructionStages : allWorkStages;
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
        errors.push("يجب إضافة دفعة مالية واحدة على الأقل.");
    } else {
        if (financials.type === 'percentage' && totalMilestoneValue !== 100) {
            errors.push(`إجمالي نسب الدفعات يجب أن يكون 100% (الحالي: ${totalMilestoneValue}%).`);
        } else if (financials.type === 'fixed' && financials.totalAmount > 0 && Math.abs(totalMilestoneValue - financials.totalAmount) > 0.001) {
            errors.push(`إجمالي مبالغ الدفعات (${formatCurrency(totalMilestoneValue)}) يجب أن يساوي إجمالي العقد (${formatCurrency(financials.totalAmount)}).`);
        }
    }
    if (templateType === 'Execution' && !constructionTypeId) errors.push("يجب اختيار نوع المقاولات.");
    if (templateType === 'Consulting' && selectedTransactionTypes.length === 0) errors.push("يجب اختيار نوع معاملة واحد على الأقل.");
    return errors;
  }, [title, financials, totalMilestoneValue, templateType, constructionTypeId, selectedTransactionTypes]);

  const handleSave = async () => {
    if (!firestore || !user) return;
    if (validationErrors.length > 0) {
        setShowValidationErrors(true);
        toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'يرجى مراجعة التنبيهات.' });
        return;
    }

    setIsSaving(true);
    try {
        const templateData = {
            title, description, templateType,
            constructionTypeId: templateType === 'Execution' ? constructionTypeId : null,
            transactionTypes: templateType === 'Consulting' ? selectedTransactionTypes : [],
            scopeOfWork, termsAndConditions, financials, openClauses,
            createdAt: template?.createdAt || serverTimestamp(),
            createdBy: template?.createdBy || user.id,
        };
        
        if (template?.id) {
            await updateDoc(doc(firestore, 'contractTemplates', template.id), cleanFirestoreData(templateData));
        } else {
            await addDoc(collection(firestore, 'contractTemplates'), cleanFirestoreData(templateData));
        }
        onSaveSuccess();
        onClose();
        toast({ title: 'نجاح', description: 'تم حفظ القالب بنجاح.' });
    } catch(e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent dir="rtl" className="max-w-5xl h-[95vh] flex flex-col p-0 rounded-xl overflow-hidden shadow-2xl">
            <DialogHeader className={cn("p-4 border-b bg-card", templateType === 'Consulting' ? "border-primary/20" : "border-amber-600/20")}>
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", templateType === 'Consulting' ? "bg-primary text-white" : "bg-amber-600 text-white")}>
                        {templateType === 'Execution' ? <Construction className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
                    </div>
                    <div>
                        <DialogTitle className="text-lg font-black">{template ? 'تعديل' : 'إنشاء'} قالب {templateType === 'Execution' ? 'عقد مقاولات' : 'عقد استشارات'}</DialogTitle>
                        <DialogDescription className="text-[10px]">برمجة بنود العقد وشروط استحقاق الدفعات.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>

            <ScrollArea className="flex-grow bg-muted/5">
                <div className="p-5 space-y-6 pb-20">
                    {showValidationErrors && validationErrors.length > 0 && (
                        <Alert variant="destructive" className="rounded-xl border-2 py-2"><AlertTriangle className="h-4 w-4" /><AlertTitle className="text-xs font-bold">تنبيه بالبيانات الناقصة</AlertTitle><AlertDescription><ul className="list-disc pr-4 text-[10px]">{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul></AlertDescription></Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-card">
                        <div className="grid gap-1"><Label className="text-[11px] font-bold opacity-60">عنوان النموذج *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم القالب..." className="h-9 text-sm" /></div>
                        {templateType === 'Execution' ? (
                            <div className="grid gap-1"><Label className="text-[11px] font-bold opacity-60">نوع المقاولات المرتبط</Label><InlineSearchList value={constructionTypeId} onSelect={setConstructionTypeId} options={constructionTypeOptions} placeholder="اختر النوع..." className="h-9"/></div>
                        ) : (
                            <div className="grid gap-1"><Label className="text-[11px] font-bold opacity-60">المعاملات المرتبطة</Label><MultiSelect options={allTransactionTypes} selected={selectedTransactionTypes} onChange={setSelectedTransactionTypes} placeholder="اختر أنواع العمل..." className="h-9"/></div>
                        )}
                    </div>

                    <div className={cn("p-4 border rounded-xl bg-card", templateType === 'Consulting' ? "border-primary/10" : "border-amber-600/10")}>
                        <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-black flex items-center gap-2"><Calculator className="h-4 w-4" /> الدفعات المالية</h3><Button size="sm" variant="outline" onClick={addMilestone} className="h-7 text-[10px] font-bold"><PlusCircle className="h-3 w-3 ml-1"/> إضافة دفعة</Button></div>
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                            <div className="grid gap-1"><Label className="text-[10px] font-bold opacity-60">نوع العقد المالي</Label><Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">قيمة ثابتة</SelectItem><SelectItem value="percentage">نسبة مئوية</SelectItem></SelectContent></Select></div>
                            <div className="grid gap-1"><Label className="text-[10px] font-bold opacity-60">إجمالي المبلغ (للتحقق)</Label><Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="h-8 text-xs font-bold" /></div>
                        </div>
                        <div className="space-y-2">
                            {financials.milestones.map((m, i) => (
                                <div key={m.id} className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg bg-muted/10">
                                    <Input value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="col-span-3 h-7 text-[11px] font-bold border-none" />
                                    <div className="col-span-5"><InlineSearchList value={m.condition || ''} onSelect={v => updateMilestone(m.id, 'condition', v)} options={conditionOptions} placeholder="شرط الاستحقاق..." className="h-7 text-[10px]"/></div>
                                    <div className="col-span-3 flex items-center gap-1"><Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="h-7 text-xs text-center"/><span className="text-[9px] font-bold">{financials.type === 'fixed' ? 'KD' : '%'}</span></div>
                                    <Button variant="ghost" size="icon" onClick={() => removeMilestone(m.id)} className="col-span-1 h-6 w-6 text-destructive"><Trash2 className="h-3 w-3"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1"><h3 className="text-sm font-black flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> الشروط القانونية</h3><Button size="sm" variant="outline" onClick={addTerm} className="h-7 text-[10px] font-bold"><PlusCircle className="h-3.5 w-3.5 ml-1"/> إضافة مادة</Button></div>
                        <div className="space-y-2">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex items-start gap-2 group">
                                    <Badge variant="secondary" className="mt-1 h-5 w-5 rounded flex items-center justify-center text-[9px] font-black">{index + 1}</Badge>
                                    <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={1} className="flex-grow text-[11px] min-h-[38px]" placeholder="نص المادة..."/>
                                    <Button variant="ghost" size="icon" onClick={() => removeTerm(term.id)} className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5"/></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t bg-card flex-shrink-0">
              <Button variant="ghost" onClick={onClose} disabled={isSaving} className="h-9 text-xs">إلغاء</Button>
              <Button onClick={handleSave} disabled={isSaving} className="h-9 px-10 text-sm font-black shadow-lg">
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                حفظ القالب
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
