'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];
    
    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    endDate.setHours(23, 59, 59, 999);
    const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

    const transactionMap = new Map(transactions.map(t => [t.id, t]));
    const engineerStats = new Map<string, ResourceStats>();
    const projectsPerEngineer = new Map<string, Set<string>>();

    employees.forEach(emp => {
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

      const transactionId = entry.transactionId;
      if (!transactionId) return;

      const transaction = transactionMap.get(transactionId);
      const resourceId = transaction?.assignedEngineerId;
      if (!resourceId || !engineerStats.has(resourceId)) return;

      const stats = engineerStats.get(resourceId)!;

      entry.lines.forEach(line => {
        const account = accounts.find(a => a.id === line.accountId);
        if(!account) return;

        let profitChange = 0;
        if (account.code.startsWith('4')) { // Revenue
          profitChange = (line.credit || 0) - (line.debit || 0);
        } else if (account.code.startsWith('51')) { // Direct Costs
          profitChange = -((line.debit || 0) - (line.credit || 0));
        }
        
        if (profitChange !== 0) {
            stats.totalProfit += profitChange;
        }
      });
      projectsPerEngineer.get(resourceId)?.add(transactionId);
    });

    const results: ResourceStats[] = [];
    engineerStats.forEach(stats => {
      stats.netContribution = stats.totalProfit - stats.totalSalary;
      stats.projectCount = projectsPerEngineer.get(stats.id)?.size || 0;
      if (stats.projectCount > 0) {
        results.push(stats);
      }
    });

    return results.sort((a,b) => b.netContribution - a.netContribution);
  }, [journalEntries, employees, accounts, transactions, loading, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom-res">من تاريخ</Label>
          <Input id="dateFrom-res" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo-res">إلى تاريخ</Label>
          <Input id="dateTo-res" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
