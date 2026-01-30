'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DepartmentStats {
  id: string;
  name: string;
  totalProfit: number;
  totalSalaries: number;
  netContribution: number;
  projectCount: number;
}

export function DepartmentPerformanceReport() {
  const { journalEntries, employees, accounts, departments, loading } = useAnalyticalData();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];

    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    endDate.setHours(23, 59, 59, 999);
    const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

    const deptStats = new Map<string, DepartmentStats>();
    const projectsPerDept = new Map<string, Set<string>>();

    departments.forEach(dept => {
      deptStats.set(dept.id, { id: dept.id, name: dept.name, totalProfit: 0, totalSalaries: 0, netContribution: 0, projectCount: 0 });
      projectsPerDept.set(dept.id, new Set());
    });
    
    employees.forEach(emp => {
      const dept = departments.find(d => d.name === emp.department);
      if (dept) {
        const stats = deptStats.get(dept.id)!;
        const monthlySalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
        stats.totalSalaries += monthlySalary * monthsInPeriod;
      }
    });

    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;

      entry.lines.forEach(line => {
        if (!line.auto_dept_id || !deptStats.has(line.auto_dept_id)) return;
        
        const stats = deptStats.get(line.auto_dept_id)!;
        const account = accounts.find(a => a.id === line.accountId);
        if(!account) return;

        let profitChange = 0;
        if (account.code.startsWith('4')) {
          profitChange = line.credit - line.debit;
        } else if (account.code.startsWith('51')) {
          profitChange = -(line.debit - line.credit);
        }
        
        if (profitChange !== 0) {
            stats.totalProfit += profitChange;
        }

        if (line.auto_profit_center) {
            projectsPerDept.get(line.auto_dept_id)?.add(line.auto_profit_center);
        }
      });
    });
    
    const results: DepartmentStats[] = [];
    deptStats.forEach(stats => {
      stats.netContribution = stats.totalProfit - stats.totalSalaries;
      stats.projectCount = projectsPerDept.get(stats.id)?.size || 0;
      if (stats.projectCount > 0 || stats.totalSalaries > 0) {
        results.push(stats);
      }
    });

    return results.sort((a,b) => b.netContribution - a.netContribution);
  }, [journalEntries, employees, accounts, departments, loading, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom-dept">من تاريخ</Label>
          <Input id="dateFrom-dept" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo-dept">إلى تاريخ</Label>
          <Input id="dateTo-dept" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>
      
       <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>القسم</TableHead>
                <TableHead className="text-left">إجمالي ربح المشاريع</TableHead>
                <TableHead className="text-left">إجمالي تكلفة الرواتب</TableHead>
                <TableHead className="text-left">صافي المساهمة الربحية</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 3}).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && reportData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">لا توجد بيانات للفترة المحددة.</TableCell>
                </TableRow>
              )}
              {!loading && reportData.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-left font-mono text-green-600">{formatCurrency(item.totalProfit)}</TableCell>
                  <TableCell className="text-left font-mono text-red-600">({formatCurrency(item.totalSalaries)})</TableCell>
                  <TableCell className="text-left font-mono font-bold">{formatCurrency(item.netContribution)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}
