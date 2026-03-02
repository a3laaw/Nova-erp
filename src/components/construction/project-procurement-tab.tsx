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
  AlertCircle,
  ShoppingBag
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

  // 1. جلب أوامر الشراء والمشتريات المباشرة
  const poQuery = React.useMemo(() => {
    if (!firestore || !project.id) return null;
    return [where('projectId', '==', project.id)];
  }, [firestore, project.id]);

  const { data: pos, loading: posLoading } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', poQuery || []);

  // 2. جلب أذونات الاستلام للمقارنة
  const grnQuery = React.useMemo(() => {
    if (!firestore || !project.id) return null;
    return [where('projectId', '==', project.id)];
  }, [firestore, project.id]);

  const { data: grns, loading: grnsLoading } = useSubscription<any>(firestore, 'grns', grnQuery || []);

  const augmentedPos = React.useMemo(() => {
      return [...pos].map(po => {
          const poGrns = grns.filter(g => g.purchaseOrderId === po.id && g.status !== 'cancelled');
          const actualReceivedTotal = poGrns.reduce((sum, g) => sum + (g.totalValue || 0), 0);
          return { ...po, actualReceivedTotal };
      });
  }, [pos, grns]);

  const totalOrdered = React.useMemo(() => augmentedPos.filter(p => p.status !== 'cancelled').reduce((sum, p) => sum + (p.totalAmount || 0), 0), [augmentedPos]);
  const totalReceived = React.useMemo(() => grns.filter(g => g.status !== 'cancelled').reduce((sum, g) => sum + (g.totalValue || 0), 0), [grns]);

  if (posLoading || grnsLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col lg:flex-row justify-between items-center bg-muted/30 p-6 rounded-2xl border gap-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black">توريدات ومشتريات المشروع</CardTitle>
          <CardDescription>متابعة التكاليف المباشرة وأوامر الشراء المرتبطة بالمشروع.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-6">
            <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">إجمالي المشتريات المعتمدة</p>
                <p className="text-xl font-bold font-mono">{formatCurrency(totalOrdered)}</p>
            </div>
            <div className="text-left border-r pr-8 border-primary/10">
                <p className="text-[10px] uppercase font-black text-primary">المستلم والمصروف فعلياً</p>
                <p className="text-2xl font-black text-primary font-mono">{formatCurrency(totalReceived)}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 border-purple-600 text-purple-700 hover:bg-purple-50">
                    <Link href={`/dashboard/purchasing/direct-invoice?projectId=${project.id}`}>
                        <ShoppingBag className="h-5 w-5" /> فاتورة مباشرة
                    </Link>
                </Button>
                <Button asChild className="h-11 px-6 rounded-xl font-bold gap-2 shadow-lg shadow-primary/20">
                    <Link href={`/dashboard/purchasing/new?projectId=${project.id}`}>
                        <PlusCircle className="h-5 w-5" /> أمر شراء رسمي
                    </Link>
                </Button>
            </div>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>رقم المستند</TableHead>
              <TableHead>المورد</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead className="text-left">قيمة الطلب</TableHead>
              <TableHead className="text-left bg-primary/5 text-primary">المستلم/المصروف</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-[80px] text-center">عرض</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {augmentedPos.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">لا توجد طلبات شراء أو فواتير مباشرة لهذا المشروع.</TableCell></TableRow>
            ) : (
              augmentedPos.map((po) => {
                const isDirect = (po as any).type === 'direct_invoice';
                return (
                  <TableRow key={po.id} className="group hover:bg-muted/30">
                    <TableCell className="font-mono font-bold text-primary">{po.poNumber}</TableCell>
                    <TableCell className="font-medium">{po.vendorName}</TableCell>
                    <TableCell>
                        <Badge variant="secondary" className={cn("text-[10px]", isDirect ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-blue-700 border-blue-100")}>
                            {isDirect ? 'فاتورة مباشرة' : 'أمر شراء'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(po.totalAmount)}</TableCell>
                    <TableCell className="text-left font-mono font-black text-primary bg-primary/[0.02] border-r">
                        {isDirect ? formatCurrency(po.totalAmount) : formatCurrency(po.actualReceivedTotal || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("px-2 font-bold text-[10px]", statusColors[po.status])}>
                        {statusTranslations[po.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/purchasing/purchase-orders/${po.id}`}><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Alert className="bg-blue-50/50 border-blue-200 rounded-2xl">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-bold">إدارة التوريدات</AlertTitle>
            <AlertDescription className="text-blue-700 text-xs">يتم احتساب التكلفة الفعلية للمشروع بناءً على مبالغ الاستلام النهائية (GRN) أو الفواتير المباشرة.</AlertDescription>
        </Alert>
        <Alert className="bg-purple-50/50 border-purple-200 rounded-2xl">
            <ShoppingBag className="h-4 w-4 text-purple-600" />
            <AlertTitle className="text-purple-800 font-bold">المشتريات المباشرة</AlertTitle>
            <AlertDescription className="text-purple-700 text-xs">تُستخدم الفاتورة المباشرة لتسجيل المصاريف الطارئة والمشتريات التي تتم يدوياً دون الحاجة لمستودع.</AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
