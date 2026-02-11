'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';

interface ResourceStats {
  id: string;
  name: string;
  totalProfit: number;
  totalSalary: number;
  netContribution: number;
  projectCount: number;
}

export function ResourceAnalysisReport() {
  const { journalEntries, employees, accounts, transactions, loading } = useAnalyticalData();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

  // IMPROVED: Filter for active employees to avoid including terminated ones in calculations.
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];
    
    const startDate = dateFrom;
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);
    const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

    const engineerStats = new Map<string, ResourceStats>();
    const projectsPerEngineer = new Map<string, Set<string>>();

    activeEmployees.forEach(emp => {
      if (emp.id && emp.jobTitle?.includes('مهندس')) {
        const monthlySalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
        engineerStats.set(emp.id, {
          id: emp.id,
          name: emp.fullName,
          totalProfit: 0,
          totalSalary: monthlySalary * monthsInPeriod,
          netContribution: 0,
          projectCount: 0,
        });
        projectsPerEngineer.set(emp.id, new Set());
      }
    });

    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;
      
      entry.lines.forEach(line => {
        const resourceId = line.auto_resource_id;
        if (!resourceId || !engineerStats.has(resourceId)) return;

        const stats = engineerStats.get(resourceId)!;
        
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

        const profitCenterId = line.auto_profit_center;
        if (profitCenterId) {
            projectsPerEngineer.get(resourceId)?.add(profitCenterId);
        }
      });
    });

    const results: ResourceStats[] = [];
    engineerStats.forEach(stats => {
      stats.netContribution = stats.totalProfit - stats.totalSalary;
      stats.projectCount = projectsPerEngineer.get(stats.id)?.size || 0;
      if (stats.projectCount > 0 || stats.totalSalary > 0) {
        results.push(stats);
      }
    });

    return results.sort((a,b) => b.netContribution - a.netContribution);
  }, [journalEntries, activeEmployees, accounts, loading, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom-res">من تاريخ</Label>
          <DateInput id="dateFrom-res" value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo-res">إلى تاريخ</Label>
          <DateInput id="dateTo-res" value={dateTo} onChange={setDateTo} />
        </div>
      </div>
      
       <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المهندس</TableHead>
                <TableHead className="text-left">إجمالي ربح المشاريع</TableHead>
                <TableHead className="text-left">إجمالي تكلفة الراتب</TableHead>
                <TableHead className="text-left">صافي المساهمة الربحية</TableHead>
                <TableHead className="text-center">عدد المشاريع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 3}).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && reportData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">لا توجد بيانات للفترة المحددة.</TableCell>
                </TableRow>
              )}
              {!loading && reportData.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-left font-mono text-green-600">{formatCurrency(item.totalProfit)}</TableCell>
                  <TableCell className="text-left font-mono text-red-600">({formatCurrency(item.totalSalary)})</TableCell>
                  <TableCell className="text-left font-mono font-bold">{formatCurrency(item.netContribution)}</TableCell>
                  <TableCell className="text-center font-mono">{item.projectCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
    </div>
  );
}
