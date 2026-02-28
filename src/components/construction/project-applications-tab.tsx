
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { ConstructionProject, PaymentApplication } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Coins, 
  PlusCircle, 
  ExternalLink, 
  FileText,
  Clock,
  CheckCircle2
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

interface ProjectApplicationsTabProps {
  project: ConstructionProject;
}

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    paid: 'bg-primary text-primary-foreground',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    submitted: 'مرسل للعميل',
    approved: 'معتمد مالياً',
    paid: 'تم التحصيل',
    cancelled: 'ملغي',
};

export function ProjectApplicationsTab({ project }: ProjectApplicationsTabProps) {
  const { firestore } = useFirebase();

  // Fetch Payment Applications linked to this project
  const appQuery = React.useMemo(() => {
    if (!firestore || !project.id) return null;
    return [
        where('projectId', '==', project.id),
        orderBy('createdAt', 'desc')
    ];
  }, [firestore, project.id]);

  const { data: apps, loading } = useSubscription<PaymentApplication>(
    firestore, 
    appQuery ? 'payment_applications' : null, 
    appQuery || []
  );

  const totalBilled = React.useMemo(() => {
    return (apps || []).filter(a => a.status !== 'cancelled').reduce((sum, a) => sum + (a.totalAmount || 0), 0);
  }, [apps]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center bg-muted/30 p-6 rounded-2xl border">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black">مستخلصات المشروع (الإيرادات)</CardTitle>
          <CardDescription>إدارة مطالبات الدفع الموجهة للعميل بناءً على نسب الإنجاز.</CardDescription>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">إجمالي ما تم فوترته</p>
                <p className="text-2xl font-black text-primary font-mono">{formatCurrency(totalBilled)}</p>
            </div>
            <Button asChild className="h-11 px-6 rounded-xl font-bold gap-2">
                <Link href={`/dashboard/construction/payment-applications/new?projectId=${project.id}`}>
                    <PlusCircle className="h-5 w-5" />
                    إصدار مستخلص جديد
                </Link>
            </Button>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden border-none shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>رقم المستخلص</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-left">قيمة المطالبة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-[100px] text-center">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <Coins className="h-10 w-10 opacity-20" />
                    <p>لم يتم إصدار أي مستخلصات لهذا المشروع بعد.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              apps.map((app) => (
                <TableRow key={app.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono font-bold text-primary">{app.applicationNumber}</TableCell>
                  <TableCell>{formatDate(app.date)}</TableCell>
                  <TableCell className="text-left font-mono font-bold">{formatCurrency(app.totalAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("px-2", statusColors[app.status])}>
                      {statusTranslations[app.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/dashboard/construction/payment-applications/${app.id}`}>
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
    </div>
  );
}
