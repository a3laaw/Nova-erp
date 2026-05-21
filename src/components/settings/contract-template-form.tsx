'use client';

import { useState, useEffect, useMemo } from 'react';
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
  FileSignature,
  Sparkles,
  Layers,
  Workflow,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, addDoc, updateDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import type { ContractTemplate, TransactionType, SubService, WorkStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { InlineSearchList } from '../ui/inline-search-list';
import { Separator } from '../ui/separator';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

interface ContractTemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
  template: ContractTemplate | null;
  initialType: 'Consulting' | 'Execution';
}

export function ContractTemplateForm({ isOpen, onClose, onSaveSuccess, template, initialType }: ContractTemplateFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateType] = useState<'Consulting' | 'Execution'>(template?.templateType || initialType);
  const [workNature, setWorkNature] = useState<'labor_only' | 'with_materials'>(template?.workNature || 'labor_only');
  
  const [selectedTransactionTypeId, setSelectedTransactionTypeId] = useState(template?.transactionTypeId || '');
  const [selectedSubServiceId, setSelectedSubServiceId] = useState(template?.subServiceId || '');
  const [subServices, setSubServices] = useState<SubService[]>([]);
  const [specificWorkStages, setSpecificWorkStages] = useState<{ value: string, label: string }[]>([]);
  
  const [financials, setFinancials] = useState<any>({
    type: 'fixed',
    totalAmount: 0,
    milestones: [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingPath, setIsLoadingPath] = useState(false);

  const { data: transactionTypesData, loading: typesLoading } = useSubscription<TransactionType>(
      firestore, 
      tenantId ? 'transactionTypes' : null,
      [orderBy('order')]
  );

  const transactionTypeOptions = useMemo(() => 
    transactionTypesData.map(t => ({ value: t.id!, label: t.name }))
  , [transactionTypesData]);

  useEffect(() => {
    if (!selectedTransactionTypeId || !firestore || !tenantId) {
        setSubServices([]);
        return;
    }
    const fetchSubServices = async () => {
        setIsLoadingPath(true);
        try {
            const subsPath = getTenantPath(`transactionTypes/${selectedTransactionTypeId}/subServices`, tenantId);
            const snap = await getDocs(query(collection(firestore, subsPath!), orderBy('order')));
            setSubServices(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubService)));
        } catch (e) {
            console.error("Error fetching sub-services:", e);
        } finally { setIsLoadingPath(false); }
    };
    fetchSubServices();
  }, [selectedTransactionTypeId, firestore, tenantId]);

  useEffect(() => {
    if (!selectedSubServiceId || !selectedTransactionTypeId || !firestore || !tenantId) {
        setSpecificWorkStages([]);
        return;
    }
    const fetchStages = async () => {
        try {
            const stagesPath = getTenantPath(`transactionTypes/${selectedTransactionTypeId}/subServices/${selectedSubServiceId}/workStages`, tenantId);
            const snap = await getDocs(query(collection(firestore, stagesPath!), orderBy('order')));
            setSpecificWorkStages(snap.docs.map(d => ({ value: d.data().name, label: d.data().name })));
        } catch (e) { console.error(e); }
    };
    fetchStages();
  }, [selectedSubServiceId, selectedTransactionTypeId, firestore, tenantId]);

  useEffect(() => {
    if (template && isOpen) {
        setTitle(template.title);
        setDescription(template.description || '');
        setFinancials(template.financials || { type: 'fixed', totalAmount: 0, milestones: [] });
        setWorkNature(template.workNature || 'labor_only');
        setSelectedTransactionTypeId(template.transactionTypeId || '');
        setSelectedSubServiceId(template.subServiceId || '');
    }
  }, [template, isOpen]);

  const addMilestone = () => {
    setFinancials((prev: any) => ({
      ...prev,
      milestones: [...prev.milestones, { id: generateId(), name: `الدفعة ${arabicOrdinals[prev.milestones.length] || ''}`, condition: '', value: 0 }]
    }));
  };

  const totalCalculated = useMemo(() => {
    return financials.milestones.reduce((sum: number, m: any) => sum + (Number(m.value) || 0), 0);
  }, [financials.milestones]);

  useEffect(() => {
    if (financials.type === 'fixed') {
        setFinancials((prev: any) => ({ ...prev, totalAmount: totalCalculated }));
    }
  }, [totalCalculated, financials.type]);

  const handleSave = async () => {
    if (!firestore || !currentUser || !tenantId || !title.trim()) return;
    setIsSaving(true);
    try {
        const payload = {
            title, description, templateType, workNature,
            transactionTypeId: selectedTransactionTypeId,
            subServiceId: selectedSubServiceId,
            financials,
            updatedAt: serverTimestamp(),
            companyId: tenantId
        };

        const templatesPath = getTenantPath('contractTemplates', tenantId);
        if (template?.id) await updateDoc(doc(firestore, templatesPath!, template.id), cleanFirestoreData(payload));
        else await addDoc(collection(firestore, templatesPath!), cleanFirestoreData({ ...payload, createdAt: serverTimestamp() }));
        
        onSaveSuccess(); onClose();
        toast({ title: 'نجاح الحفظ', description: 'تم تحديث القالب المرجعي للمنظومة.' });
    } catch(e) { toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent dir="rtl" className="max-w-5xl h-[90vh] flex flex-col p-0 rounded-2xl border-none shadow-2xl overflow-hidden bg-white">
            <DialogHeader className={cn("p-8 border-b text-white shrink-0 no-print", templateType === 'Consulting' ? "bg-primary" : "bg-amber-600")}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-right">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            <FileSignature className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-white">{template ? 'تعديل' : 'إنشاء'} قالب عقد {templateType === 'Execution' ? 'مقاولات' : 'استشارات'}</DialogTitle>
                            <DialogDescription className="text-white/60 font-bold">تحديد بنود الصرف وشروط الاستحقاق الميدانية الموحدة.</DialogDescription>
                        </div>
                    </div>
                </div>
            </DialogHeader>

            <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-8 space-y-10">
                    <section className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="grid gap-3">
                                <Label className="font-black text-xs uppercase text-slate-400 tracking-widest pr-1 no-print">عنوان القالب المرجعي *</Label>
                                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد هيكل أسود مصنعية..." className="h-12 rounded-xl text-lg font-bold border-2" />
                            </div>
                            <div className="grid gap-3">
                                <Label className="font-black text-xs uppercase text-slate-400 tracking-widest pr-1 no-print">نوع المعاملة الرئيسية</Label>
                                <InlineSearchList 
                                    value={selectedTransactionTypeId} 
                                    onSelect={v => { setSelectedTransactionTypeId(v); setSelectedSubServiceId(''); }} 
                                    options={transactionTypeOptions} 
                                    placeholder={typesLoading ? "جاري التحميل..." : "اختر الخدمة الرئيسية..."} 
                                    disabled={typesLoading}
                                />
                            </div>
                        </div>

                        {selectedTransactionTypeId && (
                            <div className="grid md:grid-cols-2 gap-8 animate-in slide-in-from-top-2">
                                <div className="grid gap-3">
                                    <Label className="font-black text-xs uppercase text-primary tracking-widest pr-1 flex items-center gap-2 no-print">
                                        <Layers className="h-4 w-4" /> نوع الخدمة التفصيلي *
                                    </Label>
                                    <InlineSearchList 
                                        value={selectedSubServiceId} 
                                        onSelect={setSelectedSubServiceId} 
                                        options={subServices.map(s => ({ value: s.id!, label: s.name }))} 
                                        placeholder={isLoadingPath ? "جاري التحميل..." : "اختر التفصيل الفرعي..."} 
                                        className="rounded-xl border-primary/20 bg-primary/5 font-black text-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </section>

                    <Separator className="opacity-10 no-print" />

                    <section className="space-y-6">
                        <div className="flex justify-between items-center no-print">
                            <h3 className="text-xl font-black flex items-center gap-3 text-[#1e1b4b]">
                                <Calculator className="h-6 w-6 text-primary"/> الدفعات المالية المبرمجة
                            </h3>
                            <Button onClick={addMilestone} variant="outline" className="rounded-xl border-dashed border-2 border-primary/40 text-primary font-black gap-2 h-11 px-6 hover:bg-primary/5">
                                <PlusCircle className="h-4 w-4"/> إضافة دفعة +
                            </Button>
                        </div>
                        
                        {!selectedSubServiceId ? (
                            <div className="p-10 border-4 border-dashed rounded-[2.5rem] bg-muted/5 flex flex-col items-center justify-center text-center gap-3 opacity-40 no-print">
                                <AlertTriangle className="h-10 w-10 text-slate-400" />
                                <p className="font-black text-lg">يرجى اختيار نوع الخدمة التفصيلي أولاً لتمكين ربط الدفعات.</p>
                            </div>
                        ) : (
                            <>
                                <div className="grid md:grid-cols-2 gap-6 bg-white/60 p-6 rounded-3xl border-2 border-primary/10 shadow-inner mb-6 no-print">
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">نظام التسعير</Label>
                                        <Select value={financials.type} onValueChange={(v: any) => setFinancials({...financials, type: v, milestones: []})}>
                                            <SelectTrigger className="h-11 rounded-xl border-2 font-black bg-white text-primary"><SelectValue /></SelectTrigger>
                                            <SelectContent dir="rtl">
                                                <SelectItem value="fixed">مبلغ ثابت (KWD)</SelectItem>
                                                <SelectItem value="percentage">نسب مئوية (%)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-[10px] font-black uppercase text-slate-400">إجمالي قيمة العقد المعتمدة</Label>
                                        <Input 
                                            type="number" 
                                            value={financials.totalAmount} 
                                            readOnly={financials.type === 'fixed'}
                                            onChange={e => setFinancials({...financials, totalAmount: Number(e.target.value)})} 
                                            className={cn("h-11 rounded-xl font-black text-xl text-primary border-2", financials.type === 'fixed' ? "bg-muted/50" : "bg-white")} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {financials.milestones.map((m: any, i: number) => (
                                        <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-5 border-2 rounded-2xl bg-white hover:border-primary/30 transition-all group shadow-sm">
                                            <div className="md:col-span-1 flex justify-center">
                                                <Badge variant="secondary" className="font-black text-xs px-4 h-8 rounded-full border-none shadow-sm bg-slate-50 text-slate-900">
                                                    الدفعة {arabicOrdinals[i] || (i + 1)}
                                                </Badge>
                                            </div>
                                            <div className="md:col-span-8">
                                                <Label className="text-[9px] font-black text-primary uppercase mb-1 block no-print">مرحلة الإنجاز الميداني</Label>
                                                <InlineSearchList 
                                                    value={m.condition} 
                                                    onSelect={v => setFinancials({...financials, milestones: financials.milestones.map((x: any) => x.id === m.id ? {...x, condition: v} : x)})} 
                                                    options={specificWorkStages} 
                                                    placeholder="اختر مرحلة..." 
                                                    className="h-10 border-dashed bg-primary/[0.02] border-primary/20 text-primary" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 flex flex-col items-center gap-1">
                                                <Label className="text-[9px] font-black text-slate-400 uppercase no-print">القيمة</Label>
                                                <Input type="number" value={m.value} onChange={e => setFinancials({...financials, milestones: financials.milestones.map((x: any) => x.id === m.id ? {...x, value: Number(e.target.value)} : x)})} className="h-10 w-24 text-center font-black text-primary text-lg border-2 rounded-lg" />
                                            </div>
                                            <div className="md:col-span-1 flex justify-end no-print">
                                                <Button variant="ghost" size="icon" onClick={() => setFinancials({...financials, milestones: financials.milestones.filter((x: any) => x.id !== m.id)})} className="text-red-400 hover:text-red-600 rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {financials.type === 'percentage' && totalCalculated !== 100 && financials.milestones.length > 0 && (
                                    <Alert variant="destructive" className="mt-4 rounded-2xl border-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle className="font-black">خلل في النسب المئوية</AlertTitle>
                                        <AlertDescription className="font-bold">مجموع النسب الحالية هو {totalCalculated}%؛ يجب أن يكون المجموع 100% بالضبط.</AlertDescription>
                                    </Alert>
                                )}
                            </>
                        )}
                    </section>
                </div>
            </ScrollArea>

            <DialogFooter className="p-8 border-t bg-muted/10 shrink-0 no-print">
                <Button variant="ghost" onClick={onClose} disabled={isSaving} className="font-bold h-12 px-8 rounded-xl">إلغاء</Button>
                <Button onClick={handleSave} disabled={isSaving || !title.trim() || !selectedSubServiceId || (financials.type === 'percentage' && totalCalculated !== 100)} className="h-14 px-20 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3 min-w-[320px]">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6"/> : <Save className="h-6 w-6"/>} حفظ القالب المرجعي
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}
