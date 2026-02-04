'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';

interface DepartmentStats {
  id: string;
  name: string;
  totalProfit: number;
  totalSalaries: number;
  netContribution: number;
  projectCount: number;
}

export function DepartmentPerformanceReport() {
  const { journalEntries, employees, accounts, departments, transactions, loading } = useAnalyticalData();
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
    
    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    departments.forEach(dept => {
      deptStats.set(dept.id, { id: dept.id, name: dept.name, totalProfit: 0, totalSalaries: 0, netContribution: 0, projectCount: 0 });
      projectsPerDept.set(dept.id, new Set());
    });
    
    employees.forEach(emp => {
      const dept = departments.find(d => d.name === emp.department);
      if (dept && deptStats.has(dept.id)) {
        const stats = deptStats.get(dept.id)!;
        const monthlySalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
        stats.totalSalaries += monthlySalary * monthsInPeriod;
      }
    });

    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;

      const transactionId = entry.transactionId;
      if (!transactionId) return;

      const transaction = transactionMap.get(transactionId);
      if (!transaction) return;

      const engineer = employeeMap.get(transaction.assignedEngineerId || '');
      if (!engineer || !engineer.department) return;
      
      const department = departments.find(d => d.name === engineer.department);
      if (!department || !deptStats.has(department.id)) return;

      const stats = deptStats.get(department.id)!;

      entry.lines.forEach(line => {
        const account = accounts.find(a => a.id === line.accountId);
        if(!account) return;

        let profitChange = 0;
        if (account.code.startsWith('4')) {
          profitChange = (line.credit || 0) - (line.debit || 0);
        } else if (account.code.startsWith('51')) {
          profitChange = -((line.debit || 0) - (line.credit || 0));
        }
        
        if (profitChange !== 0) {
            stats.totalProfit += profitChange;
        }
      });
      projectsPerDept.get(department.id)?.add(transactionId);
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
  }, [journalEntries, employees, accounts, departments, transactions, loading, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        div className="grid gap-2">
          Label htmlFor="dateFrom-dept">من تاريخLabel>
          DateInput id="dateFrom-dept" value={dateFrom} onChange={setDateFrom} />
        div>
        div className="grid gap-2">
          Label htmlFor="dateTo-dept">إلى تاريخLabel>
          DateInput id="dateTo-dept" value={dateTo} onChange={setDateTo} />
        div>
      div>
      
       div className="border rounded-lg">
          Table>
            TableHeader>
              TableRow>
                TableHead>القسمTableHead>
                TableHead className="text-left">إجمالي ربح المشاريعTableHead>
                TableHead className="text-left">إجمالي تكلفة الرواتبTableHead>
                TableHead className="text-left">صافي المساهمة الربحيةTableHead>
              TableRow>
            TableHeader>
            TableBody>
              {loading && Array.from({length: 3}).map((_, i) => (
                TableRow key={i}>
                  TableCell colSpan={4}>Skeleton className="h-6 w-full" />TableCell>
                TableRow>
              ))}
              {!loading && reportData.length === 0 && (
                TableRow>
                  TableCell colSpan={4} className="h-24 text-center">لا توجد بيانات للفترة المحددة.TableCell>
                TableRow>
              )}
              {!loading && reportData.map(item => (
                TableRow key={item.id}>
                  TableCell className="font-medium">{item.name}TableCell>
                  TableCell className="text-left font-mono text-green-600">{formatCurrency(item.totalProfit)}TableCell>
                  TableCell className="text-left font-mono text-red-600">({formatCurrency(item.totalSalaries)})TableCell>
                  TableCell className="text-left font-mono font-bold">{formatCurrency(item.netContribution)}TableCell>
                TableRow>
              ))}
            TableBody>
          Table>
        div>
    div>
  );
}
