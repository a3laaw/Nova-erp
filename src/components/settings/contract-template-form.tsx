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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { 
  PlusCircle, 
  Trash2, 
  Save, 
  Loader2, 
  Calculator,
  FileText,
  Briefcase,
  Construction,
  ShieldCheck,
  AlertTriangle,
  FileSignature
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
  const [workNature, setWorkNature] = useState<'labor_only' | 'with_materials'>(template?.workNature || 'labor_only');
  
  const [constructionTypeId, setConstructionTypeId] = useState('');
  const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<string[]>([]);
  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<ContractTerm[]>([]);
  const [financials, setFinancials] = useState<ContractTemplate['financials']>({
    type: 'fixed',
    totalAmount: 0,
    milestones: [],
  });

  const [allTransactionTypes, setAllTransactionTypes] = useState<MultiSelectOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // جلب البيانات المرجعية للمقاولات
  const { data: constructionTypes } = useSubscription<ConstructionType>(firestore, 'construction_types', useMemo(() => [orderBy('name')], []));
  const [constructionStages, setConstructionStages] = useState<MultiSelectOption[]>([]);
  const [allWorkStages, setAllWorkStages] = useState<MultiSelectOption[]>([]);

  const constructionTypeOptions = useMemo(() => constructionTypes.map(t => ({ value: t.id!, label: t.name })), [constructionTypes]);

  useEffect(() => {
    if (!firestore || !isOpen) return;
    const fetchRefs = async () => {
        try {
            const typesSnap = await getDocs(query(collection(firestore, 'transactionTypes'), orderBy('name')));
            setAllTransactionTypes(typesSnap.docs.map(d => ({ value: d.data().name, label: d.data().name })));

            const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages'), orderBy('order')));
            const uniqueStages = new Map();
            stagesSnap.forEach(d => {
                const name = d.data().name;
                if (name) uniqueStages.set(name, { value: name, label: name });
            });
            setAllWorkStages(Array.from(uniqueStages.values()));
        } catch (e) { console.error(e); }
    };
    fetchRefs();
  }, [firestore, isOpen]);

  useEffect(() => {
    if (templateType === 'Execution' && constructionTypeId && firestore) {
        getDocs(query(collection(firestore, `construction_types/${constructionTypeId}/stages`), orderBy('order'))).then(snap => {
            setConstructionStages(snap.docs.map(d => ({ value: d.data().name, label: d.data().name })));
        });
    }
  }, [constructionTypeId, firestore, templateType]);

  useEffect(() => {
    if (template && isOpen) {
        setTitle(template.title);
        setDescription(template.description || '');
        setConstructionTypeId(template.constructionTypeId || '');
        setSelectedTransactionTypes(template.transactionTypes || []);
        setTermsAndConditions(template.termsAndConditions || []);
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, milestones: [] });
        setWorkNature(template.workNature || 'labor_only');
    }
  }, [template, isOpen]);

  const conditionOptions = useMemo(() => templateType === 'Execution' ? constructionStages : allWorkStages, [templateType, constructionStages, allWorkStages]);

  const addMilestone = () => {
    setFinancials(prev => ({
      ...prev,
      milestones: [...prev.milestones, { id: generateId(), name: `الدفعة ${milestoneNames[prev.milestones.length] || ''}`, condition: '', value: 0 }]
    }));
  };

  const handleSave = async () => {
    if (!firestore || !user || !title.trim()) return;
    setIsSaving(true);
    try {
        const payload = {
            title, description, templateType, workNature,
            constructionTypeId: templateType === 'Execution' ? constructionTypeId : null,
            transactionTypes: templateType === 'Consulting' ? selectedTransactionTypes : [],
            termsAndConditions, financials,
            updatedAt: serverTimestamp(),
            companyId: user.currentCompanyId
        };
        if (template?.id) await updateDoc(doc(firestore, 'contractTemplates', template.id), cleanFirestoreData(payload));
        else await addDoc(collection(firestore, 'contractTemplates'), cleanFirestoreData({ ...payload, createdAt: serverTimestamp() }));
        onSaveSuccess(); onClose();
        toast({ title: 'نجاح الحفظ' });
    } catch(e) { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent dir="rtl" className="max-w-5xl h-[90vh] flex flex-col p-0 rounded-2xl border-none shadow-2xl overflow-hidden">
            <DialogHeader className={cn("p-6 border-b text-white", templateType === 'Consulting' ? "bg-primary" : "bg-amber-600")}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <FileSignature className="h-10 w-10 opacity-40" />
                        <div>
                            <DialogTitle className="text-2xl font-black">{template ? 'تعديل' : 'إنشاء'} قالب عقد {templateType === 'Execution' ? 'مقاولات' : 'استشارات'}</DialogTitle>
                            <DialogDescription className="text-white/60 font-bold">تحديد بنود الصرف وشروط الاستحقاق الميدانية الموحدة.</DialogDescription>
                        </div>
                    </div>
                </div>
            </DialogHeader>

            <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-8 space-y-10">
                    <section className="grid md:grid-cols-2 gap-8">
                        <div className="grid gap-2"><Label className="font-black text-gray-700 pr-1">عنوان القالب *</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد هيكل أسود مصنعية..." className="h-12 rounded-xl text-lg font-bold" /></div>
                        {templateType === 'Execution' ? (
                            <div className="grid gap-2"><Label className="font-black text-gray-700 pr-1">نوع المقاولات المرتبط</Label><InlineSearchList value={constructionTypeId} onSelect={setConstructionTypeId} options={constructionTypeOptions} placeholder="اختر النوع..." className="h-12" /></div>
                        ) : (
                            <div className="grid gap-2"><Label className="font-black text-gray-700 pr-1">المعاملات المرتبطة</Label><MultiSelect options={allTransactionTypes} selected={selectedTransactionTypes} onChange={setSelectedTransactionTypes} placeholder="اختر أنواع العمل..." /></div>
                        )}
                    </section>

                    <section className="space-y-6">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-black flex items-center gap-2"><Calculator className="h-6 w-6 text-primary"/> الدفعات المالية المبرمجة</h3><Button onClick={addMilestone} variant="outline" className="rounded-xl border-dashed border-2 font-bold gap-2"><PlusCircle className="h-4 w-4"/> إضافة دفعة</Button></div>
                        <div className="grid md:grid-cols-2 gap-6 bg-white p-6 rounded-3xl border-2 border-primary/10 shadow-sm">
                            <div className="grid gap-2"><Label className="text-xs font-bold opacity-60">نظام التسعير</Label><Select value={financials.type} onValueChange={(v: any) => setFinancials({...financials, type: v, milestones: []})}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">مبلغ ثابت</SelectItem><SelectItem value="percentage">نسب مئوية</SelectItem></SelectContent></Select></div>
                            <div className="grid gap-2"><Label className="text-xs font-bold opacity-60">إجمالي المبلغ (للتحقق)</Label><Input type="number" value={financials.totalAmount} onChange={e => setFinancials({...financials, totalAmount: Number(e.target.value)})} className="h-11 rounded-xl font-black text-xl text-primary" /></div>
                        </div>
                        <div className="space-y-4">
                            {financials.milestones.map((m, i) => (
                                <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 border-2 rounded-2xl bg-white hover:border-primary/30 transition-all group">
                                    <div className="md:col-span-3"><Input value={m.name} onChange={e => setFinancials({...financials, milestones: financials.milestones.map(x => x.id === m.id ? {...x, name: e.target.value} : x)})} className="h-10 border-none font-bold text-base shadow-none" /></div>
                                    <div className="md:col-span-6"><InlineSearchList value={m.condition} onSelect={v => setFinancials({...financials, milestones: financials.milestones.map(x => x.id === m.id ? {...x, condition: v} : x)})} options={conditionOptions} placeholder="اربط بمرحلة إنجاز..." className="h-10 border-dashed" /></div>
                                    <div className="md:col-span-2 flex items-center gap-2"><Input type="number" value={m.value} onChange={e => setFinancials({...financials, milestones: financials.milestones.map(x => x.id === m.id ? {...x, value: Number(e.target.value)} : x)})} className="h-10 text-center font-black text-primary text-lg" /><span className="font-bold text-muted-foreground">{financials.type === 'fixed' ? 'د.ك' : '%'}</span></div>
                                    <div className="md:col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" onClick={() => setFinancials({...financials, milestones: financials.milestones.filter(x => x.id !== m.id)})} className="text-destructive"><Trash2 className="h-5 w-5"/></Button></div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </ScrollArea>

            <DialogFooter className="p-8 border-t bg-muted/10">
                <Button variant="ghost" onClick={onClose} disabled={isSaving} className="font-bold">إلغاء</Button>
                <Button onClick={handleSave} disabled={isSaving || !title} className="h-14 px-20 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6"/>} حفظ القالب المرجعي
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
