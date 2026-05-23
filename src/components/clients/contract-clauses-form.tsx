'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  Target,
  ShieldCheck,
  AlertCircle,
  X,
  Ruler,
  Building2,
  Workflow
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
import { useAuth } from '@/context/auth-context';
import type { Client, ClientTransaction, Account, Quotation } from '@/lib/types';
import { formatCurrency, cleanFirestoreData, cn, getTenantPath } from '@/lib/utils';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { InlineSearchList } from '../ui/inline-search-list';

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

  const tenantId = currentUser?.currentCompanyId;
  const [isSaving, setIsSaving] = useState(false);
  
  // 🛡️ المواصفات الفنية (Specs) 🛡️
  const [specs, setSpecs] = useState<any>({
      totalArea: 0,
      floorsCount: 1,
      basementType: 'none',
      roofExtension: 'none',
      workNature: 'labor_only'
  });

  // 💰 البيانات المالية والدفعات (Financials) 💰
  const [financials, setFinancials] = useState<any>({ 
      type: 'fixed', 
      totalAmount: 0, 
      milestones: [] 
  });
  
  const [fetchedStages, setFetchedStages] = useState<{ value: string, label: string }[]>([]);
  const [isRefLoading, setIsRefLoading] = useState(false);
  const syncedRef = useRef(false);

  // 🛡️ محرك المزامنة الفورية الجذري (Zero-Latency Sync) 🛡️
  useEffect(() => {
    if (isOpen && transaction && !syncedRef.current) {
        const q = transaction as any;
        
        // 1. مزامنة المواصفات
        setSpecs({
            totalArea: Number(q.totalArea || q.contract?.specs?.totalArea) || 0,
            floorsCount: Number(q.floorsCount || q.contract?.specs?.floorsCount) || 1,
            basementType: q.basementType || q.contract?.specs?.basementType || 'none',
            roofExtension: q.roofExtension || q.contract?.specs?.roofExtension || 'none',
            workNature: q.workNature || q.contract?.specs?.workNature || 'labor_only'
        });

        // 2. مزامنة الدفعات والنسب
        const type = q.financialsType || q.contract?.financialsType || 'fixed';
        const rawItems = q.items || q.contract?.clauses || [];
        
        setFinancials({
            type: type,
            totalAmount: Number(q.totalAmount || q.contract?.totalAmount) || 0,
            milestones: rawItems.map((item: any, idx: number) => ({
                id: item.id || generateId(),
                name: item.description || item.name || `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
                condition: item.triggerCondition || item.condition || '',
                value: type === 'percentage' ? (Number(item.percentage) || 0) : (Number(item.unitPrice || item.amount) || 0)
            }))
        });
        
        syncedRef.current = true;
    }
    
    if (!isOpen) {
        syncedRef.current = false;
    }
  }, [isOpen, transaction]);

  // جلب مراحل العمل المعتمدة
  useEffect(() => {
    if (!isOpen || !firestore || !tenantId) return;
    const fetchRefData = async () => {
      setIsRefLoading(true);
      try {
        const stagesSnap = await getDocs(query(collectionGroup(firestore, 'workStages'), where('companyId', '==', tenantId)));
        const stages = Array.from(new Map(stagesSnap.docs.map(doc => {
            const name = doc.data().name;
            return [name, { value: name, label: name }];
        })).values());
        setFetchedStages(stages);
      } catch (e) { console.error(e); }
      finally { setIsRefLoading(false); }
    };
    fetchRefData();
  }, [isOpen, firestore, tenantId]);

  // ✨ صمام أمان العرض (WBS LINK Safe Options) ✨
  const wbsOptions = useMemo(() => {
      const currentValues = financials.milestones.map((m: any) => m.condition).filter(Boolean);
      const existingValues = new Set(fetchedStages.map(s => s.value));
      const fallbacks = currentValues
        .filter(v => !existingValues.has(v))
        .map(v => ({ value: v, label: v }));
      
      return [...fetchedStages, ...fallbacks];
  }, [fetchedStages, financials.milestones]);

  const currentTotalInput = useMemo(() => 
    (financials.milestones || []).reduce((sum: number, m: any) => sum + (Number(m.value) || 0), 0)
  , [financials.milestones]);

  useEffect(() => {
    if (financials.type === 'fixed') {
        setFinancials((prev: any) => ({ ...prev, totalAmount: currentTotalInput }));
    }
  }, [currentTotalInput, financials.type]);

  const handleSubmit = async () => {
    if (!firestore || !currentUser || !clientId || isSaving || !tenantId) return;
    
    if (financials.type === 'percentage' && Math.abs(currentTotalInput - 100) > 0.01) {
        toast({ variant: 'destructive', title: 'خلل مالي', description: 'يجب أن يكون مجموع نسب الدفعات 100% بالضبط.' });
        return;
    }

    setIsSaving(true);
    try {
        let newTxId = '';
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
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
                transactionType: transaction?.transactionType || transaction?.subject || 'عقد مبيعات',
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
                    entryNumber: `JV-PR-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(), 
                    narration: `إثبات مديونية عقد: ${transaction?.transactionType || transaction?.subject || ''} لـ ${clientName}`,
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

        toast({ title: 'نجاح تفعيل العقد', description: 'تم إنشاء العقد المباشر والترحيل المالي بنجاح.' });
        onClose();
        router.push(`/dashboard/construction/projects/new?clientId=${clientId}&transactionId=${newTxId}`);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في الربط المالي', description: e.message });
    } finally { setIsSaving(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-5xl h-[95vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl bg-white" 
        dir="rtl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-8 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><FileSignature className="h-8 w-8"/></div>
                <div className="text-right">
                    <DialogTitle className="text-2xl font-black text-[#1e1b4b]">توقيع العقد المعتمد</DialogTitle>
                    <DialogDescription className="font-bold text-slate-500">مراجعة وتأكيد بنود العرض الفني والمالي لبدء التنفيذ الميداني.</DialogDescription>
                </div>
            </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-white">
            <div className="p-8 space-y-12">
                <section className="space-y-6">
                    <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-indigo-600 pr-4">
                        <Target className="h-7 w-7 text-indigo-600" /> المواصفات الإنشائية (Synced)
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-10 border-4 border-slate-50 rounded-[3rem] bg-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500/10" />
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1 flex items-center gap-1">
                                <Ruler className="h-3 w-3" /> المساحة (م²)
                            </Label>
                            <Input 
                                type="number" 
                                value={specs.totalArea} 
                                onChange={e => setSpecs({...specs, totalArea: Number(e.target.value)})} 
                                className="h-12 font-black text-2xl text-indigo-600 rounded-xl bg-indigo-50/20 border-indigo-100 shadow-inner" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1 flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> عدد الأدوار
                            </Label>
                            <Input 
                                type="number" 
                                value={specs.floorsCount} 
                                onChange={e => setSpecs({...specs, floorsCount: Number(e.target.value)})} 
                                className="h-12 font-black text-2xl rounded-xl shadow-inner" 
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">خيار السرداب</Label>
                            <Select value={specs.basementType} onValueChange={v => setSpecs({...specs, basementType: v})}>
                                <SelectTrigger className="h-12 rounded-xl font-black bg-white border-2"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl" className="rounded-xl">
                                    <SelectItem value="none">بدون سرداب</SelectItem>
                                    <SelectItem value="full">كامل</SelectItem>
                                    <SelectItem value="half">نصف دور</SelectItem>
                                    <SelectItem value="vault">قبو</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 pr-1">توسعة السطح</Label>
                            <Select value={specs.roofExtension} onValueChange={v => setSpecs({...specs, roofExtension: v})}>
                                <SelectTrigger className="h-12 rounded-xl font-black bg-white border-2"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl" className="rounded-xl">
                                    <SelectItem value="none">لا يوجد</SelectItem>
                                    <SelectItem value="quarter">ربع دور</SelectItem>
                                    <SelectItem value="half">نصف دور</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </section>

                <section className="space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 pr-4 border-r-8 border-primary">
                        <h3 className="text-xl font-black flex items-center gap-3 text-[#1e1b4b]">
                            <Calculator className="h-7 w-7 text-primary"/> الدفعات المالية (حرّة التعديل)
                        </h3>
                        <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-2xl border no-print">
                            <Label className="text-xs font-black text-slate-500">نظام الدفع:</Label>
                            <Select value={financials.type} onValueChange={v => setFinancials({...financials, type: v})}>
                                <SelectTrigger className="w-44 h-10 rounded-xl border-none bg-white font-black text-primary shadow-md"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl" className="rounded-xl">
                                    <SelectItem value="fixed">مبلغ ثابت (KD)</SelectItem>
                                    <SelectItem value="percentage">نسب مئوية (%)</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {financials.type === 'percentage' && (
                                <div className="flex items-center gap-2 border-r pr-4 mr-2 animate-in zoom-in-95">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">إجمالي العقد:</Label>
                                    <Input 
                                        type="number" 
                                        value={financials.totalAmount} 
                                        onChange={e => setFinancials({...financials, totalAmount: Number(e.target.value)})} 
                                        className={cn("w-32 h-10 border-none text-center font-black text-xl text-primary rounded-xl shadow-md bg-white")} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="border-4 border-slate-50 rounded-[3rem] overflow-hidden shadow-2xl bg-white/95">
                        <Table>
                            <TableHeader className="bg-slate-900 h-16">
                                <TableRow className="border-none">
                                    <TableHead className="w-24 text-center font-black text-white/40 border-l border-white/10">#</TableHead>
                                    <TableHead className="px-10 font-black text-white text-right text-lg">شرط الاستحقاق الميداني (WBS LINK)</TableHead>
                                    <TableHead className="text-center w-64 font-black text-white text-lg">
                                        {financials.type === 'percentage' ? 'النسبة (%)' : 'المبلغ (د.ك)'}
                                    </TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(financials.milestones || []).map((m: any, i: number) => (
                                    <TableRow key={m.id} className="h-24 border-b last:border-0 hover:bg-primary/[0.02] transition-all group">
                                        <TableCell className="text-center bg-slate-50/50 border-l">
                                            <Badge variant="secondary" className="font-black text-sm px-4 h-8 rounded-full border bg-white text-slate-900 shadow-sm">
                                                {i+1}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-10">
                                            <Label className="text-[9px] font-black text-primary uppercase mb-1 block opacity-40">ارتباط سير العمل الميداني:</Label>
                                            <InlineSearchList 
                                                value={m.condition} 
                                                onSelect={v => { const newM = [...financials.milestones]; newM[i].condition = v; setFinancials({...financials, milestones: newM}); }} 
                                                options={wbsOptions} 
                                                placeholder="اربط بمرحلة ميدانية..." 
                                                className="h-12 text-sm border-dashed border-2 border-primary/20 bg-primary/[0.02] font-black text-primary rounded-xl" 
                                            />
                                        </TableCell>
                                        <TableCell className="bg-primary/[0.01] border-r border-slate-50">
                                            <Input 
                                                type="number" step="any" 
                                                value={m.value} 
                                                onChange={e => { const newM = [...financials.milestones]; newM[i].value = parseFloat(e.target.value) || 0; setFinancials({...financials, milestones: newM}); }} 
                                                className="text-center font-black text-4xl text-primary border-none shadow-none focus-visible:ring-0 bg-transparent font-mono h-16" 
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" onClick={() => setFinancials({...financials, milestones: financials.milestones.filter((x: any) => x.id !== m.id)})} className="text-red-300 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                                                <Trash2 className="h-5 w-5"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-primary h-28 text-white">
                                <TableRow className="border-none hover:bg-transparent">
                                    <TableCell colSpan={2} className="text-right px-12">
                                        <p className="text-3xl font-black tracking-tight">إجمالي قيمة التعاقد المبرم:</p>
                                        <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-40 mt-1">Total Fixed Contract Sum</p>
                                    </TableCell>
                                    <TableCell className="text-center border-r border-white/10 bg-white/10">
                                        <div className="flex flex-col items-center">
                                            <div className={cn("text-5xl font-black font-mono tracking-tighter", financials.type === 'percentage' && Math.abs(currentTotalInput - 100) > 0.01 ? 'text-red-400' : 'text-white')}>
                                                {financials.type === 'fixed' ? formatCurrency(currentTotalInput) : `${currentTotalInput}%`}
                                            </div>
                                            {financials.type === 'percentage' && Math.abs(currentTotalInput - 100) > 0.01 && (
                                                <div className="flex items-center gap-1 text-[10px] font-black text-red-200 mt-2 uppercase animate-pulse">
                                                    <AlertCircle className="h-3 w-3" /> يجب أن يكون المجموع 100%
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableFooter>
                        </Table>
                        <div className="p-8 flex justify-center bg-muted/5 border-t border-dashed">
                            <Button variant="outline" onClick={() => setFinancials({...financials, milestones: [...financials.milestones, {id: generateId(), name: `الدفعة الجديدة`, value: 0, condition: ''}]})} className="h-14 px-12 rounded-2xl border-dashed border-2 font-black text-primary gap-3 hover:bg-white shadow-xl hover:scale-105 transition-all active:scale-95">
                                <PlusCircle className="h-6 w-6" /> إضافة دفعة استحقاق يدوية +
                            </Button>
                        </div>
                    </div>
                </section>
            </div>
        </ScrollArea>

        <DialogFooter className="p-10 border-t bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
            <div className="text-right space-y-1">
                <p className="text-sm font-black text-primary flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 animate-pulse"/> سيتم إنشاء قيد مديونية آلي بـ {financials.type === 'fixed' ? formatCurrency(currentTotalInput) : formatCurrency(financials.totalAmount)}
                </p>
                <p className="text-[11px] text-muted-foreground font-bold pr-9">الاعتماد النهائي يغير حالة العميل آلياً ويبدأ دورة التنفيذ الميداني للمشاريع.</p>
            </div>
            <div className="flex gap-4">
                <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8 text-slate-400">إلغاء</Button>
                <Button 
                    onClick={handleSubmit} 
                    disabled={isSaving || financials.milestones.length === 0 || (financials.type === 'percentage' && Math.abs(currentTotalInput - 100) > 0.01)} 
                    className="h-20 px-24 rounded-[2.2rem] font-black text-3xl shadow-2xl shadow-primary/40 gap-4 bg-[#7209B7] text-white border-none transition-all active:scale-95"
                >
                    {isSaving ? <Loader2 className="animate-spin h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
                    توقيع واعتـماد العقـد
                </Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
