
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
        const queryParams = new URLSearchParams({
            payeeType: 'vendor',
            payeeName: 'وزارة الداخلية - شؤون الإقامة',
            amount: cost,
            description: `رسوم تجديد إقامة للموظف: ${employee.fullName}`,
            debitAccountCode: '110301', // مصروفات مدفوعة مقدماً
            employeeId: employee.id!,
            newExpiryDate: newExpiryDate.toISOString(),
            source: 'residency_renewal'
        });

        router.push(`/dashboard/accounting/payment-vouchers/new?${queryParams.toString()}`);
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
              step="0.001"
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
