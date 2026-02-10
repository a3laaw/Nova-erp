'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Employee, LeaveRequest } from '@/lib/types';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, AlertCircle, CalendarClock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';


// ADDED: مكون لتقرير رصيد الإجازات
function LeaveBalanceReport() {
    const { firestore } = useFirebase();
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const [balanceFilter, setBalanceFilter] = useState('all');

    const employeeLeaveBalances = useMemo(() => {
        if (!employees) return [];
        return employees.map(emp => ({
            ...emp,
            leaveBalance: calculateAnnualLeaveBalance(emp, new Date()),
        })).sort((a,b) => a.leaveBalance - b.leaveBalance);
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        if (balanceFilter === 'all') return employeeLeaveBalances;
        const limit = parseInt(balanceFilter, 10);
        return employeeLeaveBalances.filter(emp => emp.leaveBalance < limit);
    }, [employeeLeaveBalances, balanceFilter]);

    const handlePrint = () => {
        const element = document.getElementById('leave-balance-printable-area');
        if (!element) return;
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            html2pdf().from(element).set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `leave_balance_report_${format(new Date(), "yyyy-MM-dd")}.pdf`,
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            }).save();
        });
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>أرصدة إجازات الموظفين</CardTitle>
                    <CardDescription>عرض تفصيلي لأرصدة الإجازات السنوية لجميع الموظفين النشطين.</CardDescription>
                </div>
                <div className='flex items-center gap-4'>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="balance-filter">عرض الموظفين برصيد أقل من</Label>
                        <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                            <SelectTrigger id="balance-filter" className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="10">10 أيام</SelectItem>
                                <SelectItem value="5">5 أيام</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
            </CardHeader>
            <CardContent id="leave-balance-printable-area">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>الرقم الوظيفي</TableHead>
                            <TableHead>القسم</TableHead>
                            <TableHead className="text-center">رصيد مرحل</TableHead>
                            <TableHead className="text-center">مكتسب</TableHead>
                            <TableHead className="text-center">مستخدم</TableHead>
                            <TableHead className="text-center font-bold">الرصيد المتبقي</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 4}).map((_, i) => (
                             <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                        {!loading && filteredEmployees.map(emp => (
                            <TableRow key={emp.id} className={emp.leaveBalance < 5 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                <TableCell className="font-medium">{emp.fullName}</TableCell>
                                <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                                <TableCell>{emp.department}</TableCell>
                                <TableCell className="text-center">{emp.carriedLeaveDays || 0}</TableCell>
                                <TableCell className="text-center">{emp.annualLeaveAccrued || 0}</TableCell>
                                <TableCell className="text-center">{emp.annualLeaveUsed || 0}</TableCell>
                                <TableCell className="text-center font-bold">
                                    <div className='flex justify-center items-center gap-2'>
                                      {emp.leaveBalance}
                                      {emp.leaveBalance < 5 && <Badge variant="destructive">منخفض</Badge>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

// ADDED: مكون لتقرير الإجازات الجارية
function OngoingLeavesReport() {
    const { firestore } = useFirebase();
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const leavesQuery = useMemo(() => [
        where('status', '==', 'approved'),
        where('endDate', '>=', todayStart),
    ], [todayStart]);
    
    const { data: approvedLeaves, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', leavesQuery);
    
    const ongoingLeaves = useMemo(() => {
        if (!approvedLeaves) return [];
        return approvedLeaves.filter(leave => {
            const startDate = toFirestoreDate(leave.startDate);
            return startDate && startDate <= todayEnd;
        })
    }, [approvedLeaves, todayEnd]);

    const handlePrint = () => {
        const element = document.getElementById('ongoing-leaves-printable-area');
        if (!element) return;
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            html2pdf().from(element).set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `ongoing_leaves_report_${format(new Date(), "yyyy-MM-dd")}.pdf`,
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            }).save();
        });
    };

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        return date ? format(date, 'dd/MM/yyyy') : '-';
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>الموظفون في إجازة حاليًا</CardTitle>
                    <CardDescription>قائمة بالموظفين الذين في إجازة معتمدة اليوم.</CardDescription>
                </div>
                 <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
            </CardHeader>
            <CardContent id="ongoing-leaves-printable-area">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>نوع الإجازة</TableHead>
                            <TableHead>من تاريخ</TableHead>
                            <TableHead>إلى تاريخ</TableHead>
                            <TableHead>عدد الأيام</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 2}).map((_, i) => (
                             <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && ongoingLeaves.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">لا يوجد موظفون في إجازة اليوم.</TableCell></TableRow>}
                        {!loading && ongoingLeaves.map(leave => (
                            <TableRow key={leave.id}>
                                <TableCell className="font-medium">{leave.employeeName}</TableCell>
                                <TableCell>{leave.leaveType}</TableCell>
                                <TableCell>{formatDate(leave.startDate)}</TableCell>
                                <TableCell>{formatDate(leave.endDate)}</TableCell>
                                <TableCell>{leave.days}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

// ADDED: صفحة تقارير HR مع تبويبين: رصيد الإجازات والإجازات الجارية
export default function HrReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير الموارد البشرية</CardTitle>
                <CardDescription>عرض تحليلات وتقارير خاصة بالموظفين والإجازات.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="leave-balance" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="leave-balance">أرصدة الإجازات</TabsTrigger>
                        <TabsTrigger value="ongoing-leaves">الإجازات الجارية</TabsTrigger>
                    </TabsList>
                    <TabsContent value="leave-balance" className="mt-4">
                        <LeaveBalanceReport />
                    </TabsContent>
                    <TabsContent value="ongoing-leaves" className="mt-4">
                        <OngoingLeavesReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
