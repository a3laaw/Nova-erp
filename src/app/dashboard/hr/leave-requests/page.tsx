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
import { ArrowRight, Check, PlusCircle, X, Pencil, LogIn, CheckCircle } from 'lucide-react';
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
import { collection, query, where, doc, updateDoc, writeBatch, serverTimestamp, type DocumentData, orderBy, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';


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
    const router = useRouter();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    
    const [requestToReturn, setRequestToReturn] = useState<LeaveRequest | null>(null);
    const [actualReturnDate, setActualReturnDate] = useState('');
    const [isReturnConfirmOpen, setIsReturnConfirmOpen] = useState(false);
    const [isProcessingReturn, setIsProcessingReturn] = useState(false);

    const [requestToReject, setRequestToReject] = useState<LeaveRequest | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
    const [isProcessingReject, setIsProcessingReject] = useState(false);

    const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (isReturnConfirmOpen) {
            setActualReturnDate(new Date().toISOString().split('T')[0]);
        }
    }, [isReturnConfirmOpen]);
    
    useEffect(() => {
        if (!firestore) return;

        const fetchAllEmployees = async () => {
            setDataLoading(true);
            try {
                const employeesSnapshot = await getDocs(collection(firestore, 'employees'));
                const newEmployeesMap = new Map<string, string>();
                employeesSnapshot.forEach(doc => {
                    const emp = doc.data() as Employee;
                    newEmployeesMap.set(doc.id, emp.fullName);
                });
                setEmployeesMap(newEmployeesMap);
            } catch (error) {
                console.error("Failed to fetch employees for map:", error);
                toast({
                    variant: "destructive",
                    title: "خطأ",
                    description: "فشل في جلب بيانات الموظفين.",
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchAllEmployees();
    }, [firestore, toast]);


    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'leaveRequests'), 
            where('status', '==', filter),
            orderBy('createdAt', 'desc')
        );
    }, [firestore, filter]);

    const [snapshot, loading, error] = useCollection(requestsQuery);

    const requests = useMemo(() => {
        if (!snapshot) return [];
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
    }, [snapshot]);


    const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected', employeeId?: string, rejectionReason?: string) => {
        if (!firestore || !employeeId) return;

        const requestRef = doc(firestore, 'leaveRequests', requestId);
        const employeeRef = doc(firestore, 'employees', employeeId);

        try {
            const batch = writeBatch(firestore);

            const updateData: DocumentData = {
                status: newStatus,
                approvedAt: serverTimestamp(),
            };
            
            if (newStatus === 'rejected') {
                updateData.rejectionReason = rejectionReason || 'لم يتم تحديد سبب.';
            }

            batch.update(requestRef, updateData);

            if (newStatus === 'approved') {
                batch.update(employeeRef, { status: 'on-leave' });
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
    
    const handleRejectClick = (request: LeaveRequest) => {
        setRequestToReject(request);
        setRejectionReason('');
        setIsRejectConfirmOpen(true);
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
                actualReturnDate: toFirestoreDate(actualReturnDate),
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

    const handleConfirmReject = async () => {
        if (!requestToReject) return;
        setIsProcessingReject(true);
        await handleStatusUpdate(requestToReject.id, 'rejected', requestToReject.employeeId, rejectionReason);
        setIsProcessingReject(false);
        setIsRejectConfirmOpen(false);
        setRequestToReject(null);
    };


    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingRequest(null);
    };


  const formatDateDisplay = (date: any) => {
    const d = toFirestoreDate(date);
    if (!d) return '-';
    return format(d, 'dd/MM/yyyy');
  }

  const isLoading = loading || dataLoading;

  return (
    <div className='space-y-6'>
        <Button variant="outline" onClick={() => router.push('/dashboard/hr')}>
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى الموارد البشرية
        </Button>
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
                            {isLoading && Array.from({ length: 3 }).map((_, i) => (
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
                            {!isLoading && requests.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        لا توجد طلبات إجازة حالياً.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoading && requests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className='font-medium'>{employeesMap.get(req.employeeId) || req.employeeName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={typeColors[req.leaveType]}>
                                            {typeTranslations[req.leaveType]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDateDisplay(req.startDate)}</TableCell>
                                    <TableCell>{formatDateDisplay(req.endDate)}</TableCell>
                                    <TableCell className='font-medium'>
                                        {req.workingDays !== undefined ? `${req.workingDays} أيام عمل` : `${req.days} أيام`}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className={statusColors[req.status]}>
                                                {statusTranslations[req.status]}
                                            </Badge>
                                            {req.status === 'rejected' && req.rejectionReason && (
                                                <p className='text-xs text-muted-foreground truncate' title={req.rejectionReason}>
                                                    السبب: {req.rejectionReason}
                                                </p>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className='text-center'>
                                        {filter === 'pending' && (
                                            <div className='flex gap-2 justify-center'>
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-blue-600 border-blue-600 hover:bg-blue-50 hover:text-blue-700" onClick={() => handleEditRequestClick(req)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleStatusUpdate(req.id, 'approved', req.employeeId)}>
                                                    <Check className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleRejectClick(req)}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {filter === 'approved' && (
                                            <>
                                                {req.isBackFromLeave ? (
                                                    <div className='flex items-center justify-center gap-2 text-green-600'>
                                                        <CheckCircle className="h-4 w-4" />
                                                        <span className='text-xs'>عاد في: {formatDateDisplay(req.actualReturnDate)}</span>
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
                            الرجاء تحديد تاريخ العودة الفعلي للموظف "{employeesMap.get(requestToReturn?.employeeId || '') || requestToReturn?.employeeName}". سيتم تحديث حالة الموظف إلى "نشط".
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

            <AlertDialog open={isRejectConfirmOpen} onOpenChange={setIsRejectConfirmOpen}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>رفض طلب الإجازة</AlertDialogTitle>
                        <AlertDialogDescription>
                            الرجاء كتابة سبب رفض طلب الإجازة للموظف "{employeesMap.get(requestToReject?.employeeId || '') || requestToReject?.employeeName}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label htmlFor="rejectionReason">سبب الرفض</Label>
                        <Textarea
                            id="rejectionReason"
                            placeholder="مثال: ضغط العمل في هذه الفترة، عدم وجود بديل..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isProcessingReject}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmReject} disabled={isProcessingReject || !rejectionReason} className="bg-destructive hover:bg-destructive/90">
                            {isProcessingReject ? 'جاري الرفض...' : 'تأكيد الرفض'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
    </div>
  );
}

    