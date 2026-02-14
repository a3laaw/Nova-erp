
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, collectionGroup, orderBy } from 'firebase/firestore';
import type { ContractTemplate, ContractScopeItem, ContractTerm, ContractFinancialMilestone, Department, TransactionType, WorkStage } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, Trash2, ArrowUp, ArrowDown, Save, Loader2, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';


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

// --- Sub-component for Template Selection ---
function TemplateSelectionView({
  templates,
  onSelect,
  onContinueWithout,
}: {
  templates: ContractTemplate[];
  onSelect: (template: ContractTemplate) => void;
  onContinueWithout: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>اختر نموذج العقد</DialogTitle>
        <DialogDescription>
          تم العثور على عدة نماذج مرتبطة بنوع هذه المعاملة. الرجاء اختيار النموذج المناسب للبدء.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="block w-full text-right p-4 border rounded-lg hover:bg-accent transition-colors"
          >
            <p className="font-semibold">{t.title}</p>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onContinueWithout}>
          متابعة بدون نموذج (إنشاء يدوي)
        </Button>
      </DialogFooter>
    </>
  );
}

// --- NEW Sub-component for Transaction Selection ---
function TransactionTypeSelectionDialog({
  isOpen,
  onClose,
  allTypes,
  selectedTypes,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  allTypes: MultiSelectOption[];
  selectedTypes: string[];
  onSave: (newSelection: string[]) => void;
}) {
  const [currentSelection, setCurrentSelection] = useState<string[]>(selectedTypes);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCurrentSelection(selectedTypes);
      setSearchQuery('');
    }
  }, [isOpen, selectedTypes]);

  const handleCheckedChange = (checked: boolean, value: string) => {
    setCurrentSelection(prev => {
      if (checked) {
        return [...prev, value];
      } else {
        return prev.filter(item => item !== value);
      }
    });
  };

  const handleConfirm = () => {
    onSave(currentSelection);
    onClose();
  };

  const filteredTypes = useMemo(() => {
      if (!searchQuery) {
          return allTypes;
      }
      return allTypes.filter(type => 
          type.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [allTypes, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>اختر أنواع المعاملات</DialogTitle>
          <DialogDescription>
            حدد أنواع المعاملات التي يمكن استخدام هذا النموذج معها.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rtl:right-3 rtl:left-auto" />
            <Input
                placeholder="ابحث عن نوع معاملة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rtl:pr-10"
            />
        </div>
        <ScrollArea className="h-72 border rounded-md p-4">
          <div className="space-y-4">
            {filteredTypes.length > 0 ? (
                filteredTypes.map(type => (
                <div key={type.value} className="flex items-center space-x-2 rtl:space-x-reverse">
                    <Checkbox
                    id={`type-${type.value}`}
                    checked={currentSelection.includes(type.value)}
                    onCheckedChange={(checked) => handleCheckedChange(!!checked, type.value)}
                    />
                    <Label htmlFor={`type-${type.value}`} className="flex-1 cursor-pointer">
                    {type.label}
                    </Label>
                </div>
                ))
            ) : (
                <p className="text-center text-sm text-muted-foreground py-4">لا توجد نتائج مطابقة.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="button" onClick={handleConfirm}>حفظ الاختيارات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function ContractTemplateForm({ isOpen, onClose, onSaveSuccess, template, initialType }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<'Consulting' | 'Execution'>('Consulting');
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
  
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  
  useEffect(() => {
    const fetchRefData = async () => {
      if (!firestore) return;
      setLoadingRefData(true);
      try {
        const types: MultiSelectOption[] = [];
        const transTypesSnapshot = await getDocs(query(collectionGroup(firestore, 'transactionTypes')));
        const uniqueTypeNames = new Set<string>();
        transTypesSnapshot.forEach(typeDoc => {
            const typeName = typeDoc.data().name;
            if (typeName && !uniqueTypeNames.has(typeName)) {
                types.push({ value: typeName, label: typeName });
                uniqueTypeNames.add(typeName);
            }
        });
        setAllTransactionTypes(types.sort((a,b) => a.label.localeCompare(b.label, 'ar')));
        
        const stages: MultiSelectOption[] = [];
        const stagesSnapshot = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const uniqueStages = new Map<string, MultiSelectOption>();
        stagesSnapshot.forEach(stageDoc => {
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
        setSelectedTransactionTypes(template.transactionTypes || []);
        setScopeOfWork(template.scopeOfWork || []);
        setTermsAndConditions(template.termsAndConditions || []);
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses(template.openClauses || []);
    } else {
        setTitle('');
        setDescription('');
        setTemplateType(initialType || 'Consulting');
        setSelectedTransactionTypes([]);
        setScopeOfWork([]);
        setTermsAndConditions([]);
        setFinancials({ type: 'fixed', totalAmount: 0, discount: 0, milestones: [] });
        setOpenClauses([]);
    }
  }, [template, isOpen, initialType]);


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
            transactionTypes: selectedTransactionTypes,
            scopeOfWork,
            termsAndConditions,
            financials,
            openClauses,
            createdAt: template?.createdAt || serverTimestamp(),
            createdBy: template?.createdBy || user.id,
        };
        
        if (template?.id) {
            await updateDoc(doc(firestore, 'contractTemplates', template.id), templateData);
            toast({ title: 'نجاح', description: 'تم تحديث النموذج بنجاح.' });
        } else {
            await addDoc(collection(firestore, 'contractTemplates'), templateData);
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

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          dir="rtl"
          className="max-w-4xl h-[90vh]"
        >
            <DialogHeader>
                <DialogTitle>{template ? 'تعديل نموذج عقد' : 'إنشاء نموذج عقد جديد'}</DialogTitle>
                <DialogDescription>استخدم هذا النموذج لإنشاء قوالب عقود قابلة لإعادة الاستخدام.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[calc(90vh-150px)]">
                <div className="p-4 space-y-8">
                    <section className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">البيانات الأساسية</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="template-title">عنوان النموذج <span className="text-destructive">*</span></Label>
                                <Input id="template-title" value={title} onChange={e => setTitle(e.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="template-type">نوع النموذج</Label>
                                <Select value={templateType} onValueChange={(v) => setTemplateType(v as any)}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Consulting">استشاري</SelectItem>
                                        <SelectItem value="Execution">تنفيذ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="template-description">الوصف</Label>
                            <Textarea id="template-description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
                        </div>
                        <div className="grid gap-2">
                            <Label>ربط بأنواع المعاملات</Label>
                            <div className="p-3 border rounded-md min-h-[40px] bg-muted/50">
                                {selectedTransactionTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {selectedTransactionTypes.map(type => (
                                    <Badge key={type} variant="secondary">{type}</Badge>
                                    ))}
                                </div>
                                ) : (
                                <p className="text-sm text-muted-foreground">لم يتم اختيار أي نوع</p>
                                )}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsTypeSelectorOpen(true)}
                                disabled={loadingRefData}
                            >
                                تعديل أنواع المعاملات
                            </Button>
                        </div>
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">نطاق العمل (Scope of Work)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addScopeItem}><PlusCircle className="ml-2"/> إضافة بند</Button>
                        </div>
                        {scopeOfWork.map((item, index) => (
                            <div key={item.id} className="flex items-start gap-2 p-2 border rounded-md">
                               <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                               <div className="flex-grow space-y-2">
                                 <Input placeholder="عنوان البند" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} />
                                 <Textarea placeholder="وصف تفصيلي للبند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} />
                               </div>
                                <div className="flex flex-col">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'up')} disabled={index === 0}>
                                        <ArrowUp className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderScopeItem(index, 'down')} disabled={index === scopeOfWork.length - 1}>
                                        <ArrowDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button variant="ghost" size="icon" type="button" onClick={() => removeScopeItem(item.id)} className="shrink-0"><Trash2 className="text-destructive h-4 w-4"/></Button>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">الشروط والأحكام</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addTerm}><PlusCircle className="ml-2"/> إضافة شرط</Button>
                        </div>
                         {termsAndConditions.map((term, index) => (
                            <div key={term.id} className="flex items-center gap-2">
                               <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                               <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow"/>
                               <div className="flex flex-col">
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                                <Button variant="ghost" size="icon" type="button" onClick={() => reorderTerm(index, 'down')} disabled={index === termsAndConditions.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                               </div>
                               <Button variant="ghost" size="icon" type="button" onClick={() => removeTerm(term.id)}><Trash2 className="text-destructive h-4 w-4"/></Button>
                            </div>
                         ))}
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <h3 className="font-semibold">البنود المالية</h3>
                         <div className="grid md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>نوع العقد المالي</Label>
                                <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">قيمة ثابتة</SelectItem>
                                        <SelectItem value="percentage">نسبة مئوية</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>إجمالي قيمة العقد (د.ك)</Label>
                                <Input type="number" value={financials.totalAmount} onChange={e => setFinancials(p => ({...p, totalAmount: Number(e.target.value)}))} className="dir-ltr text-left" />
                            </div>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                             <h4 className="font-semibold">الدفعات المالية</h4>
                             <Button variant="outline" size="sm" type="button" onClick={addMilestone}><PlusCircle className="ml-2"/> إضافة دفعة</Button>
                        </div>
                        <div className="space-y-2">
                            {financials.milestones.map((m, i) => (
                                 <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                                    <Label className="col-span-3 font-semibold">{m.name}</Label>
                                    <Select value={m.condition || '_NONE_'} onValueChange={v => updateMilestone(m.id, 'condition', v === '_NONE_' ? '' : v)}>
                                        <SelectTrigger className="col-span-5">
                                            <SelectValue placeholder="اختر مرحلة العمل كشرط..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="_NONE_">بدون شرط</SelectItem>
                                            {allWorkStages.map(stage => <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <div className="col-span-3 flex items-center gap-1">
                                        <Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="dir-ltr text-left"/>
                                        <span className="text-sm">{financials.type === 'fixed' ? 'د.ك' : '%'}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" type="button" onClick={() => removeMilestone(m.id)} className="col-span-1"><Trash2 className="text-destructive h-4 w-4"/></Button>
                                 </div>
                            ))}
                        </div>
                         {financials.milestones.length > 0 && (
                            <div className="border-t pt-2 mt-2 space-y-1">
                                <div className="flex justify-between font-semibold">
                                    <span>مجموع الدفعات:</span>
                                    <span className="font-mono">{financials.type === 'fixed' ? formatCurrency(totalMilestoneValue) : `${totalMilestoneValue}%`}</span>
                                </div>
                                {financials.type === 'percentage' && totalMilestoneValue !== 100 && <p className="text-destructive text-xs text-center">تحذير: مجموع النسب لا يساوي 100%</p>}
                                 {financials.type === 'fixed' && totalMilestoneValue !== financials.totalAmount && <p className="text-destructive text-xs text-center">تحذير: مجموع الدفعات لا يساوي إجمالي قيمة العقد</p>}
                            </div>
                         )}
                    </section>

                    <section className="space-y-4 p-4 border rounded-lg">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">بنود إضافية (اختياري)</h3>
                            <Button size="sm" variant="outline" type="button" onClick={addOpenClause}><PlusCircle className="ml-2"/> إضافة بند</Button>
                        </div>
                        <div className='space-y-2'>
                            {openClauses.map((clause, index) => (
                                <div key={clause.id} className="flex items-center gap-2">
                                   <span className="pt-2 font-semibold">{arabicOrdinals[index] || `${index + 1}-`}</span>
                                   <Textarea value={clause.text} onChange={(e) => updateOpenClause(clause.id, e.target.value)} rows={2} className="flex-grow" placeholder={`نص البند الإضافي ${index + 1}`}/>
                                   <div className="flex flex-col">
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => reorderOpenClause(index, 'down')} disabled={index === openClauses.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                                   </div>
                                   <Button variant="ghost" size="icon" type="button" onClick={() => removeOpenClause(clause.id)}><Trash2 className="text-destructive h-4 w-4"/></Button>
                                </div>
                            ))}
                        </div>
                    </section>

                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>إلغاء</Button>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                {template ? 'حفظ التعديلات' : 'إنشاء النموذج'}
              </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <TransactionTypeSelectionDialog
        isOpen={isTypeSelectorOpen}
        onClose={() => setIsTypeSelectorOpen(false)}
        allTypes={allTransactionTypes}
        selectedTypes={selectedTransactionTypes}
        onSave={setSelectedTransactionTypes}
      />
    </>
  )
}
