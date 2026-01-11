
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, PlusCircle, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LeaveRequestForm } from '@/components/hr/leave-request-form';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


interface LeaveRequest extends DocumentData {
    id: string;
    employeeName: string;
    leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
    startDate: string;
    endDate: string;
    days: number;
    workingDays?: number;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: { seconds: number, nanoseconds: number };
}


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
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

    const requestsQuery = useMemo(() => {
        if (!firestore) return null;
        // Removed orderBy to avoid composite index requirement. Sorting will be done on the client.
        return query(
            collection(firestore, 'leaveRequests'), 
            where('status', '==', filter)
        );
    }, [firestore, filter]);

    const [snapshot, loading, error] = useCollection(requestsQuery);

    const requests = useMemo(() => {
        if (!snapshot) return [];
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
        // Sort client-side
        reqs.sort((a, b) => {
            const dateA = a.createdAt?.seconds ?? 0;
            const dateB = b.createdAt?.seconds ?? 0;
            return dateB - dateA; // Sort descending
        });
        return reqs;
    }, [snapshot]);


    const handleStatusUpdate = async (requestId: string, newStatus: 'approved' | 'rejected') => {
        if (!firestore) return;
        const requestRef = doc(firestore, 'leaveRequests', requestId);
        try {
            await updateDoc(requestRef, {
                status: newStatus,
                approvedAt: serverTimestamp(),
                // approvedBy: currentUser?.uid // In a real app with auth context
            });
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


  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('ar-KW', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);
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
                <Button onClick={() => setIsFormOpen(true)}>
                    <PlusCircle className="ml-2 h-4 w-4" />
                    طلب إجازة جديد
                </Button>
            </div>
        </CardHeader>
        <CardContent>
             <div className="flex gap-2 mb-4">
                <Button variant={filter === 'pending' ? 'default' : 'outline'} onClick={() => setFilter('pending')}>
                    طلبات معلقة
                </Button>
                <Button variant={filter === 'approved' ? 'default' : 'outline'} onClick={() => setFilter('approved')} className='bg-green-600 hover:bg-green-700 text-white'>
                    طلبات مقبولة
                </Button>
                <Button variant={filter === 'rejected' ? 'default' : 'outline'} onClick={() => setFilter('rejected')} className='bg-red-600 hover:bg-red-700 text-white'>
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
                            {filter === 'pending' && <TableHead>الإجراءات</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {loading && Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={`skel-${i}`}>
                                <TableCell colSpan={filter === 'pending' ? 7 : 6}><Skeleton className="h-8 w-full" /></TableCell>
                            </TableRow>
                        ))}
                        {error && (
                            <TableRow>
                                <TableCell colSpan={filter === 'pending' ? 7 : 6} className="h-24 text-center text-destructive">
                                    حدث خطأ أثناء جلب البيانات.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={filter === 'pending' ? 7 : 6} className="h-24 text-center">
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
                                {filter === 'pending' && (
                                    <TableCell>
                                        <div className='flex gap-2'>
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700" onClick={() => handleStatusUpdate(req.id, 'approved')}>
                                                <Check className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleStatusUpdate(req.id, 'rejected')}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
      <LeaveRequestForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
      />
    </>
  );
}
