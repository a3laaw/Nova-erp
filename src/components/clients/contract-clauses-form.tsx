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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, PlusCircle, Trash2, ArrowUp, ArrowDown, FileSignature, Calculator, LayoutGrid } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, getDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, collectionGroup, orderBy, writeBatch, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, ContractClause, ContractTemplate, ContractTerm, ContractScopeItem, Employee, Department, Account, ContractFinancialMilestone, WorkStage } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Separator } from '../ui/separator';
import { InlineSearchList } from '../ui/inline-search-list';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  transaction: ClientTransaction | null | Partial<ClientTransaction>;
  clientId: string;
  clientName: string;
  quotationIdToUpdate?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['أولاً', 'ثانياً', 'ثالثاً', 'رابعاً', 'خامساً', 'سادساً', 'سابعاً', 'ثامناً', 'تاسعاً', 'عاشراً'];
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractClausesForm({ isOpen, onClose, onSaveSuccess, transaction, clientId, clientName, quotationIdToUpdate }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [scopeOfWork, setScopeOfWork] = useState<ContractScopeItem[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<ContractTerm[]>([]);
  const [openClauses, setOpenClauses] = useState<ContractTerm[]>([]);
  
  const [financials, setFinancials] = useState<ContractTemplate['financials']>({
    type: 'fixed',
    totalAmount: 0,
    discount: 0,
    milestones: [],
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [loadingRefData, setLoadingRefData] = useState(true);
  const [referenceData, setReferenceData] = useState<{ stages: MultiSelectOption[], employees: Employee[], departments: Department[] }>({ stages: [], employees: [], departments: [] });

  useEffect(() => {
    if (!isOpen || !firestore) return;

    const fetchData = async () => {
      setLoadingRefData(true);
      try {
        const [engSnap, deptSnap, stagesSnap] = await Promise.all([
            getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
            getDocs(query(collection(firestore, 'departments'))),
            getDocs(query(collectionGroup(firestore, 'workStages')))
        ]);

        const stages = Array.from(new Map(stagesSnap.docs.map(doc => {
            const name = doc.data().name;
            return [name, { value: name, label: name }];
        })).values());

        setReferenceData({
            stages,
            employees: engSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)),
            departments: deptSnap.docs.map(d => ({id: d.id, ...d.data()} as Department))
        });

        // تعبئة البيانات من واقع العرض أو العقد الحالي
        if (transaction?.contract) {
            const c = transaction.contract;
            setScopeOfWork(c.scopeOfWork || []);
            setTermsAndConditions(c.termsAndConditions || []);
            setOpenClauses(c.openClauses || []);
            setFinancials({
                type: c.financialsType || 'fixed',
                totalAmount: c.totalAmount || 0,
                discount: 0,
                milestones: (c.clauses || []).map(cl => ({
                    id: cl.id || generateId(),
                    name: cl.name,
                    condition: cl.condition || '',
                    value: c.financialsType === 'percentage' ? cl.percentage || 0 : cl.amount
                }))
            });
        }
      } finally {
        setLoadingRefData(false);
      }
    };
    fetchData();
  }, [isOpen, firestore, transaction]);

  const totalMilestoneValue = useMemo(() => financials.milestones.reduce((sum, m) => sum + Number(m.value || 0), 0), [financials.milestones]);
  const finalTotalCalculated = useMemo(() => financials.type === 'fixed' ? totalMilestoneValue : financials.totalAmount, [financials, totalMilestoneValue]);

  const handleSubmit = async () => {
    if (!firestore || !currentUser || !clientId) return;
    
    // التحقق من توازن الدفعات
    if (financials.type === 'percentage' && totalMilestoneValue !== 100) {
        toast({ variant: 'destructive', title: 'خطأ في النسب', description: 'إجمالي نسب الدفعات يجب أن يكون 100%.' });
        return;
    }

    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            
            // 1. حسابات المحاسبة (AR)
            const revenueAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1)));
            const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
            const jeCounterDoc = await transaction_fs.get(jeCounterRef);
            const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

            const finalClauses = financials.milestones.map(m => {
                const amount = financials.type === 'percentage' ? (m.value / 100) * financials.totalAmount : m.value;
                return { id: m.id, name: m.name, condition: m.condition, amount, status: 'غير مستحقة', percentage: financials.type === 'percentage' ? m.value : null };
            });

            const contractData = { clauses: finalClauses, scopeOfWork, termsAndConditions, openClauses, totalAmount: finalTotalCalculated, financialsType: financials.type };

            let targetTxId = transaction?.id;
            
            // 2. معالجة المعاملة (إنشاء أو تحديث)
            if (targetTxId && targetTxId !== '__NEW__') {
                transaction_fs.update(doc(firestore, `clients/${clientId}/transactions/${targetTxId}`), { contract: contractData, status: 'in-progress' });
            } else {
                const clientRef = doc(firestore, 'clients', clientId);
                const clientSnap = await transaction_fs.get(clientRef);
                const nextTxCount = (clientSnap.data()?.transactionCounter || 0) + 1;
                const txNumber = `CL${clientSnap.data()?.fileNumber}-TX${String(nextTxCount).padStart(2, '0')}`;
                
                const newTxRef = doc(collection(firestore, `clients/${clientId}/transactions`));
                targetTxId = newTxRef.id;
                
                transaction_fs.set(newTxRef, {
                    transactionNumber: txNumber, clientId, transactionType: transaction?.transactionType || 'معاملة جديدة',
                    status: 'in-progress', contract: contractData, createdAt: serverTimestamp(),
                    assignedEngineerId: transaction?.assignedEngineerId || null
                });
                transaction_fs.update(clientRef, { transactionCounter: nextTxCount, status: 'contracted' });
            }

            // 3. توليد القيد المحاسبي المباشر
            if (revenueAccSnap.docs[0] && clientAccSnap.docs[0]) {
                const newJeRef = doc(collection(firestore, 'journalEntries'));
                transaction_fs.set(newJeRef, {
                    entryNumber: `JV-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), narration: `إثبات مديونية عقد: ${transaction?.transactionType || ''} - عميل: ${clientName}`,
                    totalDebit: finalTotalCalculated, totalCredit: finalTotalCalculated, status: 'posted',
                    lines: [
                        { accountId: clientAccSnap.docs[0].id, accountName: clientName, debit: finalTotalCalculated, credit: 0, auto_profit_center: targetTxId },
                        { accountId: revenueAccSnap.docs[0].id, accountName: revenueAccSnap.docs[0].data().name, debit: 0, credit: finalTotalCalculated, auto_profit_center: targetTxId }
                    ],
                    clientId, transactionId: targetTxId, createdAt: serverTimestamp(), createdBy: currentUser.id
                });
                transaction_fs.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
            }

            if (quotationIdToUpdate) {
                transaction_fs.update(doc(firestore, 'quotations', quotationIdToUpdate), { status: 'accepted', transactionId: targetTxId });
            }
        });

        toast({ title: 'تم توقيع العقد', description: 'تم إنشاء العقد والقيد المحاسبي بنجاح.' });
        onClose();
        router.push(`/dashboard/clients/${clientId}/transactions/${transaction?.id || ''}`);
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsSaving(false);
    }
  };

  const addMilestone = () => {
    setFinancials(prev => ({
      ...prev,
      milestones: [...prev.milestones, { id: generateId(), name: `الدفعة ${milestoneNames[prev.milestones.length] || ''}`, value: 0, condition: '' }]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-6 bg-primary/5 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileSignature className="h-6 w-6"/></div>
            <div>
                <DialogTitle className="text-xl font-black">تحرير وإقرار بنود العقد</DialogTitle>
                <DialogDescription>قم بمراجعة وتعديل الأسعار والشروط قبل اعتماد العقد وتحويله للمحاسبة.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-8 space-y-10">
                {/* القسم المالي - الجوهر */}
                <section className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black flex items-center gap-2 text-primary"><Calculator className="h-5 w-5"/> البنود المالية والدفعات</h3>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border shadow-sm">
                            <Label className="text-xs font-bold">نوع التسعير:</Label>
                            <Select value={financials.type} onValueChange={(v: any) => setFinancials(p => ({...p, type: v, milestones: []}))}>
                                <SelectTrigger className="h-8 w-32 rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="fixed">مبلغ ثابت</SelectItem><SelectItem value="percentage">نسب مئوية</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-12 border-b-2">
                                    <TableHead className="px-6 font-bold">اسم الدفعة / المرحلة</TableHead>
                                    <TableHead className="font-bold">شرط الاستحقاق (WBS)</TableHead>
                                    <TableHead className="text-center font-bold w-40">{financials.type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {financials.milestones.map((m, i) => (
                                    <TableRow key={m.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                        <TableCell className="px-4">
                                            <Input value={m.name} onChange={e => {
                                                const newM = [...financials.milestones];
                                                newM[i].name = e.target.value;
                                                setFinancials(p => ({...p, milestones: newM}));
                                            }} className="font-bold border-none shadow-none focus-visible:ring-0" />
                                        </TableCell>
                                        <TableCell>
                                            <InlineSearchList 
                                                value={m.condition || ''} 
                                                onSelect={v => {
                                                    const newM = [...financials.milestones];
                                                    newM[i].condition = v;
                                                    setFinancials(p => ({...p, milestones: newM}));
                                                }} 
                                                options={referenceData.stages} 
                                                placeholder="اربط بمرحلة..."
                                                className="h-9 text-xs border-dashed"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" step="any" 
                                                value={m.value} 
                                                onChange={e => {
                                                    const newM = [...financials.milestones];
                                                    newM[i].value = parseFloat(e.target.value) || 0;
                                                    setFinancials(p => ({...p, milestones: newM}));
                                                }}
                                                className="text-center font-black text-xl text-primary border-none shadow-none focus-visible:ring-0"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                setFinancials(p => ({...p, milestones: p.milestones.filter(x => x.id !== m.id)}));
                                            }} className="text-destructive rounded-full"><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5">
                                <TableRow className="h-20 border-t-4">
                                    <TableCell colSpan={2} className="text-right px-12 font-black text-xl">صافي قيمة العقد:</TableCell>
                                    <TableCell className="text-center font-mono text-3xl font-black text-primary">
                                        {financials.type === 'fixed' ? formatCurrency(totalMilestoneValue) : `${totalMilestoneValue}%`}
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <Button variant="outline" onClick={addMilestone} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold hover:bg-primary/5"><PlusCircle className="h-4 w-4" /> إضافة دفعة جديدة</Button>
                </section>

                <Separator />

                {/* الأقسام الوصفية */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2"><LayoutGrid className="h-5 w-5 text-primary"/> نطاق العمل</Label>
                        {scopeOfWork.map((item, index) => (
                            <div key={item.id} className="p-4 border-2 rounded-2xl bg-white space-y-2 group relative">
                                <Input placeholder="عنوان المهمة" value={item.title} onChange={e => {
                                    const newS = [...scopeOfWork];
                                    newS[index].title = e.target.value;
                                    setScopeOfWork(newS);
                                }} className="font-bold border-none px-0 h-7 focus-visible:ring-0" />
                                <Textarea placeholder="وصف المهمة..." value={item.description} onChange={e => {
                                    const newS = [...scopeOfWork];
                                    newS[index].description = e.target.value;
                                    setScopeOfWork(newS);
                                }} rows={2} className="text-xs border-none px-0 resize-none focus-visible:ring-0" />
                                <Button variant="ghost" size="icon" onClick={() => setScopeOfWork(prev => prev.filter(x => x.id !== item.id))} className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive h-6 w-6"><X className="h-3 w-3"/></Button>
                            </div>
                        ))}
                        <Button variant="ghost" onClick={() => setScopeOfWork(p => [...p, { id: generateId(), title: '', description: '' }])} className="w-full border-dashed border-2 rounded-xl text-xs font-bold text-muted-foreground"><PlusCircle className="h-3 w-3 ml-2"/> أضف مهمة لنطاق العمل</Button>
                    </div>

                    <div className="space-y-4">
                        <Label className="font-black text-lg flex items-center gap-2">الشروط والأحكام</Label>
                        <div className="space-y-2">
                            {termsAndConditions.map((term, index) => (
                                <div key={term.id} className="flex gap-2 group">
                                    <Badge variant="secondary" className="h-6 w-6 rounded-lg shrink-0 flex items-center justify-center font-black">{index + 1}</Badge>
                                    <Textarea value={term.text} onChange={e => {
                                        const newT = [...termsAndConditions];
                                        newT[index].text = e.target.value;
                                        setTermsAndConditions(newT);
                                    }} rows={1} className="text-xs min-h-[38px] rounded-xl focus:border-primary transition-all" />
                                    <Button variant="ghost" size="icon" onClick={() => setTermsAndConditions(prev => prev.filter(x => x.id !== term.id))} className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"><Trash2 className="h-4 w-4"/></Button>
                                </div>
                            ))}
                            <Button variant="ghost" onClick={() => setTermsAndConditions(p => [...p, { id: generateId(), text: '' }])} className="w-full border-dashed border-2 rounded-xl text-xs font-bold text-muted-foreground"><PlusCircle className="h-3 w-3 ml-2"/> إضافة بند قانوني</Button>
                        </div>
                    </div>
                </section>
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-white">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={isSaving || financials.milestones.length === 0} className="h-12 px-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/30 gap-2">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                اعتماد وتوقيع العقد نهائياً
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
