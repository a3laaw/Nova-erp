'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { LeaveRequest } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LeaveRequestForm } from './leave-request-form';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';


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
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: leaveRequests, loading, error } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'leaveRequests', requestToDelete.id));
        toast({ title: 'نجاح', description: 'تم حذف طلب الإجازة بنجاح.' });
    } catch (e) {
        console.error("Error deleting leave request:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف طلب الإجازة.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
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
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent dir="rtl">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="ml-2 h-4 w-4" />
                                حذف
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
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

       <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في حذف طلب الإجازة الخاص بـ "{requestToDelete?.employeeName}"؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالحذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
