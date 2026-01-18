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
import { Button } from '@/components/ui/button';
import { Check, X, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// Mock data based on the provided image
const systemAlerts = [
    {
        id: '1',
        notes: 'ارسال المعامله للرسام',
        transactionType: 'بلدية سكن خاص',
        transactionLink: '#',
        clientName: 'مشعل عبدالله ناصر',
        transferredBy: 'م. احمد سعيد',
        transactionStatus: 'قيد المراجعة',
        alertDate: '2026-01-18T18:03:01Z',
        viewedAt: null,
        isRead: false,
        isActive: true,
    },
    {
        id: '2',
        notes: 'الرجاء استكمال الانشائي واجراءات الترخيص',
        transactionType: 'بلدية سكن خاص',
        transactionLink: '#',
        clientName: 'مشعل عبدالله ناصر',
        transferredBy: 'م. مرام مجدي',
        transactionStatus: 'بانتظار رد المهندس',
        alertDate: '2026-01-18T18:02:22Z',
        viewedAt: null,
        isRead: false,
        isActive: true,
    }
];

export default function SystemAlertsPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>تنبيهات النظام</CardTitle>
            <CardDescription>
              عرض جميع التنبيهات والمهام المتعلقة بالمعاملات.
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            Displaying 1-2 of 2 results
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>ملاحظات للتنبيه</TableHead>
                <TableHead>المعامله المحوله</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>محوله بواسطة</TableHead>
                <TableHead>حالة المعامله</TableHead>
                <TableHead>تاريخ التنبيه</TableHead>
                <TableHead>شوهد في</TableHead>
                <TableHead className="text-center">تم قراءه التنبيه</TableHead>
                <TableHead className="text-center">مفعل</TableHead>
                <TableHead className="text-center">الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systemAlerts.map((alert, index) => (
                <TableRow key={alert.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{alert.notes}</TableCell>
                  <TableCell>
                    <Link href={alert.transactionLink} className="text-primary hover:underline">
                      {alert.transactionType}
                    </Link>
                  </TableCell>
                  <TableCell>{alert.clientName}</TableCell>
                  <TableCell>{alert.transferredBy}</TableCell>
                  <TableCell>{alert.transactionStatus}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                        <span>{format(new Date(alert.alertDate), 'yyyy-MM-dd')}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(alert.alertDate), 'HH:mm:ss')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {alert.viewedAt ? format(new Date(alert.viewedAt), 'yyyy-MM-dd HH:mm') : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {alert.isRead ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <X className="h-5 w-5 text-red-500 mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                     {alert.isActive ? <Check className="h-5 w-5 text-green-500 mx-auto" /> : <X className="h-5 w-5 text-red-500 mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon">
                        <FileWarning className="h-5 w-5 text-destructive mx-auto" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
