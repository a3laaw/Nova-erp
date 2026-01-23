'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid'; // Assuming uuid is available, or use a simpler unique id generator

import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '../ui/inline-search-list';
import { Logo } from '@/components/layout/logo';
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowRight, PlusCircle, Trash2, ArrowUp, ArrowDown, Save, Loader2 } from 'lucide-react';
import type { Company, Client, Contract, ContractScopeItem, ContractTerm, ContractFinancialMilestone } from '@/lib/types';

// Helper to generate unique IDs for list items
const generateId = () => Math.random().toString(36).substring(2, 9);


export function ContractForm({ clients, company }: { clients: Client[], company: Company | null }) {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  // States for each section of the contract
  const [title, setTitle] = useState('اتفاقية تصميم هندسي');
  const [contractDate, setContractDate] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<ContractTerm[]>([]);
  
  const [financials, setFinancials] = useState<{
    type: 'fixed' | 'percentage';
    totalAmount: number;
    discount: number;
    milestones: ContractFinancialMilestone[];
  }>({
    type: 'fixed',
    totalAmount: 0,
    discount: 0,
    milestones: [],
  });
  
  const [openClauses, setOpenClauses] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setContractDate(new Date().toISOString().split('T')[0]);
  }, []);

  const client = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  // --- Dynamic Section Handlers ---

  const addScopeItem = () => setScopeOfWork([...scopeOfWork, { id: generateId(), title: '', description: '' }]);
  const updateScopeItem = (id: string, field: 'title' | 'description', value: string) => {
    setScopeOfWork(scopeOfWork.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  const removeScopeItem = (id: string) => setScopeOfWork(scopeOfWork.filter(item => item.id !== id));

  const addTerm = () => setTermsAndConditions([...termsAndConditions, { id: generateId(), text: '' }]);
  const updateTerm = (id: string, value: string) => {
    setTermsAndConditions(termsAndConditions.map(term => term.id === id ? { ...term, text: value } : term));
  };
  const removeTerm = (id: string) => setTermsAndConditions(termsAndConditions.filter(term => term.id !== id));
  const reorderTerm = (index: number, direction: 'up' | 'down') => {
    const newTerms = [...termsAndConditions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newTerms.length) return;
    [newTerms[index], newTerms[newIndex]] = [newTerms[newIndex], newTerms[index]];
    setTermsAndConditions(newTerms);
  };

  const addMilestone = () => {
    const newMilestones = [...financials.milestones, { id: generateId(), name: '', condition: '', value: 0 }];
    setFinancials(prev => ({ ...prev, milestones: newMilestones }));
  };
  const updateMilestone = (id: string, field: keyof ContractFinancialMilestone, value: string | number) => {
    const newMilestones = financials.milestones.map(m => m.id === id ? { ...m, [field]: value } : m);
    setFinancials(prev => ({ ...prev, milestones: newMilestones }));
  };
  const removeMilestone = (id: string) => {
    const newMilestones = financials.milestones.filter(m => m.id !== id);
    setFinancials(prev => ({ ...prev, milestones: newMilestones }));
  };
  
  const totalMilestoneValue = useMemo(() => {
      return financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0);
  }, [financials.milestones]);

  const handleSaveContract = async () => {
      if (!client || !currentUser || !firestore) {
          toast({ variant: "destructive", title: "خطأ", description: "الرجاء اختيار عميل أولاً." });
          return;
      }
      setIsSaving(true);
      try {
          const contractData: Omit<Contract, 'id'> = {
              clientId: client.id,
              clientName: client.nameAr,
              companySnapshot: company || {},
              title,
              contractDate: new Date(contractDate),
              scopeOfWork,
              termsAndConditions,
              financials,
              openClauses,
              createdAt: serverTimestamp(),
              createdBy: currentUser.id,
          };
          await addDoc(collection(firestore, 'contracts'), contractData);
          toast({ title: "نجاح", description: "تم حفظ العقد بنجاح." });
          router.push('/dashboard/contracts');
      } catch (error) {
          console.error("Error saving contract:", error);
          toast({ variant: "destructive", title: "خطأ", description: "فشل حفظ العقد." });
      } finally {
          setIsSaving(false);
      }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6" dir="rtl">
        <div className="flex justify-between items-center no-print">
            <h1 className="text-2xl font-bold">إنشاء عقد جديد</h1>
            <div className="flex gap-2">
                <Button onClick={handlePrint} variant="outline"><Printer className="ml-2"/> طباعة</Button>
                <Button onClick={handleSaveContract} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 animate-spin" /> : <Save className="ml-2" />}
                    حفظ العقد
                </Button>
            </div>
        </div>

        <div id="printable-contract" className="bg-card p-8 rounded-lg shadow-sm space-y-8 print:shadow-none print:p-2">
            
            {/* Section 1 & 2: Header and Parties */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            {company?.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-16 w-16 object-contain"/> : <Logo className="h-16 w-16 !p-2" />}
                            <div>
                               <h2 className="text-lg font-bold">{company?.name || 'سكوب للاستشارات الهندسية'}</h2>
                               <p className="text-xs text-muted-foreground">{company?.address}</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xl font-bold text-left mb-1 h-9" />
                            <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} className="text-sm text-left h-8" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-2">أطراف الاتفاقية</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg">
                         <div>
                            <p className="font-semibold mb-1">الطرف الأول:</p>
                            <p>{company?.name || 'مكتب سكوب للاستشارات الهندسية (scoop)'}, ويمثله المهندس/ بليه علي المسفر.</p>
                        </div>
                        <div>
                            <p className="font-semibold mb-1">الطرف الثاني:</p>
                             <InlineSearchList 
                                options={clients.map(c => ({ value: c.id, label: c.nameAr, searchKey: c.civilId }))}
                                value={selectedClientId}
                                onSelect={setSelectedClientId}
                                placeholder="ابحث عن عميل..."
                             />
                             {client && (
                                <div className="text-xs mt-2 space-y-1 text-muted-foreground">
                                    <p>الرقم المدني: {client.civilId}</p>
                                    <p>القطعة: {client.address?.block}, المنطقة: {client.address?.area}</p>
                                </div>
                             )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section 3: Scope of Work */}
            <Card>
                <CardHeader>
                    <CardTitle>نطاق عمل الطرف الأول (Scope of Work)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {scopeOfWork.map((item, index) => (
                        <div key={item.id} className="flex gap-2 items-start p-2 border rounded-md">
                           <span className="pt-2 font-mono text-sm text-muted-foreground">{index + 1}.</span>
                           <div className="flex-grow space-y-2">
                             <Input placeholder="عنوان البند" value={item.title} onChange={(e) => updateScopeItem(item.id, 'title', e.target.value)} />
                             <Textarea placeholder="وصف تفصيلي للبند..." value={item.description} onChange={(e) => updateScopeItem(item.id, 'description', e.target.value)} rows={2} />
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => removeScopeItem(item.id)} className="shrink-0"><Trash2 className="text-destructive h-4 w-4"/></Button>
                        </div>
                    ))}
                    <Button variant="outline" onClick={addScopeItem}><PlusCircle className="ml-2"/> إضافة بند عمل</Button>
                </CardContent>
            </Card>

            {/* Section 4: Terms and Conditions */}
            <Card>
                <CardHeader><CardTitle>الشروط والأحكام</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                     {termsAndConditions.map((term, index) => (
                        <div key={term.id} className="flex gap-2 items-start">
                           <span className="pt-2 font-semibold">{index + 1}-</span>
                           <Textarea value={term.text} onChange={(e) => updateTerm(term.id, e.target.value)} rows={2} className="flex-grow"/>
                           <div className="flex flex-col">
                            <Button variant="ghost" size="icon" onClick={() => reorderTerm(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" onClick={() => reorderTerm(index, 'down')} disabled={index === termsAndConditions.length - 1}><ArrowDown className="h-4 w-4"/></Button>
                           </div>
                           <Button variant="ghost" size="icon" onClick={() => removeTerm(term.id)}><Trash2 className="text-destructive h-4 w-4"/></Button>
                        </div>
                     ))}
                     <Button variant="outline" onClick={addTerm}><PlusCircle className="ml-2"/> إضافة شرط جديد</Button>
                </CardContent>
            </Card>

            {/* Section 5 & 6: Financials & Discount */}
            <Card>
                <CardHeader><CardTitle>البنود المالية والخصم</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>نوع العقد المالي</Label>
                            <Select value={financials.type} onValueChange={(v: 'fixed' | 'percentage') => setFinancials(p => ({...p, type: v}))}>
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
                         <Button variant="outline" onClick={addMilestone}><PlusCircle className="ml-2"/> إضافة دفعة</Button>
                     </div>
                     <div className="space-y-2">
                        {financials.milestones.map((m, i) => (
                             <div key={m.id} className="grid grid-cols-12 gap-2 items-center">
                                <span className="col-span-1 text-sm text-muted-foreground">#{i+1}</span>
                                <Input placeholder="اسم الدفعة" value={m.name} onChange={e => updateMilestone(m.id, 'name', e.target.value)} className="col-span-3"/>
                                <Input placeholder="شرط الاستحقاق" value={m.condition} onChange={e => updateMilestone(m.id, 'condition', e.target.value)} className="col-span-4"/>
                                <div className="col-span-3 flex items-center gap-1">
                                    <Input type="number" value={m.value} onChange={e => updateMilestone(m.id, 'value', Number(e.target.value))} className="dir-ltr text-left"/>
                                    <span className="text-sm">{financials.type === 'fixed' ? 'د.ك' : '%'}</span>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeMilestone(m.id)} className="col-span-1"><Trash2 className="text-destructive h-4 w-4"/></Button>
                             </div>
                        ))}
                     </div>
                     {financials.milestones.length > 0 && (
                        <div className="border-t pt-4 mt-4 space-y-2">
                            <div className="flex justify-between font-semibold">
                                <span>مجموع الدفعات:</span>
                                <span className="font-mono">{financials.type === 'fixed' ? formatCurrency(totalMilestoneValue) : `${totalMilestoneValue}%`}</span>
                            </div>
                            {financials.type === 'percentage' && totalMilestoneValue !== 100 && <p className="text-destructive text-xs text-center">تحذير: مجموع النسب لا يساوي 100%</p>}
                             {financials.type === 'fixed' && totalMilestoneValue !== financials.totalAmount && <p className="text-destructive text-xs text-center">تحذير: مجموع الدفعات لا يساوي إجمالي قيمة العقد</p>}
                        </div>
                     )}
                     <Separator />
                     <div className="grid md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>قيمة الخصم (د.ك)</Label>
                            <Input type="number" value={financials.discount} onChange={e => setFinancials(p => ({...p, discount: Number(e.target.value)}))} className="dir-ltr text-left" />
                        </div>
                         <div className="flex items-end justify-end text-lg font-bold">
                            <div className="flex justify-between items-center gap-4 p-2 rounded-md bg-muted">
                                <span>الإجمالي بعد الخصم:</span>
                                <span className="font-mono text-primary">{formatCurrency(financials.totalAmount - financials.discount)}</span>
                            </div>
                        </div>
                     </div>
                </CardContent>
            </Card>

            {/* Section 7: Open Clauses */}
             <Card>
                <CardHeader><CardTitle>بنود إضافية أو ملحقات</CardTitle></CardHeader>
                <CardContent>
                    <Textarea placeholder="أضف أي نصوص أو شروط إضافية هنا..." value={openClauses} onChange={e => setOpenClauses(e.target.value)} rows={6} />
                </CardContent>
            </Card>

            {/* Section 8: Signatures */}
            <section className="pt-12">
                 <h3 className="font-bold mb-4 text-center">التوقيعات</h3>
                 <div className="grid grid-cols-2 gap-8 text-center text-sm pt-16">
                    <div>
                        <p className="font-bold border-t pt-2">الطرف الأول: {company?.name || '...'}</p>
                    </div>
                     <div>
                        <p className="font-bold border-t pt-2">الطرف الثاني: {client?.nameAr || '...'}</p>
                    </div>
                </div>
            </section>
        </div>
    </div>
  );
}
