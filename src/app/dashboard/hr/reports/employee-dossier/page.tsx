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
    FileText, Printer, Loader2, History, TrendingUp, Clock, CalendarX, 
    ShieldAlert, User, FileSearch, Activity, Calculator, 
    Stethoscope, AlertCircle, Briefcase, Award, CheckCircle2
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
    attendanceSummary: { absentDays: number; lateMinutes: number; presentDays: number; };
    leaveStats: { sickDays: number; emergencyDays: number; annualDays: number; unpaidDays: number; };
    permissionCount: number;
}

export default function EmployeeDossierReport() {
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
            const employeesToProcess = selectedEmployeeId === 'all' ? employees : employees.filter(e => e.id === selectedEmployeeId);
            const dossierResults: DossierEntry[] = [];

            for (const emp of employeesToProcess) {
                const logsSnap = await getDocs(query(collection(firestore, `employees/${emp.id}/auditLogs`), where('effectiveDate', '>=', start), where('effectiveDate', '<=', end), orderBy('effectiveDate', 'desc')));
                const auditLogs = logsSnap.docs.map(d => d.data() as AuditLog);

                const attSnap = await getDocs(query(collection(firestore, 'attendance'), where('employeeId', '==', emp.id)));
                let absentDays = 0, lateMinutes = 0, presentDays = 0;
                attSnap.forEach(docSnap => {
                    (docSnap.data() as MonthlyAttendance).records?.forEach(r => {
                        const rDate = toFirestoreDate(r.date);
                        if (rDate && isWithinInterval(rDate, { start, end })) {
                            if (r.status === 'absent' && r.auditStatus !== 'waived') absentDays += (r.manualDeductionDays || 1);
                            if (r.status === 'present') presentDays++;
                            if (r.status === 'late' && r.auditStatus !== 'waived') lateMinutes += 30; 
                        }
                    });
                });

                const leavesSnap = await getDocs(query(collection(firestore, 'leaveRequests'), where('employeeId', '==', emp.id), where('status', 'in', ['approved', 'on-leave', 'returned'])));
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

                const permsSnap = await getDocs(query(collection(firestore, 'permissionRequests'), where('employeeId', '==', emp.id), where('status', '==', 'approved')));
                let permissionCount = 0;
                permsSnap.forEach(docSnap => {
                    const pDate = toFirestoreDate((docSnap.data() as PermissionRequest).date);
                    if (pDate && isWithinInterval(pDate, { start, end })) permissionCount++;
                });

                dossierResults.push({ employee: emp, auditLogs, attendanceSummary: { absentDays, lateMinutes, presentDays }, leaveStats, permissionCount });
            }
            setResults(dossierResults);
        } finally { setIsGenerating(false); }
    };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="no-print rounded-[2rem] border-none shadow-sm bg-gradient-to-l from-white to-indigo-50">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner"><History className="h-8 w-8" /></div>
                        <div>
                            <CardTitle className="text-2xl font-black">وثيقة ملف المتغيرات الشاملة</CardTitle>
                            <CardDescription className="text-base font-bold">تاريخ الموظف الميداني والمالي مدمجاً في وثيقة توثيقية واحدة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 flex flex-wrap gap-4 items-end">
                    <div className="grid gap-2 w-64"><Label className="font-bold">الموظف</Label><InlineSearchList value={selectedEmployeeId} onSelect={setSelectedEmployeeId} options={employeeOptions} placeholder="اختر..." /></div>
                    <div className="grid gap-2 w-48"><Label className="font-bold">من</Label><DateInput value={dateFrom} onChange={setDateFrom} /></div>
                    <div className="grid gap-2 w-48"><Label className="font-bold">إلى</Label><DateInput value={dateTo} onChange={setDateTo} /></div>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="h-11 rounded-xl font-black gap-2 shadow-xl">
                        {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />} توليد المسيرة الوظيفية
                    </Button>
                </CardContent>
            </Card>

            {results && results.map((entry, idx) => (
                <Card key={idx} className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white print:shadow-none print:m-0 print:rounded-none">
                    <CardHeader className="bg-primary/5 text-[#1e1b4b] p-10 border-b-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <Logo className="h-20 w-20 !p-3 border-2 border-primary/20 shadow-inner" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black tracking-tight">{entry.employee.fullName}</h2>
                                    <p className="text-primary font-bold">{entry.employee.jobTitle} - {entry.employee.department}</p>
                                </div>
                            </div>
                            <div className="text-left opacity-40"><p className="text-[10px] font-black uppercase tracking-[0.3em]">Official Dossier Record</p></div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-10 space-y-12">
                        
                        <section className="space-y-6">
                            <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-indigo-600 pr-4"><Activity className="text-indigo-600" /> الجدول الزمني للقرارات والمسيرة</h3>
                            <div className="relative pr-8 border-r-4 border-slate-100 space-y-8">
                                <div className="relative flex items-center gap-4">
                                    <div className="absolute -right-[2.3rem] bg-indigo-600 rounded-full p-2 border-4 border-white shadow-md"><Award className="h-4 w-4 text-white"/></div>
                                    <div className="bg-slate-50 p-4 rounded-2xl border flex-1">
                                        <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">تاريخ المباشرة الرسمي</p>
                                        <p className="font-black text-lg">{format(toFirestoreDate(entry.employee.hireDate)!, 'dd MMMM yyyy', { locale: ar })}</p>
                                    </div>
                                </div>
                                {entry.auditLogs.map((log, lidx) => (
                                    <div key={lidx} className="relative flex items-center gap-4">
                                        <div className="absolute -right-[2.1rem] bg-white rounded-full p-1.5 border-2 border-indigo-200 shadow-sm"><CheckCircle2 className="h-3 w-3 text-indigo-400"/></div>
                                        <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-indigo-100 flex-1 flex justify-between items-center">
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase">{format(toFirestoreDate(log.effectiveDate)!, 'dd/MM/yyyy')}</p>
                                                <p className="font-bold text-sm text-slate-800">{log.notes}</p>
                                            </div>
                                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase">{log.changeType}</Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="space-y-6">
                            <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-primary pr-4"><Clock className="text-primary" /> ملخص الانضباط الميداني</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="p-6 bg-green-50 rounded-3xl border border-green-100 text-center shadow-inner"><Label className="text-[10px] font-black text-green-700 uppercase">الحضور</Label><p className="text-3xl font-black text-green-800">{entry.attendanceSummary.presentDays} يوم</p></div>
                                <div className="p-6 bg-red-50 rounded-3xl border border-red-100 text-center shadow-inner"><Label className="text-[10px] font-black text-red-700 uppercase">الغياب الفعلي</Label><p className="text-3xl font-black text-red-800">{entry.attendanceSummary.absentDays} يوم</p></div>
                                <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100 text-center shadow-inner"><Label className="text-[10px] font-black text-orange-700 uppercase">التأخير</Label><p className="text-3xl font-black text-orange-800">{entry.attendanceSummary.lateMinutes} د</p></div>
                                <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100 text-center shadow-inner"><Label className="text-[10px] font-black text-blue-700 uppercase">استئذانات</Label><p className="text-3xl font-black text-blue-800">{entry.permissionCount}</p></div>
                            </div>
                        </section>

                        <footer className="pt-20 grid grid-cols-3 gap-12 text-center text-[10px] font-black uppercase text-muted-foreground border-t-2 border-dashed">
                            <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد الموارد البشرية</p><div>التوقيع والتاريخ</div></div>
                            <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">التدقيق المالي</p><div>المصادقة</div></div>
                            <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد الإدارة</p><div>الختم الرسمي</div></div>
                        </footer>
                    </CardContent>
                </Card>
            ))}
            
            {results && <div className="flex justify-end pb-20 no-print"><Button onClick={() => window.print()} className="h-16 px-16 rounded-3xl font-black text-xl shadow-2xl gap-3"><Printer className="h-6 w-6" /> طباعة الوثائق التاريخية</Button></div>}
        </div>
    );
}
