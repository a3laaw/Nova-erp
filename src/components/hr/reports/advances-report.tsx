'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toFirestoreDate } from '@/services/date-converter';

interface OverheadItem {
  accountId: string;
  accountName: string;
  accountCode: string;
  totalAmount: number;
}

export function AdvancesAndDeductionsReport() {
    const { journalEntries, employees, accounts, loading } = useAnalyticalData();
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

    // IMPROVED: Filter for active employees to avoid including terminated ones in calculations
    const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

    const reportData = useMemo(() => {
        if (loading || !activeEmployees.length || !accounts.length) return [];
        
        const startDate = dateFrom;
        const endDate = new Date(dateTo!);
        endDate.setHours(23, 59, 59, 999);

        const employeeMap = new Map(activeEmployees.map(e => [e.id, e]));
        const advancesAccount = accounts.find(a => a.code === '110302'); // سلف الموظفين
        if (!advancesAccount) return [];
        
        const advances = journalEntries.filter(entry => {
            const entryDate = toFirestoreDate(entry.date);
            return entryDate && entryDate >= startDate! && entryDate <= endDate && entry.status === 'posted';
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
            return { ...adv, employeeName: employee?.fullName || 'غير معروف', department: employee?.department || '-' };
        }).sort((a,b) => b.date.getTime() - a.date.getTime());

    }, [journalEntries, activeEmployees, accounts, loading, dateFrom, dateTo]);
    
    const totalAmount = useMemo(() => reportData.reduce((sum, item) => sum + item.amount, 0), [reportData]);
    
    return (
        <Card>
             <CardHeader><CardTitle>تقرير السلف والاستقطاعات</CardTitle><CardDescription>السلف النقدية المقدمة للموظفين خلال الشهر.</CardDescription></CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg mb-4">
                    <div className="grid gap-2"><Label htmlFor="dateFrom-advances">من تاريخ</Label><DateInput id="dateFrom-advances" value={dateFrom} onChange={setDateFrom} /></div>
                    <div className="grid gap-2"><Label htmlFor="dateTo-advances">إلى تاريخ</Label><DateInput id="dateTo-advances" value={dateTo} onChange={setDateTo} /></div>
                </div>
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader><TableRow><TableHead>اسم الموظف</TableHead><TableHead>القسم</TableHead><TableHead>تاريخ السلفة</TableHead><TableHead>البيان</TableHead><TableHead className="text-left">المبلغ</TableHead></TableRow></TableHeader>
                         <TableBody>
                            {loading && Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)}
                            {!loading && reportData.length === 0 && <TableRow><TableCell colSpan={5} className="h-24 text-center">لا توجد سلف أو استقطاعات لهذا الشهر.</TableCell></TableRow>}
                            {!loading && reportData.map(item => (<TableRow key={item.id}><TableCell className="font-medium">{item.employeeName}</TableCell><TableCell>{item.department}</TableCell><TableCell>{format(item.date, 'dd/MM/yyyy')}</TableCell><TableCell className="text-sm text-muted-foreground">{item.reason}</TableCell><TableCell className="text-left font-mono">{formatCurrency(item.amount)}</TableCell></TableRow>))}
                        </TableBody>
                        <TableFooter><TableRow className="font-bold text-base"><TableCell colSpan={4}>إجمالي السلف والاستقطاعات</TableCell><TableCell className="text-left font-mono">{formatCurrency(totalAmount)}</TableCell></TableRow></TableFooter>
                    </Table>
                 </div>
            </CardContent>
        </Card>
    );
}
