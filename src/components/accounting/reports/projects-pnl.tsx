'use client';

import React, { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ProjectPnl {
  transactionId: string;
  clientId: string;
  clientName: string;
  projectName: string;
  revenue: number;
  directCosts: number;
  profit: number;
  margin: number;
}

export function ProjectsPnlReport() {
  const { journalEntries, clients, transactions, accounts, employees, departments, loading } = useAnalyticalData();
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [engineerFilter, setEngineerFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');


  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];

    const startDate = dateFrom;
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    const pnlMap = new Map<string, Omit<ProjectPnl, 'transactionId' | 'clientName' | 'projectName'>>();
    
    const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
    const transactionMap = new Map(transactions.map(t => [t.id, { name: t.transactionType, clientId: t.clientId, assignedEngineerId: t.assignedEngineerId }]));

    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;

      entry.lines.forEach(line => {
        const profitCenterId = line.auto_profit_center;
        if (!profitCenterId) return;

        const pnl = pnlMap.get(profitCenterId) || { revenue: 0, directCosts: 0, profit: 0, margin: 0, clientId: '' };
        
        if (!pnl.clientId) {
            const txInfo = transactionMap.get(profitCenterId);
            if(txInfo) pnl.clientId = txInfo.clientId;
        }
        
        const account = accounts.find(a => a.id === line.accountId);
        if(!account) return;

        if (account.code.startsWith('4')) { // Revenue accounts
          pnl.revenue += (line.credit || 0) - (line.debit || 0);
        } else if (account.code.startsWith('51')) { // Direct Cost accounts
          pnl.directCosts += (line.debit || 0) - (line.credit || 0);
        }
        
        pnlMap.set(profitCenterId, pnl);
      });
    });

    let results: ProjectPnl[] = [];
    pnlMap.forEach((data, transactionId) => {
      if (data.revenue === 0 && data.directCosts === 0) return;

      const profit = data.revenue - data.directCosts;
      const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;
      const txInfo = transactionMap.get(transactionId);

      results.push({
        transactionId,
        clientId: data.clientId,
        clientName: clientMap.get(data.clientId) || 'عميل غير معروف',
        projectName: txInfo?.name || 'مشروع غير معروف',
        ...data,
        profit,
        margin,
      });
    });

    if (departmentFilter !== 'all') {
        results = results.filter(item => {
            const tx = transactionMap.get(item.transactionId);
            if (!tx || !tx.assignedEngineerId) return false;
            const engineer = employees.find(e => e.id === tx.assignedEngineerId);
            const dept = departments.find(d => d.name === engineer?.department);
            return dept?.id === departmentFilter;
        });
    }

    if (engineerFilter !== 'all') {
        results = results.filter(item => {
            const tx = transactionMap.get(item.transactionId);
            return tx?.assignedEngineerId === engineerFilter;
        });
    }
    
    if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        results = results.filter(item => 
            item.projectName.toLowerCase().includes(lowerCaseQuery) || 
            item.clientName.toLowerCase().includes(lowerCaseQuery)
        );
    }

    return results.sort((a,b) => b.profit - a.profit);
  }, [journalEntries, clients, transactions, accounts, employees, departments, loading, dateFrom, dateTo, departmentFilter, engineerFilter, searchQuery]);

  const totals = useMemo(() => ({
    revenue: reportData.reduce((sum, item) => sum + item.revenue, 0),
    directCosts: reportData.reduce((sum, item) => sum + item.directCosts, 0),
    profit: reportData.reduce((sum, item) => sum + item.profit, 0),
  }), [reportData]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom">من تاريخ</Label>
          <DateInput id="dateFrom" value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo">إلى تاريخ</Label>
          <DateInput id="dateTo" value={dateTo} onChange={setDateTo} />
        </div>
        <div className="grid gap-2">
            <Label htmlFor="search-project">بحث</Label>
            <Input id="search-project" placeholder="اسم المشروع أو العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <div className="grid gap-2">
            <Label htmlFor="dept-filter">القسم</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}><SelectTrigger id="dept-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الأقسام</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid gap-2">
            <Label htmlFor="eng-filter">المهندس</Label>
            <Select value={engineerFilter} onValueChange={setEngineerFilter}><SelectTrigger id="eng-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المهندسين</SelectItem>{employees.filter(e => e.jobTitle?.includes('مهندس')).map(e => <SelectItem key={e.id} value={e.id!}>{e.fullName}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      
       <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المشروع (العميل)</TableHead>
                <TableHead className="text-left">الإيرادات</TableHead>
                <TableHead className="text-left">التكاليف المباشرة</TableHead>
                <TableHead className="text-left">هامش الربح</TableHead>
                <TableHead className="text-left">النسبة</TableHead>
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
                <TableRow key={item.transactionId}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/clients/${item.clientId}/transactions/${item.transactionId}`} className="hover:underline text-primary">
                        {item.projectName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{item.clientName}</p>
                  </TableCell>
                  <TableCell className="text-left font-mono text-green-600">{formatCurrency(item.revenue)}</TableCell>
                  <TableCell className="text-left font-mono text-red-600">({formatCurrency(item.directCosts)})</TableCell>
                  <TableCell className="text-left font-mono font-bold">{formatCurrency(item.profit)}</TableCell>
                  <TableCell className="text-left font-mono">{item.margin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
             <TableFooter>
                <TableRow className="font-bold text-base">
                    <TableCell>الإجمالي</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(totals.revenue)}</TableCell>
                    <TableCell className="text-left font-mono">({formatCurrency(totals.directCosts)})</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(totals.profit)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
             </TableFooter>
          </Table>
        </div>
    </div>
  );
}
