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
  updateDoc,
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
import { PlusCircle, MoreHorizontal, Trash2, Loader2, X, Pencil, CheckCircle } from 'lucide-react';
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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  'on-leave': 'bg-blue-100 text-blue-800 border-blue-200',
  'returned': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const statusTranslations: Record<string, string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  'on-leave': 'في إجازة',
  'returned': 'عاد للعمل',
};

export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const tenantId = currentUser?.currentCompanyId;
  
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: leaveRequests, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', [orderBy('createdAt', 'desc')]);

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
        toast({ title: 'نجاح', description: 'تم حذف طلب الإجازة بنجاح.' });
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
        toast({ title: '✅ تمت الموافقة' });
    } catch (e) { toast({ variant: 'destructive', title: 'عائق صلاحيات' }); }
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
        toast({ title: '❌ تم الرفض' });
    } catch (e) { toast({ variant: 'destructive', title: 'عائق صلاحيات' }); }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button asChild className="h-11 px-8 rounded-xl font-black gap-2">
          <Link href="/dashboard/hr/leaves/new"><PlusCircle className="h-5 w-5" /> إضافة</Link>
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
              <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد طلبات إجازة حالياً.</TableCell></TableRow>
            ) : (
              leaveRequests.map(req => (
                <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 h-16">
                  <TableCell className="px-8 font-black text-slate-800">
                      <Link href={`/dashboard/hr/leaves/${req.id}`} className="hover:underline">{req.employeeName}</Link>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="font-bold">{req.leaveType}</Badge></TableCell>
                  <TableCell className="font-mono text-xs opacity-60 font-bold">{formatDate(req.startDate)} - {formatDate(req.endDate)}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[req.status])}>{statusTranslations[req.status]}</Badge></TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir="rtl" className="rounded-xl shadow-2xl p-2 border-none">
                            <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase">التحكم في الطلب</DropdownMenuLabel>
                            {req.status === 'pending' && (
                                <>
                                    <DropdownMenuItem onClick={() => handleApprove(req)} className="text-green-600 font-bold gap-2 rounded-lg py-3"><CheckCircle className="h-4 w-4"/> موافقة إدارية</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReject(req)} className="text-red-600 font-bold gap-2 rounded-lg py-3"><X className="h-4 w-4"/> رفض الطلب</DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuItem asChild className="rounded-lg py-3 font-bold gap-2">
                                <Link href={`/dashboard/hr/leaves/${req.id}/edit`}><Pencil className="h-4 w-4" /> تعديل البيانات</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100" />
                            <DropdownMenuItem className="text-red-600 font-black gap-2 rounded-lg py-3 focus:bg-red-50" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="h-4 w-4" /> حذف نهائي
                            </DropdownMenuItem>
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
        <AlertDialogContent dir="rtl" className="rounded-[2rem] p-10 border-none shadow-2xl">
            <AlertDialogHeader>
                <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-8 w-8"/></div>
                <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2">سيتم حذف طلب الإجازة من سجلات المنشأة نهائياً ولا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3">
                <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-lg shadow-red-200">
                    {isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف الطلب'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
