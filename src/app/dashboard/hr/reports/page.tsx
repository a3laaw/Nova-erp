'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Employee, LeaveRequest, MonthlyAttendance } from '@/lib/types';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import { format, isPast, getDaysInMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, AlertCircle, CalendarClock, Users, Percent, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

// --- LeaveBalanceReport Component (Existing) ---
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
            <CardHeader className="flex-row items-center justify-between no-print">
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
                 <div className="print:block hidden mb-4">
                    <h2 className="text-xl font-bold">تقرير أرصدة إجازات الموظفين</h2>
                    <p className="text-sm text-muted-foreground">تاريخ التقرير: {format(new Date(), "dd/MM/yyyy")}</p>
                </div>
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

// OngoingLeavesReport Component (Existing)
function OngoingLeavesReport() {
    const { firestore } = useFirebase();
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const leavesQuery = useMemo(() => [
        where('endDate', '>=', todayStart),
    ], [todayStart]);
    
    const { data: futureLeaves, loading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests', leavesQuery);
    
    const ongoingLeaves = useMemo(() => {
        if (!futureLeaves) return [];
        return futureLeaves.filter(leave => {
            const startDate = toFirestoreDate(leave.startDate);
            return leave.status === 'approved' && startDate && startDate <= todayEnd;
        })
    }, [futureLeaves, todayEnd]);


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
            <CardHeader className="flex-row items-center justify-between no-print">
                <div>
                    <CardTitle>الموظفون في إجازة حاليًا</CardTitle>
                    <CardDescription>قائمة بالموظفين الذين في إجازة معتمدة اليوم.</CardDescription>
                </div>
                 <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
            </CardHeader>
            <CardContent id="ongoing-leaves-printable-area">
                <div className="print:block hidden mb-4">
                    <h2 className="text-xl font-bold">تقرير الموظفين في إجازة</h2>
                    <p className="text-sm text-muted-foreground">تاريخ التقرير: {format(new Date(), "dd/MM/yyyy")}</p>
                </div>
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

// ADDED: تبويب الحضور والغياب الشهري مع فلتر الشهر وإجماليات
function MonthlyAttendanceReport() {
    const { firestore } = useFirebase();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    
    const attendanceQuery = useMemo(() => {
        return [
            where('year', '==', parseInt(year)),
            where('month', '==', parseInt(month))
        ];
    }, [year, month]);

    const { data: attendanceData, loading: loadingAttendance } = useSubscription<MonthlyAttendance>(firestore, 'attendance', attendanceQuery);
    const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);

    const loading = loadingAttendance || loadingEmployees;
    
    const reportData = useMemo(() => {
        if (!attendanceData || !employees) return [];
        const daysInSelectedMonth = getDaysInMonth(new Date(parseInt(year), parseInt(month) - 1));

        return employees.map(emp => {
            const attendance = attendanceData.find(a => a.employeeId === emp.id);
            const present = attendance?.summary?.presentDays || 0;
            const absent = attendance?.summary?.absentDays || 0;
            const late = attendance?.summary?.lateDays || 0;
            const attendancePercentage = attendance ? (present / (attendance.summary.totalDays || daysInSelectedMonth)) * 100 : 0;
            
            return {
                id: emp.id,
                name: emp.fullName,
                employeeNumber: emp.employeeNumber,
                presentDays: present,
                absentDays: absent,
                lateDays: late,
                attendancePercentage: isNaN(attendancePercentage) ? 0 : attendancePercentage,
            }
        }).sort((a,b) => a.name.localeCompare(b.name, 'ar'));
    }, [attendanceData, employees, year, month]);

    const totals = useMemo(() => {
        if (!reportData || reportData.length === 0) return { totalPresent: 0, totalAbsent: 0, totalLate: 0, overallAttendance: 0 };
        const totalPresent = reportData.reduce((sum, item) => sum + item.presentDays, 0);
        const totalAbsent = reportData.reduce((sum, item) => sum + item.absentDays, 0);
        const totalLate = reportData.reduce((sum, item) => sum + item.lateDays, 0);
        const daysInSelectedMonth = getDaysInMonth(new Date(parseInt(year), parseInt(month) - 1));
        const totalPossibleDays = reportData.length * daysInSelectedMonth;
        const overallAttendance = totalPossibleDays > 0 ? (totalPresent / totalPossibleDays) * 100 : 0;

        return { totalPresent, totalAbsent, totalLate, overallAttendance };
    }, [reportData, year, month]);
    
    const handlePrint = () => {
        const element = document.getElementById('attendance-printable-area');
        if (!element) return;
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            html2pdf().from(element).set({
                margin: [0.5, 0.5, 0.5, 0.5],
                filename: `attendance_report_${year}-${month}.pdf`,
                jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
            }).save();
        });
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card id="attendance-printable-area">
            <CardHeader className="flex-row items-center justify-between no-print">
                <div>
                    <CardTitle>الحضور والغياب الشهري</CardTitle>
                    <CardDescription>عرض ملخص لحضور الموظفين خلال الشهر المحدد.</CardDescription>
                </div>
                <div className='flex items-center gap-4'>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="attendance-year-select">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger id="attendance-year-select" className="w-[120px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="flex items-center gap-2">
                        <Label htmlFor="attendance-month-select">الشهر</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger id="attendance-month-select" className="w-[120px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="print:block hidden mb-4">
                    <h2 className="text-xl font-bold">تقرير الحضور والغياب</h2>
                    <p className="text-sm text-muted-foreground">عن شهر {month} / {year}</p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>الرقم الوظيفي</TableHead>
                            <TableHead className="text-center">أيام الحضور</TableHead>
                            <TableHead className="text-center">أيام الغياب</TableHead>
                            <TableHead className="text-center">عدد التأخيرات</TableHead>
                            <TableHead className="text-center w-[150px]">نسبة الحضور</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 4}).map((_, i) => (
                             <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد سجلات حضور للشهر المحدد.</TableCell></TableRow>}
                        {!loading && reportData.map(item => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="font-mono">{item.employeeNumber}</TableCell>
                                <TableCell className="text-center text-green-600 font-medium">{item.presentDays}</TableCell>
                                <TableCell className="text-center text-red-600">{item.absentDays}</TableCell>
                                <TableCell className="text-center text-orange-600">{item.lateDays}</TableCell>
                                <TableCell className="text-center font-mono">
                                    <div className="flex items-center justify-center gap-2">
                                        <Progress value={item.attendancePercentage} className="w-20 h-2" />
                                        <span>{item.attendancePercentage.toFixed(1)}%</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    {!loading && reportData.length > 0 && (
                        <TableFooter>
                            <TableRow className="font-bold bg-muted">
                                <TableCell colSpan={2}>الإجمالي / المتوسط</TableCell>
                                <TableCell className="text-center">{totals.totalPresent}</TableCell>
                                <TableCell className="text-center">{totals.totalAbsent}</TableCell>
                                <TableCell className="text-center">{totals.totalLate}</TableCell>
                                <TableCell className="text-center">{totals.overallAttendance.toFixed(1)}%</TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </CardContent>
        </Card>
    );
}

// Main Page Component
export default function HrReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير الموارد البشرية</CardTitle>
                <CardDescription>عرض تحليلات وتقارير خاصة بالموظفين والإجازات.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="leave-balance" dir="rtl">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="leave-balance">أرصدة الإجازات</TabsTrigger>
                        <TabsTrigger value="ongoing-leaves">الإجازات الجارية</TabsTrigger>
                        <TabsTrigger value="monthly-attendance">الحضور والغياب الشهري</TabsTrigger>
                    </TabsList>
                    <TabsContent value="leave-balance" className="mt-4">
                        <LeaveBalanceReport />
                    </TabsContent>
                    <TabsContent value="ongoing-leaves" className="mt-4">
                        <OngoingLeavesReport />
                    </TabsContent>
                    <TabsContent value="monthly-attendance" className="mt-4">
                        <MonthlyAttendanceReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
