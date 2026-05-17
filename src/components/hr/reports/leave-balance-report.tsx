'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { where } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Printer, FileDown, AlertTriangle, Clock } from 'lucide-react';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * تقرير أرصدة الإجازات المطور (v2.0):
 * - عرض مرئي للأرصدة (Progress Bars).
 * - توقع نفاد الرصيد.
 * - تصدير مسودة الرواتب الشاملة.
 */
export function LeaveBalanceReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', [where('status', '==', 'active')]);
    const [balanceFilter, setBalanceFilter] = useState('all');

    const employeeLeaveBalances = useMemo(() => {
        if (!employees) return [];
        return employees.map(emp => {
            const balance = calculateAnnualLeaveBalance(emp, new Date());
            const used = emp.annualLeaveUsed || 0;
            const total = (emp.annualLeaveAccrued || 0) + (emp.carriedLeaveDays || 0);
            const usageRate = total > 0 ? (used / total) * 100 : 0;
            
            return {
                ...emp,
                leaveBalance: balance,
                usageRate,
                isCritical: balance < 5,
                isHigh: balance > 30, // تراكم خطير للشركة
            };
        }).sort((a,b) => a.leaveBalance - b.leaveBalance);
    }, [employees]);

    const filteredEmployees = useMemo(() => {
        if (balanceFilter === 'all') return employeeLeaveBalances;
        const limit = parseInt(balanceFilter, 10);
        if (limit === 999) return employeeLeaveBalances.filter(e => e.isHigh);
        return employeeLeaveBalances.filter(emp => emp.leaveBalance < limit);
    }, [employeeLeaveBalances, balanceFilter]);

    const handleExportForPayroll = () => {
        const data = employeeLeaveBalances.map(emp => ({
            'الرقم الوظيفي': emp.employeeNumber,
            'اسم الموظف': emp.fullName,
            'القسم': emp.department,
            'الرصيد المتبقي': emp.leaveBalance,
            'حالة الرصيد': emp.isCritical ? 'منخفض' : emp.isHigh ? 'متراكم (تنبيه)' : 'طبيعي'
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "مسودة الرواتب");
        XLSX.writeFile(wb, `Leave_Balance_Report_${new Date().getMonth()+1}.xlsx`);
        toast({ title: 'نجاح التصدير', description: 'تم إنشاء ملف مسودة الرواتب بنجاح.' });
    };

    return (
        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-8 border-b">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <CardTitle className="text-2xl font-black flex items-center gap-2">
                            <Clock className="text-primary" /> ميزان أرصدة الإجازات والالتزامات الزمنية
                        </CardTitle>
                        <CardDescription className="text-base font-medium">مراقبة استهلاك الأرصدة وتنبيهات التراكم المالي الكبير.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportForPayroll} className="rounded-xl font-bold gap-2 border-green-600 text-green-700 hover:bg-green-50">
                            <FileDown className="h-4 w-4" /> تصدير للرواتب (Excel)
                        </Button>
                        <Button variant="outline" onClick={() => window.print()} className="rounded-xl font-bold gap-2"><Printer className="h-4 w-4"/> طباعة</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                <div className="flex items-center gap-6 mb-8 p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed">
                    <div className="grid gap-2">
                        <Label className="font-black text-xs pr-1">تصفية حسب سعة الرصيد:</Label>
                        <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                            <SelectTrigger className="w-[200px] h-11 rounded-xl bg-white border-2 font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="all">كل الموظفين</SelectItem>
                                <SelectItem value="10">رصيد أقل من 10 أيام</SelectItem>
                                <SelectItem value="5">رصيد منخفض جداً (أقل من 5)</SelectItem>
                                <SelectItem value="999">الموظفون بتراكم (30+ يوم)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"/> <span className="text-[10px] font-bold">كافٍ</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400"/> <span className="text-[10px] font-bold">منخفض</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600"/> <span className="text-[10px] font-bold">نافد</span></div>
                    </div>
                </div>

                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="px-8 font-black">الموظف</TableHead>
                                <TableHead className="font-black text-center">الرصيد المرحل</TableHead>
                                <TableHead className="font-black text-center">المكتسب</TableHead>
                                <TableHead className="font-black text-center">المستهلك</TableHead>
                                <TableHead className="w-64 font-black">حالة الرصيد المتبقي</TableHead>
                                <TableHead className="text-center font-black">توقع النفاد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 4}).map((_, i) => ( <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-14 w-full" /></TableCell></TableRow> ))
                            ) : filteredEmployees.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد بيانات مطابقة لهذه العتبة.</TableCell></TableRow>
                            ) : (
                                filteredEmployees.map(emp => (
                                    <TableRow key={emp.id} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                        <TableCell className="px-8">
                                            <div className="font-black text-slate-900">{emp.fullName}</div>
                                            <div className="text-[10px] text-muted-foreground font-bold">{emp.department} • {emp.employeeNumber}</div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-bold opacity-60">{emp.carriedLeaveDays || 0}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-primary">{emp.annualLeaveAccrued || 0}</TableCell>
                                        <TableCell className="text-center font-mono font-bold text-red-600">{emp.annualLeaveUsed || 0}</TableCell>
                                        <TableCell className="px-4">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between text-[10px] font-black uppercase">
                                                    <span className={cn(emp.leaveBalance < 5 ? "text-red-600" : "text-green-600")}>{emp.leaveBalance} يوم متبقي</span>
                                                    <span className="text-muted-foreground">{emp.usageRate.toFixed(0)}% مستخدم</span>
                                                </div>
                                                <Progress value={100 - emp.usageRate} className={cn("h-2", emp.leaveBalance < 5 ? "bg-red-100" : "bg-green-100")} />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {emp.leaveBalance < 5 ? (
                                                <Badge variant="destructive" className="font-black text-[9px] gap-1"><AlertTriangle className="h-3 w-3"/> حرج</Badge>
                                            ) : emp.isHigh ? (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-black text-[9px]">تراكم (30+)</Badge>
                                            ) : (
                                                <span className="text-[10px] font-bold text-muted-foreground">آمن</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/10 p-4 border-t flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Nova ERP — Automated Leave Liability Tracking</span>
                <span>تاريخ التقرير: {format(new Date(), 'PPpp', { locale: ar })}</span>
            </CardFooter>
        </Card>
    );
}
