'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Check, X, Pencil, Undo2, Banknote } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { LeaveRequest, Employee, Payslip } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { LeaveRequestForm } from './leave-request-form';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency } from '@/lib/utils';


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
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<LeaveRequest | null>(null);

  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [requestToApprove, setRequestToApprove] = useState<LeaveRequest | null>(null);
  const [requestToReject, setRequestToReject] = useState<LeaveRequest | null>(null);
  const [requestToUndoApproval, setRequestToUndoApproval] = useState<LeaveRequest | null>(null);
  const [requestToUndoRejection, setRequestToUndoRejection] = useState<LeaveRequest | null>(null);
  const [requestToPay, setRequestToPay] = useState<LeaveRequest | null>(null);

  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  
  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: leaveRequests, setData: setLeaveRequests, loading: loadingLeaves } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);
  const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

  const loading = loadingLeaves || loadingEmployees;

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleEditClick = (req: LeaveRequest) => {
    setRequestToEdit(req);
    setIsFormOpen(true);
  }

  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'leaveRequests', requestToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف طلب الإجازة بنجاح.' });
    } catch (e) {
        console.error("Error deleting leave request:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف طلب الإجازة.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };
  
  const handleConfirmApproval = async () => {
    if (!requestToApprove || !firestore || !currentUser) return;

    setIsProcessingAction(true);
    const batch = writeBatch(firestore);

    try {
        const leaveRef = doc(firestore, 'leaveRequests', requestToApprove.id);
        batch.update(leaveRef, {
            status: 'approved',
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp()
        });

        const employee = employees.find(e => e.id === requestToApprove.employeeId);
        if (employee) {
            const employeeRef = doc(firestore, 'employees', employee.id!);
            const daysToDeduct = requestToApprove.days || 0;
            let employeeUpdate: Partial<Employee> = {};
            
            switch (requestToApprove.leaveType) {
                case 'Annual':
                    employeeUpdate.annualLeaveUsed = (employee.annualLeaveUsed || 0) + daysToDeduct;
                    break;
                case 'Sick':
                    employeeUpdate.sickLeaveUsed = (employee.sickLeaveUsed || 0) + daysToDeduct;
                    break;
                case 'Emergency':
                     employeeUpdate.emergencyLeaveUsed = (employee.emergencyLeaveUsed || 0) + daysToDeduct;
                    break;
            }
            batch.update(employeeRef, employeeUpdate);
        }

        await batch.commit();
        toast({ title: 'نجاح', description: 'تمت الموافقة على طلب الإجازة.' });

        const targetUserId = await findUserIdByEmployeeId(firestore, requestToApprove.employeeId);
        if (targetUserId && targetUserId !== currentUser.id) {
            await createNotification(firestore, {
                userId: targetUserId,
                title: 'تحديث على طلب الإجازة',
                body: `تمت الموافقة على طلب الإجازة الذي قدمته من ${formatDate(requestToApprove.startDate)} إلى ${formatDate(requestToApprove.endDate)}.`,
                link: '/dashboard/hr/leaves'
            });
        }
    } catch (e) {
        console.error("Error approving leave:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في الموافقة على طلب الإجازة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToApprove(null);
    }
  };
  
  const handleConfirmRejection = async () => {
    if (!requestToReject || !rejectionReason.trim() || !firestore || !currentUser) return;
    setIsProcessingAction(true);
    try {
        const leaveRef = doc(firestore, 'leaveRequests', requestToReject.id);
        await updateDoc(leaveRef, {
            status: 'rejected',
            rejectionReason: rejectionReason,
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp()
        });
        toast({ title: 'تم الرفض', description: 'تم رفض طلب الإجازة بنجاح.' });
        
        const targetUserId = await findUserIdByEmployeeId(firestore, requestToReject.employeeId);
        if (targetUserId && targetUserId !== currentUser.id) {
            await createNotification(firestore, {
                userId: targetUserId,
                title: 'تحديث على طلب الإجازة',
                body: `تم رفض طلب الإجازة الذي قدمته. السبب: ${rejectionReason}`,
                link: '/dashboard/hr/leaves'
            });
        }
    } catch (e) {
        console.error("Error rejecting leave:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في رفض طلب الإجازة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToReject(null);
        setRejectionReason('');
    }
  };

  const handleUndoApproval = async () => {
    if (!requestToUndoApproval || !firestore || !currentUser) return;

    setIsProcessingAction(true);
    const batch = writeBatch(firestore);

    try {
        const leaveRef = doc(firestore, 'leaveRequests', requestToUndoApproval.id);
        batch.update(leaveRef, { status: 'pending' });

        const employee = employees.find(e => e.id === requestToUndoApproval.employeeId);
        if (employee) {
            const employeeRef = doc(firestore, 'employees', employee.id!);
            const daysToRevert = requestToUndoApproval.days || 0;
            let employeeUpdate: Partial<Employee> = {};
            
            switch (requestToUndoApproval.leaveType) {
                case 'Annual':
                    employeeUpdate.annualLeaveUsed = (employee.annualLeaveUsed || 0) - daysToRevert;
                    break;
                case 'Sick':
                    employeeUpdate.sickLeaveUsed = (employee.sickLeaveUsed || 0) - daysToRevert;
                    break;
                case 'Emergency':
                     employeeUpdate.emergencyLeaveUsed = (employee.emergencyLeaveUsed || 0) - daysToRevert;
                    break;
            }
            if(employeeUpdate.annualLeaveUsed !== undefined) employeeUpdate.annualLeaveUsed = Math.max(0, employeeUpdate.annualLeaveUsed);
            if(employeeUpdate.sickLeaveUsed !== undefined) employeeUpdate.sickLeaveUsed = Math.max(0, employeeUpdate.sickLeaveUsed);
            if(employeeUpdate.emergencyLeaveUsed !== undefined) employeeUpdate.emergencyLeaveUsed = Math.max(0, employeeUpdate.emergencyLeaveUsed);

            batch.update(employeeRef, employeeUpdate);
        }

        await batch.commit();
        toast({ title: 'نجاح', description: 'تم التراجع عن الموافقة بنجاح.' });
    } catch (e) {
        console.error("Error undoing approval:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في التراجع عن الموافقة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToUndoApproval(null);
    }
  };
  
   const handleUndoRejection = async () => {
    if (!requestToUndoRejection || !firestore) return;
    setIsProcessingAction(true);
    try {
        const leaveRef = doc(firestore, 'leaveRequests', requestToUndoRejection.id);
        await updateDoc(leaveRef, { status: 'pending', rejectionReason: null });
        toast({ title: 'نجاح', description: 'تم التراجع عن الرفض.' });
    } catch (e) {
        console.error("Error undoing rejection:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن الرفض.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToUndoRejection(null);
    }
  };
  
  const handleConfirmLeavePayment = async () => {
    if (!requestToPay || !firestore) return;
    setIsProcessingAction(true);
    
    try {
        const employee = employees.find(e => e.id === requestToPay.employeeId);
        if (!employee) throw new Error("لم يتم العثور على بيانات الموظف.");

        const fullSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
        const dailyRate = fullSalary / 26;
        const leaveSalary = dailyRate * (requestToPay.workingDays || 0);

        const batch = writeBatch(firestore);

        const payslipId = `leave-${requestToPay.id}`;
        const payslipRef = doc(firestore, 'payroll', payslipId);

        const payslipData: Omit<Payslip, 'id'> = {
            employeeId: employee.id!,
            employeeName: employee.fullName,
            year: toFirestoreDate(requestToPay.startDate)!.getFullYear(),
            month: toFirestoreDate(requestToPay.startDate)!.getMonth() + 1,
            type: 'Leave',
            leaveRequestId: requestToPay.id,
            earnings: {
                basicSalary: leaveSalary,
            },
            deductions: {
                absenceDeduction: 0,
                otherDeductions: 0,
            },
            netSalary: leaveSalary,
            status: 'draft',
            createdAt: serverTimestamp(),
            notes: `راتب إجازة ${statusTranslations[requestToPay.status]} من ${formatDate(requestToPay.startDate)} إلى ${formatDate(requestToPay.endDate)}`,
        };
        batch.set(payslipRef, payslipData);
        
        const leaveRef = doc(firestore, 'leaveRequests', requestToPay.id);
        batch.update(leaveRef, { isSalaryPaid: true });

        await batch.commit();

        toast({ title: 'نجاح', description: 'تم إنشاء كشف راتب الإجازة بنجاح.' });

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'فشل صرف راتب الإجازة.';
        toast({ variant: 'destructive', title: 'خطأ', description: msg });
    } finally {
        setIsProcessingAction(false);
        setRequestToPay(null);
    }
  };


  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setRequestToEdit(null); setIsFormOpen(true); }}>
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
                <TableCell>{req.workingDays} يوم عمل</TableCell>
                <TableCell><Badge variant="outline" className={statusColors[req.status]}>{statusTranslations[req.status]}</Badge></TableCell>
                <TableCell>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent dir="rtl">
                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                             {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                                <>
                                    {req.status === 'approved' && !req.isSalaryPaid && (
                                        <DropdownMenuItem onClick={() => setRequestToPay(req)}>
                                            <Banknote className="ml-2 h-4 w-4" /> صرف راتب الإجازة
                                        </DropdownMenuItem>
                                    )}
                                    {req.status === 'pending' && (
                                        <>
                                            <DropdownMenuItem onClick={() => setRequestToApprove(req)} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                                <Check className="ml-2 h-4 w-4" /> موافقة
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setRequestToReject(req)} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                                <X className="ml-2 h-4 w-4" /> رفض
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {req.status === 'approved' && (
                                        <DropdownMenuItem onClick={() => setRequestToUndoApproval(req)} className="text-orange-600 focus:text-orange-700 focus:bg-orange-50">
                                            <Undo2 className="ml-2 h-4 w-4" /> تراجع عن الموافقة
                                        </DropdownMenuItem>
                                    )}
                                     {req.status === 'rejected' && (
                                        <DropdownMenuItem onClick={() => setRequestToUndoRejection(req)}>
                                            <Undo2 className="ml-2 h-4 w-4" /> تراجع عن الرفض
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => handleEditClick(req)}>
                                        <Pencil className="ml-2 h-4 w-4" /> تعديل
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="ml-2 h-4 w-4" /> حذف
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
        onSaveSuccess={() => {}}
        leaveRequestToEdit={requestToEdit}
      />
      
      <AlertDialog open={!!requestToApprove} onOpenChange={() => setRequestToApprove(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الموافقة</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من موافقتك على طلب الإجازة للموظف "{requestToApprove?.employeeName}"؟ سيتم تحديث رصيد إجازاته.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmApproval} disabled={isProcessingAction} className="bg-green-600 hover:bg-green-700">
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، موافقة'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!requestToUndoApproval} onOpenChange={() => setRequestToUndoApproval(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد التراجع عن الموافقة</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في التراجع عن الموافقة؟ سيتم إعادة الطلب إلى حالة "معلق" وإعادة أيام الإجازة لرصيد الموظف.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoApproval} disabled={isProcessingAction} className="bg-orange-600 hover:bg-orange-700">
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، تراجع'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

       <AlertDialog open={!!requestToUndoRejection} onOpenChange={() => setRequestToUndoRejection(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد التراجع عن الرفض</AlertDialogTitle>
                <AlertDialogDescription>
                    سيتم إعادة الطلب إلى حالة "معلق" ليتم مراجعته مرة أخرى.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoRejection} disabled={isProcessingAction}>
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، تراجع'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToReject} onOpenChange={() => setRequestToReject(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد الرفض</AlertDialogTitle>
                <AlertDialogDescription>
                    الرجاء ذكر سبب رفض طلب الإجازة للموظف "{requestToReject?.employeeName}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Textarea
                    placeholder="اكتب سبب الرفض هنا..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRejection} disabled={!rejectionReason.trim() || isProcessingAction}>
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'تأكيد الرفض'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
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
     <AlertDialog open={!!requestToPay} onOpenChange={() => setRequestToPay(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد صرف راتب الإجازة</AlertDialogTitle>
                <AlertDialogDescription>
                    سيتم إنشاء كشف راتب إجازة مسودة للموظف. هل تود المتابعة؟
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessingAction}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmLeavePayment} disabled={isProcessingAction} className="bg-green-600 hover:bg-green-700">
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالصرف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
