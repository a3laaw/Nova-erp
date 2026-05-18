'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  where, 
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, X, Pencil, CheckCircle, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import type { LeaveRequest, Employee } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { cn, getTenantPath } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;
  
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: leaveRequests, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', [orderBy('createdAt', 'desc')]);
  const { data: employees } = useSubscription<Employee>(firestore, 'employees');

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    try {
        const finalPath = getTenantPath(`leaveRequests/${requestToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, finalPath));
        toast({ title: 'نجاح', description: 'تم حذف الطلب بنجاح.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };

  const handleApprove = async (req: LeaveRequest) => {
    if (!firestore || !tenantId || !currentUser) return;
    try {
        const finalPath = getTenantPath(`leaveRequests/${req.id}`, tenantId);
        await updateDoc(doc(firestore, finalPath), {
            status: 'approved',
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp()
        });
        toast({ title: 'تمت الموافقة' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
  };

  const handleReject = async (req: LeaveRequest) => {
    if (!firestore || !tenantId || !currentUser) return;
    try {
        const finalPath = getTenantPath(`leaveRequests/${req.id}`, tenantId);
        await updateDoc(doc(firestore, finalPath), {
            status: 'rejected',
            rejectedBy: currentUser.id,
            rejectedAt: serverTimestamp()
        });
        toast({ title: 'تم الرفض' });
    } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button asChild className="h-11 px-8 rounded-xl font-black gap-2">
          <Link href="/dashboard/hr/leaves/new"><PlusCircle className="h-5 w-5" /> طلب إجازة جديد</Link>
        </Button>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
        <Table>
          <TableHeader className="bg-[#F8F9FE]">
            <TableRow className="border-none">
              <TableHead className="px-8 font-black text-[#7209B7]">الموظف</TableHead>
              <TableHead className="font-black text-[#7209B7]">النوع</TableHead>
              <TableHead className="font-black text-[#7209B7]">الفترة</TableHead>
              <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
              <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveRequests.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic">لا توجد طلبات إجازة.</TableCell></TableRow>
            ) : (
              leaveRequests.map(req => (
                <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 h-16">
                  <TableCell className="px-8 font-black">{req.employeeName}</TableCell>
                  <TableCell><Badge variant="secondary">{req.leaveType}</Badge></TableCell>
                  <TableCell className="font-mono text-xs opacity-60">{formatDate(req.startDate)} - {formatDate(req.endDate)}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("px-3", statusColors[req.status])}>{statusTranslations[req.status]}</Badge></TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir="rtl">
                            {req.status === 'pending' && (
                                <>
                                    <DropdownMenuItem onClick={() => handleApprove(req)} className="text-green-600 font-bold"><CheckCircle className="ml-2 h-4 w-4"/> موافقة</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReject(req)} className="text-red-600 font-bold"><X className="ml-2 h-4 w-4"/> رفض</DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuItem asChild><Link href={`/dashboard/hr/leaves/${req.id}/edit`} className="gap-2"><Pencil className="h-4 w-4" /> تعديل</Link></DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive font-bold" onClick={() => setRequestToDelete(req)}><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف طلب الإجازة نهائياً.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive rounded-xl font-black">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'حذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
