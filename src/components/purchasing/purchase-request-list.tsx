
'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { PurchaseRequest } from '@/lib/types';
import { format } from 'date-fns';
import { FileText, MoreHorizontal, Eye, CheckCircle, Trash2, Loader2, Send } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { toFirestoreDate } from '@/services/date-converter';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  converted: 'bg-green-100 text-green-800 border-green-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'بانتظار الموافقة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  converted: 'تم تحويله لأمر شراء',
};

export function PurchaseRequestList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: requests, loading } = useSubscription<PurchaseRequest>(firestore, 'purchase_requests', queryConstraints);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="border rounded-xl overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>رقم الطلب</TableHead>
            <TableHead>التاريخ</TableHead>
            <TableHead>صاحب الطلب</TableHead>
            <TableHead>عدد البنود</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">لا توجد طلبات شراء مسجلة.</TableCell>
            </TableRow>
          ) : (
            requests.map((req) => (
              <TableRow key={req.id} className="hover:bg-muted/30">
                <TableCell className="font-mono font-bold">{req.requestNumber}</TableCell>
                <TableCell>{formatDate(req.date)}</TableCell>
                <TableCell className="font-medium">{req.requesterName}</TableCell>
                <TableCell>{req.items?.length || 0}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[req.status]}>
                    {statusTranslations[req.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/dashboard/purchasing/requests/${req.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
