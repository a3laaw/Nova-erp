'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Check, X, Pencil } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import type { PermissionRequest, Employee } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PermissionRequestForm } from './permission-request-form';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';


const statusColors: Record<PermissionRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<PermissionRequest['status'], string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};

const typeTranslations: Record<PermissionRequest['type'], string> = {
    late_arrival: 'تأخير صباحي',
    early_departure: 'خروج مبكر',
};

export function PermissionRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<PermissionRequest | null>(null);

  const [requestToDelete, setRequestToDelete] = useState<PermissionRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [requestToAction, setRequestToAction] = useState<{ request: PermissionRequest, action: 'approve' | 'reject' } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  useEffect(() => {
    const employeeId = searchParams.get('employeeId');
    if (employeeId) {
        setIsFormOpen(true);
    }
  }, [searchParams]);

  
  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: permissionRequests, loading: loadingRequests } = useSubscription<PermissionRequest>(firestore, 'permissionRequests', queryConstraints);
  const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

  const loading = loadingRequests || loadingEmployees;

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleEditClick = (req: PermissionRequest) => {
    setRequestToEdit(req);
    setIsFormOpen(true);
  }

  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'permissionRequests', requestToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف طلب الاستئذان بنجاح.' });
    } catch (e) {
        console.error("Error deleting permission request:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الطلب.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };
  
  const handleConfirmAction = async () => {
    if (!requestToAction || !firestore || !currentUser) return;
    
    if(requestToAction.action === 'reject' && !rejectionReason.trim()) {
        toast({variant: 'destructive', title: 'خطأ', description: 'سبب الرفض مطلوب.'});
        return;
    }

    setIsProcessingAction(true);
    try {
        const reqRef = doc(firestore, 'permissionRequests', requestToAction.request.id);
        const newStatus = requestToAction.action === 'approve' ? 'approved' : 'rejected';
        
        await updateDoc(reqRef, {
            status: newStatus,
            approvedBy: currentUser.id,
            approvedAt: new Date(),
            ...(newStatus === 'rejected' && { rejectionReason: rejectionReason })
        });
        
        toast({ title: 'نجاح', description: `تم ${newStatus === 'approved' ? 'الموافقة على' : 'رفض'} الطلب بنجاح.` });
    } catch (e) {
        console.error("Error updating permission request:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الطلب.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToAction(null);
        setRejectionReason('');
    }
  };


  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setRequestToEdit(null); setIsFormOpen(true); }}>
          <PlusCircle className="ml-2 h-4 w-4" />
          طلب استئذان جديد
        </Button>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
        <Table>
          <TableHeader className="bg-[#F8F9FE]">
            <TableRow className="border-none">
              <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم الملف</TableHead>
              <TableHead className="font-black text-[#7209B7]">اسم الموظف</TableHead>
              <TableHead className="font-black text-[#7209B7]">نوع الاستئذان</TableHead>
              <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
              <TableHead className="font-black text-[#7209B7]">السبب</TableHead>
              <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
              <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={7} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
            ))}
            {!loading && permissionRequests.length === 0 && (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground font-bold italic">لا توجد طلبات استئذان مسجلة.</TableCell></TableRow>
            )}
            {!loading && permissionRequests.map(req => {
              const emp = employees.find(e => e.id === req.employeeId);
              return (
              <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                <TableCell className="px-8 font-mono font-bold opacity-60 text-xs">{emp?.employeeNumber || '---'}</TableCell>
                <TableCell className="font-black text-gray-800">{req.employeeName}</TableCell>
                <TableCell>{typeTranslations[req.type]}</TableCell>
                <TableCell className="font-bold text-xs opacity-60">{formatDate(req.date)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground italic font-medium">{req.reason}</TableCell>
                <TableCell><Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[req.status])}>{statusTranslations[req.status]}</Badge></TableCell>
                <TableCell className="text-center">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent dir="rtl" className="rounded-xl">
                            <DropdownMenuLabel>إجراءات الطلب</DropdownMenuLabel>
                             {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && req.status === 'pending' && (
                                <>
                                    <DropdownMenuItem onClick={() => setRequestToAction({request: req, action: 'approve'})} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                        <Check className="ml-2 h-4 w-4" /> موافقة
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRequestToAction({request: req, action: 'reject'})} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                        <X className="ml-2 h-4 w-4" /> رفض
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuItem onClick={() => handleEditClick(req)}>
                                <Pencil className="ml-2 h-4 w-4" /> تعديل
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="ml-2 h-4 w-4" /> حذف
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
      
      <PermissionRequestForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
        onSaveSuccess={() => {}}
        permissionToEdit={requestToEdit}
        employees={employees}
        loadingRefs={loadingEmployees}
      />
      
      <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                <AlertDialogDescription>سيتم حذف هذا الطلب بشكل دائم.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                    {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالحذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToAction} onOpenChange={() => setRequestToAction(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle>
                    {requestToAction?.action === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                    {requestToAction?.action === 'approve' 
                        ? `هل أنت متأكد من موافقتك على طلب ${typeTranslations[requestToAction.request.type]} للموظف "${requestToAction.request.employeeName}"؟`
                        : `الرجاء ذكر سبب رفض طلب الاستئذان.`
                    }
                </AlertDialogDescription>
            </AlertDialogHeader>
            {requestToAction?.action === 'reject' && (
                <div className="py-4">
                    <Textarea
                        placeholder="اكتب سبب الرفض هنا..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="rounded-xl border-2"
                    />
                </div>
            )}
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel disabled={isProcessingAction} className="rounded-xl">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmAction} disabled={isProcessingAction || (requestToAction?.action === 'reject' && !rejectionReason.trim())} className={cn("rounded-xl font-bold px-8", requestToAction?.action === 'approve' ? "bg-green-600" : "bg-red-600")}>
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'تأكيد'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
