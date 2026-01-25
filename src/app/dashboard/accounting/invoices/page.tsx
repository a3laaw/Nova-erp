'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import { Badge } from '@/components/ui/badge';
  import { invoices } from '@/lib/data';
  import { formatCurrency } from '@/lib/utils';
  import type { InvoiceStatus } from '@/lib/types';
  import { cn } from '@/lib/utils';
  import { format } from 'date-fns';

  const statusStyles: Record<InvoiceStatus, string> = {
      'Paid': 'bg-green-100 text-green-800 border-green-200',
      'Sent': 'bg-blue-100 text-blue-800 border-blue-200',
      'Draft': 'bg-gray-100 text-gray-800 border-gray-200',
      'Overdue': 'bg-red-100 text-red-800 border-red-200',
  };

export default function InvoicesPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>الفواتير</CardTitle>
                <CardDescription>
                    عرض وإدارة فواتير العملاء.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>رقم الفاتورة</TableHead>
                            <TableHead>العميل</TableHead>
                            <TableHead>تاريخ الإصدار</TableHead>
                            <TableHead>تاريخ الاستحقاق</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead className="text-left">المبلغ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map(invoice => (
                                <TableRow key={invoice.id}>
                                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                    <TableCell>{invoice.clientId}</TableCell>
                                    <TableCell>{format(new Date(invoice.issueDate), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(statusStyles[invoice.status])}>{invoice.status}</Badge>
                                    </TableCell>
                                    <TableCell className="text-left">{formatCurrency(invoice.amount)}</TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
