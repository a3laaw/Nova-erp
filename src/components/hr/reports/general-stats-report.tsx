'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { toFirestoreDate } from '@/services/date-converter';
import type { Employee, Payslip, MonthlyAttendance, LeaveRequest } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format, differenceInYears, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Users, UserPlus, Star, CalendarX, Percent, Wallet, UserX as UserXIcon, Briefcase, Loader2 } from 'lucide-react';
import { where } from 'firebase/firestore';

const StatCard = ({ title, value, icon, description, loading, colorClass }: { title: string, value: string | number, icon: React.ReactNode, description?: string, loading: boolean, colorClass?: string }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className={cn("h-6 w-6 text-muted-foreground", colorClass)}>{icon}</div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-3xl font-bold">{value}</div>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </CardContent>
    </Card>
);

export function GeneralStatsReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());

    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: allLeaves, loading: leavesLoading } = useSubscription<LeaveRequest>(firestore, 'leaveRequests');

    const payslipsQuery = useMemo(() => {
        if (!firestore) return null;
        return [where('year', '==', parseInt(year)), where('month', '==', parseInt(month))];
    }, [firestore, year, month]);
    const { data: monthlyPayslips, loading: payslipsLoading } = useSubscription<Payslip>(firestore, 'payroll', payslipsQuery || []);
    
    const attendanceQuery = useMemo(() => {
        if (!firestore) return null;
        return [where('year', '==', parseInt(year)), where('month', '==', parseInt(month))];
    }, [firestore, year, month]);
    const { data: monthlyAttendance, loading: attendanceLoading } = useSubscription<MonthlyAttendance>(firestore, 'attendance', attendanceQuery || []);
    
    const loading = employeesLoading || leavesLoading || payslipsLoading || attendanceLoading;

    const stats = useMemo(() => {
        if (!employees) return null;

        const today = new Date();
        const selectedYear = parseInt(year);
        const selectedMonth = parseInt(month) - 1;
        const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));

        const activeEmployees = employees.filter(e => e.status === 'active');
        const newHiresThisMonth = activeEmployees.filter(e => {
            const hireDate = toFirestoreDate(e.hireDate);
            return hireDate && isWithinInterval(hireDate, { start: monthStart, end: monthEnd });
        }).length;

        const totalServiceYears = activeEmployees.reduce((sum, e) => {
            const hireDate = toFirestoreDate(e.hireDate);
            return hireDate ? sum + differenceInYears(today, hireDate) : sum;
        }, 0);
        const avgServiceYears = activeEmployees.length > 0 ? (totalServiceYears / activeEmployees.length).toFixed(1) : '0';

        const totalLeaveBalance = activeEmployees.reduce((sum, e) => sum + calculateAnnualLeaveBalance(e, today), 0);

        const totalPresent = monthlyAttendance.reduce((sum, a) => sum + (a.summary.presentDays || 0), 0);
        const totalAbsent = monthlyAttendance.reduce((sum, a) => sum + (a.summary.absentDays || 0), 0);
        const totalWorkingDays = totalPresent + totalAbsent;
        const attendancePercentage = totalWorkingDays > 0 ? (totalPresent / totalWorkingDays) * 100 : 0;

        const totalSalaryCost = monthlyPayslips.reduce((sum, p) => sum + p.netSalary, 0);

        const separationsThisYear = employees.filter(e => {
            const termDate = toFirestoreDate(e.terminationDate);
            return e.status === 'terminated' && termDate && termDate.getFullYear() === selectedYear;
        }).length;
        
        const ongoingLeaves = allLeaves.filter(l => {
             const leaveStart = toFirestoreDate(l.startDate);
             const leaveEnd = toFirestoreDate(l.endDate);
             return l.status === 'approved' && leaveStart && leaveEnd && isWithinInterval(today, { start: leaveStart, end: leaveEnd });
        }).length;

        return {
            totalActiveEmployees: activeEmployees.length,
            newHiresThisMonth,
            avgServiceYears,
            totalLeaveBalance,
            attendancePercentage,
            totalSalaryCost,
            separationsThisYear,
            ongoingLeaves
        };

    }, [employees, allLeaves, monthlyPayslips, monthlyAttendance, year, month]);

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader>
                <CardTitle>الإحصائيات العامة للموارد البشرية</CardTitle>
                <CardDescription>نظرة عامة سريعة على أهم مؤشرات الأداء.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                    <div className="grid gap-2"><Label>السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                    <div className="grid gap-2"><Label>الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatCard loading={loading} title="إجمالي الموظفين النشطين" value={stats?.totalActiveEmployees || 0} icon={<Users />} />
                    <StatCard loading={loading} title="موظفون جدد (الشهر الحالي)" value={stats?.newHiresThisMonth || 0} icon={<UserPlus />} />
                    <StatCard loading={loading} title="متوسط سنوات الخدمة" value={`${stats?.avgServiceYears || 0}`} icon={<Star />} description="للموظفين النشطين" />
                    <StatCard loading={loading} title="موظفون في إجازة حالياً" value={stats?.ongoingLeaves || 0} icon={<CalendarX />} />
                    <StatCard 
                        loading={loading}
                        title="نسبة الحضور للشهر"
                        value={`${stats?.attendancePercentage.toFixed(1) || 0}%`}
                        icon={<Percent />}
                        colorClass={stats && stats.attendancePercentage < 90 ? 'text-destructive' : 'text-green-600'}
                    />
                    <StatCard loading={loading} title="تكلفة الرواتب للشهر" value={formatCurrency(stats?.totalSalaryCost || 0)} icon={<Wallet />} />
                    <StatCard loading={loading} title="إجمالي رصيد الإجازات" value={`${stats?.totalLeaveBalance || 0} يوم`} icon={<Briefcase />} />
                    <StatCard loading={loading} title="حالات إنهاء الخدمة (السنة)" value={stats?.separationsThisYear || 0} icon={<UserXIcon />} />
                </div>
            </CardContent>
        </Card>
    );
}
