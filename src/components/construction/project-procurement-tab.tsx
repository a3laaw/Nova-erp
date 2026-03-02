'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { ConstructionProject, PurchaseOrder } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingCart, 
  PlusCircle, 
  ExternalLink, 
  PackageCheck, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ProjectProcurementTabProps {
  project: ConstructionProject;
}

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    partially_received: 'bg-indigo-100 text-indigo-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمد',
    received: 'تم الاستلام',
    partially_received: 'مستلم جزئياً',
    cancelled: 'ملغي',
};

export function ProjectProcurementTab({ project }: ProjectProcurementTabProps) {
  const { firestore } = useFirebase();

  // Fetch POs linked to this project
  const poQuery = React.useMemo(() => {
    if (!firestore || !project.id) return null;
    return [
        where('projectId', '==', project.id),
        orderBy('createdAt', 'desc')
    ];
  }, [firestore, project.id]);

  const { data: pos, loading: posLoading } = useSubscription<PurchaseOrder>(
    firestore, 
    poQuery ? 'purchaseOrders' : null, 
    poQuery || []
  );

  const totalProcurement = React.useMemo(() => {
    return (pos || []).filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [pos]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  if (posLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black">مشتريات المشروع</CardTitle>
          <CardDescription>إدارة وتتبع طلبات التوريد الخاصة بالموقع.</CardDescription>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">إجمالي قيمة التوريدات</p>
                <p className="text-2xl font-black text-primary font-mono">{formatCurrency(totalProcurement)}</p>
            </div>
            <Button asChild className="h-11 px-6 rounded-xl font-bold gap-2">
                <Link href={`/dashboard/purchasing/new?projectId=${project.id}&clientName=${encodeURIComponent(project.clientName || '')}`}>
                    <PlusCircle className="h-5 w-5" />
                    أمر شراء جديد
                </Link>
            </Button>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>رقم الطلب</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-left">المبلغ</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-[100px] text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <ShoppingCart className="h-10 w-10 opacity-20" />
                    <p>لا توجد طلبات شراء مسجلة لهذا المشروع بعد.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pos.map((po) => (
                <TableRow key={po.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono font-bold text-primary">{po.poNumber}</TableCell>
                  <TableCell className="font-medium">{po.vendorName}</TableCell>
                  <TableCell>{formatDate(po.orderDate)}</TableCell>
                  <TableCell className="text-left font-mono font-bold">{formatCurrency(po.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("px-2", statusColors[po.status])}>
                      {statusTranslations[po.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/purchasing/purchase-orders/${po.id}`}>
                            <ExternalLink className="h-4 w-4" />
                        </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert className="bg-blue-50/50 border-blue-200">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-bold">طلبات قيد التوريد</AlertTitle>
            <AlertDescription className="text-blue-700 text-xs">
                يوجد عدد {pos.filter(p => p.status === 'approved' || p.status === 'partially_received').length} طلبات بانتظار وصول المواد للموقع.
            </AlertDescription>
        </Alert>
        <Alert className="bg-green-50/50 border-green-200">
            <PackageCheck className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800 font-bold">المواد المستلمة</AlertTitle>
            <AlertDescription className="text-green-700 text-xs">
                بمجرد استلام المواد، يتم تحديث التكلفة الفعلية في جدول الكميات (BOQ) تلقائياً.
            </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
