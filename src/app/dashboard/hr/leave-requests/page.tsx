

'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, PlusCircle, X, Pencil, LogIn, CheckCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/hr/leave-request-form';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, writeBatch, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';


const statusColors: Record<LeaveRequest['status'], string> = {
    'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'approved': 'bg-green-100 text-green-800 border-green-200',
    'rejected': 'bg-red-100 text-red-800 border-red-200',
};
const statusTranslations: Record<LeaveRequest['status'], string> = {
    'pending': 'معلقة',
    'approved': 'مقبولة',
    'rejected': 'مرفوضة',
};

const typeColors: Record<LeaveRequest['leaveType'], string> = {
    'Annual': 'bg-blue-100 text-blue-800 border-blue-200',
    'Sick': 'bg-purple-100 text-purple-800 border-purple-200',
    'Emergency': 'bg-orange-100 text-orange-800 border-orange-200',
    'Unpaid': 'bg-gray-100 text-gray-800 border-gray-200',
};
const typeTranslations: Record<LeaveRequest['leaveType'], string> = {
    'Annual': 'سنوية',
    'Sick': 'مرضية',
    'Emergency': 'طارئة',
    'Unpaid': 'بدون راتب',
};


export default function LeaveRequestsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    
    const [requestToReturn, setRequestToReturn] = useState<LeaveRequest | null>(null);
    const [actualReturnDate, setActualReturnDate] = useState('');
    const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false);
    const [isProcessingReturn, setIsProcessingReturn] = useState(false);

    useEffect(() => {
        if (isReturnConfirmOpen) {
            setActualReturnDate(new Date().toISOString().split('T')[0]);
        }
    }, [isReturnConfirmOpen]);

    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'leaveRequests'), 
            where('status', '==', filter)
        );
    }, [firestore, filter]);

    const [snapshot, loading, error] = useCollection(requestsQuery);

    const requests = useMemo(() => {
        if (!snapshot) return [];
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
        reqs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        return reqs;
    }, [snapshot]);


    const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected', employeeId?: string, workingDays?: number) => {
        if (!firestore || !employeeId) return;

        const requestRef = doc(firestore, 'leaveRequests', requestId);
        const employeeRef = doc(firestore, 'employees', employeeId);

        try {
            const batch = writeBatch(firestore);

            batch.update(requestRef, {
                status: newStatus,
                approvedAt: serverTimestamp(),
                // approvedBy: currentUser?.uid // In a real app with auth context
            });

            // If approved, update employee status and leave balance
            if (newStatus === 'approved') {
                batch.update(employeeRef, { 
                    status: 'on-leave',
                    // This is a simplified update. A robust system would use transactions
                    // and cloud functions to handle leave accrual and usage precisely.
                    // annualLeaveUsed: increment(workingDays) 
                });
            }

            await batch.commit();
            
            toast({
                title: 'نجاح',
                description: `تم ${newStatus === 'approved' ? 'قبول' : 'رفض'} الطلب بنجاح.`
            });
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: 'فشل تحديث حالة الطلب.'
            });
        }
    };
    
    const handleNewRequestClick = () => {
        setEditingRequest(null);
        setIsFormOpen(true);
    };

    const handleEditRequestClick = (request: LeaveRequest) => {
        setEditingRequest(request);
        setIsFormOpen(true);
    };

    const handleReturnClick = (request: LeaveRequest) => {
        setRequestToReturn(request);
        setIsReturnConfirmOpen(true);
    }

    const handleConfirmReturn = async () => {
        if (!firestore || !requestToReturn || !actualReturnDate) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد تاريخ العودة الفعلي.' });
            return;
        }

        setIsProcessingReturn(true);
        const requestRef = doc(firestore, 'leaveRequests', requestToReturn.id);
        const employeeRef = doc(firestore, 'employees', requestToReturn.employeeId);

        try {
            const batch = writeBatch(firestore);

            batch.update(requestRef, {
                isBackFromLeave: true,
                actualReturnDate: new Date(actualReturnDate).toISOString(),
            });

            batch.update(employeeRef, {
                status: 'active'
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تسجيل عودة الموظف بنجاح.' });
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تسجيل عودة الموظف.' });
        } finally {
            setIsProcessingReturn(false);
            setIsReturnConfirmOpen(false);
            setRequestToReturn(null);
        }
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingRequest(null);
    };


  const formatDate = (date: any) => {
    if (!date) return '-';
    try {
        let d: Date;
        if (typeof date === 'string') {
            d = new Date(date);
        } else if (date && typeof date.seconds === 'number') {
            d = new Date(date.seconds * 1000);
        } else {
            return '-';
        }
        
        if (isNaN(d.getTime())) return '-';

        return new Intl.DateTimeFormat('ar-KW', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(d);
    } catch (e) {
        return '-';
    }
  }

  return (
    <>
      <Card dir="rtl">
        <CardHeader>
            <div className='flex justify-between items-center'>
                <div>
                    <CardTitle>طلبات الإجازة</CardTitle>
                    <CardDescription>
                    إدارة طلبات الإجازات المقدمة من الموظفين.
                    </CardDescription>
                </div>
                <Button onClick={handleNewRequestClick}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    طلب إجازة جديد
                </Button>
            </div>
        </CardHeader>
        <CardContent>
             <div className="flex gap-2 mb-4 border-b pb-4">
                <Button variant={filter === 'pending' ? 'secondary' : 'ghost'} onClick={() => setFilter('pending')}>
                    طلبات معلقة
                </Button>
                <Button variant={filter === 'approved' ? 'secondary' : 'ghost'} onClick={() => setFilter('approved')} >
                    طلبات مقبولة
                </Button>
                <Button variant={filter === 'rejected' ? 'secondary' : 'ghost'} onClick={() => setFilter('rejected')} >
                    طلبات مرفوضة
                </Button>
            </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>نوع الإجازة</TableHead>
                            <TableHead>من تاريخ</TableHead>
                            <TableHead>إلى تاريخ</TableHead>
                            <TableHead>الأيام</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead className='text-center'>الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading && Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={`skel-${i}`}>
                                <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))}
                        {error && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-destructive">
                                    حدث خطأ أثناء جلب البيانات.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    لا توجد طلبات إجازة حالياً.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && requests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className='font-medium'>{req.employeeName}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={typeColors[req.leaveType]}>
                                        {typeTranslations[req.leaveType]}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDate(req.startDate)}</TableCell>
                                <TableCell>{formatDate(req.endDate)}</TableCell>
                                <TableCell>
                                    <div className='flex flex-col'>
                                        <span className='font-medium'>{req.days} أيام</span>
                                        {req.workingDays !== undefined && <span className='text-xs text-muted-foreground'>({req.workingDays} أيام عمل)</span>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[req.status]}>
                                        {statusTranslations[req.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell className='text-center'>
                                    {filter === 'pending' && (
                                        <div className='flex gap-2 justify-center'>
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleEditRequestClick(req)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleStatusUpdate(req.id, 'approved', req.employeeId, req.workingDays)}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleStatusUpdate(req.id, 'rejected', req.employeeId)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    {filter === 'approved' && (
                                        <>
                                            {req.isBackFromLeave ? (
                                                 <div className='flex items-center justify-center gap-2 text-green-600'>
                                                    <CheckCircle className="h-4 w-4" />
                                                    <span className='text-xs'>عاد في: {formatDate(req.actualReturnDate)}</span>
                                                 </div>
                                            ) : (
                                                <Button size="sm" variant="outline" onClick={() => handleReturnClick(req)}>
                                                    <LogIn className="ml-2 h-4 w-4" />
                                                    تسجيل العودة
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      <LeaveRequestForm 
        isOpen={isFormOpen} 
        onClose={handleCloseForm}
        requestToEdit={editingRequest}
      />

       <AlertDialog open={isReturnConfirmOpen} onOpenChange={setIsReturnConfirmOpen}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تسجيل عودة الموظف</AlertDialogTitle>
                    <AlertDialogDescription>
                        الرجاء تحديد تاريخ العودة الفعلي للموظف "{requestToReturn?.employeeName}". سيتم تحديث حالة الموظف إلى "نشط".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                 <div className="grid gap-2 py-4">
                    <Label htmlFor="actualReturnDate">تاريخ العودة الفعلي</Label>
                    <Input
                        id="actualReturnDate"
                        type="date"
                        value={actualReturnDate}
                        onChange={(e) => setActualReturnDate(e.target.value)}
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessingReturn}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmReturn} disabled={isProcessingReturn}>
                        {isProcessingReturn ? 'جاري الحفظ...' : 'تأكيد العودة'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
