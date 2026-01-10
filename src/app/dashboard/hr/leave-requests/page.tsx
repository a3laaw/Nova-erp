'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/hr/leave-request-form';

const statusColors: Record<string, string> = {
    'معلقة': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'مقبولة': 'bg-green-100 text-green-800 border-green-200',
    'مرفوضة': 'bg-red-100 text-red-800 border-red-200',
};

const typeColors: Record<string, string> = {
    'سنوية': 'bg-blue-100 text-blue-800 border-blue-200',
    'مرضية': 'bg-green-100 text-green-800 border-green-200',
    'طارئة': 'bg-orange-100 text-orange-800 border-orange-200',
}


export default function LeaveRequestsPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-KW', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
  }

  return (
    <>
      <Card dir="rtl">
        <CardHeader>
            <div className='flex justify-between items-center'>
                <div>
                    <CardTitle>طلبات الإجازة</CardTitle>
                    <CardDescription>
                    إدارة طلبات الإجازات المقدمة من الموظفين.
                    </CardDescription>
                </div>
                <Button onClick={() => setIsFormOpen(true)}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    طلب إجازة جديد
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>نوع الإجازة</TableHead>
                            <TableHead>من تاريخ</TableHead>
                            <TableHead>إلى تاريخ</TableHead>
                            <TableHead>عدد الأيام</TableHead>
                            <TableHead>الحالة</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                لا توجد طلبات إجازة حالياً.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      <LeaveRequestForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={() => { /* Implement save logic */ }} />
    </>
  );
}
