'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function MonthlyAttendanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());

    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    
    const attendanceQuery = useMemo(() => {
        if (!firestore) return null;
        return [where('year', '==', parseInt(year)), where('month', '==', parseInt(month))];
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
            return { ...att, employeeName: employee?.fullName || 'موظف غير معروف', employeeNumber: employee?.employeeNumber || '-', department: employee?.department || '-', attendancePercentage };
        }).sort((a,b) => (b.summary.absentDays || 0) - (a.summary.absentDays || 0));
    }, [attendanceData, employees]);
    
    const totals = useMemo(() => {
        const totalPresent = reportData.reduce((sum, item) => sum + (item.summary.presentDays || 0), 0);
        const totalAbsent = reportData.reduce((sum, item) => sum + (item.summary.absentDays || 0), 0);
        const totalDays = totalPresent + totalAbsent;
        const overallAttendance = totalDays > 0 ? (totalPresent / totalDays) * 100 : 0;
        return { totalPresent, totalAbsent, overallAttendance };
    }, [reportData]);

    const handlePrint = () => { toast({ title: 'قيد التطوير', description: 'سيتم إضافة خاصية الطباعة قريبًا.' }); };

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>تقرير الحضور والغياب الشهري</CardTitle>
                <CardDescription>عرض ملخص الحضور والغياب والتأخيرات للموظفين.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2"><Label htmlFor="year-filter-att">السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger id="year-filter-att" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label htmlFor="month-filter-att">الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger id="month-filter-att" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>اسم الموظف</TableHead><TableHead>القسم</TableHead><TableHead className="text-center">أيام الحضور</TableHead><TableHead className="text-center">أيام الغياب</TableHead><TableHead className="text-center">مرات التأخير</TableHead><TableHead className="text-center">نسبة الحضور</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 4}).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>))}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات حضور لهذا الشهر. قم برفعها من صفحة الرواتب.</TableCell></TableRow>}
                            {!loading && reportData.map(item => (<TableRow key={item.id} className={(item.summary.absentDays || 0) > 3 ? 'bg-red-50 dark:bg-red-900/20' : ''}><TableCell className="font-medium">{item.employeeName}</TableCell><TableCell>{item.department}</TableCell><TableCell className="text-center font-mono">{item.summary.presentDays || 0}</TableCell><TableCell className="text-center font-mono text-red-600">{item.summary.absentDays || 0}</TableCell><TableCell className="text-center font-mono text-orange-600">{item.summary.lateDays || 0}</TableCell><TableCell className="text-center font-mono font-bold"><div className="flex justify-center items-center gap-2"><span>{item.attendancePercentage.toFixed(1)}%</span>{(item.summary.absentDays || 0) > 3 && <Badge variant="destructive">غياب متكرر</Badge>}</div></TableCell></TableRow>))}
                        </TableBody>
                        <TableFooter><TableRow className="font-bold text-base bg-muted"><TableCell colSpan={2}>الإجمالي / المتوسط</TableCell><TableCell className="text-center font-mono">{totals.totalPresent}</TableCell><TableCell className="text-center font-mono">{totals.totalAbsent}</TableCell><TableCell></TableCell><TableCell className="text-center font-mono">{totals.overallAttendance.toFixed(1)}%</TableCell></TableRow></TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
