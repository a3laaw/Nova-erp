'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isBefore, startOfDay } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search, TrendingUp, TrendingDown, Target, User } from 'lucide-react';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

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

  // الرقابة المنطقية: تعديل تاريخ النهاية آلياً إذا كان قبل البداية
  useEffect(() => {
    if (dateFrom && dateTo && isBefore(startOfDay(dateTo), startOfDay(dateFrom))) {
        setDateTo(dateFrom);
    }
  }, [dateFrom, dateTo]);

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

        // 4xxx: Revenue (Credits increase profit)
        // 51xx: Direct Operating Costs (Debits decrease profit)
        if (account.code.startsWith('4')) {
          pnl.revenue += (line.credit || 0) - (line.debit || 0);
        } else if (account.code.startsWith('51')) {
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

    // Filters...
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-muted/30 p-6 rounded-2xl border border-primary/10">
        <div className="grid gap-2">
          <Label className="font-bold text-xs">من تاريخ</Label>
          <DateInput value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="grid gap-2">
          <Label className="font-bold text-xs">إلى تاريخ</Label>
          <DateInput value={dateTo} onChange={setDateTo} />
        </div>
        <div className="grid gap-2">
            <Label className="font-bold text-xs">بحث سريع</Label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="المشروع أو العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 rounded-xl" />
            </div>
        </div>
        <div className="grid gap-2">
            <Label className="font-bold text-xs">القسم</Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل الأقسام</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
        </div>
        <div className="grid gap-2">
            <Label className="font-bold text-xs">المهندس</Label>
            <Select value={engineerFilter} onValueChange={setEngineerFilter}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">كل المهندسين</SelectItem>{employees.filter(e => e.jobTitle?.includes('مهندس')).map(e => <SelectItem key={e.id} value={e.id!}>{e.fullName}</SelectItem>)}</SelectContent>
            </Select>
        </div>
      </div>
      
       <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
          <Table>
            <TableHeader className="bg-muted/80 backdrop-blur-sm">
              <TableRow className="h-14 border-b-2">
                <TableHead className="px-6 font-black text-base">المشروع والعميل</TableHead>
                <TableHead className="text-left font-black text-base">إجمالي الإيرادات</TableHead>
                <TableHead className="text-left font-black text-base">التكاليف المباشرة</TableHead>
                <TableHead className="text-left font-black text-base bg-primary/5 text-primary">صافي الربح</TableHead>
                <TableHead className="text-center font-black text-base">هامش الربح (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-16 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : reportData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-40">
                        <Target className="h-12 w-12" />
                        <p className="font-bold">لا توجد حركات مالية مسجلة على المشاريع للفترة المختارة.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map(item => (
                    <TableRow key={item.transactionId} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0">
                    <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Target className="h-5 w-5"/></div>
                            <div>
                                <Link href={`/dashboard/clients/${item.clientId}/transactions/${item.transactionId}`} className="font-black hover:underline text-lg">
                                    {item.projectName}
                                </Link>
                                <p className="text-xs font-bold text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/> {item.clientName}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-left font-mono font-black text-green-600 text-lg">{formatCurrency(item.revenue)}</TableCell>
                    <TableCell className="text-left font-mono font-bold text-red-600 text-lg">({formatCurrency(item.directCosts)})</TableCell>
                    <TableCell className="text-left font-mono font-black text-xl bg-primary/[0.02] border-r border-primary/10">
                        <div className="flex items-center justify-end gap-2">
                            {formatCurrency(item.profit)}
                            {item.profit > 0 ? <TrendingUp className="h-4 w-4 text-green-500"/> : <TrendingDown className="h-4 w-4 text-red-500"/>}
                        </div>
                    </TableCell>
                    <TableCell className="px-6">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-black uppercase">
                                <span>الربحية</span>
                                <span>{item.margin.toFixed(1)}%</span>
                            </div>
                            <Progress value={item.margin} className="h-2" color={item.margin > 20 ? 'bg-green-500' : 'bg-orange-500'} />
                        </div>
                    </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
             <TableFooter className="bg-primary/5">
                <TableRow className="h-24 border-t-4 border-primary/20 font-black text-xl hover:bg-transparent">
                    <TableCell className="px-12">إجمالي الأداء للمشاريع المختارة:</TableCell>
                    <TableCell className="text-left font-mono text-green-700">{formatCurrency(totals.revenue)}</TableCell>
                    <TableCell className="text-left font-mono text-red-700">({formatCurrency(totals.directCosts)})</TableCell>
                    <TableCell className="text-left font-mono text-3xl text-primary bg-primary/5 px-6 border-r">{formatCurrency(totals.profit)}</TableCell>
                    <TableCell />
                </TableRow>
             </TableFooter>
          </Table>
        </div>
    </div>
  );
}