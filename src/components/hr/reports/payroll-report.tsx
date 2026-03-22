'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Employee, Payslip } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Download, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

const statusColors: Record<string, string> = { draft: 'bg-yellow-100 text-yellow-800', processed: 'bg-blue-100 text-blue-800', paid: 'bg-green-100 text-green-800' };
const statusTranslations: Record<string, string> = { draft: 'مسودة', processed: 'تمت المعالجة', paid: 'مدفوع' };
const payslipTypeColors: Record<string, string> = { Monthly: 'bg-transparent', Leave: 'bg-sky-100 text-sky-800' };
const payslipTypeTranslations: Record<string, string> = { Monthly: 'راتب شهري', Leave: 'راتب إجازة' };

export function MonthlyPayrollReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    const [searchQuery, setSearchQuery] = useState('');
                        
    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
                                
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [payslipsLoading, setPayslipsLoading] = useState(false);
                                        
    useEffect(() => {
        if (!firestore) return;
        const fetch = async () => {
            setPayslipsLoading(true);
            try {
                const snap = await getDocs(query(
                    collection(firestore, 'payroll'),
                    where('year', '==', parseInt(year)),
                    where('month', '==', parseInt(month))
                ));
                setPayslips(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payslip)));
            } catch (e) {
                console.error(e);
            } finally {
                setPayslipsLoading(false);
            }
        };
        fetch();
    }, [firestore, year, month]);
                                                                                                                                                                                                                                                                                        
    const loading = employeesLoading || payslipsLoading;
                                                                                                                                                                                                                                                                                                
    const reportData = useMemo(() => {
        if (!payslips || !employees) return [];
        const filtered = payslips.filter(p => p.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()));
        return filtered.map(p => {
            const totalEarnings = (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0) + (p.earnings.commission || 0);
            const totalDeductions = (p.deductions.absenceDeduction || 0) + (p.deductions.lateDeduction || 0) + (p.deductions.otherDeductions || 0);
            return { ...p, totalEarnings, totalDeductions };
        }).sort((a,b) => a.employeeName.localeCompare(b.employeeName, 'ar'));
    }, [payslips, employees, searchQuery]);
                                                                                                                                                                                                                                                                                                                                                                            
    const totals = useMemo(() => ({
        earnings: reportData.reduce((sum, p) => sum + p.totalEarnings, 0),
        deductions: reportData.reduce((sum, p) => sum + p.totalDeductions, 0),
        net: reportData.reduce((sum, p) => sum + p.netSalary, 0),
    }), [reportData]);
                                                                                                                                                                                                                                                                                                                                                                                                            
    const handleExcelExport = () => {
        if (!reportData || reportData.length === 0) { toast({ title: 'لا توجد بيانات للتصدير' }); return; }
        const dataForSheet = reportData.map(p => ({
            'اسم الموظف': p.employeeName, 'نوع الكشف': payslipTypeTranslations[p.type || 'Monthly'],
            'إجمالي الاستحقاقات': p.totalEarnings, 'إجمالي الاستقطاعات': p.totalDeductions,
            'صافي الراتب': p.netSalary, 'الحالة': statusTranslations[p.status],
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Payslips_${year}_${month}`);
        XLSX.writeFile(workbook, `Payroll_${year}-${month}.xlsx`);
    };
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            
    return (
        <Card>
            <CardHeader><CardTitle>تقرير الرواتب الشهري</CardTitle><CardDescription>ملخص لجميع كشوفات الرواتب التي تم إنشاؤها للشهر المحدد.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg justify-between items-end">
                    <div className="flex flex-wrap gap-4">
                        <div className="grid gap-2"><Label htmlFor="year-filter-payroll">السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger id="year-filter-payroll" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="month-filter-payroll">الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger id="month-filter-payroll" className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="search">بحث بالاسم</Label><Input id="search" placeholder="ابحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                    </div>
                    <Button variant="outline" onClick={handleExcelExport} disabled={loading || reportData.length === 0}><Download className="ml-2 h-4"/> تصدير Excel</Button>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>الاستحقاقات</TableHead><TableHead>الاستقطاعات</TableHead><TableHead>الصافي</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات رواتب لهذا الشهر.</TableCell></TableRow>}
                            {!loading && reportData.map(p => (<TableRow key={p.id}><TableCell className="font-medium">{p.employeeName}</TableCell><TableCell><Badge variant="outline" className={payslipTypeColors[p.type || 'Monthly']}>{payslipTypeTranslations[p.type || 'Monthly']}</Badge></TableCell><TableCell>{formatCurrency(p.totalEarnings)}</TableCell><TableCell className="text-destructive">{formatCurrency(p.totalDeductions)}</TableCell><TableCell className="font-bold">{formatCurrency(p.netSalary)}</TableCell><TableCell><Badge variant="outline" className={statusColors[p.status]}>{statusTranslations[p.status]}</Badge></TableCell></TableRow>))}
                        </TableBody>
                        <TableFooter><TableRow className="font-bold text-base bg-muted"><TableCell colSpan={2}>الإجمالي</TableCell><TableCell>{formatCurrency(totals.earnings)}</TableCell><TableCell className="text-destructive">{formatCurrency(totals.deductions)}</TableCell><TableCell>{formatCurrency(totals.net)}</TableCell><TableCell></TableCell></TableRow></TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
