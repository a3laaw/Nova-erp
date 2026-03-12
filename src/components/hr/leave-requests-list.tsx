'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  updateDoc, 
  writeBatch, 
  getDocs, 
  where, 
  limit, 
  Timestamp, 
  getDoc,
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
import type { LeaveRequest, Employee } from '@/lib/types';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '../ui/textarea';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency, cn, cleanFirestoreData } from '@/lib/utils';
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


function InfoRow({ label, value, icon }: { label: string, value: string | React.ReactNode, icon: React.ReactNode }) {
    return (
        <div className="flex gap-4 text-sm">
            <div className="text-muted-foreground shrink-0">{icon}</div>
            <div className="font-semibold w-24 shrink-0">{label}:</div>
            <div className="break-words">{value}</div>
        </div>
    )
}

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

  // ✨ جلب سياق القرار الذكي (HR Insights)
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

        if (['approved', 'on-leave', 'returned'].includes(requestToDelete.status)) {
            const daysToRestore = (requestToDelete.workingDays || 0) - (requestToDelete.unpaidDays || 0);
            if (daysToRestore > 0) {
                if (requestToDelete.leaveType === 'Annual') {
                    currentUsedBalance = Math.max(0, currentUsedBalance - daysToRestore);
                    batch.update(employeeRef, { annualLeaveUsed: currentUsedBalance });
                }
            }
        }

        // البحث عن الطلبات المعلقة لإعادة الحسبة آلياً
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
        toast({ title: 'نجاح', description: 'تم حذف الطلب وترميم الأرصدة تلقائياً.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الطلب.' });
    } finally {
        setIsDeleting(false);
        setRequestToDelete(null);
    }
  };
  
  const handleConfirmApproval = async () => {
    if (!requestToApprove || !firestore || !currentUser) return;

    setIsProcessingAction(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const leaveRef = doc(firestore, 'leaveRequests', requestToApprove.id!);
            const employeeRef = doc(firestore, 'employees', requestToApprove.employeeId);
            const employeeSnap = await transaction.get(employeeRef);

            if (!employeeSnap.exists()) throw new Error("الموظف غير موجود في النظام.");
            const employee = employeeSnap.data() as Employee;

            // تحديث طلب الإجازة
            transaction.update(leaveRef, {
                status: 'approved',
                approvedBy: currentUser.id,
                approvedAt: serverTimestamp()
            });

            // تحديث رصيد الموظف
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
                transaction.update(employeeRef, employeeUpdate);
            }
        });

        toast({ title: 'نجاح', description: 'تمت الموافقة على طلب الإجازة وتحديث الرصيد.' });
    } catch (e: any) {
        console.error("Approval error:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: e.message || 'فشل في الموافقة على طلب الإجازة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToApprove(null);
    }
  };
  
  const handleConfirmRejection = async () => {
    if (!requestToReject || !rejectionReason.trim() || !firestore || !currentUser) return;
    setIsProcessingAction(true);
    try {
        const leaveRef = doc(firestore, 'permissionRequests', requestToReject.id!);
        await updateDoc(leaveRef, {
            status: 'rejected',
            rejectionReason: rejectionReason,
            approvedBy: currentUser.id,
            approvedAt: serverTimestamp()
        });
        toast({ title: 'تم الرفض', description: 'تم رفض طلب الإجازة بنجاح.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message || 'فشل في رفض طلب الإجازة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToReject(null);
        setRejectionReason('');
    }
  };

  const handleUndoApproval = async () => {
    if (!requestToUndoApproval || !firestore || !currentUser) return;

    setIsProcessingAction(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const leaveRef = doc(firestore, 'leaveRequests', requestToUndoApproval.id!);
            const employeeRef = doc(firestore, 'employees', requestToUndoApproval.employeeId);
            const employeeSnap = await transaction.get(employeeRef);

            if (!employeeSnap.exists()) throw new Error("الموظف غير موجود.");
            const employee = employeeSnap.data() as Employee;

            transaction.update(leaveRef, { status: 'pending' });

            const daysToRevert = (requestToUndoApproval.workingDays || 0) - (requestToUndoApproval.unpaidDays || 0);
            let employeeUpdate: any = {};
            
            if (requestToUndoApproval.leaveType === 'Annual') {
                employeeUpdate.annualLeaveUsed = Math.max(0, (employee.annualLeaveUsed || 0) - daysToRevert);
            } else if (requestToUndoApproval.leaveType === 'Sick') {
                employeeUpdate.sickLeaveUsed = Math.max(0, (employee.sickLeaveUsed || 0) - daysToRevert);
            } else if (requestToUndoApproval.leaveType === 'Emergency') {
                employeeUpdate.emergencyLeaveUsed = Math.max(0, (employee.emergencyLeaveUsed || 0) - daysToRevert);
            }

            if (Object.keys(employeeUpdate).length > 0) {
                transaction.update(employeeRef, employeeUpdate);
            }
        });

        toast({ title: 'تم التراجع', description: 'تمت إعادة حالة الطلب واسترداد الرصيد المخصوم.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ', description: e.message || 'فشل في التراجع عن الموافقة.' });
    } finally {
        setIsProcessingAction(false);
        setRequestToUndoApproval(null);
    }
  };
  
  const handleStartLeave = async () => {
    if (!requestToStart || !firestore || !actualDate || !requestToStart.id) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'البيانات غير كافية لتسجيل المغادرة.' });
        return;
    }
    setIsProcessingAction(true);
    try {
        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'leaveRequests', requestToStart.id);
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
    if (!requestToReturn || !firestore || !actualDate || !requestToReturn.id) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'البيانات غير كافية لتسجيل العودة.' });
        return;
    }
    setIsProcessingAction(true);
    try {
        const batch = writeBatch(firestore);
        const requestRef = doc(firestore, 'leaveRequests', requestToReturn.id);
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
              <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم الملف</TableHead>
              <TableHead className="font-black text-[#7209B7]">اسم الموظف</TableHead>
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
                <TableRow key={i}><TableCell colSpan={7} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
              ))
            ) : leaveRequests.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد طلبات إجازة مسجلة.</TableCell></TableRow>
            ) : (
              leaveRequests.map(req => {
                const emp = employees.find(e => e.id === req.employeeId);
                return (
                <TableRow key={req.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16 cursor-pointer" onClick={() => router.push(`/dashboard/hr/leaves/${req.id}`)}>
                  <TableCell className="px-8 font-mono font-bold opacity-60 text-xs">{emp?.employeeNumber || '---'}</TableCell>
                  <TableCell>
                    <span className="font-black text-gray-800">{req.employeeName}</span>
                  </TableCell>
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
              )})
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* نافذة حذف الطلب */}
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

      {/* نافذة الموافقة */}
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

      {/* نافذة الرفض */}
      <AlertDialog open={!!requestToReject} onOpenChange={() => setRequestToReject(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black">رفض طلب الإجازة</AlertDialogTitle>
                <AlertDialogDescription>الرجاء ذكر سبب الرفض ليتم إشعار الموظف به.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="اكتب سبب الرفض هنا..." className="rounded-xl border-2" />
            </div>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRejection} disabled={isProcessingAction || !rejectionReason.trim()} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'تأكيد الرفض'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✨ نافذة التراجع عن الموافقة ✨ */}
      <AlertDialog open={!!requestToUndoApproval} onOpenChange={() => setRequestToUndoApproval(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-orange-50 rounded-2xl text-orange-600 shadow-inner">
                        <Undo2 className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">تراجع عن الموافقة</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium leading-relaxed">
                    هل أنت متأكد من التراجع عن الموافقة على طلب <strong>{requestToUndoApproval?.employeeName}</strong>؟
                    <br/><br/>
                    سيتم إعادة الطلب لحالة "معلق" واسترداد الأيام المخصومة لرصيد الموظف آلياً.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={handleUndoApproval} disabled={isProcessingAction} className="bg-orange-600 hover:bg-orange-700 rounded-xl font-black px-10 shadow-lg shadow-orange-100">
                    {isProcessingAction ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، تراجع عن الموافقة'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* نافذة تسجيل المغادرة */}
      <AlertDialog open={!!requestToStart} onOpenChange={() => setRequestToStart(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 shadow-inner">
                        <PlaneTakeoff className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">تسجيل مغادرة الموظف</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">يرجى تحديد التاريخ الذي غادر فيه الموظف العمل فعلياً لبدء الإجازة.</AlertDialogDescription>
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

      {/* نافذة تسجيل العودة */}
      <AlertDialog open={!!requestToReturn} onOpenChange={() => setRequestToReturn(null)}>
        <AlertDialogContent dir="rtl" className="rounded-3xl">
            <AlertDialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 shadow-inner">
                        <Home className="h-6 w-6" />
                    </div>
                    <AlertDialogTitle className="text-2xl font-black">إشعار مباشرة العمل</AlertDialogTitle>
                </div>
                <AlertDialogDescription className="text-base font-medium">يرجى تحديد التاريخ الذي باشر فيه الموظف عمله فعلياً بعد العودة من الإجازة.</AlertDialogDescription>
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
    </>
  );
}
