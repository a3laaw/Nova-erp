'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { LeaveRequest } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LeaveRequestForm } from './leave-request-form';
import { toFirestoreDate } from '@/services/date-converter';

const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<LeaveRequest['status'], string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: leaveRequests, loading, error, setData: setLeaveRequests } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="ml-2 h-4 w-4" />
          طلب إجازة جديد
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الموظف</TableHead>
              <TableHead>نوع الإجازة</TableHead>
              <TableHead>الفترة</TableHead>
              <TableHead>الأيام</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!loading && leaveRequests.length === 0 && (
              <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد طلبات إجازة.</TableCell></TableRow>
            )}
            {!loading && leaveRequests.map(req => (
              <TableRow key={req.id}>
                <TableCell className="font-medium">{req.employeeName}</TableCell>
                <TableCell>{req.leaveType}</TableCell>
                <TableCell>{formatDate(req.startDate)} - {formatDate(req.endDate)}</TableCell>
                <TableCell>{req.workingDays} أيام عمل</TableCell>
                <TableCell><Badge variant="outline" className={statusColors[req.status]}>{statusTranslations[req.status]}</Badge></TableCell>
                <TableCell>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      <LeaveRequestForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSaveSuccess={() => { /* Real-time will handle update */ }} 
      />
    </>
  );
}
