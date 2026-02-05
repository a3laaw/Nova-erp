
'use client';
import { useState, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { LeaveRequest, Employee } from '@/lib/types';
import { format, differenceInCalendarDays } from 'date-fns';
import { MoreHorizontal, PlusCircle, Check, X, Eye, Loader2, Plane, Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { LeaveRequestForm } from './leave-request-form';
import { toFirestoreDate } from '@/services/date-converter';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'مقبول',
  rejected: 'مرفوض',
};

const leaveTypeTranslations: Record<string, string> = {
  Annual: 'سنوية',
  Sick: 'مرضية',
  Emergency: 'طارئة',
  Unpaid: 'بدون أجر',
};


export function LeaveRequestsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestToProcess, setRequestToProcess] = useState<{ request: LeaveRequest; action: 'approve' | 'reject' } | null>(null);
  const [backFromLeaveDialog, setBackFromLeaveDialog] = useState<LeaveRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: requests, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', [orderBy('createdAt', 'desc')]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleAction = async () => {
    if (!requestToProcess || !firestore) return;

    setIsProcessing(true);
    const { request, action } = requestToProcess;

    try {
        const leaveRef = doc(firestore, 'leaveRequests', request.id);
        const empRef = doc(firestore, 'employees', request.employeeId);
        
        await firestore.runTransaction(async (transaction) => {
            const empDoc = await transaction.get(empRef);
            if (!empDoc.exists()) throw new Error("لم يتم العثور على الموظف.");
            
            const employee = empDoc.data() as Employee;
            
            if (action === 'approve') {
                const leaveDays = request.workingDays || request.days;
                if (request.leaveType === 'Annual' && (employee.annualLeaveBalance || 0) < leaveDays) {
                    throw new Error("رصيد إجازات الموظف لا يغطي مدة الإجازة المطلوبة.");
                }
                
                let updateData: Partial<Employee> = {};
                if (request.leaveType === 'Annual') {
                    updateData.annualLeaveUsed = (employee.annualLeaveUsed || 0) + leaveDays;
                } else if (request.leaveType === 'Sick') {
                    updateData.sickLeaveUsed = (employee.sickLeaveUsed || 0) + leaveDays;
                } else if (request.leaveType === 'Emergency') {
                     updateData.emergencyLeaveUsed = (employee.emergencyLeaveUsed || 0) + leaveDays;
                }
                
                transaction.update(empRef, updateData);
                transaction.update(leaveRef, { status: 'approved', approvedAt: serverTimestamp() });

            } else { // Reject
                transaction.update(leaveRef, { status: 'rejected', approvedAt: serverTimestamp() });
            }
        });
        
        toast({ title: 'نجاح', description: `تم ${action === 'approve' ? 'قبول' : 'رفض'} الطلب.` });

    } catch (e: any) {
        console.error("Error processing leave request:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: e.message || 'فشل معالجة طلب الإجازة.' });
    } finally {
        setIsProcessing(false);
        setRequestToProcess(null);
    }
  };
  
  const handleBackFromLeave = async () => {
    if(!backFromLeaveDialog || !firestore) return;
    setIsProcessing(true);
     try {
        const leaveRef = doc(firestore, 'leaveRequests', backFromLeaveDialog.id);
        await updateDoc(leaveRef, { isBackFromLeave: true, actualReturnDate: serverTimestamp() });
        toast({ title: 'نجاح', description: `تم تسجيل عودة الموظف "${backFromLeaveDialog.employeeName}" من الإجازة.` });
    } catch(e) {
         toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل عودة الموظف.' });
    } finally {
        setIsProcessing(false);
        setBackFromLeaveDialog(null);
    }
  };

  return (
    <div className="space-y-4">
        <div className="flex justify-end">
            <Button onClick={() => setIsFormOpen(true)} size="sm">
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
                        <TableHead>من</TableHead>
                        <TableHead>إلى</TableHead>
                        <TableHead>الأيام</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && Array.from({length: 5}).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                    ))}
                    {!loading && requests.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد طلبات إجازة حالياً.</TableCell></TableRow>
                    )}
                    {requests.map(req => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">{req.employeeName}</TableCell>
                            <TableCell>{leaveTypeTranslations[req.leaveType] || req.leaveType}</TableCell>
                            <TableCell>{formatDate(req.startDate)}</TableCell>
                            <TableCell>{formatDate(req.endDate)}</TableCell>
                            <TableCell>{req.workingDays || req.days}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[req.status]}>{statusTranslations[req.status]}</Badge>
                            </TableCell>
                            <TableCell>
                                {req.status === 'pending' ? (
                                    <div className="flex gap-2">
                                        <Button size="xs" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => setRequestToProcess({ request: req, action: 'approve' })}><Check className="h-4 w-4"/> قبول</Button>
                                        <Button size="xs" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => setRequestToProcess({ request: req, action: 'reject' })}><X className="h-4 w-4"/> رفض</Button>
                                    </div>
                                ) : req.status === 'approved' && !req.isBackFromLeave ? (
                                     <Button size="xs" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => setBackFromLeaveDialog(req)}><Plane className="h-4 w-4 ml-1" /> تسجيل العودة</Button>
                                ) : (
                                    '-'
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
        
        {isFormOpen && <LeaveRequestForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} />}
        
        <AlertDialog open={!!requestToProcess} onOpenChange={() => setRequestToProcess(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد الإجراء</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من {requestToProcess?.action === 'approve' ? 'قبول' : 'رفض'} طلب الإجازة للموظف "{requestToProcess?.request.employeeName}"؟
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAction} disabled={isProcessing} className={requestToProcess?.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}>
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، تأكيد'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!backFromLeaveDialog} onOpenChange={() => setBackFromLeaveDialog(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تسجيل عودة من الإجازة</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل تؤكد أن الموظف "{backFromLeaveDialog?.employeeName}" قد عاد من إجازته؟
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBackFromLeave} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، تأكيد العودة'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}


    