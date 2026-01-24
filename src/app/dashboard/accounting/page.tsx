
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { format } from 'date-fns';


const statusStyles: Record<InvoiceStatus, string> = {
    'Paid': 'bg-green-100 text-green-800 border-green-200',
    'Sent': 'bg-blue-100 text-blue-800 border-blue-200',
    'Draft': 'bg-gray-100 text-gray-800 border-gray-200',
    'Overdue': 'bg-red-100 text-red-800 border-red-200',
};

export default function AccountingPage() {
  const { language } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>المحاسبة</CardTitle>
                <CardDescription>
                إدارة الفواتير وتتبع الإيرادات والمصروفات وعرض التقارير المالية.
                </CardDescription>
            </div>
            <Button asChild variant="outline">
                <Link href="/dashboard/accounting/assistant">
                    <Sparkles className="ml-2 h-4 w-4" />
                    المساعد الذكي
                </Link>
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="invoices" dir="rtl">
          <TabsList>
            <TabsTrigger value="invoices">الفواتير</TabsTrigger>
            <TabsTrigger value="cash-receipts">سندات القبض</TabsTrigger>
            <TabsTrigger value="transactions">الإيرادات/المصروفات</TabsTrigger>
            <TabsTrigger value="reports">التقارير</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices" className="mt-4">
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
          </TabsContent>
          <TabsContent value="cash-receipts" className="mt-4">
            <div className="flex justify-end mb-4">
                <Button asChild>
                    <Link href="/dashboard/accounting/cash-receipts/new">
                        <PlusCircle className="ml-2 h-4 w-4" />
                        إنشاء سند قبض
                    </Link>
                </Button>
            </div>
            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">قائمة سندات القبض</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    سيتم عرض قائمة بجميع سندات القبض هنا.
                </p>
            </div>
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">سجل المعاملات قريباً</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    سجل كامل للإيرادات والمصروفات سيكون متاحاً هنا.
                </p>
            </div>
          </TabsContent>
          <TabsContent value="reports" className="mt-4">
             <div className="p-8 text-center border-2 border-dashed rounded-lg">
                <h3 className="mt-4 text-lg font-medium">التقارير المالية قريباً</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    سيتم إنشاء تقارير الأرباح والخسائر والميزانية العمومية والتدفقات النقدية هنا.
                </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
