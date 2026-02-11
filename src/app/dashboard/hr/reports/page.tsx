'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Employee, MonthlyAttendance, LeaveRequest, Payslip, JournalEntry, Account } from '@/lib/types';
import { calculateAnnualLeaveBalance, calculateGratuity } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInYears, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Printer, UserCheck, UserX, CalendarIcon, Wallet, FileWarning, Search, Download, FileSpreadsheet, HandCoins } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import Link from 'next/link';

// --- Status Translations & Colors ---
const statusTranslations: Record<string, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
  draft: 'مسودة',
  processed: 'تمت المعالجة',
  paid: 'مدفوع',
};
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
  draft: 'bg-yellow-100 text-yellow-800',
  processed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
};
const contractTypeTranslations: Record<string, string> = {
    permanent: 'دائم',
    temporary: 'مؤقت',
    subcontractor: 'مقاول باطن',
    percentage: 'نسبة',
    'part-time': 'دوام جزئي',
    'piece-rate': 'بالقطعة',
    special: 'دوام خاص',
};

// --- GeneralEmployeeReport Component ---
function GeneralEmployeeReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees');

    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [contractTypeFilter, setContractTypeFilter] = useState('all');

    const { departmentOptions, contractTypeOptions } = useMemo(() => {
        if (!employees) return { departmentOptions: [], contractTypeOptions: [] };
        const depts = new Set(employees.map(e => e.department).filter(Boolean));
        const contracts = new Set(employees.map(e => e.contractType).filter(Boolean));
        return {
            departmentOptions: Array.from(depts),
            contractTypeOptions: Array.from(contracts),
        };
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        let filtered = employees || [];
        if (statusFilter !== 'all') filtered = filtered.filter(e => e.status === statusFilter);
        if (departmentFilter !== 'all') filtered = filtered.filter(e => e.department === departmentFilter);
        if (contractTypeFilter !== 'all') filtered = filtered.filter(e => e.contractType === contractTypeFilter);
        return filtered;
    }, [employees, statusFilter, departmentFilter, contractTypeFilter]);

    const formatDate = (date: any) => toFirestoreDate(date) ? format(toFirestoreDate(date)!, 'dd/MM/yyyy') : '-';

    const handlePrint = () => {
      toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                 <div>
                    <CardTitle>تقرير الموظفين العام</CardTitle>
                    <CardDescription>عرض بيانات الموظفين مع فلاتر متقدمة.</CardDescription>
                </div>
                 <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2">
                        <Label htmlFor="status-filter">الحالة</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger id="status-filter" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                {Object.entries(statusTranslations).filter(([k]) => ['active', 'on-leave', 'terminated'].includes(k)).map(([key, value]) => (
                                    <SelectItem key={key} value={key}>{value}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="department-filter">القسم</Label>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger id="department-filter" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                {departmentOptions.map(dept => <SelectItem key={dept} value={dept}>{dept}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="contract-type-filter">نوع العقد</Label>
                        <Select value={contractTypeFilter} onValueChange={setContractTypeFilter}>
                            <SelectTrigger id="contract-type-filter" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                {contractTypeOptions.map(type => <SelectItem key={type} value={type}>{contractTypeTranslations[type] || type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم الكامل</TableHead>
                                <TableHead>الرقم الوظيفي</TableHead>
                                <TableHead>القسم</TableHead>
                                <TableHead>تاريخ التعيين</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>الراتب الأساسي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                            ))}
                            {!loading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                            {!loading && filteredEmployees.map(emp => (
                                <TableRow key={emp.id}>
                                    <TableCell className="font-medium">{emp.fullName}</TableCell>
                                    <TableCell className="font-mono">{emp.employeeNumber}</TableCell>
                                    <TableCell>{emp.department}</TableCell>
                                    <TableCell>{formatDate(emp.hireDate)}</TableCell>
                                    <TableCell><Badge variant="outline" className={statusColors[emp.status]}>{statusTranslations[emp.status]}</Badge></TableCell>
                                    <TableCell className="font-mono">{formatCurrency(emp.basicSalary)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// --- LeaveBalanceReport Component ---
function LeaveBalanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
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
        toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
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
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead>القسم</TableHead>
                            <TableHead className="text-center">رصيد مرحل</TableHead>
                            <TableHead className="text-center">مكتسب</TableHead>
                            <TableHead className="text-center">مستخدم</TableHead>
                            <TableHead className="text-center font-bold">الرصيد المتبقي</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 4}).map((_, i) => (
                             <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                        {!loading && filteredEmployees.map(emp => (
                            <TableRow key={emp.id} className={emp.leaveBalance < 5 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                <TableCell className="font-medium">{emp.fullName}</TableCell>
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

// --- MonthlyAttendanceReport Component ---
function MonthlyAttendanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());

    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    
    const attendanceQuery = useMemo(() => {
        if (!firestore) return null;
        return [
            where('year', '==', parseInt(year)),
            where('month', '==', parseInt(month))
        ];
    }, [firestore, year, month]);
    const { data: attendanceData, loading: attendanceLoading } = useSubscription<MonthlyAttendance>(firestore, 'attendance', attendanceQuery || []);

    const loading = employeesLoading || attendanceLoading;

    const reportData = useMemo(() => {
        if (!attendanceData || !employees) return [];
        const employeeMap = new Map(employees.map(e => [e.id, e]));

        return attendanceData.map(att => {
            const employee = employeeMap.get(att.employeeId);
            const { presentDays = 0, absentDays = 0 } = att.summary;
            const totalWorkingDays = presentDays + absentDays;
            const attendancePercentage = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;

            return {
                ...att,
                employeeName: employee?.fullName || 'موظف غير معروف',
                employeeNumber: employee?.employeeNumber || '-',
                department: employee?.department || '-',
                attendancePercentage,
            };
        }).sort((a,b) => (b.summary.absentDays || 0) - (a.summary.absentDays || 0));
    }, [attendanceData, employees]);
    
    const totals = useMemo(() => {
        const totalPresent = reportData.reduce((sum, item) => sum + (item.summary.presentDays || 0), 0);
        const totalAbsent = reportData.reduce((sum, item) => sum + (item.summary.absentDays || 0), 0);
        const totalDays = totalPresent + totalAbsent;
        const overallAttendance = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
        return { totalPresent, totalAbsent, overallAttendance };
    }, [reportData]);

    const handlePrint = () => {
        toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>تقرير الحضور والغياب الشهري</CardTitle>
                    <CardDescription>عرض ملخص الحضور والغياب والتأخيرات للموظفين.</CardDescription>
                </div>
                <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                     <div className="grid gap-2">
                        <Label htmlFor="year-filter-att">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger id="year-filter-att" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="month-filter-att">الشهر</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger id="month-filter-att" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الموظف</TableHead>
                                <TableHead>القسم</TableHead>
                                <TableHead className="text-center">أيام الحضور</TableHead>
                                <TableHead className="text-center">أيام الغياب</TableHead>
                                <TableHead className="text-center">مرات التأخير</TableHead>
                                <TableHead className="text-center">نسبة الحضور</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 4}).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                            ))}
                            {!loading && reportData.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات حضور لهذا الشهر. قم برفعها من صفحة الرواتب.</TableCell></TableRow>
                            )}
                            {!loading && reportData.map(item => (
                                <TableRow key={item.id} className={(item.summary.absentDays || 0) > 3 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                    <TableCell className="font-medium">{item.employeeName}</TableCell>
                                    <TableCell>{item.department}</TableCell>
                                    <TableCell className="text-center font-mono">{item.summary.presentDays || 0}</TableCell>
                                    <TableCell className="text-center font-mono text-red-600">{item.summary.absentDays || 0}</TableCell>
                                    <TableCell className="text-center font-mono text-orange-600">{item.summary.lateDays || 0}</TableCell>
                                    <TableCell className="text-center font-mono font-bold">
                                        <div className="flex justify-center items-center gap-2">
                                            <span>{item.attendancePercentage.toFixed(1)}%</span>
                                            {(item.summary.absentDays || 0) > 3 && <Badge variant="destructive">غياب متكرر</Badge>}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-base bg-muted">
                                <TableCell colSpan={2}>الإجمالي / المتوسط</TableCell>
                                <TableCell className="text-center font-mono">{totals.totalPresent}</TableCell>
                                <TableCell className="text-center font-mono">{totals.totalAbsent}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-center font-mono">{totals.overallAttendance.toFixed(1)}%</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}

// --- MonthlyPayrollReport Component ---
function MonthlyPayrollReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    
    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
    const payslipsQuery = useMemo(() => {
        if (!firestore) return null;
        return [where('year', '==', parseInt(year)), where('month', '==', parseInt(month))];
    }, [firestore, year, month]);
    const { data: payslips, loading: payslipsLoading } = useSubscription<Payslip>(firestore, 'payroll', payslipsQuery || []);

    const loading = employeesLoading || payslipsLoading;
    
    const reportData = useMemo(() => {
        if (!payslips || !employees) return [];
        return payslips.map(p => {
            const employee = employees.find(e => e.id === p.employeeId);
            const totalEarnings = (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0) + (p.earnings.commission || 0);
            const totalDeductions = (p.deductions.absenceDeduction || 0) + (p.deductions.otherDeductions || 0);
            return {
                ...p,
                employeeName: employee ? employee.fullName : p.employeeName,
                employeeNumber: employee?.employeeNumber || '-',
                department: employee?.department || '-',
                totalEarnings,
                totalDeductions,
            };
        }).sort((a,b) => a.employeeName.localeCompare(b.employeeName, 'ar'));
    }, [payslips, employees]);

    const totals = useMemo(() => ({
        earnings: reportData.reduce((sum, p) => sum + p.totalEarnings, 0),
        deductions: reportData.reduce((sum, p) => sum + p.totalDeductions, 0),
        net: reportData.reduce((sum, p) => sum + p.netSalary, 0),
    }), [reportData]);

    const handleExcelExport = () => {
        const dataForSheet = reportData.map(p => ({
            'اسم الموظف': p.employeeName,
            'الرقم الوظيفي': p.employeeNumber,
            'الراتب الأساسي': p.earnings.basicSalary,
            'البدلات': p.totalEarnings - p.earnings.basicSalary,
            'الخصومات': p.totalDeductions,
            'صافي الراتب': p.netSalary,
            'الحالة': statusTranslations[p.status] || p.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'الرواتب');
        XLSX.writeFile(workbook, `Payroll_${year}-${month}.xlsx`);
    };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>تقرير الرواتب الشهري</CardTitle>
                    <CardDescription>ملخص لجميع كشوفات الرواتب التي تم إنشاؤها للشهر المحدد.</CardDescription>
                </div>
                <Button variant="outline" onClick={handleExcelExport} disabled={loading || reportData.length === 0}><Download className="ml-2 h-4"/> تصدير Excel</Button>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2">
                        <Label htmlFor="year-filter-payroll">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger id="year-filter-payroll" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="grid gap-2">
                        <Label htmlFor="month-filter-payroll">الشهر</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger id="month-filter-payroll" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الأساسي</TableHead><TableHead>البدلات</TableHead><TableHead>الخصومات</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات رواتب لهذا الشهر.</TableCell></TableRow>}
                            {!loading && reportData.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.employeeName}</TableCell>
                                    <TableCell>{formatCurrency(p.earnings.basicSalary)}</TableCell>
                                    <TableCell>{formatCurrency(p.totalEarnings - p.earnings.basicSalary)}</TableCell>
                                    <TableCell className="text-destructive">{formatCurrency(p.totalDeductions)}</TableCell>
                                    <TableCell className="font-bold">{formatCurrency(p.netSalary)}</TableCell>
                                    <TableCell><Badge variant="outline" className={statusColors[p.status]}>{statusTranslations[p.status]}</Badge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-base bg-muted">
                                <TableCell colSpan={2}>الإجمالي</TableCell>
                                <TableCell className="text-left">{formatCurrency(totals.earnings - totals.deductions)}</TableCell>
                                <TableCell className="text-left text-destructive">{formatCurrency(totals.deductions)}</TableCell>
                                <TableCell className="text-left">{formatCurrency(totals.net)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// --- AdvancesAndDeductionsReport Component ---
function AdvancesAndDeductionsReport() {
    const { journalEntries, employees, accounts, loading } = useAnalyticalData();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());

    const reportData = useMemo(() => {
        if (loading || !employees.length || !accounts.length) return [];
        
        const startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

        const employeeMap = new Map(employees.map(e => [e.id, e]));
        const advancesAccount = accounts.find(a => a.code === '110302'); // سلف الموظفين
        if (!advancesAccount) return [];
        
        const advances = journalEntries.filter(entry => {
            const entryDate = toFirestoreDate(entry.date);
            return entryDate && entryDate >= startDate && entryDate <= endDate && entry.status === 'posted';
        })
        .flatMap(entry => 
            entry.lines.filter(line => line.accountId === advancesAccount.id && (line.debit || 0) > 0 && line.auto_resource_id)
            .map(line => ({
                id: entry.id! + '-' + line.accountId,
                employeeId: line.auto_resource_id!,
                amount: line.debit,
                reason: entry.narration,
                date: toFirestoreDate(entry.date)!,
            }))
        );

        return advances.map(adv => {
            const employee = employeeMap.get(adv.employeeId);
            return {
                ...adv,
                employeeName: employee?.fullName || 'غير معروف',
                department: employee?.department || '-',
            };
        }).sort((a,b) => b.date.getTime() - a.date.getTime());

    }, [journalEntries, employees, accounts, loading, year, month]);

    const totalAmount = useMemo(() => reportData.reduce((sum, item) => sum + item.amount, 0), [reportData]);

    const handlePrint = () => {
        toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    
    return (
        <Card>
             <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>تقرير السلف والاستقطاعات</CardTitle>
                    <CardDescription>السلف النقدية المقدمة للموظفين خلال الشهر.</CardDescription>
                </div>
                <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
            </CardHeader>
             <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2">
                        <Label htmlFor="year-filter-advances">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger id="year-filter-advances" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="month-filter-advances">الشهر</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger id="month-filter-advances" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الموظف</TableHead>
                                <TableHead>القسم</TableHead>
                                <TableHead>تاريخ السلفة</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left">المبلغ</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {loading && Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">لا توجد سلف أو استقطاعات لهذا الشهر.</TableCell></TableRow>}
                            {!loading && reportData.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.employeeName}</TableCell>
                                    <TableCell>{item.department}</TableCell>
                                    <TableCell>{format(item.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-base">
                                <TableCell colSpan={4}>إجمالي السلف والاستقطاعات</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totalAmount)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}

// ADDED: تبويب مكافأة نهاية الخدمة والاستحقاقات
function GratuityReport() {
    const { employees, loading } = useAnalyticalData();
    const { toast } = useToast();
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');

    const reportData = useMemo(() => {
        if (loading || !employees) return [];
        
        return employees
            .filter(e => e.status === 'active')
            .map(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                if (!hireDate) return null;

                const yearsOfService = differenceInYears(new Date(), hireDate);
                
                const gratuityOnTermination = calculateGratuity({ ...emp, terminationReason: 'termination' }, new Date());
                const gratuityOnResignation = calculateGratuity({ ...emp, terminationReason: 'resignation' }, new Date());

                return {
                    ...emp,
                    yearsOfService,
                    gratuityOnTermination: gratuityOnTermination.gratuity,
                    leaveBalancePay: gratuityOnTermination.leaveBalancePay,
                    totalOnTermination: gratuityOnTermination.total,
                    gratuityOnResignation: gratuityOnResignation.gratuity,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);
    }, [employees, loading]);
    
    const filteredData = useMemo(() => {
        if (serviceDurationFilter === 'all') return reportData;
        const years = parseInt(serviceDurationFilter, 10);
        return reportData.filter(item => item.yearsOfService > years);
    }, [reportData, serviceDurationFilter]);

    const totals = useMemo(() => ({
        gratuity: filteredData.reduce((sum, item) => sum + item.gratuityOnTermination, 0),
        leavePay: filteredData.reduce((sum, item) => sum + item.leaveBalancePay, 0),
        total: filteredData.reduce((sum, item) => sum + item.totalOnTermination, 0),
    }), [filteredData]);
    
    const handlePrint = () => {
        toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' });
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>تقدير مكافآت نهاية الخدمة</CardTitle>
                    <CardDescription>تقدير للاستحقاقات المتوقعة للموظفين النشطين في حال إنهاء خدماتهم اليوم.</CardDescription>
                </div>
                 <div className='flex items-center gap-4'>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="service-duration-filter-gratuity">مدة الخدمة</Label>
                        <Select value={serviceDurationFilter} onValueChange={setServiceDurationFilter}>
                            <SelectTrigger id="service-duration-filter-gratuity" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="3">أكثر من 3 سنوات</SelectItem>
                                <SelectItem value="5">أكثر من 5 سنوات</SelectItem>
                                <SelectItem value="10">أكثر من 10 سنوات</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <Button variant="outline" onClick={handlePrint}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الموظف (الرقم الوظيفي)</TableHead>
                                <TableHead>القسم</TableHead>
                                <TableHead>تاريخ التعيين</TableHead>
                                <TableHead className="text-center">سنوات الخدمة</TableHead>
                                <TableHead className="text-left">مكافأة (إنهاء)</TableHead>
                                <TableHead className="text-left">مكافأة (استقالة)</TableHead>
                                <TableHead className="text-left">بدل إجازات</TableHead>
                                <TableHead className="text-left font-bold">الإجمالي المتوقع</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {loading && Array.from({length: 4}).map((_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                             {!loading && filteredData.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center">لا توجد بيانات.</TableCell></TableRow>}
                             {!loading && filteredData.map(item => (
                                 <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="font-medium">{item.fullName}</div>
                                        <div className="text-xs text-muted-foreground font-mono">{item.employeeNumber}</div>
                                    </TableCell>
                                    <TableCell>{item.department}</TableCell>
                                    <TableCell>{toFirestoreDate(item.hireDate) ? format(toFirestoreDate(item.hireDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {item.yearsOfService.toFixed(1)}
                                            {item.yearsOfService >= 2.5 && item.yearsOfService < 3 && <Badge variant="outline" className="bg-yellow-100 text-yellow-800">قريب من الاستحقاق</Badge>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.gratuityOnTermination)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.gratuityOnResignation)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.leaveBalancePay)}</TableCell>
                                    <TableCell className="text-left font-mono font-bold">{formatCurrency(item.totalOnTermination)}</TableCell>
                                 </TableRow>
                             ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="font-bold text-base bg-muted">
                                <TableCell colSpan={4}>الإجمالي المتوقع للموظفين الظاهرين (في حال إنهاء الخدمة)</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totals.gratuity)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totals.leavePay)}</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(totals.total)}</TableCell>
                            </TableRow>
                         </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}



// Main Page Component
export default function HrReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير الموارد البشرية</CardTitle>
                <CardDescription>عرض تحليلات وتقارير خاصة بالموظفين والإجازات والرواتب.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="general" dir="rtl">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="general">الموظفين العام</TabsTrigger>
                        <TabsTrigger value="leave-balance">أرصدة الإجازات</TabsTrigger>
                        <TabsTrigger value="attendance">الحضور والغياب</TabsTrigger>
                        <TabsTrigger value="payroll">الرواتب الشهرية</TabsTrigger>
                        <TabsTrigger value="advances">السلف والاستقطاعات</TabsTrigger>
                        <TabsTrigger value="gratuity">نهاية الخدمة</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-4">
                        <GeneralEmployeeReport />
                    </TabsContent>
                    <TabsContent value="leave-balance" className="mt-4">
                        <LeaveBalanceReport />
                    </TabsContent>
                    <TabsContent value="attendance" className="mt-4">
                        <MonthlyAttendanceReport />
                    </TabsContent>
                    <TabsContent value="payroll" className="mt-4">
                        <MonthlyPayrollReport />
                    </TabsContent>
                    <TabsContent value="advances" className="mt-4">
                        <AdvancesAndDeductionsReport />
                    </TabsContent>
                    <TabsContent value="gratuity" className="mt-4">
                        {/* ADDED: تبويب مكافأة نهاية الخدمة والاستحقاقات مع فلتر سنوات الخدمة + تنبيه قرب الاستحقاق */}
                        <GratuityReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}