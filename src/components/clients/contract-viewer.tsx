'use client';

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
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ContractTemplate } from '@/lib/types';
import { AlertCircle } from 'lucide-react';


const statusColors: Record<string, string> = {
  'مدفوعة': 'bg-green-100 text-green-800 border-green-200',
  'مستحقة': 'bg-red-100 text-red-800 border-red-200',
  'غير مستحقة': 'bg-gray-100 text-gray-800 border-gray-200',
};

interface ContractViewerProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  contract: ContractTemplate | null;
}

export function ContractViewer({ isOpen, onClose, clientName, contract }: ContractViewerProps) {
  
  const content = () => {
    if (!contract) {
      return (
         <div className="py-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا يوجد عقد لهذه المعاملة</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                لم يتم تحديد نموذج عقد مطابق لنوع هذه المعاملة.
            </p>
        </div>
      )
    }

    return (
        <>
            <DialogHeader>
            <DialogTitle>{contract.title}</DialogTitle>
            <DialogDescription>
                عقد متعلق بالعميل: {clientName}
            </DialogDescription>
            </DialogHeader>
            <div className="py-4">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>البند</TableHead>
                    <TableHead className="text-left">الدفعة</TableHead>
                    <TableHead>الحالة</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {contract.clauses.map((clause) => (
                    <TableRow key={clause.id}>
                    <TableCell className="font-medium">{clause.name}</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(clause.amount)}</TableCell>
                    <TableCell>
                        <Badge variant="outline" className={statusColors[clause.status]}>{clause.status}</Badge>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell className='font-bold'>الإجمالي</TableCell>
                        <TableCell className='text-left font-bold font-mono'>{formatCurrency(contract.totalAmount)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
            </div>
        </>
    );
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        {content()}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
