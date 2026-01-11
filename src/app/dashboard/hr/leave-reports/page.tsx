
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
import { collection, query, where, getDocs, Timestamp, type DocumentData } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { LeaveRequest } from '@/lib/types';
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
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useRouter } from 'next/navigation';

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


export default function LeaveReportsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    
    const [dateFrom, setDateFrom] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [dateTo, setDateTo] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [statusFilter, setStatusFilter] = useState<'all' | LeaveRequest['status']>('all');

    const [reportData, setReportData] = useState<LeaveRequest[]>([]);

    const handleGenerateReport = async () => {
        if (!firestore || !dateFrom || !dateTo) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد تاريخ البدء والنهاية.' });
            return;
        }

        setLoading(true);
        setReportData([]);

        try {
            const startDate = new Date(dateFrom);
            startDate.setHours(0, 0, 0, 0); // Set to start of the day
            
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999); // Set to end of the day

            const constraints = [
                where('startDate', '>=', Timestamp.fromDate(startDate)),
                where('startDate', '<=', Timestamp.fromDate(endDate)),
            ];

            if (statusFilter !== 'all') {
                constraints.push(where('status', '==', statusFilter));
            }
            
            const q = query(
                collection(firestore, 'leaveRequests'), 
                ...constraints
            );
            
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
            
            // Sort client-side to avoid needing another composite index
            data.sort((a, b) => {
                const dateA = a.startDate ? (typeof a.startDate === 'string' ? new Date(a.startDate) : (a.startDate as any).toDate()) : new Date(0);
                const dateB = b.startDate ? (typeof b.startDate === 'string' ? new Date(b.startDate) : (b.startDate as any).toDate()) : new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            setReportData(data);

            if (data.length === 0) {
                 toast({ title: 'لا توجد نتائج', description: 'لم يتم العثور على طلبات إجازة تطابق معايير البحث.' });
            }

        } catch (error) {
            console.error("Error generating report: ", error);
            toast({ variant: 'destructive', title: 'خطأ في الاستعلام', description: 'فشل في جلب البيانات. قد تحتاج إلى إنشاء فهرس مركب في Firestore. راجع الكونسول لمزيد من التفاصيل.' });
        } finally {
            setLoading(false);
        }
    }
    
    const totalDays = useMemo(() => {
        return reportData.reduce((acc, req) => acc + (req.workingDays || req.days || 0), 0);
    }, [reportData]);

    const formatDateForDisplay = (date: any) => {
        if (!date) return '-';
        try {
            const d = typeof date === 'string' ? new Date(date) : date.toDate();
            if (isNaN(d.getTime())) return '-';
            return new Intl.DateTimeFormat('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
        } catch (e) { return '-'; }
    }
    
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
                        <div className="grid gap-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="dateFrom">من تاريخ</Label>
                            <Input 
                                id="dateFrom"
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                         <div className="grid gap-2 col-span-2 sm:col-span-1">
                            <Label htmlFor="dateTo">إلى تاريخ</Label>
                            <Input 
                                id="dateTo"
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2 col-span-2 sm:col-span-1">
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
                        <Button onClick={handleGenerateReport} disabled={loading} className="col-span-2 lg:col-span-1">
                            {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Search className="ml-2 h-4 w-4" />}
                            {loading ? 'جاري البحث...' : 'توليد التقرير'}
                        </Button>
                    </div>
                </div>

                {/* Report Display */}
                 <div className="border rounded-lg">
                    <div className='p-4 flex justify-between items-center'>
                        <div>
                            <h3 className='font-bold'>تقرير الإجازات</h3>
                            {dateFrom && dateTo && (
                                 <p className='text-sm text-muted-foreground'>
                                    للفترة من {format(new Date(dateFrom), "dd/MM/yyyy")} إلى {format(new Date(dateTo), "dd/MM/yyyy")}
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
                             {loading && Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={`skel-${i}`}>
                                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                                </TableRow>
                            ))}
                            {!loading && reportData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        {reportData.length === 0 && !loading ? 'لا توجد بيانات لعرضها. الرجاء تحديد الفلاتر وتوليد التقرير.' : ''}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && reportData.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className='font-medium'>{req.employeeName}</TableCell>
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
