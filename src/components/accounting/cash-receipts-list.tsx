'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { CashReceipt } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { Badge } from '../ui/badge';

const paymentMethodTranslations: Record<string, string> = {
    'Cash': 'نقداً',
    'Cheque': 'شيك',
    'Bank Transfer': 'تحويل بنكي',
    'K-Net': 'كي-نت'
};

export function CashReceiptsList() {
  const { firestore } = useFirebase();

  const receiptsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cashReceipts'), orderBy('receiptDate', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(receiptsQuery);

  const receipts = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashReceipt));
  }, [snapshot]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      return format(dateValue.toDate(), 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم السند</TableHead>
                        <TableHead>اسم العميل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead className="text-left">المبلغ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }
  
  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة السندات.</div>;
  }

  if (receipts.length === 0) {
    return (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد سندات قبض</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                ابدأ بإنشاء سند قبض جديد ليظهر هنا.
            </p>
        </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>رقم السند</TableHead>
            <TableHead>اسم العميل</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>طريقة الدفع</TableHead>
            <TableHead className="text-left">المبلغ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {receipts.map((receipt) => (
            <TableRow key={receipt.id}>
              <TableCell className="font-mono">{receipt.voucherNumber}</TableCell>
              <TableCell>{receipt.clientNameAr}</TableCell>
              <TableCell>{formatDate(receipt.receiptDate)}</TableCell>
              <TableCell>
                  <Badge variant="outline">{paymentMethodTranslations[receipt.paymentMethod] || receipt.paymentMethod}</Badge>
              </TableCell>
              <TableCell className="text-left font-mono">{formatCurrency(receipt.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
