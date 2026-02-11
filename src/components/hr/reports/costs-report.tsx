'use client';
import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Employee, Payslip } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useAnalyticalData } from '@/hooks/use-analytical-data';


const payslipTypeColors: Record<string, string> = {
    Monthly: 'bg-transparent',
    Leave: 'bg-sky-100 text-sky-800',
};

const payslipTypeTranslations: Record<string, string> = {
    Monthly: 'راتب شهري',
    Leave: 'راتب إجازة',
};

export function MonthlyCostsReport() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { employees, loading: employeesLoadingFromHook } = useAnalyticalData();
    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    const [searchQuery, setSearchQuery] = useState('');
    
    const payslipsQuery = useMemo(() => {
        if (!firestore) return null;
        return [where('year', '==', parseInt(year)), where('month', '==', parseInt(month))];
    }, [firestore, year, month]);
    const { data: payslips, loading: payslipsLoading } = useSubscription<Payslip>(firestore, 'payroll', payslipsQuery || []);

    const loading = employeesLoadingFromHook || payslipsLoading;
    
    const reportData = useMemo(() => {
        if (!payslips || !employees) return [];
        const employeeMap = new Map(employees.map(e => [e.id, e]));

        const data = payslips.map(p => {
            const employee = employeeMap.get(p.employeeId);
            const totalEarnings = (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0) + (p.earnings.commission || 0);
            const totalDeductions = (p.deductions.absenceDeduction || 0) + (p.deductions.otherDeductions || 0);
            // The net cost to the company is the total gross pay (earnings).
            const netCost = totalEarnings;
            return { 
                ...p,
                employeeName: employee?.fullName || p.employeeName,
                employeeNumber: employee?.employeeNumber || '-',
                department: employee?.department || '-',
                totalEarnings, 
                totalDeductions,
                netCost,
                // Only include if employee is currently active or was terminated this month
                isActiveOrRecent: employee ? (employee.status === 'active' || (employee.status === 'terminated' && toFirestoreDate(employee.terminationDate)?.getMonth() === parseInt(month) - 1)) : false
            };
        });

        if (!searchQuery) return data;
        return data.filter(p => 
            p.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.employeeNumber && p.employeeNumber.includes(searchQuery))
        );
    }, [payslips, employees, searchQuery, month]);
    
    const totals = useMemo(() => {
        const netCostTotal = reportData.reduce((sum, p) => sum + p.netCost, 0);
        return {
            earnings: reportData.reduce((sum, p) => sum + p.totalEarnings, 0),
            deductions: reportData.reduce((sum, p) => sum + p.totalDeductions, 0),
            netCost: netCostTotal,
        };
    }, [reportData]);
    
    const reportDataWithPercentage = useMemo(() => {
        if (totals.netCost === 0) return reportData;
        return reportData.map(p => ({
            ...p,
            costPercentage: (p.netCost / totals.netCost) * 100,
        }));
    }, [reportData, totals.netCost]);


    const handleExcelExport = () => {
        if (!reportDataWithPercentage || reportDataWithPercentage.length === 0) { toast({ title: 'لا توجد بيانات للتصدير' }); return; }
        const dataForSheet = reportDataWithPercentage.map(p => ({
            'الاسم الكامل': p.employeeName,
            'الرقم الوظيفي': p.employeeNumber,
            'القسم': p.department,
            'إجمالي الراتب والبدلات': p.totalEarnings,
            'إجمالي الاستقطاعات': p.totalDeductions,
            'صافي التكلفة على الشركة': p.netCost,
            'نسبة التكلفة': `${p.costPercentage.toFixed(2)}%`,
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `Costs_${year}_${month}`);
        XLSX.writeFile(workbook, `Costs_Report_${year}-${month}.xlsx`);
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <Card>
            <CardHeader><CardTitle>تقرير التكاليف والمصروفات الشهرية</CardTitle><CardDescription>تحليل لتكلفة الموظفين الإجمالية خلال شهر محدد.</CardDescription></CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 mb-4 p-4 bg-muted/50 rounded-lg justify-between items-end">
                    <div className="flex flex-wrap gap-4">
                        <div className="grid gap-2"><Label htmlFor="year-filter-costs">السنة</Label><Select value={year} onValueChange={setYear}><SelectTrigger id="year-filter-costs" className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="month-filter-costs">الشهر</Label><Select value={month} onValueChange={setMonth}><SelectTrigger id="month-filter-costs" className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid gap-2"><Label htmlFor="search">بحث بالاسم</Label><Input id="search" placeholder="ابحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                    </div>
                    <Button variant="outline" onClick={handleExcelExport} disabled={loading || reportDataWithPercentage.length === 0}><Download className="ml-2 h-4"/> تصدير Excel</Button>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>القسم</TableHead><TableHead>إجمالي الراتب والبدلات</TableHead><TableHead>إجمالي الاستقطاعات</TableHead><TableHead>صافي التكلفة</TableHead><TableHead>% من الإجمالي</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading && Array.from({length:5}).map((_,i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportDataWithPercentage.length === 0 && <TableRow><TableCell colSpan={6} className="h-24 text-center">لا توجد بيانات رواتب لهذا الشهر.</TableCell></TableRow>}
                            {!loading && reportDataWithPercentage.map(p => (<TableRow key={p.id}><TableCell className="font-medium"><Link href={`/dashboard/hr/employees/${p.employeeId}`} className="hover:underline">{p.employeeName}</Link></TableCell><TableCell>{p.department}</TableCell><TableCell>{formatCurrency(p.totalEarnings)}</TableCell><TableCell className="text-destructive">{p.totalDeductions > 0 ? `(${formatCurrency(p.totalDeductions)})` : '-'}</TableCell><TableCell className="font-bold">{formatCurrency(p.netCost)}</TableCell><TableCell>{p.costPercentage.toFixed(1)}%</TableCell></TableRow>))}
                        </TableBody>
                         <TableFooter><TableRow className="font-bold text-base bg-muted"><TableCell colSpan={2}>الإجمالي</TableCell><TableCell>{formatCurrency(totals.earnings)}</TableCell><TableCell className="text-destructive">{formatCurrency(totals.deductions)}</TableCell><TableCell>{formatCurrency(totals.netCost)}</TableCell><TableCell>100%</TableCell></TableRow></TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
