
'use client';

import { useState, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Employee, MonthlyAttendance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '../ui/badge';
import { Printer, FileSearch, Loader2, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function MonthlyAttendanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportResults, setReportResults] = useState<any[] | null>(null);

    const handleGenerate = async () => {
        if (!firestore) return;
        setIsGenerating(true);
        try {
            const [employeesSnap, attendanceSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                getDocs(query(collection(firestore, 'attendance'), where('year', '==', parseInt(year)), where('month', '==', parseInt(month))))
            ]);

            const employees = employeesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            const employeeMap = new Map(employees.map(e => [e.id, e]));

            const results = attendanceSnap.docs.map(doc => {
                const att = doc.data() as MonthlyAttendance;
                const employee = employeeMap.get(att.employeeId);
                const { presentDays = 0, absentDays = 0 } = att.summary;
                const totalWorkingDays = presentDays + absentDays;
                const attendancePercentage = totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;
                
                return {
                    ...att,
                    employeeName: employee?.fullName || 'موظف غير معروف',
                    department: employee?.department || '-',
                    attendancePercentage
                };
            }).sort((a, b) => b.summary.absentDays - a.summary.absentDays);

            setReportResults(results);
            toast({ title: 'تم التوليد', description: 'تم استخراج وتثبيت قراءات الحضور للفترة المحددة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل توليد التقرير.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const totals = useMemo(() => {
        if (!reportResults) return { totalPresent: 0, totalAbsent: 0, overallAttendance: 0 };
        const totalPresent = reportResults.reduce((sum, item) => sum + (item.summary.presentDays || 0), 0);
        const totalAbsent = reportResults.reduce((sum, item) => sum + (item.summary.absentDays || 0), 0);
        const totalDays = totalPresent + totalAbsent;
        return { totalPresent, totalAbsent, overallAttendance: totalDays > 0 ? (totalPresent / totalDays) * 100 : 0 };
    }, [reportResults]);

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card dir="rtl" className="rounded-3xl border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-xl font-black">تقرير الحضور والغياب (القراءات المثبتة)</CardTitle>
                <CardDescription>عرض ملخص الحضور والغياب والتأخيرات. القراءات لا تتحدث تلقائياً لضمان دقة التدقيق.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 mb-6 p-6 bg-muted/30 rounded-2xl border-2 border-dashed items-end">
                    <div className="grid gap-2">
                        <Label className="font-bold mr-1">السنة</Label>
                        <Select value={year} onValueChange={setYear}>
                            <SelectTrigger className="w-[120px] bg-background rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="font-bold mr-1">الشهر</Label>
                        <Select value={month} onValueChange={setMonth}>
                            <SelectTrigger className="w-[120px] bg-background rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="h-10 px-8 rounded-xl font-black text-base gap-2 shadow-lg shadow-primary/20">
                        {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
                        إنشاء التقرير
                    </Button>
                </div>

                {reportResults ? (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="border rounded-2xl overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-bold">اسم الموظف</TableHead>
                                        <TableHead className="font-bold">القسم</TableHead>
                                        <TableHead className="text-center font-bold">الحضور</TableHead>
                                        <TableHead className="text-center font-bold">الغياب</TableHead>
                                        <TableHead className="text-center font-bold">التأخير</TableHead>
                                        <TableHead className="text-center font-bold">نسبة الالتزام</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportResults.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">لا توجد سجلات حضور للفترة المحددة.</TableCell></TableRow>
                                    ) : (
                                        reportResults.map(item => (
                                            <TableRow key={item.id} className={cn(item.summary.absentDays > 3 && "bg-red-50/50")}>
                                                <TableCell className="font-bold">{item.employeeName}</TableCell>
                                                <TableCell className="text-xs">{item.department}</TableCell>
                                                <TableCell className="text-center font-mono font-black text-green-600">{item.summary.presentDays || 0}</TableCell>
                                                <TableCell className="text-center font-mono font-black text-red-600">{item.summary.absentDays || 0}</TableCell>
                                                <TableCell className="text-center font-mono font-bold text-orange-600">{item.summary.lateDays || 0}</TableCell>
                                                <TableCell className="text-center font-mono font-black">
                                                    {item.attendancePercentage.toFixed(1)}%
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                                <TableFooter className="bg-muted/50 h-16 font-black text-lg">
                                    <TableRow>
                                        <TableCell colSpan={2}>المتوسط الإجمالي:</TableCell>
                                        <TableCell className="text-center font-mono">{totals.totalPresent}</TableCell>
                                        <TableCell className="text-center font-mono text-red-600">{totals.totalAbsent}</TableCell>
                                        <TableCell />
                                        <TableCell className="text-center font-mono text-primary">{totals.overallAttendance.toFixed(1)}%</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-muted/5 opacity-40">
                        <UserCheck className="h-12 w-12 mb-3 text-muted-foreground" />
                        <p className="font-bold text-muted-foreground">يرجى تحديد الشهر والسنة والضغط على "إنشاء التقرير" للمتابعة.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
