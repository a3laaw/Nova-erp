'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  Loader2, 
  Save, 
  PlusCircle, 
  Trash2, 
  FileSignature, 
  Calculator, 
  Layers, 
  CheckCircle2, 
  Ruler, 
  Building2, 
  Target,
  ShieldCheck,
  AlertCircle,
  X
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { 
  doc, 
  collection, 
  serverTimestamp, 
  getDocs, 
  query, 
  runTransaction, 
  limit, 
  where, 
  collectionGroup, 
  orderBy, 
  getDoc 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Client, ClientTransaction, Account, Quotation } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { InlineSearchList } from '../ui/inline-search-list';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: () => void;
  transaction: any; 
  clientId: string;
  clientName: string;
  quotationIdToUpdate?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];

export function ContractClausesForm({ isOpen, onClose, onSaveSuccess, transaction, clientId, clientName, quotationIdToUpdate }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [financials, setFinancials] = useState<any>({ type: 'fixed', totalAmount: 0, milestones: [] });
  const [specs, setSpecs] = useState<any>({
      totalArea: 0,
      floorsCount: 1,
      basementType: 'none',
      roofExtension: 'none',
      workNature: 'labor_only'
  });
  
  const [referenceData, setReferenceData] = useState<{ stages: { value: string, label: string }[] }>({ stages: [] });
  const [isRefLoading, setIsRefLoading] = useState(false);
  const syncedRef = useRef(false);

  // 1. ✨ محرك المزامنة الفورية الجبار (Quotation-to-Contract Power Sync)
  useEffect(() => {
    if (isOpen && transaction && !syncedRef.current) {
        // حالة 1: سحب البيانات المباشرة من عرض السعر المفتوح
        if (transaction.quotationNumber || transaction.subject) {
            const q = transaction as Quotation;
            
            // مزامنة المواصفات الفنية
            setSpecs({
                totalArea: Number(q.totalArea) || 0,
                floorsCount: Number(q.floorsCount) || 1,
                basementType: q.basementType || 'none',
                roofExtension: q.roofExtension || 'none',
                workNature: q.workNature || 'labor_only'
            });

            // مزامنة البيانات المالية والنسب
            setFinancials({
                type: q.financialsType || 'fixed',
                totalAmount: Number(q.totalAmount) || 0,
                milestones: (q.items || []).map((item: any, idx: number) => ({
                    id: generateId(),
                    name: `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
                    condition: item.triggerCondition || '',
                    value: q.financialsType === 'percentage' ? (Number(item.percentage) || 0) : (Number(item.unitPrice) || 0)
                }))
            });
            
            syncedRef.current = true;
        } 
        // حالة 2: سحب البيانات من عقد سابق (حالة التعديل)
        else if (transaction.contract) {
            const c = transaction.contract;
            setSpecs(c.specs || {});
            setFinancials({
                type: c.financialsType || 'fixed',
                totalAmount: Number(c.totalAmount) || 0,
                milestones: (c.clauses || []).map((cl: any) => ({
                    id: cl.id || generateId(),
                    name: cl.name,
                    condition: cl.condition || '',
                    value: c.financialsType === 'percentage' ? (Number(cl.percentage) || 0) : (Number(cl.amount) || 0)
                }))
            });
            syncedRef.current = true;
        }
    }
    
    if (!isOpen) syncedRef.current = false;
  }, [isOpen, transaction]);

  // 2. ✨ جلب قائمة مراحل العمل لتمكين ربط الدفعات بالمسار الميداني (WBS Link)
  useEffect(() => {
    if (!isOpen || !firestore || !currentUser?.currentCompanyId) return;
    
    const fetchRefData = async () => {
      setIsRefLoading(true);
      try {
        const tenantId = currentUser.currentCompanyId;
        const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages'), where('companyId', '==', tenantId)));
        const stages = Array.from(new Map(stagesSnap.docs.map(doc => {
            const name = doc.data().name;
            return [name, { value: name, label: name }];
        })).values());
        setReferenceData({ stages });
      } catch (e) { console.error("Reference Data Fetch Failed:", e); }
      finally { setIsRefLoading(false); }
    };
    
    fetchRefData();
  }, [isOpen, firestore, currentUser]);

  // حساب المجموع اللحظي (للتأكد من توازن النسب أو المبالغ)
  const currentTotalInput = useMemo(() => 
    (financials.milestones || []).reduce((sum: number, m: any) => sum + (Number(m.value) || 0), 0)
  , [financials.milestones]);

  const handleSubmit = async () => {
    if (!firestore || !currentUser || !clientId || isSaving) return;
    
    // التحقق من توازن النسب المئوية
    if (financials.type === 'percentage' && Math.abs(currentTotalInput - 100) > 0.01) {
        toast({ variant: 'destructive', title: 'خطأ في النسب', description: 'يجب أن يكون مجموع نسب الدفعات 100% بالضبط.' });
        return;
    }

    setIsSaving(true);
    try {
        let newTxId = '';
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const tenantId = currentUser.currentCompanyId!;
            
            const coaPath = getTenantPath('chartOfAccounts', tenantId);
            const revenueAccSnap = await getDocs(query(collection(firestore, coaPath!), where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, coaPath!), where('name', '==', clientName), limit(1)));
            
            const jeCounterPath = getTenantPath('counters/journalEntries', tenantId);
            const jeCounterRef = doc(firestore, jeCounterPath!);
            const jeCounterDoc = await transaction_fs.get(jeCounterRef);
            const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;

            const finalClauses = financials.milestones.map((m: any) => {
                const amount = financials.type === 'percentage' ? (m.value / 100) * financials.totalAmount : m.value;
                return { id: m.id, name: m.name, condition: m.condition, amount, status: 'غير مستحقة', percentage: m.value };
            });

            const totalAmount = financials.type === 'fixed' ? currentTotalInput : financials.totalAmount;
            const contractData = { clauses: finalClauses, totalAmount, financialsType: financials.type, specs };

            const clientPath = getTenantPath(`clients/${clientId}`, tenantId);
            const clientRef = doc(firestore, clientPath!);
            const clientSnap = await transaction_fs.get(clientRef);
            
            const nextTxCount = (clientSnap.data()?.transactionCounter || 0) + 1;
            const txNumber = `CL${clientSnap.data()?.fileNumber}-TX${String(nextTxCount).padStart(2, '0')}`;
            
            const txsCollectionPath = getTenantPath(`clients/${clientId}/transactions`, tenantId);
            const newTxRef = doc(collection(firestore, txsCollectionPath!));
            newTxId = newTxRef.id;
            
            transaction_fs.set(newTxRef, cleanFirestoreData({
                transactionNumber: txNumber, 
                clientId, 
                transactionType: transaction?.transactionType || 'عقد مبيعات',
                status: 'in-progress', 
                contract: contractData, 
                createdAt: serverTimestamp(),
                assignedEngineerId: transaction?.assignedEngineerId || null,
                companyId: tenantId
            }));
            
            transaction_fs.update(clientRef, { transactionCounter: nextTxCount, status: 'contracted' });

            if (!revenueAccSnap.empty && !clientAccSnap.empty) {
                const jePath = getTenantPath('journalEntries', tenantId);
                const newJeRef = doc(collection(firestore, jePath!));
                transaction_fs.set(newJeRef, cleanFirestoreData({
                    entryNumber: `JV-DIRECT-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), 
                    narration: `إثبات مديونية عقد: ${transaction?.transactionType || ''} لـ ${clientName}`,
                    totalDebit: totalAmount, 
                    totalCredit: totalAmount, 
                    status: 'posted',
                    lines: [
                        { accountId: clientAccSnap.docs[0].id, accountName: clientName, debit: totalAmount, credit: 0, auto_profit_center: newTxId },
                        { accountId: revenueAccSnap.docs[0].id, accountName: revenueAccSnap.docs[0].data().name, debit: 0, credit: totalAmount, auto_profit_center: newTxId }
                    ],
                    clientId, 
                    transactionId: newTxId, 
                    createdAt: serverTimestamp(), 
                    createdBy: currentUser.id,
                    companyId: tenantId
                }));
                transaction_fs.set(jeCounterRef, { counts: { [currentYear]: nextJeNum } }, { merge: true });
            }

            if (quotationIdToUpdate) {
                const qPath = getTenantPath(`quotations/${quotationIdToUpdate}`, tenantId);
                transaction_fs.update(doc(firestore, qPath!), { status: 'accepted', transactionId: newTxId });
            }
        });

        toast({ title: 'تم تفعيل العقد', description: 'تم تأسيس المشروع والترحيل المالي بنجاح.' });
        onClose();
        router.push(`/dashboard/construction/projects/new?clientId=${clientId}&transactionId=${newTxId}`);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في المزامنة', description: e.message });
    } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
        <DialogHeader className="p-8 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><FileSignature className="h-8 w-8"/></div>
                <div className="text-right">
                    <DialogTitle className="text-2xl font-black text-[#1e1b4b]">توقيع العقد وتحويله لمشروع</DialogTitle>
                    <DialogDescription className="font-bold text-slate-500">مراجعة وتأكيد بنود العرض المالي قبل بدء التنفيذ الميداني.</DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-8 space-y-10">
                <section className="space-y-6">
                    <h3 className="text-lg font-black flex items-center gap-3 border-r-8 border-indigo-600 pr-4">
                        <Layers className="h-6 w-6 text-indigo-600" /> المواصفات الفنية المسحوبة
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-8 border-2 border-dashed rounded-[2.5rem] bg-white shadow-inner">
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">المساحة (م²)</Label>
                            <Input 
                                type="number" 
                                value={specs.totalArea} 
                                onChange={e => setSpecs({...specs, totalArea: Number(e.target.value)})} 
                                className="h-10 font-black text-indigo-600 rounded-xl bg-indigo-50/20 border-indigo-100" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">عدد الأدوار</Label>
                            <Input 
                                type="number" 
                                value={specs.floorsCount} 
                                onChange={e => setSpecs({...specs, floorsCount: Number(e.target.value)})} 
                                className="h-10 font-black rounded-xl" 
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">خيار السرداب</Label>
                            <Select value={specs.basementType} onValueChange={v => setSpecs({...specs, basementType: v})}>
                                <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="none">بدون</SelectItem>
                                    <SelectItem value="full">كامل</SelectItem>
                                    <SelectItem value="half">نص</SelectItem>
                                    <SelectItem value="vault">قبو</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">توسعة السطح</Label>
                            <Select value={specs.roofExtension} onValueChange={v => setSpecs({...specs, roofExtension: v})}>
                                <SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="none">لا يوجد</SelectItem>
                                    <SelectItem value="quarter">ربع دور</SelectItem>
                                    <SelectItem value="half">نصف دور</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="flex justify-between items-center pr-4 border-r-8 border-primary">
                        <h3 className="text-lg font-black flex items-center gap-3 text-[#1e1b4b]">
                            <Calculator className="h-6 w-6 text-primary"/> الترتيبات المالية المعتمدة
                        </h3>
                        <div className="flex items-center gap-4">
                            <Label className="text-xs font-bold text-slate-500">نظام الدفع:</Label>
                            <Badge variant="outline" className="bg-white border-primary/20 text-primary font-black px-4 h-8 rounded-xl shadow-sm">
                                {financials.type === 'percentage' ? 'نسب مئوية %' : 'مبالغ ثابتة KD'}
                            </Badge>
                        </div>
                    </div>

                    <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white">
                        <Table>
                            <TableHeader className="bg-muted/50 h-14">
                                <TableRow className="border-none">
                                    <TableHead className="w-24 text-center font-black text-slate-400 border-l border-white/20">رقم الدفعة</TableHead>
                                    <TableHead className="px-10 font-black text-slate-400 text-right">بيان شرط الاستحقاق (WBS LINK)</TableHead>
                                    <TableHead className="text-center w-48 font-black">
                                        {financials.type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                    </TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(financials.milestones || []).map((m: any, i: number) => (
                                    <TableRow key={m.id} className="h-20 border-b last:border-0 hover:bg-muted/5 transition-all group">
                                        <TableCell className="text-center bg-slate-50/50 border-l">
                                            <Badge variant="secondary" className="font-black text-xs px-3 h-7 rounded-full border bg-white text-slate-900">
                                                {i+1}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-10">
                                            <InlineSearchList 
                                                value={m.condition} 
                                                onSelect={v => { const newM = [...financials.milestones]; newM[i].condition = v; setFinancials({...financials, milestones: newM}); }} 
                                                options={referenceData.stages} 
                                                placeholder="اربط بمرحلة..." 
                                                className="h-10 text-xs border-dashed border-primary/30 bg-primary/[0.02] font-bold" 
                                            />
                                        </TableCell>
                                        <TableCell className="bg-primary/[0.01] border-r">
                                            <Input 
                                                type="number" step="any" 
                                                value={m.value} 
                                                onChange={e => { const newM = [...financials.milestones]; newM[i].value = parseFloat(e.target.value) || 0; setFinancials({...financials, milestones: newM}); }} 
                                                className="text-center font-black text-2xl text-primary border-none shadow-none focus-visible:ring-0 font-mono" 
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => setFinancials({...financials, milestones: financials.milestones.filter((x: any) => x.id !== m.id)})} className="text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary/5 h-24">
                                <TableRow className="border-t-4 border-primary/20">
                                    <TableCell colSpan={2} className="text-right px-12">
                                        <p className="text-2xl font-black tracking-tight text-slate-800">إجمالي قيمة التعاقد المبرم:</p>
                                    </TableCell>
                                    <TableCell className="text-center border-r border-slate-200 bg-white">
                                        <div className="flex flex-col items-center">
                                            <div className={cn("text-4xl font-black font-mono tracking-tighter text-primary", financials.type === 'percentage' && currentTotalInput !== 100 ? 'text-red-600' : '')}>
                                                {financials.type === 'fixed' ? formatCurrency(currentTotalInput) : `${currentTotalInput}%`}
                                            </div>
                                            {financials.type === 'percentage' && currentTotalInput !== 100 && (
                                                <span className="text-[10px] font-black text-red-600 mt-1 animate-pulse">يجب أن يكون المجموع 100%</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                        <div className="p-6 flex justify-center bg-muted/5 border-t">
                            <Button variant="outline" onClick={() => setFinancials({...financials, milestones: [...financials.milestones, {id: generateId(), name: `الدفعة الجديدة`, value: 0, condition: ''}]})} className="h-14 px-16 rounded-2xl border-dashed border-2 font-black text-primary gap-3 hover:bg-white shadow-md">
                                <PlusCircle className="h-6 w-6" /> إضافة دفعة استحقاق إضافية
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </ScrollArea>

        <DialogFooter className="p-10 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
            <div className="text-right space-y-1">
                <p className="text-sm font-black text-primary flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5"/> سيتم إنشاء قيد مديونية آلي بـ {financials.type === 'fixed' ? formatCurrency(currentTotalInput) : formatCurrency(financials.totalAmount)}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold pr-7">الاعتماد النهائي يغير حالة العميل آلياً ويبدأ دورة التنفيذ الميداني.</p>
            </div>
            <div className="flex gap-4">
                <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                <Button onClick={handleSubmit} disabled={isSaving || financials.milestones.length === 0} className="h-16 px-16 rounded-[1.8rem] font-black text-2xl shadow-xl shadow-primary/30 gap-4 bg-[#7209B7] text-white border-none transition-all active:scale-95">
                    {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
                    اعتماد العقد والبدء بالتنفيذ
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
