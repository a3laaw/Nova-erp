'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, serverTimestamp, getDocs, where, limit, Timestamp } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Check, X, Pencil, Undo2, Banknote, Sparkles, Clock, AlertCircle, CheckCircle, ArrowRight, PlaneTakeoff, Home, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import type { LeaveRequest, Employee, Payslip } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DateInput } from '../ui/date-input';
import { Label } from '../ui/label';


const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  'on-leave': 'bg-blue-100 text-blue-800 border-blue-200',
  'returned': 'bg-indigo-100 text-indigo-800 border-indigo-200',
};

const statusTranslations: Record<LeaveRequest['status'], string> = {
  pending: 'معلق',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  'on-leave': 'في إجازة (مغادر)',
  'returned': 'عاد للعمل (مكتمل)',
};

const leaveTypeTranslations: Record<LeaveRequest['leaveType'], string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};

export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [requestToApprove, setRequestToApprove] = useState<LeaveRequest | null>(null);
  const [requestToReject, setRequestToReject] = useState<LeaveRequest | null>(null);
  const [requestToUndoApproval, setRequestToUndoApproval] = useState<LeaveRequest | null>(null);
  const [requestToUndoRejection, setRequestToUndoRejection] = useState<LeaveRequest | null>(null);
  const [requestToPay, setRequestToPay] = useState<LeaveRequest | null>(null);
  const [requestToStart, setRequestToStart] = useState<LeaveRequest | null>(null);
  const [requestToReturn, setRequestToReturn] = useState<LeaveRequest | null>(null);

  const [rejectionReason, setRejectionReason] = useState('');
  const [actualDate, setActualDate] = useState<Date | undefined>(new Date());
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // ✨ سياق القرار الذكي للـ HR (Smart Context)
  const [lastLeaveInfo, setLastLeaveInfo] = useState<LeaveRequest | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: leaveRequests, loading: loadingLeaves } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);
  const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

  const loading = loadingLeaves || loadingEmployees;

  // جلب آخر إجازة عند الرغبة في الموافقة لتوفير سياق للـ HR
  useEffect(() => {
    const targetReq = requestToApprove || requestToReject;
    if (!firestore || !targetReq?.employeeId) {
        setLastLeaveInfo(null);
        return;
    }

    const fetchContext = async () => {
        setLoadingContext(true);
        try {
            const q = query(
                collection(firestore, 'leaveRequests'),
                where('employeeId', '==', targetReq.employeeId),
                where('status', 'in', ['approved', 'on-leave', 'returned']),
                orderBy('endDate', 'desc'),
                limit(1)
            );
            const snap = await getDocs(q);
            const filtered = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
                .filter(l => l.id !== targetReq.id);

            if (filtered.length > 0) setLastLeaveInfo(filtered[0]);
            else setLastLeaveInfo(null);
        } catch (e) {
            console.error("Error fetching context:", e);
        } finally {
            setLoadingContext(false);
        }
    };

    fetchContext();
  }, [firestore, requestToApprove, requestToReject]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'leaveRequests', requestToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف طلب الإجازة بنجاح.' });
    } catch (error) {
        console.error("Error deleting leave request:", error);
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
        const leaveRef = doc(firestore, 'leaveRequests', requestToApprove.id!);
        batch.update(leaveRef, {
            status: 'approved',
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp()
        });

        const employee = employees.find(e => e.id === requestToApprove.employeeId);
        if (employee) {
            const employeeRef = doc(firestore, 'employees', employee.id!);
            const daysToDeduct = requestToApprove.workingDays || requestToApprove.days || 0;
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
        const leaveRef = doc(firestore, 'leaveRequests', requestToReject.id!);
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
        const leaveRef = doc(firestore, 'leaveRequests', requestToUndoApproval.id!);
        batch.update(leaveRef, { status: 'pending' });

        const employee = employees.find(e => e.id === requestToUndoApproval.employeeId);
        if (employee) {
            const employeeRef = doc(firestore, 'employees', employee.id!);
            const daysToRevert = requestToUndoApproval.workingDays || requestToUndoApproval.days || 0;
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
        const reqRef = doc(firestore, 'leaveRequests', requestToUndoRejection.id!);
        await updateDoc(reqRef, { status: 'pending', rejectionReason: null });
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
        const dailyRate = fullSalary > 0 ? fullSalary / 26 : 0;
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
                housingAllowance: 0,
                transportAllowance: 0,
                commission: 0,
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
        
        const leaveRef = doc(firestore, 'leaveRequests', requestToPay.id!);
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

  const handleStartLeave = async () => {
    if (!requestToStart || !firestore || !actualDate) {
        toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'البيانات المطلوبة لتسجيل المغادرة غير متوفرة.' });
        return;
    }
    setIsProcessingAction(true);
    try {
        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'leaveRequests', requestToStart.id!);
        const employeeRef = doc(firestore, 'employees', requestToStart.employeeId);

        batch.update(requestRef, { 
            status: 'on-leave',
            actualStartDate: Timestamp.fromDate(actualDate)
        });
        batch.update(employeeRef, { status: 'on-leave' });
        
        await batch.commit();
        toast({ title: 'تم تسجيل المغادرة', description: `تم توثيق مغادرة الموظف بتاريخ ${format(actualDate, 'dd/MM/yyyy')}.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل بدء الإجازة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToStart(null);
        setActualDate(new Date());
    }
  };

  const handleReturnToWork = async () => {
    if (!requestToReturn || !firestore || !actualDate) {
        toast({ variant: 'destructive', title: 'خطأ في البيانات', description: 'البيانات المطلوبة لتسجيل العودة غير متوفرة.' });
        return;
    }
    setIsProcessingAction(true);
    try {
        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'leaveRequests', requestToReturn.id!);
        const employeeRef = doc(firestore, 'employees', requestToReturn.employeeId);

        batch.update(requestRef, { 
            status: 'returned',
            actualReturnDate: Timestamp.fromDate(actualDate)
        });
        batch.update(employeeRef, { status: 'active' });
        
        await batch.commit();
        toast({ title: 'تمت المباشرة', description: `تم توثيق عودة الموظف للعمل بتاريخ ${format(actualDate, 'dd/MM/yyyy')}.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل العودة للعمل.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToReturn(null);
        setActualDate(new Date());
    }
  };


  return (
    <>
      <div className="flex justify-end mb-6">
        <Button asChild className="h-11 px-8 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
          <Link href="/dashboard/hr/leaves/new">
            <PlusCircle className="h-5 w-5" />
            تقديم طلب إجازة جديد
          </Link>
        </Button>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
        <Table>
          <TableHeader className="bg-[#F8F9FE]">
            <TableRow className="border-none">
              <TableHead className="px-8 py-5 font-black text-[#7209B7]">اسم الموظف</TableHead>
              <TableHead className="font-black text-[#7209B7]">نوع الإجازة</TableHead>
              <TableHead className="font-black text-[#7209B7]">الفترة</TableHead>
              <TableHead className="font-black text-[#7209B7]">الأيام</TableHead>
              <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
              <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
              ))
            ) : leaveRequests.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد طلبات إجازة مسجلة.</TableCell></TableRow>
            ) : (
              leaveRequests.map(req => (
                <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16 cursor-pointer" onClick={() => router.push(`/dashboard/hr/leaves/${req.id}`)}>
                  <TableCell className="px-8 font-black text-gray-800">{req.employeeName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold px-3">
                        {leaveTypeTranslations[req.leaveType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs opacity-60">
                    <div className="flex items-center gap-1">
                        <span>{formatDate(req.startDate)}</span>
                        <ArrowRight className="h-3 w-3 mx-1 rotate-180" />
                        <span>{formatDate(req.endDate)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black">{req.workingDays} يوم عمل</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[req.status])}>
                        {statusTranslations[req.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                            <DropdownMenuLabel>إجراءات الطلب</DropdownMenuLabel>
                             {(currentUser?.role === 'Admin' || currentUser?.role === 'HR') && (
                                <>
                                    {req.status === 'approved' && (
                                        <DropdownMenuItem onClick={() => { setActualDate(toFirestoreDate(req.startDate) || new Date()); setRequestToStart(req); }} className="gap-2 text-blue-600 font-bold">
                                            <PlaneTakeoff className="h-4 w-4" /> تسجيل مغادرة
                                        </DropdownMenuItem>
                                    )}
                                    {req.status === 'on-leave' && (
                                        <DropdownMenuItem onClick={() => { setActualDate(toFirestoreDate(req.endDate) || new Date()); setRequestToReturn(req); }} className="gap-2 text-indigo-600 font-bold">
                                            <Home className="h-4 w-4" /> تسجيل عودة للعمل
                                        </DropdownMenuItem>
                                    )}
                                    {req.status === 'approved' && !req.isSalaryPaid && (
                                        <DropdownMenuItem onClick={() => setRequestToPay(req)} className="gap-2">
                                            <Banknote className="h-4 w-4" /> صرف راتب الإجازة
                                        </DropdownMenuItem>
                                    )}
                                    {req.status === 'pending' && (
                                        <>
                                            <DropdownMenuItem onClick={() => setRequestToApprove(req)} className="text-green-600 gap-2 font-bold">
                                                <CheckCircle className="h-4 w-4" /> موافقة
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setRequestToReject(req)} className="text-red-600 gap-2 font-bold">
                                                <X className="h-4 w-4" /> رفض الطلب
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    {req.status === 'approved' && (
                                        <DropdownMenuItem onClick={() => setRequestToUndoApproval(req)} className="text-orange-600 gap-2">
                                            <Undo2 className="h-4 w-4" /> تراجع عن الموافقة
                                        </DropdownMenuItem>
                                    )}
                                     {req.status === 'rejected' && (
                                        <DropdownMenuItem onClick={() => setRequestToUndoRejection(req)} className="gap-2">
                                            <Undo2 className="h-4 w-4" /> تراجع عن الرفض
                                        </DropdownMenuItem>
                                    )}
                                     <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/leaves/${req.id}/edit`)} className="gap-2">
                                        <Pencil className="h-4 w-4" /> تعديل البيانات
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            
                            <DropdownMenuItem className="text-destructive gap-2" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="h-4 w-4" /> حذف الطلب
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
      
      {/* ✨ نافذة تسجيل المغادرة التاريخية */}
      <AlertDialog open={!!requestToStart} onOpenChange={() => setRequestToStart(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 shadow-inner">
                        <PlaneTakeoff className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">تسجيل مغادرة الموظف</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">
                    يرجى تحديد التاريخ الذي غادر فيه الموظف <strong>{requestToStart?.employeeName}</strong> العمل فعلياً.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
                <Label className="font-bold pr-1">تاريخ المغادرة الفعلي:</Label>
                <DateInput value={actualDate} onChange={setActualDate} />
            </div>
            <AlertDialogFooter className="mt-2 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleStartLeave} disabled={isProcessingAction || !actualDate} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-black px-10 shadow-lg shadow-blue-100">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد المغادرة'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✨ نافذة إشعار العودة التاريخي */}
      <AlertDialog open={!!requestToReturn} onOpenChange={() => setRequestToReturn(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
                        <Home className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">إشعار مباشرة العمل</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">
                    يرجى تحديد التاريخ الذي باشر فيه الموظف <strong>{requestToReturn?.employeeName}</strong> عمله فعلياً.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
                <Label className="font-bold pr-1">تاريخ المباشرة الفعلي:</Label>
                <DateInput value={actualDate} onChange={setActualDate} />
            </div>
            <AlertDialogFooter className="mt-2 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleReturnToWork} disabled={isProcessingAction || !actualDate} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl font-black px-10 shadow-lg shadow-indigo-100">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد العودة'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToApprove} onOpenChange={() => setRequestToApprove(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl max-w-lg">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-green-50 rounded-2xl text-green-600 shadow-inner">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">تأكيد الموافقة</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">
                    هل أنت متأكد من موافقتك على طلب إجازة <strong>{requestToApprove?.employeeName}</strong>؟ سيتم خصم الأيام من رصيده آلياً.
                </AlertDialogDescription>
            </AlertDialogHeader>

            {/* ✨ عرض سياق القرار الذكي في نافذة الموافقة */}
            {lastLeaveInfo && (
                <div className="mt-4 p-4 border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl space-y-2 animate-in zoom-in-95">
                    <p className="text-xs font-black text-primary flex items-center gap-2 uppercase tracking-widest">
                        <Sparkles className="h-3 w-3"/> سياق القرار (HR Insights)
                    </p>
                    <p className="text-xs font-bold leading-relaxed text-slate-700">
                        كان الموظف في إجازة <strong>{leaveTypeTranslations[lastLeaveInfo.leaveType]}</strong> 
                        انتهت بتاريخ <strong>{format(toFirestoreDate(lastLeaveInfo.endDate)!, 'dd/MM/yyyy')}</strong> 
                        أي منذ <strong>{formatDistanceToNow(toFirestoreDate(lastLeaveInfo.endDate)!, { locale: ar })}</strong>.
                    </p>
                </div>
            )}

            <AlertDialogFooter className="mt-6 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold" disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmApproval} disabled={isProcessingAction} className="bg-green-600 hover:bg-green-700 rounded-xl font-black px-10 shadow-lg shadow-green-100">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، موافقة'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToReject} onOpenChange={() => setRequestToReject(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-red-700">تأكيد الرفض</AlertDialogTitle>
                <AlertDialogDescription>
                    الرجاء ذكر سبب رفض طلب الإجازة للموظف "{requestToReject?.employeeName}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Textarea
                    placeholder="اكتب سبب الرفض هنا..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="rounded-2xl border-2"
                />
            </div>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl" disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRejection} disabled={!rejectionReason.trim() || isProcessingAction} className="bg-red-600 hover:bg-red-700 rounded-xl font-bold">
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'تأكيد الرفض'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
       <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-red-50 rounded-2xl text-red-600 shadow-inner">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">حذف الطلب نهائياً</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">
                    هل أنت متأكد من حذف طلب إجازة <strong>{requestToDelete?.employeeName}</strong>؟ لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold" disabled={isDeleting}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-10">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، احذف الطلب'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

     <AlertDialog open={!!requestToPay} onOpenChange={() => setRequestToPay(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد صرف راتب الإجازة</AlertDialogTitle>
                <AlertDialogDescription>
                    سيتم إنشاء كشف راتب إجازة مسودة للموظف بناءً على عدد أيام الإجازة المعتمدة. هل تود المتابعة؟
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl" disabled={isProcessingAction}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmLeavePayment} disabled={isProcessingAction} className="bg-green-600 hover:bg-green-700 rounded-xl font-bold">
                    {isProcessingAction ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Banknote className="ml-2 h-4 w-4" />} نعم، قم بالصرف
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToUndoApproval} onOpenChange={() => setRequestToUndoApproval(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle>تراجع عن الموافقة</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من التراجع عن الموافقة على طلب إجازة <strong>{requestToUndoApproval?.employeeName}</strong>؟ سيتم إعادة الحالة إلى "معلق" واسترداد الأيام المخصومة لرصيد الموظف.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold" disabled={isProcessingAction}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoApproval} disabled={isProcessingAction} className="bg-orange-600 hover:bg-orange-700 rounded-xl font-black">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد التراجع'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!requestToUndoRejection} onOpenChange={() => setRequestToUndoRejection(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle>تراجع عن الرفض</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من التراجع عن رفض طلب إجازة <strong>{requestToUndoRejection?.employeeName}</strong>؟ سيتم إعادة الحالة إلى "معلق".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold" disabled={isProcessingAction}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoRejection} disabled={isProcessingAction} className="bg-primary hover:bg-primary/90 rounded-xl font-black">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد التراجع'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
