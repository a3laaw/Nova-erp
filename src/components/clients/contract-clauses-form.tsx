
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Save, PlusCircle, Trash2, FileSignature, Calculator, LayoutGrid, CheckCircle2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, collectionGroup, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, Employee, Department, Account, ContractFinancialMilestone } from '@/lib/types';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect, type MultiSelectOption } from '../ui/multi-select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
const milestoneNames = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractClausesForm({ isOpen, onClose, onSaveSuccess, transaction, clientId, clientName, quotationIdToUpdate }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [scopeOfWork, setScopeOfWork] = useState<any[]>([]);
  const [termsAndConditions, setTermsAndConditions] = useState<any[]>([]);
  const [openClauses, setOpenClauses] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [financials, setFinancials] = useState<any>({ type: 'fixed', totalAmount: 0, milestones: [] });
  const [referenceData, setReferenceData] = useState<{ stages: MultiSelectOption[] }>({ stages: [] });

  useEffect(() => {
    if (!isOpen || !firestore) return;
    const fetchData = async () => {
      try {
        const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages')));
        const stages = Array.from(new Map(stagesSnap.docs.map(doc => {
            const name = doc.data().name;
            return [name, { value: name, label: name }];
        })).values());
        setReferenceData({ stages });

        if (transaction?.contract) {
            const c = transaction.contract;
            setScopeOfWork(c.scopeOfWork || []);
            setTermsAndConditions(c.termsAndConditions || []);
            setOpenClauses(c.openClauses || []);
            setFinancials({
                type: c.financialsType || 'fixed',
                totalAmount: c.totalAmount || 0,
                milestones: (c.clauses || []).map(cl => ({ id: cl.id || generateId(), name: cl.name, condition: cl.condition || '', value: c.financialsType === 'percentage' ? cl.percentage || 0 : cl.amount }))
            });
        }
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, [isOpen, firestore, transaction]);

  const totalValue = useMemo(() => financials.milestones.reduce((sum: number, m: any) => sum + Number(m.value || 0), 0), [financials.milestones]);

  const handleSubmit = async () => {
    if (!firestore || !currentUser || !clientId) return;
    
    setIsSaving(true);
    try {
        let newTxId = '';
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const revenueAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), where('name', '==', clientName), limit(1)));
            const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
            const jeCounterDoc = await transaction_fs.get(jeCounterRef);
            const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

            const finalClauses = financials.milestones.map((m: any) => {
                const amount = financials.type === 'percentage' ? (m.value / 100) * financials.totalAmount : m.value;
                return { id: m.id, name: m.name, condition: m.condition, amount, status: 'غير مستحقة', percentage: m.value };
            });

            const totalAmount = financials.type === 'fixed' ? totalValue : financials.totalAmount;
            const contractData = { clauses: finalClauses, scopeOfWork, termsAndConditions, openClauses, totalAmount, financialsType: financials.type };

            const clientRef = doc(firestore, 'clients', clientId);
            const clientSnap = await transaction_fs.get(clientRef);
            const nextTxCount = (clientSnap.data()?.transactionCounter || 0) + 1;
            const txNumber = `CL${clientSnap.data()?.fileNumber}-TX${String(nextTxCount).padStart(2, '0')}`;
            
            const newTxRef = doc(collection(firestore, `clients/${clientId}/transactions`));
            newTxId = newTxRef.id;
            
            transaction_fs.set(newTxRef, {
                transactionNumber: txNumber, clientId, transactionType: transaction?.transactionType || 'عقد مقاولات',
                status: 'in-progress', contract: contractData, createdAt: serverTimestamp(),
                assignedEngineerId: transaction?.assignedEngineerId || null
            });
            transaction_fs.update(clientRef, { transactionCounter: nextTxCount, status: 'contracted' });

            if (revenueAccSnap.docs[0] && clientAccSnap.docs[0]) {
                const newJeRef = doc(collection(firestore, 'journalEntries'));
                transaction_fs.set(newJeRef, {
                    entryNumber: `JV-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), narration: `إثبات مديونية عقد: ${transaction?.transactionType || ''}`,
                    totalDebit: totalAmount, totalCredit: totalAmount, status: 'posted',
                    lines: [
                        { accountId: clientAccSnap.docs[0].id, accountName: clientName, debit: totalAmount, credit: 0, auto_profit_center: newTxId },
                        { accountId: revenueAccSnap.docs[0].id, accountName: revenueAccSnap.docs[0].data().name, debit: 0, credit: totalAmount, auto_profit_center: newTxId }
                    ],
                    clientId, transactionId: newTxId, createdAt: serverTimestamp(), createdBy: currentUser.id
                });
                transaction_fs.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
            }

            if (quotationIdToUpdate) {
                transaction_fs.update(doc(firestore, 'quotations', quotationIdToUpdate), { status: 'accepted', transactionId: newTxId });
            }
        });

        toast({ title: 'نجاح تفعيل العقد', description: 'سيتم توجيهك الآن لتأسيس الهيكل الفني للمشروع.' });
        onClose();
        router.push(`/dashboard/construction/projects/new?clientId=${clientId}&transactionId=${newTxId}`);
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الربط المالي' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden" dir="rtl">
        <DialogHeader className="p-6 bg-primary/5 border-b">
            <DialogTitle className="text-xl font-black flex items-center gap-2"><FileSignature className="text-primary"/> توقيع العقد وتحويله لمشروع</DialogTitle>
            <DialogDescription>بمجرد الاعتماد، سيتم إنشاء القيد المحاسبي لمديونية المالك والبدء بتأسيس هيكل المشروع الفني.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-8 space-y-10">
                <section className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black flex items-center gap-2"><Calculator className="h-5 w-5 text-primary"/> الترتيبات المالية للدفعات</h3>
                        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border shadow-sm">
                            <Label className="text-xs font-bold">نوع التسعير:</Label>
                            <Select value={financials.type} onValueChange={(v: any) => setFinancials((p: any) => ({...p, type: v, milestones: []}))}>
                                <SelectTrigger className="h-8 w-32 rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="fixed">مبلغ ثابت</SelectItem><SelectItem value="percentage">نسب مئوية</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
                        <Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead className="px-6 font-bold">اسم الدفعة</TableHead><TableHead className="font-bold">شرط الاستحقاق الميداني</TableHead><TableHead className="text-center w-40">{financials.type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {financials.milestones.map((m: any, i: number) => (
                                    <TableRow key={m.id} className="h-16 border-b last:border-0 hover:bg-muted/5">
                                        <TableCell className="px-4"><Input value={m.name} onChange={e => { const newM = [...financials.milestones]; newM[i].name = e.target.value; setFinancials((p: any) => ({...p, milestones: newM})); }} className="font-bold border-none shadow-none" /></TableCell>
                                        <TableCell><InlineSearchList value={m.condition || ''} onSelect={v => { const newM = [...financials.milestones]; newM[i].condition = v; setFinancials((p: any) => ({...p, milestones: newM})); }} options={referenceData.stages} placeholder="اربط بمرحلة..." className="h-9 text-xs border-dashed" /></TableCell>
                                        <TableCell><Input type="number" step="any" value={m.value} onChange={e => { const newM = [...financials.milestones]; newM[i].value = parseFloat(e.target.value) || 0; setFinancials((p: any) => ({...p, milestones: newM})); }} className="text-center font-black text-xl text-primary border-none shadow-none" /></TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => setFinancials((p: any) => ({...p, milestones: p.milestones.filter((x: any) => x.id !== m.id)}))} className="text-destructive"><Trash2 className="h-4 w-4"/></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5 h-20">
                                <TableRow>
                                    <TableCell colSpan={2} className="text-right px-12 font-black text-xl">إجمالي قيمة العقد:</TableCell>
                                    <TableCell className="text-center font-mono text-3xl font-black text-primary">{financials.type === 'fixed' ? formatCurrency(totalValue) : `${totalValue}%`}</TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <Button variant="outline" onClick={() => setFinancials((p: any) => ({...p, milestones: [...p.milestones, {id: generateId(), name: `الدفعة الجديدة`, value: 0, condition: ''}]}))} className="w-full h-12 border-dashed border-2 rounded-2xl gap-2 font-bold"><PlusCircle className="h-4 w-4" /> إضافة دفعة مخصصة</Button>
                </section>
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-white">
            <Button variant="ghost" onClick={onClose} disabled={isSaving}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={isSaving || financials.milestones.length === 0} className="h-12 px-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/30 gap-2">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                اعتماد وتحويل للمشروع الآن
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
