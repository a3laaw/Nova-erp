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

// Placeholder data as per user's request to think about the structure.
const mockContract = {
  title: 'عقد تصميم وإشراف لمشروع فيلا سكنية',
  clientName: 'شركة المشاريع المتحدة',
  projectName: 'مشروع فيلا دبي',
  totalAmount: 5000,
  clauses: [
    { id: 1, name: 'تقديم المخططات الأولية', amount: 1000, status: 'مدفوعة' },
    { id: 2, name: 'تسليم مخططات البلدية', amount: 1500, status: 'مدفوعة' },
    { id: 3, name: 'تسليم مخططات الكهرباء والماء', amount: 1000, status: 'مستحقة' },
    { id: 4, name: 'عند الانتهاء من صب السقف الأول', amount: 750, status: 'غير مستحقة' },
    { id: 5, name: 'عند التسليم النهائي للمشروع', amount: 750, status: 'غير مستحقة' },
  ]
};

const statusColors: Record<string, string> = {
  'مدفوعة': 'bg-green-100 text-green-800 border-green-200',
  'مستحقة': 'bg-red-100 text-red-800 border-red-200',
  'غير مستحقة': 'bg-gray-100 text-gray-800 border-gray-200',
};

interface ContractViewerProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
}

export function ContractViewer({ isOpen, onClose, clientName }: ContractViewerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>{mockContract.title}</DialogTitle>
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
              {mockContract.clauses.map((clause) => (
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
                    <TableCell className='text-left font-bold font-mono'>{formatCurrency(mockContract.totalAmount)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
