'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Printer, User, UserCheck, UserX, UserCog, CalendarIcon, Wallet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { formatCurrency } from '@/lib/utils';

// ADDED: صفحة تقارير HR مبسطة مع تبويبين أوليين

// --- Status Translations & Colors ---
const statusTranslations: Record<Employee['status'], string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};
const statusColors: Record<Employee['status'], string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
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
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees');

    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [contractTypeFilter, setContractTypeFilter] = useState('all');

    // IMPROVED: جمع الأقسام وأنواع العقود تلقائيًا من البيانات
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
      // TODO: Implement PDF export logic using jsPDF if available
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
                                {Object.entries(statusTranslations).map(([key, value]) => (
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
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const [balanceFilter, setBalanceFilter] = useState('all');

    // IMPROVED: فلتر رصيد منخفض + تنبيه مرئي
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

// Main Page Component
export default function HrReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير الموارد البشرية</CardTitle>
                <CardDescription>عرض تحليلات وتقارير خاصة بالموظفين والإجازات.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="general" dir="rtl">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">تقرير الموظفين العام</TabsTrigger>
                        <TabsTrigger value="leave-balance">أرصدة الإجازات</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-4">
                        <GeneralEmployeeReport />
                    </TabsContent>
                    <TabsContent value="leave-balance" className="mt-4">
                        <LeaveBalanceReport />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
