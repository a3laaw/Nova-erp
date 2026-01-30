'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OverheadItem {
  accountId: string;
  accountName: string;
  accountCode: string;
  totalAmount: number;
}

export function OverheadReport() {
  const { journalEntries, accounts, loading } = useAnalyticalData();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const reportData = useMemo(() => {
    if (loading || !dateFrom || !dateTo) return [];

    const startDate = parseISO(dateFrom);
    const endDate = parseISO(dateTo);
    endDate.setHours(23, 59, 59, 999);

    const overheadMap = new Map<string, OverheadItem>();
    
    journalEntries.forEach(entry => {
      const entryDate = entry.date?.toDate();
      if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;
      
      // If the entry is linked to a project, it's not overhead.
      if (entry.transactionId) {
        return;
      }

      entry.lines.forEach(line => {
        const account = accounts.find(a => a.id === line.accountId);
        // Is it an administrative/general expense (starts with 52, 53, etc.)?
        if (account?.code.startsWith('5') && !account.code.startsWith('51')) {
          const item = overheadMap.get(line.accountId) || { 
            accountId: line.accountId, 
            accountName: account.name,
            accountCode: account.code,
            totalAmount: 0 
          };
          item.totalAmount += (line.debit || 0) - (line.credit || 0);
          overheadMap.set(line.accountId, item);
        }
      });
    });

    return Array.from(overheadMap.values())
        .filter(item => item.totalAmount > 0)
        .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [journalEntries, accounts, loading, dateFrom, dateTo]);
  
  const totalOverhead = useMemo(() => reportData.reduce((sum, item) => sum + item.totalAmount, 0), [reportData]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-muted/50 p-4 rounded-lg">
        <div className="grid gap-2">
          <Label htmlFor="dateFrom-ov">من تاريخ</Label>
          <Input id="dateFrom-ov" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dateTo-ov">إلى تاريخ</Label>
          <Input id="dateTo-ov" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>
      
      <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>كود الحساب</TableHead>
                <TableHead>اسم حساب المصروف</TableHead>
                <TableHead className="text-left">إجمالي المصروف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({length: 3}).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && reportData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center">لا توجد مصاريف عامة في هذه الفترة.</TableCell>
                </TableRow>
              )}
              {!loading && reportData.map(item => (
                <TableRow key={item.accountId}>
                  <TableCell className="font-mono">{item.accountCode}</TableCell>
                  <TableCell className="font-medium">{item.accountName}</TableCell>
                  <TableCell className="text-left font-mono">{formatCurrency(item.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
             <TableFooter>
                <TableRow className="font-bold text-base">
                    <TableCell colSpan={2}>إجمالي المصاريف العامة</TableCell>
                    <TableCell className="text-left font-mono">{formatCurrency(totalOverhead)}</TableCell>
                </TableRow>
             </TableFooter>
          </Table>
        </div>
    </div>
  );
}
