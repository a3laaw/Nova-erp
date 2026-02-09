'use client';

import { useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { PaymentVoucher } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { WalletCards } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';

interface EmployeeFinancialsProps {
  employeeId: string;
}

export function EmployeeFinancials({ employeeId }: EmployeeFinancialsProps) {
  const { firestore } = useFirebase();

  const queryConstraints = useMemo(() => [
    where('employeeId', '==', employeeId),
    orderBy('paymentDate', 'desc')
  ], [employeeId]);

  const { data: vouchers, loading, error } = useSubscription<PaymentVoucher>(firestore, 'paymentVouchers', queryConstraints);

  const formatDate = (date: any) => {
    const d = toFirestoreDate(date);
    return d ? format(d, 'dd/MM/yyyy', { locale: ar }) : '-';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletCards className="text-primary" />
          السندات المالية
        </CardTitle>
        <CardDescription>
          جميع سندات الصرف المرتبطة بالموظف (مثل تجديد إقامة، عهدة، وغيرها).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-destructive">
                    فشل تحميل البيانات المالية.
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && vouchers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    لا توجد سندات مالية مسجلة لهذا الموظف.
                  </TableCell>
                </TableRow>
              )}
              {!loading && vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell>
                    <Link href={`/dashboard/accounting/payment-vouchers/${voucher.id}`} className="font-mono hover:underline text-primary">
                      {voucher.voucherNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(voucher.paymentDate)}</TableCell>
                  <TableCell>{voucher.description}</TableCell>
                  <TableCell className="text-left font-mono">{formatCurrency(voucher.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
