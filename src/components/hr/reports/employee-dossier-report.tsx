'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Employee, AuditLog, LeaveRequest, PermissionRequest, MonthlyAttendance } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DateInput } from '@/components/ui/date-input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    FileText, 
    Printer, 
    Loader2, 
    History, 
    TrendingUp, 
    Clock, 
    CalendarX, 
    ShieldAlert, 
    User, 
    FileSearch, 
    Activity,
    Calculator,
    Stethoscope,
    AlertCircle,
    HandCoins
} from 'lucide-react';
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';

interface DossierEntry {
    employee: Employee;
    auditLogs: AuditLog[];
    attendanceSummary: {
        absentDays: number;
        lateMinutes: number;
        presentDays: number;
    };
    leaveStats: {
        sickDays: number;
        emergencyDays: number;
        annualDays: number;
        unpaidDays: number;
    };
    permissionCount: number;
}

export function EmployeeDossierReport() {
    const { firestore } = useFirebase();
    const { branding } = useBranding();
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [results, setResults] = useState<DossierEntry[] | null>(null);

    const { data: employees, loading: empLoading } = useSubscription<Employee>(firestore, 'employees', [orderBy('fullName')]);

    const employeeOptions = useMemo(() => [
        { value: 'all', label: 'جميع الموظفين' },
        ...employees.map(e => ({ value: e.id!, label: e.fullName }))
    ], [employees]);

    const handleGenerate = async () => {
        if (!firestore || !dateFrom || !dateTo) return;
        setIsGenerating(true);
        try {
            const start = startOfDay(dateFrom);
            const end = endOfDay(dateTo);

            const employeesToProcess = selectedEmployeeId === 'all' 
                ? employees 
                : employees.filter(e => e.id === selectedEmployeeId);

            const dossierResults: DossierEntry[] = [];

            for (const emp of employeesToProcess) {
                // 1. جلب سجلات التغيرات (Audit Logs)
                const logsSnap = await getDocs(query(
                    collection(firestore, `employees/${emp.id}/auditLogs`),
                    where('effectiveDate', '>=', start),
                    where('effectiveDate', '<=', end),
                    orderBy('effectiveDate', 'desc')
                ));
                const auditLogs = logsSnap.docs.map(d => d.data() as AuditLog);

                // 2. جلب الحضور والغياب
                const attSnap = await getDocs(query(
                    collection(firestore, 'attendance'),
                    where('employeeId', '==', emp.id)
                ));
                
                let absentDays = 0;
                let lateMinutes = 0;
                let presentDays = 0;
                
                attSnap.forEach(docSnap => {
                    const data = docSnap.data() as MonthlyAttendance;
                    data.records?.forEach(r => {
                        const rDate = toFirestoreDate(r.date);
                        if (rDate && isWithinInterval(rDate, { start, end })) {
                            if (r.status === 'absent' && r.auditStatus !== 'waived') absentDays += (r.manualDeductionDays || 1);
                            if (r.status === 'present') presentDays++;
                            if (r.status === 'late' && r.auditStatus !== 'waived') lateMinutes += 30; 
                        }
                    });
                });

                // 3. جلب الإجازات
                const leavesSnap = await getDocs(query(
                    collection(firestore, 'leaveRequests'),
                    where('employeeId', '==', emp.id),
                    where('status', 'in', ['approved', 'on-leave', 'returned'])
                ));
                const leaveStats = { sickDays: 0, emergencyDays: 0, annualDays: 0, unpaidDays: 0 };
                leavesSnap.forEach(docSnap => {
                    const l = docSnap.data() as LeaveRequest;
                    const lStart = toFirestoreDate(l.startDate);
                    if (lStart && isWithinInterval(lStart, { start, end })) {
                        if (l.leaveType === 'Sick') leaveStats.sickDays += l.workingDays || 0;
                        if (l.leaveType === 'Emergency') leaveStats.emergencyDays += l.workingDays || 0;
                        if (l.leaveType === 'Annual') leaveStats.annualDays += l.workingDays || 0;
                        leaveStats.unpaidDays += l.unpaidDays || 0;
                    }
                });

                // 4. جلب الاستئذانات
                const permsSnap = await getDocs(query(
                    collection(firestore, 'permissionRequests'),
                    where('employeeId', '==', emp.id),
                    where('status', '==', 'approved')
                ));
                let permissionCount = 0;
                permsSnap.forEach(docSnap => {
                    const p = docSnap.data() as PermissionRequest;
                    const pDate = toFirestoreDate(p.date);
                    if (pDate && isWithinInterval(pDate, { start, end })) permissionCount++;
                });

                dossierResults.push({
                    employee: emp,
                    auditLogs,
                    attendanceSummary: { absentDays, lateMinutes, presentDays },
                    leaveStats,
                    permissionCount
                });
            }

            setResults(dossierResults);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="no-print rounded-[2rem] border-none shadow-sm bg-gradient-to-l from-white to-indigo-50">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <History className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">وثيقة ملف متغيرات الموظف الشاملة</CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500">جرد شامل لكافة التغيرات المالية، الحضور، الإجازات، والجزاءات في فترة محددة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">الموظف المستهدف</Label>
                            <InlineSearchList value={selectedEmployeeId} onSelect={setSelectedEmployeeId} options={employeeOptions} placeholder="اختر..." />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">من تاريخ</Label>
                            <DateInput value={dateFrom} onChange={setDateFrom} />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">إلى تاريخ</Label>
                            <DateInput value={dateTo} onChange={setDateTo} />
                        </div>
                        <Button onClick={handleGenerate} disabled={isGenerating} className="h-11 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
                            توليد الوثائق التوثيقية
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {results && (
                <div className="space-y-12 animate-in fade-in zoom-in-95 duration-500">
                    {results.map((entry, idx) => (
                        <Card key={idx} id={`printable-dossier-${idx}`} className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white print:shadow-none print:m-0 print:rounded-none">
                            <CardHeader className="bg-slate-900 text-white p-10">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-6">
                                        <Logo className="h-20 w-20 !p-3 border-2 border-white/20" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                        <div className="space-y-1">
                                            <h2 className="text-3xl font-black tracking-tight">{entry.employee.fullName}</h2>
                                            <p className="text-indigo-200 font-bold">{entry.employee.jobTitle} - {entry.employee.department}</p>
                                            <Badge variant="outline" className="text-white border-white/40 font-mono">ID: {entry.employee.employeeNumber}</Badge>
                                        </div>
                                    </div>
                                    <div className="text-left space-y-1 opacity-60">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">Official Dossier Record</p>
                                        <p className="text-xs font-bold">الفترة: {format(dateFrom!, 'dd/MM/yyyy')} - {format(dateTo!, 'dd/MM/yyyy')}</p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-10 space-y-10">
                                <section className="space-y-6">
                                    <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-primary pr-4">
                                        <Clock className="text-primary" /> ملخص الالتزام والانضباط
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                        <div className="p-6 bg-green-50 rounded-3xl border border-green-100 flex flex-col items-center gap-1 shadow-inner">
                                            <Label className="text-[10px] font-black text-green-700 uppercase">الحضور</Label>
                                            <p className="text-3xl font-black text-green-800">{entry.attendanceSummary.presentDays} <span className="text-sm">يوم</span></p>
                                        </div>
                                        <div className="p-6 bg-red-50 rounded-3xl border border-red-100 flex flex-col items-center gap-1 shadow-inner">
                                            <Label className="text-[10px] font-black text-red-700 uppercase">الغياب الفعلي</Label>
                                            <p className="text-3xl font-black text-red-800">{entry.attendanceSummary.absentDays} <span className="text-sm">يوم</span></p>
                                        </div>
                                        <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100 flex flex-col items-center gap-1 shadow-inner">
                                            <Label className="text-[10px] font-black text-orange-700 uppercase">دقائق التأخير</Label>
                                            <p className="text-3xl font-black text-orange-800">{entry.attendanceSummary.lateMinutes} <span className="text-sm">دقيقة</span></p>
                                        </div>
                                        <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 flex flex-col items-center gap-1 shadow-inner">
                                            <Label className="text-[10px] font-black text-blue-700 uppercase">استئذانات معتمدة</Label>
                                            <p className="text-3xl font-black text-blue-800">{entry.permissionCount} <span className="text-sm">طلب</span></p>
                                        </div>
                                    </div>
                                </section>

                                <Separator />

                                <section className="space-y-6">
                                    <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-indigo-600 pr-4">
                                        <Activity className="text-indigo-600" /> سجل المتغيرات والقرارات الإدارية
                                    </h3>
                                    {entry.auditLogs.length === 0 ? (
                                        <div className="p-10 text-center border-2 border-dashed rounded-3xl opacity-30 italic font-bold">لا توجد تغيرات مسجلة في ملف الموظف خلال هذه الفترة.</div>
                                    ) : (
                                        <div className="border-2 rounded-[2rem] overflow-hidden">
                                            <Table>
                                                <TableHeader className="bg-slate-50">
                                                    <TableRow>
                                                        <TableHead className="font-black">التاريخ</TableHead>
                                                        <TableHead className="font-black">البند المتأثر</TableHead>
                                                        <TableHead className="font-black">القيمة القديمة</TableHead>
                                                        <TableHead className="font-black">القيمة الجديدة</TableHead>
                                                        <TableHead className="font-black">بواسطة</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {entry.auditLogs.map((log, lidx) => (
                                                        <TableRow key={lidx}>
                                                            <TableCell className="font-mono text-[10px]">{format(toFirestoreDate(log.effectiveDate)!, 'dd/MM/yyyy HH:mm')}</TableCell>
                                                            <TableCell className="font-black text-primary">{log.field}</TableCell>
                                                            <TableCell className="text-xs line-through opacity-40">{log.oldValue}</TableCell>
                                                            <TableCell className="font-black text-indigo-700">{log.newValue}</TableCell>
                                                            <TableCell className="text-[10px] font-bold text-muted-foreground">{log.changedBy}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    )}
                                </section>

                                <Separator />

                                <section className="space-y-6">
                                    <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-pink-600 pr-4">
                                        <CalendarX className="text-pink-600" /> تحليل استهلاك الإجازات
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-4 bg-muted/20 rounded-2xl border">
                                                <span className="font-bold flex items-center gap-2"><Stethoscope className="h-4 w-4 text-pink-600" /> إجمالي الإجازات المرضية</span>
                                                <span className="font-black text-xl">{entry.leaveStats.sickDays} يوم</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-muted/20 rounded-2xl border">
                                                <span className="font-bold flex items-center gap-2"><AlertCircle className="h-4 w-4 text-orange-600" /> إجازات طارئة</span>
                                                <span className="font-black text-xl">{entry.leaveStats.emergencyDays} يوم</span>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-4 bg-muted/20 rounded-2xl border">
                                                <span className="font-bold">إجازات سنوية مستهلكة</span>
                                                <span className="font-black text-xl">{entry.leaveStats.annualDays} يوم</span>
                                            </div>
                                            <div className="flex justify-between items-center p-4 bg-orange-50 rounded-2xl border border-orange-200">
                                                <span className="font-black text-orange-800">أيام بدون راتب (Unpaid)</span>
                                                <span className="font-black text-xl text-orange-700">{entry.leaveStats.unpaidDays} يوم</span>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <footer className="pt-20 grid grid-cols-3 gap-12 text-center text-[10px] font-black uppercase text-muted-foreground">
                                    <div className="space-y-16">
                                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد الموارد البشرية</p>
                                        <div className="pt-2 border-t border-dashed">التوقيع والتاريخ</div>
                                    </div>
                                    <div className="space-y-16">
                                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">التدقيق المالي</p>
                                        <div className="pt-2 border-t border-dashed">المراجعة والمصادقة</div>
                                    </div>
                                    <div className="space-y-16">
                                        <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المدير العام</p>
                                        <div className="pt-2 border-t border-dashed">الختم الرسمي</div>
                                    </div>
                                </footer>
                            </CardContent>
                        </Card>
                    ))}
                    
                    <div className="flex justify-end pb-20 no-print">
                        <Button onClick={() => window.print()} className="h-16 px-20 rounded-3xl font-black text-xl shadow-2xl shadow-primary/30 gap-3">
                            <Printer className="h-6 w-6" /> طباعة كافة الوثائق التوثيقية
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}