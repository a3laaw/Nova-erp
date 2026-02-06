

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
import type { Employee } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ResidencyRenewalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

export function ResidencyRenewalDialog({ isOpen, onClose, employee }: ResidencyRenewalDialogProps) {
  const { toast } = useToast();
  const router = useRouter();

  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>();
  const [cost, setCost] = useState('');
  
  const handleSaveAndCreateVoucher = () => {
    if (!newExpiryDate) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال تاريخ انتهاء الإقامة الجديد.' });
      return;
    }

    const renewalCost = parseFloat(cost) || 0;

    const params = new URLSearchParams();
    params.set('source', 'residency_renewal');
    params.set('employeeId', employee.id!);
    params.set('newExpiryDate', newExpiryDate.toISOString());
    params.set('payeeName', 'وزارة الداخلية - شؤون الإقامة');
    params.set('amount', String(renewalCost));
    params.set('description', `رسوم تجديد إقامة الموظف: ${employee.fullName}`);
    // Pre-select 'Expenses Paid in Advance' account (Asset)
    params.set('debitAccountCode', '110301');

    router.push(`/dashboard/accounting/payment-vouchers/new?${params.toString()}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تجديد إقامة موظف</DialogTitle>
          <DialogDescription>
            تحديث تاريخ انتهاء الإقامة للموظف "{employee.fullName}". سيتم توجيهك لإنشاء سند صرف لتوثيق التكلفة.
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
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="button" onClick={handleSaveAndCreateVoucher} disabled={!newExpiryDate}>
            <Save className="ml-2 h-4 w-4" />
            التالي (إنشاء سند الصرف)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
