
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check, PlusCircle, X, Pencil, LogIn, CheckCircle, MoreHorizontal, Trash2, Loader2, Printer, PlayCircle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/hr/leave-request-form';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, doc, updateDoc, writeBatch, serverTimestamp, type DocumentData, orderBy, getDocs, getDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { toFirestoreDate, fromFirestoreDate } from '@/services/date-converter';
import { format, isPast } from 'date-fns';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';


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
    const { firestore } = useFirebase();
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
    
    const [requestToDelete, setRequestToDelete] = useState<LeaveRequest | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    const [hasCheckedLeaves, setHasCheckedLeaves] = useState(false);
    const [employeesMap, setEmployeesMap] = useState<Map<string, Employee>>(new Map());
    const [dataLoading, setDataLoading] = useState(true);

    useEffect(() => {
        if (isReturnConfirmOpen) {
            setActualReturnDate(new Date().toISOString().split('T')[0]);
        }
    }, [isReturnConfirmOpen]);
    
    // Effect to automatically set employee status to 'on-leave' when leave starts
    useEffect(() => {
        if (!firestore || hasCheckedLeaves || dataLoading) return;
    
        const autoStartLeaves = async () => {
            try {
                // Fetch all approved leaves. This is a simple query that needs no special index.
                const q = query(
                    collection(firestore, 'leaveRequests'),
                    where('status', '==', 'approved')
                );
                
                const snapshot = await getDocs(q);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
    
                // Filter client-side for leaves that have started but employee hasn't returned
                const activeLeaveDocs = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    const startDate = data.startDate?.toDate ? data.startDate.toDate() : null;
                    return data.isBackFromLeave !== true && startDate && startDate <= today;
                });
    
                if (activeLeaveDocs.length === 0) {
                    setHasCheckedLeaves(true);
                    return;
                }
    
                const employeeIdsToPotentiallyUpdate = activeLeaveDocs.map(doc => doc.data().employeeId);
                const uniqueEmployeeIds = [...new Set(employeeIdsToPotentiallyUpdate)];
                
                if (uniqueEmployeeIds.length === 0) {
                    setHasCheckedLeaves(true);
                    return;
                }
    
                const employeesRef = collection(firestore, 'employees');
                const employeesQuery = query(employeesRef, where('__name__', 'in', uniqueEmployeeIds), where('status', '==', 'active'));
                const activeEmployeesToUpdateSnap = await getDocs(employeesQuery);
    
                if (activeEmployeesToUpdateSnap.empty) {
                    setHasCheckedLeaves(true);
                    return;
                }
    
                const batch = writeBatch(firestore);
                activeEmployeesToUpdateSnap.forEach(employeeDoc => {
                    batch.update(doc(firestore, 'employees', employeeDoc.id), { status: 'on-leave' });
                });
    
                await batch.commit();
    
                toast({
                    title: 'تحديث تلقائي',
                    description: `تم تحديث حالة ${activeEmployeesToUpdateSnap.size} موظف إلى "في إجازة" تلقائيًا.`
                });
    
            } catch (error) {
                console.error("Failed to auto-start leaves:", error);
            } finally {
                setHasCheckedLeaves(true); // Mark as checked even if it fails to prevent loops
            }
        };
    
        autoStartLeaves();
    }, [firestore, hasCheckedLeaves, dataLoading, toast]);

    useEffect(() => {
        if (!firestore) return;

        const fetchAllEmployees = async () => {
            setDataLoading(true);
            try {
                const employeesSnapshot = await getDocs(collection(firestore, 'employees'));
                const newEmployeesMap = new Map<string, Employee>();
                employeesSnapshot.forEach(doc => {
                    const emp = { id: doc.id, ...doc.data() } as Employee;
                    newEmployeesMap.set(doc.id, emp);
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


    const requestsQueryConstraints = useMemo(() => {
        return [where('status', '==', filter)];
    }, [filter]);

    const { data: requestsData, loading, error } = useSubscription<LeaveRequest>(
        firestore, 
        'leaveRequests', 
        requestsQueryConstraints
    );

    const requests = useMemo(() => {
        if (!requestsData) return [];
        const getSafeTimestamp = (date: any): number => {
            if (!date) return 0;
            if (typeof date.toMillis === 'function') return date.toMillis();
            const d = new Date(date);
            return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        const data = [...requestsData]; // Create a mutable copy
        data.sort((a, b) => {
            const timeB = getSafeTimestamp(b.createdAt);
            const timeA = getSafeTimestamp(a.createdAt);
            return timeB - timeA;
        });
        return data;
    }, [requestsData]);


    const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected', employeeId?: string, rejectionReason?: string) => {
        if (!firestore || !employeeId) return;

        const requestRef = doc(firestore, 'leaveRequests', requestId);

        try {
            const updateData: DocumentData = {
                status: newStatus,
                approvedAt: serverTimestamp(),
            };
            
            if (newStatus === 'rejected') {
                updateData.rejectionReason = rejectionReason || 'لم يتم تحديد سبب.';
            }

            await updateDoc(requestRef, updateData);
            
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
    
    const handleStartLeave = async (request: LeaveRequest) => {
        if (!firestore || !request.employeeId) return;

        setIsProcessingAction(true);
        const employeeRef = doc(firestore, 'employees', request.employeeId);

        try {
            await updateDoc(employeeRef, { status: 'on-leave' });
            toast({ title: 'نجاح', description: `تم تحديث حالة الموظف ${request.employeeName} إلى "في إجازة".` });
            
            // Optimistically update local state to reflect the change immediately
            setEmployeesMap(prev => {
                const newMap = new Map(prev);
                const emp = newMap.get(request.employeeId);
                if (emp) {
                    newMap.set(request.employeeId, { ...emp, status: 'on-leave' });
                }
                return newMap;
            });

        } catch (error) {
            console.error("Error starting leave:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة الموظف.' });
        } finally {
            setIsProcessingAction(false);
        }
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
            
            setEmployeesMap(prev => {
                const newMap = new Map(prev);
                const emp = newMap.get(requestToReturn.employeeId);
                if (emp) {
                    newMap.set(requestToReturn.employeeId, { ...emp, status: 'active' });
                }
                return newMap;
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

    const handleDeleteRequest = async () => {
        if (!requestToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            const batch = writeBatch(firestore);
            const requestRef = doc(firestore, 'leaveRequests', requestToDelete.id);
            
            batch.delete(requestRef);

            if (requestToDelete.status === 'approved') {
                const employeeRef = doc(firestore, 'employees', requestToDelete.employeeId);
                const employeeSnap = await getDoc(employeeRef);
                
                // If the employee is currently 'on-leave', deleting an approved leave
                // should revert their status to 'active'.
                if (employeeSnap.exists() && employeeSnap.data().status === 'on-leave') {
                    batch.update(employeeRef, { status: 'active' });
                }
            }
            
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم حذف طلب الإجازة بنجاح.' });
        } catch (err) {
            console.error("Error deleting leave request:", err);
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: 'فشل حذف طلب الإجازة.'
            });
        } finally {
            setIsDeleting(false);
            setRequestToDelete(null);
        }
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
        setEditingRequest(null);
    };


  const formatDateDisplay = (dateValue: any) => {
    const dateString = fromFirestoreDate(dateValue);
    if (!dateString) return '-';
    try {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
  }

  const isLoading = loading || dataLoading;

  return (
    <div className='space-y-6'>
        <Card dir="rtl">
            <CardHeader>
                <div className='flex justify-between items-center'>
                    <div>
                        <CardTitle>طلبات الإجازة</CardTitle>
                        <CardDescription>
                        إدارة طلبات الإجازات المقدمة من الموظفين.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleNewRequestClick}>
                            <PlusCircle className="ml-2 h-4 w-4" />
                            طلب إجازة جديد
                        </Button>
                    </div>
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
                            {!isLoading && requests.map(req => {
                                const employee = employeesMap.get(req.employeeId);
                                const leaveStartDate = toFirestoreDate(req.startDate);

                                return (
                                <TableRow key={req.id}>
                                    <TableCell className='font-medium'>{employee?.fullName || req.employeeName}</TableCell>
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
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isProcessingAction}><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/hr/leave-requests/${req.id}`}>
                                                        <Printer className="ml-2 h-4 w-4" /> عرض وطباعة
                                                    </Link>
                                                </DropdownMenuItem>
                                                
                                                {filter === 'pending' && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleEditRequestClick(req)}>
                                                            <Pencil className="ml-2 h-4 w-4" /> تعديل
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleStatusUpdate(req.id, 'approved', req.employeeId)} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                                            <Check className="ml-2 h-4 w-4" /> قبول
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRejectClick(req)} className="text-destructive focus:text-destructive">
                                                            <X className="ml-2 h-4 w-4" /> رفض
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {filter === 'approved' && (
                                                    <>
                                                        <DropdownMenuItem onClick={() => handleEditRequestClick(req)}>
                                                            <Pencil className="ml-2 h-4 w-4" /> تعديل
                                                        </DropdownMenuItem>
                                                        {!req.isBackFromLeave && employee?.status !== 'on-leave' && (
                                                          <DropdownMenuItem onClick={() => handleStartLeave(req)} disabled={isProcessingAction}>
                                                              <PlayCircle className="ml-2 h-4 w-4" /> بدء الإجازة
                                                          </DropdownMenuItem>
                                                        )}
                                                        {!req.isBackFromLeave && employee?.status === 'on-leave' && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!(leaveStartDate && isPast(leaveStartDate))} onClick={() => handleReturnClick(req)}>
                                                                            <LogIn className="ml-2 h-4 w-4" /> تسجيل العودة
                                                                        </DropdownMenuItem>
                                                                    </TooltipTrigger>
                                                                    {!(leaveStartDate && isPast(leaveStartDate)) && <TooltipContent><p>لا يمكن تسجيل العودة قبل بدء الإجازة</p></TooltipContent>}
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setRequestToDelete(req)} className="text-destructive focus:text-destructive">
                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})}
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
                            الرجاء تحديد تاريخ العودة الفعلي للموظف "{employeesMap.get(requestToReturn?.employeeId || '')?.fullName || requestToReturn?.employeeName}". سيتم تحديث حالة الموظف إلى "نشط".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-2 py-4">
                        <Label htmlFor="actualReturnDate">تاريخ العودة الفعلي</Label>
                        <DateInput
                            value={actualReturnDate}
                            onChange={(v) => setActualReturnDate(v)}
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
                            الرجاء كتابة سبب رفض طلب الإجازة للموظف "{employeesMap.get(requestToReject?.employeeId || '')?.fullName || requestToReject?.employeeName}".
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
            
            <AlertDialog open={!!requestToDelete} onOpenChange={() => setRequestToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من رغبتك في حذف طلب الإجازة هذا؟ سيتم التراجع عن أي تأثير له على رصيد الموظف. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRequest} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
    </div>
  );
}
    

    