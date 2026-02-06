
'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DateInput } from '../ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Account } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

interface ResidencyRenewalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

export function ResidencyRenewalDialog({ isOpen, onClose, employee }: ResidencyRenewalDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  
  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>();
  const [cost, setCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSaveAndCreateVoucher = async () => {
    if (!firestore || !currentUser || !newExpiryDate || !cost) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال تاريخ الانتهاء الجديد والتكلفة.' });
      return;
    }

    setIsSaving(true);
    
    try {
        await runTransaction(firestore, async (transaction) => {
            // 1. Get required accounts
            const expenseAccountQuery = query(collection(firestore, 'chartOfAccounts'), where('code', '==', '110301'), limit(1)); // مصروفات مدفوعة مقدماً
            const expenseAccountSnap = await transaction.get(expenseAccountQuery);
            if(expenseAccountSnap.empty) throw new Error("حساب المصروفات المقدمة غير موجود.");
            const debitAccount = { id: expenseAccountSnap.docs[0].id, ...expenseAccountSnap.docs[0].data() as Account };

            // 2. Get next voucher number
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'paymentVouchers');
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            const newVoucherNumber = `PV-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });

            // 3. Create Draft Payment Voucher
            const renewalCost = parseFloat(cost);
            const newVoucherRef = doc(collection(firestore, 'paymentVouchers'));
            const voucherData = {
                voucherNumber: newVoucherNumber, voucherSequence: nextNumber, voucherYear: currentYear,
                payeeName: 'وزارة الداخلية - شؤون الإقامة',
                payeeType: 'vendor' as const,
                employeeId: employee.id,
                renewalExpiryDate: newExpiryDate,
                amount: renewalCost,
                amountInWords: '', // This will be filled by accountant
                paymentDate: new Date(),
                paymentMethod: 'Cash' as const,
                description: `رسوم تجديد إقامة الموظف: ${employee.fullName}`,
                debitAccountId: debitAccount.id,
                debitAccountName: debitAccount.name,
                creditAccountId: '', // To be filled by accountant
                creditAccountName: '', // To be filled by accountant
                status: 'draft' as const,
                createdAt: serverTimestamp(),
            };
            transaction.set(newVoucherRef, voucherData);
            
            // 4. Optionally, create a draft journal entry if needed (or let the accountant do it)
            // For now, we will let the accountant handle the JE upon payment.
        });

        // 5. Send notification to accountants
        const accountantsQuery = query(collection(firestore, 'users'), where('role', '==', 'Accountant'));
        const accountantsSnap = await getDocs(accountantsQuery);
        for (const userDoc of accountantsSnap.docs) {
             await createNotification(firestore, {
                userId: userDoc.id,
                title: 'مطلوب مراجعة سند صرف',
                body: `قام ${currentUser?.fullName} بطلب صرف رسوم تجديد إقامة لـ ${employee.fullName}. السند في انتظار اختيار حساب الدفع.`,
                link: '/dashboard/accounting/payment-vouchers'
            });
        }
        
        toast({ title: 'تم إرسال الطلب', description: 'تم إنشاء سند صرف مسودة وإرسال إشعار للمحاسبة.' });
        onClose();
    } catch(error) {
        const message = error instanceof Error ? error.message : 'فشل إرسال طلب تجديد الإقامة.';
        toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تجديد إقامة موظف</DialogTitle>
          <DialogDescription>
            إدخال بيانات تجديد إقامة الموظف "{employee.fullName}". سيتم إنشاء سند صرف مسودة للمحاسب لاعتماده.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-expiry-date">تاريخ الانتهاء الجديد <span className="text-destructive">*</span></Label>
            <DateInput id="new-expiry-date" value={newExpiryDate} onChange={setNewExpiryDate} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="renewal-cost">تكلفة التجديد (بالدينار) <span className="text-destructive">*</span></Label>
            <Input
              id="renewal-cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.000"
              dir="ltr"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button type="button" onClick={handleSaveAndCreateVoucher} disabled={isSaving || !newExpiryDate || !cost}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري الإرسال...' : 'إرسال طلب الصرف للمحاسبة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

  