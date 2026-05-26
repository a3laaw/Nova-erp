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
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X, FileSignature, Calculator, ShieldCheck } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, collection, serverTimestamp, getDocs, query, runTransaction, limit, where, orderBy, getDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cleanFirestoreData, getTenantPath } from '@/lib/utils';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { InlineSearchList } from '../ui/inline-search-list';

const generateId = () => Math.random().toString(36).substring(2, 9);
const arabicOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

export function ContractClausesForm({ isOpen, onClose, transaction, clientId, clientName, quotationIdToUpdate }: any) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const tenantId = currentUser?.currentCompanyId;
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  
  const [specs, setSpecs] = useState<any>({ totalArea: 0, floorsCount: 1, basementType: 'none', roofExtension: 'none', workNature: 'labor_only' });
  const [financials, setFinancials] = useState<any>({ type: 'fixed', totalAmount: 0, milestones: [] });
  const [fetchedStages, setFetchedStages] = useState<{ value: string, label: string }[]>([]);

  useEffect(() => {
    if (isOpen && transaction) {
        const q = transaction as any;
        setSpecs({
            totalArea: Number(q.totalArea || 0),
            floorsCount: Number(q.floorsCount || 1),
            basementType: q.basementType || 'none',
            roofExtension: q.roofExtension || 'none',
            workNature: q.workNature || 'labor_only'
        });
        const type = q.financialsType || 'fixed';
        const rawItems = q.items || [];
        setFinancials({
            type: type,
            totalAmount: Number(q.totalAmount || 0),
            milestones: rawItems.map((item: any, idx: number) => ({
                id: item.id || generateId(),
                name: item.description || `الدفعة ${arabicOrdinals[idx] || (idx + 1)}`,
                condition: item.triggerCondition || (idx === 0 ? 'عند توقيع العقد' : ''), 
                value: type === 'percentage' ? (Number(item.percentage) || 0) : (Number(item.unitPrice) || 0)
            }))
        });
    }
  }, [isOpen, transaction]);

  useEffect(() => {
    if (!isOpen || !firestore || !tenantId) return;
    getDocs(query(collectionGroup(firestore, 'workStages'), where('companyId', '==', tenantId))).then(snap => {
        const stages = Array.from(new Map(snap.docs.map(doc => [doc.data().name, { value: doc.data().name, label: doc.data().name }])).values());
        setFetchedStages([{ value: 'عند توقيع العقد', label: 'عند توقيع العقد' }, ...stages]);
    });
  }, [isOpen, firestore, tenantId]);

  const handleSubmit = async () => {
    if (!firestore || !currentUser || !clientId || isSaving || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    const targetTxId = transaction.transactionId || transaction.id;

    try {
        const coaPath = getTenantPath('chartOfAccounts', tenantId);
        const revenueAccSnap = await getDocs(query(collection(firestore, coaPath!), where('code', '==', '4101'), limit(1)));
        const clientAccSnap = await getDocs(query(collection(firestore, coaPath!), where('name', '==', clientName), where('parentCode', '==', '1102'), limit(1)));
        
        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            const jeCounterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
            const coaSubCounterRef = doc(firestore, getTenantPath('counters/coa_clients', tenantId)!);
            
            const [jeCounterDoc, coaSubCounterDoc] = await Promise.all([transaction_fs.get(jeCounterRef), transaction_fs.get(coaSubCounterRef)]);

            let clientAccountId = clientAccSnap.docs[0]?.id;
            if (!clientAccountId) {
                const nextClientNum = (coaSubCounterDoc.data()?.lastNumber || 0) + 1;
                const clientCode = `1102C${String(nextClientNum).padStart(4, '0')}`;
                const newAccRef = doc(collection(firestore, coaPath));
                clientAccountId = newAccRef.id;
                transaction_fs.set(newAccRef, { code: clientCode, name: clientName, type: 'asset', level: 3, parentCode: '1102', isPayable: true, companyId: tenantId, createdAt: serverTimestamp() });
                transaction_fs.set(coaSubCounterRef, { lastNumber: nextClientNum }, { merge: true });
            }

            const txPath = getTenantPath(`clients/${clientId}/transactions/${targetTxId}`, tenantId);
            const finalClauses = financials.milestones.map((m: any) => ({ ...m, amount: financials.type === 'percentage' ? (m.value / 100) * financials.totalAmount : m.value, status: 'غير مستحقة' }));

            transaction_fs.update(doc(firestore, txPath!), {
                status: 'in-progress',
                contract: cleanFirestoreData({ clauses: finalClauses, totalAmount: financials.totalAmount, financialsType: financials.type, specs }),
                updatedAt: serverTimestamp()
            });

            const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            
            // 🛡️ المزامنة المالية السيادية (V100.0): إثبات القيد بالتاريخ المعتمد والوصف الذكي وحالة الترحيل 🛡️
            transaction_fs.set(doc(collection(firestore, getTenantPath('journalEntries', tenantId)!)), cleanFirestoreData({
                entryNumber: `JV-PR-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                date: serverTimestamp(), 
                narration: `[عقد مالي] إثبات مديونية: ${transaction.transactionType || transaction.subject} لـ ${clientName}`,
                totalDebit: financials.totalAmount, 
                totalCredit: financials.totalAmount, 
                status: 'posted', 
                lines: [
                    { accountId: clientAccountId, accountName: clientName, debit: financials.totalAmount, credit: 0, auto_profit_center: targetTxId },
                    { accountId: revenueAccSnap.docs[0]?.id, accountName: 'إيرادات عقود', debit: 0, credit: financials.totalAmount, auto_profit_center: targetTxId }
                ],
                clientId, 
                transactionId: targetTxId, 
                createdAt: serverTimestamp(), 
                createdBy: currentUser.id, 
                companyId: tenantId
            }));

            if (quotationIdToUpdate) {
                // 🛡️ تحديث حالة عرض السعر إلى "تم" (Accepted) آلياً 🛡️
                transaction_fs.update(doc(firestore, getTenantPath(`quotations/${quotationIdToUpdate}`, tenantId)!), { status: 'accepted' });
            }

            transaction_fs.set(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum }, { merge: true });
        });

        toast({ title: '✅ تم توقيع العقد وإنشاء القيد المحاسبي' });
        onClose();
        router.push(`/dashboard/clients/${clientId}`);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message });
    } finally { setIsSaving(false); savingRef.current = false; }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white" dir="rtl">
        <DialogHeader className="p-8 bg-primary/5 border-b shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary rounded-2xl text-white shadow-xl"><FileSignature className="h-6 w-6"/></div>
                <DialogTitle className="text-2xl font-black text-[#1e1b4b]">تفعيل العقد المالي</DialogTitle>
            </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-8">
            <div className="space-y-8">
                <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 rounded-3xl border-2 border-dashed">
                    <div className="grid gap-1"><Label className="text-[10px] font-black text-slate-400">المساحة</Label><Input type="number" value={specs.totalArea} onChange={e => setSpecs({...specs, totalArea: e.target.value})} className="h-10 rounded-xl" /></div>
                    <div className="grid gap-1"><Label className="text-[10px] font-black text-slate-400">الأدوار</Label><Input type="number" value={specs.floorsCount} onChange={e => setSpecs({...specs, floorsCount: e.target.value})} className="h-10 rounded-xl" /></div>
                    <div className="grid gap-1"><Label className="text-[10px] font-black text-slate-400">نظام الدفع</Label><Badge className="bg-primary h-10 rounded-xl justify-center font-black">{financials.type === 'fixed' ? 'مبالغ ثابتة' : 'نسب مئوية'}</Badge></div>
                    <div className="grid gap-1"><Label className="text-[10px] font-black text-slate-400">إجمالي العقد</Label><div className="h-10 rounded-xl bg-white border-2 flex items-center justify-center font-black text-primary font-mono">{formatCurrency(financials.totalAmount)}</div></div>
                </div>
                <div className="border-2 rounded-[2rem] overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-900 h-12">
                            <TableRow><TableHead className="w-16 text-center text-white border-l border-white/10 font-black">#</TableHead><TableHead className="px-6 font-black text-white text-right">شرط الاستحقاق (الربط الميداني)</TableHead><TableHead className="text-center w-48 font-black text-white">المبلغ / النسبة</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {financials.milestones.map((m: any, i: number) => (
                                <TableRow key={m.id} className="h-16 border-b last:border-0 hover:bg-primary/[0.02]">
                                    <TableCell className="text-center font-black text-slate-400 border-l">{i+1}</TableCell>
                                    <TableCell className="px-6"><InlineSearchList value={m.condition} onSelect={v => { const newM = [...financials.milestones]; newM[i].condition = v; setFinancials({...financials, milestones: newM}); }} options={fetchedStages} placeholder="اربط بمرحلة..." allowCustomValue className="h-10" /></TableCell>
                                    <TableCell className="text-center font-black font-mono text-primary text-xl bg-primary/5">{financials.type === 'percentage' ? `${m.value}%` : formatCurrency(m.value)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </ScrollArea>
        <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3">
            <Button variant="ghost" onClick={onClose} disabled={isSaving} className="rounded-xl font-bold h-12 px-8">تراجع</Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="rounded-xl font-black h-12 px-12 shadow-xl shadow-primary/30 gap-2">
                {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />} تفعيل العقد والقيود
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
