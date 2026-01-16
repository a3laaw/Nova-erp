
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, Timestamp, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Printer, Search, ArrowRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toFirestoreDate, fromFirestoreDate } from '@/services/date-converter';

// Represents a leave request augmented with the current employee name
interface AugmentedLeaveRequest extends LeaveRequest {
  currentEmployeeName: string;
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

// Safe date conversion utility, specific for display purposes
const formatDateForDisplay = (dateValue: any): string => {
    const dateString = fromFirestoreDate(dateValue);
    if (!dateString) return '-';
    try {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString;
    }
}


export default function LeaveReportsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isFetching, setIsFetching] = useState(true);
    const [allRequests, setAllRequests] = useState<AugmentedLeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    
    const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState<'all' | LeaveRequest['status']>('all');
    const [employeeFilter, setEmployeeFilter] = useState<'all' | string>('all');

    // Fetch all data once on component mount
    useEffect(() => {
        if (!firestore) return;

        const fetchAllData = async () => {
            setIsFetching(true);
            try {
                // 1. Fetch employees first and create a Map for quick lookup
                const employeesSnapshot = await getDocs(query(collection(firestore, 'employees')));
                const employeesData = employeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                employeesData.sort((a,b) => a.fullName.localeCompare(b.fullName));
                setEmployees(employeesData);
                const employeeMap = new Map(employeesData.map(emp => [emp.id, emp.fullName]));

                // 2. Fetch all leave requests
                const requestsQuery = query(collection(firestore, 'leaveRequests'));
                const requestsSnapshot = await getDocs(requestsQuery);

                // 3. Augment requests with the most current employee name
                const requestsData = requestsSnapshot.docs.map(doc => {
                    const req = { id: doc.id, ...doc.data() } as LeaveRequest;
                    return {
                        ...req,
                        // Use the up-to-date name from the map, or fallback to the stored name
                        currentEmployeeName: employeeMap.get(req.employeeId) || req.employeeName,
                    };
                });
                
                setAllRequests(requestsData);

            } catch (error) {
                 console.error("Error fetching initial data: ", error);
                 toast({ variant: 'destructive', title: 'خطأ في الاستعلام', description: 'فشل في جلب البيانات الأولية من قاعدة البيانات.' });
            } finally {
                setIsFetching(false);
            }
        };
        
        fetchAllData();
    }, [firestore, toast]);

    const reportData = useMemo(() => {
        if (isFetching) return [];

        let reportStart: Date, reportEnd: Date;
        try {
            reportStart = parseISO(dateFrom);
            reportStart.setHours(0, 0, 0, 0);

            reportEnd = parseISO(dateTo);
            reportEnd.setHours(23, 59, 59, 999);
            if (reportStart > reportEnd) return [];
        } catch (e) {
            return [];
        }
        
        const filteredData = allRequests.filter(req => {
            // Use the safe converter for all date operations
            const leaveStart = toFirestoreDate(req.startDate);
            const leaveEnd = toFirestoreDate(req.endDate);

            if (!leaveStart || !leaveEnd) return false;
            
            // Check for date range overlap
            const overlaps = (leaveStart <= reportEnd) && (leaveEnd >= reportStart);

            const isStatusMatch = statusFilter === 'all' || req.status === statusFilter;
            const isEmployeeMatch = employeeFilter === 'all' || req.employeeId === employeeFilter;

            return overlaps && isStatusMatch && isEmployeeMatch;
        });

        // Client-side sorting
        filteredData.sort((a, b) => {
            const dateA = toFirestoreDate(a.startDate);
            const dateB = toFirestoreDate(b.startDate);
            if (!dateA || !dateB) return 0;
            return dateB.getTime() - dateA.getTime();
        });

        return filteredData;
    }, [allRequests, dateFrom, dateTo, statusFilter, employeeFilter, isFetching]);
    
    const totalDays = useMemo(() => {
        return reportData.reduce((acc, req) => acc + (req.workingDays || req.days || 0), 0);
    }, [reportData]);
    
    const handlePrint = () => {
        window.print();
    };

  return (
    <div className='space-y-6'>
         <Button variant="outline" onClick={() => router.push('/dashboard/hr')} className="print:hidden">
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى الموارد البشرية
        </Button>
        <Card dir="rtl" className="print:shadow-none print:border-none">
            <CardHeader className="print:hidden">
                <CardTitle>تقارير الإجازات</CardTitle>
                <CardDescription>
                    توليد تقارير مفصلة عن إجازات الموظفين حسب فترة زمنية وحالة الطلب.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="bg-muted/50 p-4 rounded-lg mb-6 print:hidden">
                    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end'>
                        <div className="grid gap-2">
                            <Label htmlFor="dateFrom">من تاريخ</Label>
                            <Input 
                                id="dateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="dateTo">إلى تاريخ</Label>
                            <Input 
                                id="dateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="employeeFilter">الموظف</Label>
                             <Select dir="rtl" value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v as any)}>
                                <SelectTrigger id="employeeFilter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الموظفين</SelectItem>
                                    {employees.map(emp => (
                                        <SelectItem key={emp.id} value={emp.id!}>{emp.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="statusFilter">حالة الطلب</Label>
                             <Select dir="rtl" value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                                <SelectTrigger id="statusFilter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">الكل</SelectItem>
                                    <SelectItem value="pending">معلقة</SelectItem>
                                    <SelectItem value="approved">مقبولة</SelectItem>
                                    <SelectItem value="rejected">مرفوضة</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={() => {
                            if (reportData.length === 0 && !isFetching) {
                                toast({ title: 'لا توجد نتائج', description: 'لم يتم العثور على طلبات إجازة تطابق معايير البحث.' });
                            }
                        }} disabled={isFetching} className="col-span-2 lg:col-span-1">
                            {isFetching ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                            {isFetching ? 'جاري التحميل...' : 'تحديث العرض'}
                        </Button>
                    </div>
                </div>

                {/* Report Display */}
                 <div className="border rounded-lg">
                    <div className='p-4 flex justify-between items-center'>
                        <div>
                            <h3 className='font-bold'>تقرير الإجازات</h3>
                            {dateFrom && dateTo && (
                                 <p className='text-sm text-muted-foreground' dir='ltr'>
                                    For period from {format(new Date(dateFrom), "dd/MM/yyyy")} to {format(new Date(dateTo), "dd/MM/yyyy")}
                                </p>
                            )}
                           
                        </div>
                        <Button variant="outline" onClick={handlePrint} className="print:hidden">
                            <Printer className="ml-2 h-4 w-4" />
                            طباعة
                        </Button>
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الموظف</TableHead>
                                <TableHead>نوع الإجازة</TableHead>
                                <TableHead>من تاريخ</TableHead>
                                <TableHead>إلى تاريخ</TableHead>
                                <TableHead>الأيام (عمل)</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isFetching && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))}
                            {!isFetching && reportData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        لا توجد بيانات تطابق الفلاتر المحددة.
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isFetching && reportData.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className='font-medium'>{req.currentEmployeeName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={typeColors[req.leaveType]}>
                                            {typeTranslations[req.leaveType]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{formatDateForDisplay(req.startDate)}</TableCell>
                                    <TableCell>{formatDateForDisplay(req.endDate)}</TableCell>
                                    <TableCell>{req.workingDays ?? req.days}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={statusColors[req.status]}>
                                            {statusTranslations[req.status]}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5} className="font-bold">الإجمالي</TableCell>
                                <TableCell className="font-bold">{totalDays} يوم عمل</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    