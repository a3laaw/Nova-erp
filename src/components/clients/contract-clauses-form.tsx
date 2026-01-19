
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Save } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { ClientTransaction, ContractClause } from '@/lib/types';
import { contractTemplates } from '@/lib/contract-templates';
import { formatCurrency } from '@/lib/utils';

interface ContractClausesFormProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: ClientTransaction | null;
  clientId: string;
}

export function ContractClausesForm({ isOpen, onClose, transaction, clientId }: ContractClausesFormProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      if (transaction.contract?.clauses) {
        setClauses(JSON.parse(JSON.stringify(transaction.contract.clauses)));
      } else {
        const template = contractTemplates.find(t => t.transactionTypes.includes(transaction.transactionType));
        if (template) {
          // Deep copy to avoid mutating template
          setClauses(JSON.parse(JSON.stringify(template.clauses)));
        } else {
          setClauses([]);
        }
      }
    }
  }, [isOpen, transaction]);

  const handleAmountChange = (index: number, newAmount: string) => {
    const updatedClauses = [...clauses];
    updatedClauses[index].amount = Number(newAmount) || 0;
    setClauses(updatedClauses);
  };

  const totalAmount = useMemo(() => {
    return clauses.reduce((acc, clause) => acc + clause.amount, 0);
  }, [clauses]);

  const handleSubmit = async () => {
    if (!firestore || !transaction?.id) return;
    setIsSaving(true);
    try {
      const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transaction.id);
      await updateDoc(transactionRef, {
        contract: {
          clauses: clauses,
          totalAmount: totalAmount,
        }
      });
      toast({ title: 'نجاح', description: 'تم حفظ بنود العقد بنجاح.' });
      onClose(); // This might trigger a re-render on the parent, which is good.
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ بنود العقد.' });
    } finally {
      setIsSaving(false);
    }
  };

  const template = transaction ? contractTemplates.find(t => t.transactionTypes.includes(transaction.transactionType)) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>إدارة بنود العقد للمعاملة</DialogTitle>
          <DialogDescription>
            {template ? `تعديل الدفعات المالية لبنود عقد "${template.title}".` : 'لا يوجد نموذج عقد لهذه المعاملة.'}
          </DialogDescription>
        </DialogHeader>
        {template ? (
          <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>البند</TableHead>
                  <TableHead className="w-[150px] text-left">المبلغ (د.ك)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clauses.map((clause, index) => (
                  <TableRow key={clause.id}>
                    <TableCell className="font-medium">{clause.name}</TableCell>
                    <TableCell>
                      <Input 
                        type="number"
                        value={clause.amount}
                        onChange={(e) => handleAmountChange(index, e.target.value)}
                        className="text-left dir-ltr"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">الإجمالي</TableCell>
                  <TableCell className="text-left font-bold font-mono">
                    {formatCurrency(totalAmount)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <p>لا يوجد نموذج عقد مرتبط بنوع هذه المعاملة: "{transaction?.transactionType}"</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button onClick={handleSubmit} disabled={isSaving || !template}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
