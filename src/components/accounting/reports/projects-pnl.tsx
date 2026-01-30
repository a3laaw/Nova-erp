'use client';

import React, { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search } from 'lucide-react';
import Link from 'next/link';

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
  const { journalEntries, clients, transactions, loading } = useAnalyticalData();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];

    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    endDate.setHours(23, 59, 59, 999);

    const pnlMap = new Map<string, Omit<ProjectPnl, 'transactionId' | 'clientName' | 'projectName'>>();
    
    const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
    const transactionMap = new Map(transactions.map(t => [t.id, { name: t.transactionType, clientId: t.clientId }]));

    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;

      entry.lines.forEach(line => {
        if (!line.transactionId) return;

        const pnl = pnlMap.get(line.transactionId) || { revenue: 0, directCosts: 0, profit: 0, margin: 0, clientId: '' };
        const txInfo = transactionMap.get(line.transactionId);
        if(txInfo) pnl.clientId = txInfo.clientId;

        if (line.accountName.startsWith('إيراد')) { // simplified check
          pnl.revenue += line.credit - line.debit;
        } else if (line.accountName.startsWith('تكاليف')) { // simplified check
          pnl.directCosts += line.debit - line.credit;
        }
        
        pnlMap.set(line.transactionId!, pnl);
      });
    });

    const results: ProjectPnl[] = [];
    pnlMap.forEach((data, transactionId) => {
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

    return results.sort((a,b) => b.profit - a.profit);
  }, [journalEntries, clients, transactions, loading, dateFrom, dateTo]);

  const totals = useMemo(() => ({
    revenue: reportData.reduce((sum, item) => sum + item.revenue, 0),
    directCosts: reportData.reduce((sum, item) => sum + item.directCosts, 0),
    profit: reportData.reduce((sum, item) => sum + item.profit, 0),
  }), [reportData]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom">من تاريخ</Label>
          <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo">إلى تاريخ</Label>
          <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
