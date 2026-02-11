'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, runTransaction, collection, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Loader2, Save } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { formatCurrency } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

interface BankTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
}

interface GroupedReconciliationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bankTx: BankTransaction;
  systemJEs: JournalEntry[];
  bankAccountId: string;
  accounts: Account[];
}

export function GroupedReconciliationDialog({ isOpen, onClose, onSuccess, bankTx, systemJEs, bankAccountId, accounts }: GroupedReconciliationDialogProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [feeAccountId, setFeeAccountId] = useState('');

  const { grossAmount, netAmount, fee, canReconcile } = useMemo(() => {
    const gross = systemJEs.reduce((sum, je) => {
        const line = je.lines.find(l => l.accountId === bankAccountId);
        // system transactions are credits, so amount is negative. we need positive for this calc.
        return sum + Math.abs((line?.credit || 0) - (line?.debit || 0));
    }, 0);
    const net = bankTx.amount;
    const calculatedFee = gross - net;
    return {
      grossAmount: gross,
      netAmount: net,
      fee: calculatedFee,
      canReconcile: gross > 0 && net > 0 && calculatedFee >= 0,
    };
  }, [bankTx, systemJEs, bankAccountId]);

  const feeAccountOptions = useMemo(() => {
    return accounts
      .filter(a => a.code.startsWith('5') && !a.code.startsWith('51')) // General expenses
      .map(a => ({ value: a.id!, label: `${a.name} (${a.code})` }));
  }, [accounts]);
  
  const handleConfirm = async () => {
    if (!canReconcile || !feeAccountId || !firestore || !currentUser) {
        toast({variant: 'destructive', title: 'خطأ', description: 'بيانات غير كافية أو غير صحيحة لإتمام العملية.'});
        return;
    }
    setIsSaving(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const batch = writeBatch(firestore);

            const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
            const jeCounterDoc = await transaction.get(jeCounterRef);
            const currentYear = new Date().getFullYear();
            const nextNumber = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
            const newEntryNumber = `JV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            transaction.set(jeCounterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

            const newJeRef = doc(collection(firestore, 'journalEntries'));
            const bankAccount = accounts.find(a => a.id === bankAccountId)!;
            const feeAccount = accounts.find(a => a.id === feeAccountId)!;

            const lines = [];
            // Debit Bank with net amount
            lines.push({ accountId: bankAccountId, accountName: bankAccount.name, debit: netAmount, credit: 0 });
            // Debit Fee account with fee amount
            lines.push({ accountId: feeAccountId, accountName: feeAccount.name, debit: fee, credit: 0 });

            // Credit A/R for each original transaction
            for(const je of systemJEs) {
                const arLine = je.lines.find(l => l.accountId !== bankAccountId && (l.credit > 0 || l.debit > 0));
                if (arLine) {
                    const originalAmount = arLine.debit > 0 ? arLine.debit : arLine.credit;
                    lines.push({ accountId: arLine.accountId, accountName: arLine.accountName, debit: 0, credit: originalAmount, ... (arLine.auto_profit_center && { auto_profit_center: arLine.auto_profit_center }) });
                }
            }
            
            const newJeData = {
                entryNumber: newEntryNumber,
                date: bankTx.date,
                narration: `تسوية دفعة مجمعة من وسيط دفع - ${bankTx.description}`,
                status: 'posted',
                reconciliationStatus: 'reconciled',
                reconciliationInfo: { reconciledAt: new Date() },
                totalDebit: grossAmount,
                totalCredit: grossAmount,
                lines,
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
            };
            transaction.set(newJeRef, newJeData);

            for (const je of systemJEs) {
                const originalJeRef = doc(firestore, 'journalEntries', je.id!);
                transaction.update(originalJeRef, {
                    reconciliationStatus: 'reconciled',
                    reconciliationInfo: {
                        reconciledAt: new Date(),
                        reconciledBy: currentUser.id,
                        bankTransactionId: bankTx.id,
                        reconciliationEntryId: newJeRef.id,
                    }
                });
            }
        });
        toast({ title: 'نجاح', description: 'تمت تسوية الدفعة المجمعة بنجاح.' });
        onSuccess();
        onClose();
    } catch(e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في إنشاء قيد التسوية.' });
        console.error(e);
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent dir="rtl">
            <DialogHeader>
                <DialogTitle>تسوية دفعة مجمعة</DialogTitle>
                <DialogDescription>
                    تأكيد مطابقة عدة حركات من النظام مع إيداع بنكي واحد.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-2 bg-muted rounded-md"><p className="text-xs text-muted-foreground">إجمالي الحركات</p><p className="font-bold">{formatCurrency(grossAmount)}</p></div>
                    <div className="p-2 bg-muted rounded-md"><p className="text-xs text-muted-foreground">صافي الإيداع</p><p className="font-bold">{formatCurrency(netAmount)}</p></div>
                    <div className="p-2 bg-red-50 rounded-md"><p className="text-xs text-red-700">رسوم الوسيط</p><p className="font-bold text-red-700">{formatCurrency(fee)}</p></div>
                </div>
                {!canReconcile && (
                    <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>بيانات غير صحيحة</AlertTitle><AlertDescription>لا يمكن المتابعة. تأكد من أن مبلغ الإيداع أقل من إجمالي الحركات وأن الفرق (الرسوم) موجب.</AlertDescription></Alert>
                )}
                <div className="grid gap-2">
                    <Label htmlFor="fee-account">حساب مصروف رسوم الوسيط</Label>
                    <InlineSearchList 
                        value={feeAccountId}
                        onSelect={setFeeAccountId}
                        options={feeAccountOptions}
                        placeholder="اختر حساب المصروف..."
                        disabled={!canReconcile}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>إلغاء</Button>
                <Button onClick={handleConfirm} disabled={isSaving || !feeAccountId || !canReconcile}>
                    {isSaving ? <Loader2 className="animate-spin ml-2"/> : <Save className="ml-2"/>}
                    تأكيد التسوية وإنشاء القيد
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  )
}
