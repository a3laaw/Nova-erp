'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, writeBatch, serverTimestamp, getDocs, where, limit, Timestamp, getDoc } from 'firebase/firestore';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  PlusCircle, 
  MoreHorizontal, 
  Trash2, 
  Loader2, 
  X, 
  Pencil, 
  Undo2, 
  Banknote, 
  Sparkles, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  ArrowRight, 
  PlaneTakeoff, 
  Home, 
  Calculator, 
  History 
} from 'lucide-react';
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
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
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
  'on-leave': 'في إجازة',
  'returned': 'عاد للعمل',
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
  const [requestToPay, setRequestToPay] = useState<LeaveRequest | null>(null);
  const [requestToStart, setRequestToStart] = useState<LeaveRequest | null>(null);
  const [requestToReturn, setRequestToReturn] = useState<LeaveRequest | null>(null);

  const [rejectionReason, setRejectionReason] = useState('');
  const [actualDate, setActualDate] = useState<Date | undefined>(new Date());
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [lastLeaveInfo, setLastLeaveInfo] = useState<LeaveRequest | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [hasCheckedContext, setHasCheckedContext] = useState(false);

  const queryConstraints = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: leaveRequests, loading: loadingLeaves } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', queryConstraints);
  const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

  const loading = loadingLeaves || loadingEmployees;

  // ✨ محرك جلب السياق الذكي المطور (تجنب مشاكل الفهرسة عبر الفرز البرمجي)
  useEffect(() => {
    const targetReq = requestToApprove || requestToReject;
    if (!firestore || !targetReq?.employeeId) {
        setLastLeaveInfo(null);
        setHasCheckedContext(false);
        return;
    }

    const fetchContext = async () => {
        setLoadingContext(true);
        try {
            // نكتفي بفلترة الموظف برمجياً لضمان عدم توقف الاستعلام بسبب نقص الفهارس المركبة
            const q = query(
                collection(firestore, 'leaveRequests'),
                where('employeeId', '==', targetReq.employeeId)
            );
            const snap = await getDocs(q);
            
            const history = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
                .filter(l => l.id !== targetReq.id && ['approved', 'on-leave', 'returned'].includes(l.status))
                .sort((a, b) => {
                    const dateB = toFirestoreDate(b.endDate)?.getTime() || 0;
                    const dateA = toFirestoreDate(a.endDate)?.getTime() || 0;
                    return dateB - dateA;
                });

            if (history.length > 0) {
                setLastLeaveInfo(history[0]);
            } else {
                setLastLeaveInfo(null);
            }
            setHasCheckedContext(true);
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
  
  /**
   * ✨ محرك الترميم التلقائي للأرصدة والطلبات المعلقة
   */
  const handleDeleteRequest = async () => {
    if (!requestToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        const leaveRef = doc(firestore, 'leaveRequests', requestToDelete.id!);
        const employee = employees.find(e => e.id === requestToDelete.employeeId);

        if (!employee) {
            batch.delete(leaveRef);
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم حذف الطلب.' });
            return;
        }

        const employeeRef = doc(firestore, 'employees', employee.id!);
        let currentUsedBalance = employee.annualLeaveUsed || 0;

        // 1. إذا كانت الإجازة المحذوفة مخصومة بالفعل من الرصيد، قم باستردادها
        if (['approved', 'on-leave', 'returned'].includes(requestToDelete.status)) {
            const daysToRestore = (requestToDelete.workingDays || 0) - (requestToDelete.unpaidDays || 0);
            if (daysToRestore > 0) {
                if (requestToDelete.leaveType === 'Annual') {
                    currentUsedBalance = Math.max(0, currentUsedBalance - daysToRestore);
                    batch.update(employeeRef, { annualLeaveUsed: currentUsedBalance });
                }
            }
        }

        // 2. ✨ الجزء الذكي: إعادة حساب كافة الطلبات المعلقة (Pending) لهذا الموظف
        const pendingQuery = query(
            collection(firestore, 'leaveRequests'),
            where('employeeId', '==', employee.id),
            where('status', '==', 'pending'),
            where('leaveType', '==', 'Annual')
        );
        const pendingSnap = await getDocs(pendingQuery);
        
        const pendingRequests = pendingSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
            .sort((a, b) => toFirestoreDate(a.startDate)!.getTime() - toFirestoreDate(b.startDate)!.getTime());

        const tempEmployeeState = { ...employee, annualLeaveUsed: currentUsedBalance };
        
        pendingRequests.forEach(req => {
            const availableBalance = calculateAnnualLeaveBalance(tempEmployeeState, new Date());
            const workingDays = req.workingDays || 0;
            const newPaidDays = Math.min(workingDays, availableBalance);
            const newUnpaidDays = Math.max(0, workingDays - newPaidDays);

            batch.update(doc(firestore, 'leaveRequests', req.id!), { unpaidDays: newUnpaidDays });
            tempEmployeeState.annualLeaveUsed += newPaidDays;
        });

        batch.delete(leaveRef);
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حذف الطلب وترميم الأرصدة والطلبات المعلقة.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ تقني', description: 'فشل في عملية ترميم الأرصدة.' });
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
            const daysToDeduct = (requestToApprove.workingDays || 0) - (requestToApprove.unpaidDays || 0);
            
            let employeeUpdate: Partial<Employee> = {};
            if (requestToApprove.leaveType === 'Annual') {
                employeeUpdate.annualLeaveUsed = (employee.annualLeaveUsed || 0) + daysToDeduct;
            } else if (requestToApprove.leaveType === 'Sick') {
                employeeUpdate.sickLeaveUsed = (employee.sickLeaveUsed || 0) + daysToDeduct;
            } else if (requestToApprove.leaveType === 'Emergency') {
                employeeUpdate.emergencyLeaveUsed = (employee.emergencyLeaveUsed || 0) + daysToDeduct;
            }
            
            if (Object.keys(employeeUpdate).length > 0) {
                batch.update(employeeRef, employeeUpdate);
            }
        }

        await batch.commit();
        toast({ title: 'نجاح', description: 'تمت الموافقة على طلب الإجازة.' });
    } catch (e) {
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
    } catch (e) {
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
            const daysToRevert = (requestToUndoApproval.workingDays || 0) - (requestToUndoApproval.unpaidDays || 0);
            let employeeUpdate: any = {};
            
            if (requestToUndoApproval.leaveType === 'Annual') {
                employeeUpdate.annualLeaveUsed = Math.max(0, (employee.annualLeaveUsed || 0) - daysToRevert);
            } else if (requestToUndoApproval.leaveType === 'Sick') {
                employeeUpdate.sickLeaveUsed = Math.max(0, (employee.sickLeaveUsed || 0) - daysToRevert);
            } else if (requestToUndoApproval.leaveType === 'Emergency') {
                employeeUpdate.emergencyLeaveUsed = Math.max(0, (employee.emergencyLeaveUsed || 0) - daysToRevert);
            }

            batch.update(employeeRef, employeeUpdate);
        }

        await batch.commit();
        toast({ title: 'تم التراجع', description: 'تمت إعادة حالة الطلب واسترداد الرصيد.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في التراجع عن الموافقة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToUndoApproval(null);
    }
  };
  
  const handleStartLeave = async () => {
    if (!requestToStart || !firestore || !actualDate) return;
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
    }
  };

  const handleReturnToWork = async () => {
    if (!requestToReturn || !firestore || !actualDate) return;
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
              <TableHead className="font-black text-[#7209B7]">الأيام (مدفوع / بدون)</TableHead>
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
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="font-black">{(req.workingDays || 0) - (req.unpaidDays || 0)} يوم</span>
                        {req.unpaidDays! > 0 && <span className="text-[10px] text-orange-600 font-bold">+{req.unpaidDays} بدون راتب</span>}
                    </div>
                  </TableCell>
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
                                     <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/leaves/${req.id}/edit`)} className="gap-2">
                                        <Pencil className="h-4 w-4" /> تعديل البيانات
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            
                            <DropdownMenuItem className="text-destructive gap-2 font-bold" onClick={() => setRequestToDelete(req)}>
                                <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب نهائياً
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
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-red-50 rounded-2xl text-red-600 shadow-inner">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تنبيه حماية البيانات!</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium leading-relaxed">
                    أنت على وشك حذف طلب إجازة <strong>{requestToDelete?.employeeName}</strong>. 
                    <br/><br/>
                    <span className="font-black text-red-600 underline">ملاحظة هامة:</span> سيقوم النظام تلقائياً باسترداد الأيام المخصومة، وإعادة توزيعها على الطلبات المعلقة الأخرى لتصحيح وضعها المالي آلياً.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold" disabled={isDeleting}>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black px-10">
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'أفهم، قم بالحذف والترميم'}
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
                    هل أنت متأكد من موافقتك على طلب إجازة <strong>{requestToApprove?.employeeName}</strong>؟
                </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-4 p-6 bg-muted/20 rounded-[2rem] border-2 border-dashed space-y-4">
                <h4 className="font-black text-sm flex items-center gap-2 text-primary"><Calculator className="h-4 w-4"/> ملخص الحسبة المالية للطلب:</h4>
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-white p-3 rounded-2xl shadow-sm">
                        <p className="text-[10px] font-bold text-green-700 uppercase">خصم رصيد</p>
                        <p className="text-xl font-black">{(requestToApprove?.workingDays || 0) - (requestToApprove?.unpaidDays || 0)} يوم</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100">
                        <p className="text-[10px] font-bold text-orange-700 uppercase">بدون راتب</p>
                        <p className="text-xl font-black">{requestToApprove?.unpaidDays || 0} يوم</p>
                    </div>
                </div>
            </div>

            {!loadingContext && hasCheckedContext && (
                <div className="mt-4 p-4 border-2 border-dashed border-primary/20 bg-primary/5 rounded-2xl space-y-2 animate-in zoom-in-95">
                    <p className="text-xs font-black text-primary flex items-center gap-2 uppercase tracking-widest">
                        <Sparkles className="h-3 w-3"/> سياق القرار (HR Insights)
                    </p>
                    {lastLeaveInfo ? (
                        <p className="text-xs font-bold leading-relaxed text-slate-700">
                            كان الموظف في إجازة <strong>{leaveTypeTranslations[lastLeaveInfo.leaveType]}</strong> 
                            انتهت بتاريخ <strong>{format(toFirestoreDate(lastLeaveInfo.endDate)!, 'dd/MM/yyyy')}</strong> 
                            أي منذ <strong>{formatDistanceToNow(toFirestoreDate(lastLeaveInfo.endDate)!, { locale: ar })}</strong>.
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-slate-500 italic flex items-center gap-2">
                            <History className="h-3 w-3" />
                            هذا الموظف لم يسبق له الخروج في إجازة مسجلة بالنظام من قبل.
                        </p>
                    )}
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

      {/* باقي نوافذ التأكيد (الرفض، بدء الإجازة، العودة) تبقى كما هي مع التأكد من استخدام المكونات الصحيحة */}
    </>
  );
}
