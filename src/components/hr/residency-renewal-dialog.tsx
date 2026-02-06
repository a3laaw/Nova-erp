
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
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, writeBatch, serverTimestamp, collection, addDoc, runTransaction } from 'firebase/firestore';
import type { Employee, PaymentVoucher, Account } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Loader2, Save } from 'lucide-react';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface ResidencyRenewalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

export function ResidencyRenewalDialog({ isOpen, onClose, employee }: ResidencyRenewalDialogProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>();
  const [cost, setCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!newExpiryDate) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال تاريخ انتهاء الإقامة الجديد.' });
      return;
    }
    if (!firestore || !currentUser) return;

    setIsSaving(true);
    const renewalCost = parseFloat(cost) || 0;

    try {
      const batch = writeBatch(firestore);
      const employeeRef = doc(firestore, 'employees', employee.id!);
      const auditLogRef = doc(collection(firestore, `employees/${employee.id}/auditLogs`));

      // 1. Update residency expiry date
      batch.update(employeeRef, { residencyExpiry: newExpiryDate });

      // 2. Create an audit log for the change
      const logData = {
        changeType: 'ResidencyUpdate',
        field: 'residencyExpiry',
        oldValue: employee.residencyExpiry,
        newValue: newExpiryDate,
        effectiveDate: serverTimestamp(),
        changedBy: currentUser.id,
        notes: `تجديد الإقامة بتكلفة ${formatCurrency(renewalCost)}`,
      };
      batch.set(auditLogRef, logData);
      
      await batch.commit();

      toast({
        title: 'نجاح!',
        description: 'تم تحديث تاريخ انتهاء الإقامة بنجاح.',
      });

      if (renewalCost > 0) {
        toast({
          title: 'إجراء مطلوب',
          description: `الرجاء إنشاء سند صرف لتوثيق تكلفة التجديد البالغة ${formatCurrency(renewalCost)}.`,
          duration: 10000,
          action: (
            <Button size="sm" onClick={() => router.push(`/dashboard/accounting/payment-vouchers/new?payeeType=employee&payeeName=${encodeURIComponent(employee.fullName)}&amount=${renewalCost}&description=${encodeURIComponent(`تجديد إقامة الموظف ${employee.fullName}`)}`)}>
              إنشاء السند الآن
            </Button>
          ),
        });
      }

      onClose();
    } catch (error) {
      console.error("Error renewing residency:", error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث تاريخ الإقامة.' });
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
            تحديث تاريخ انتهاء الإقامة للموظف "{employee.fullName}" وتوثيق التكلفة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-expiry-date">تاريخ الانتهاء الجديد <span className="text-destructive">*</span></Label>
            <DateInput id="new-expiry-date" value={newExpiryDate} onChange={setNewExpiryDate} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="renewal-cost">تكلفة التجديد (اختياري)</Label>
            <Input
              id="renewal-cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.000"
              dir="ltr"
            />
             <p className="text-xs text-muted-foreground">
                إذا تم إدخال تكلفة، سيتم تذكيرك بإنشاء سند صرف لتوثيقها.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !newExpiryDate}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            حفظ التجديد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
