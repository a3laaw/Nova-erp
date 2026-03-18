'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, isBefore, startOfDay } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, Search, TrendingUp, TrendingDown, Target, User, FileSearch, Printer, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

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

/**
 * تقرير ربحية المشاريع (Profit Center Analysis):
 * يحلل كافة المشاريع كمركز ربحية مستقل بطلب يدوي لضمان ثبات البيانات.
 */
export function ProjectsPnlReport() {
  const { journalEntries, clients, transactions, accounts, employees, departments, loading: dataLoading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportResults, setReportResults] = useState<ProjectPnl[] | null>(null);

  const handleGenerate = () => {
    if (!dateFrom || !dateTo) {
        toast({ variant: 'destructive', title: 'تنبيه', description: 'يرجى تحديد الفترة الزمنية.' });
        return;
    }
    
    setIsGenerating(true);
    
    // محاكاة معالجة البيانات الثقيلة (تثبيت القراءة)
    setTimeout(() => {
        const startDate = startOfDay(dateFrom);
        const endDate = endOfDay(dateTo);

        const pnlMap = new Map<string, any>();
        const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
        const transactionMap = new Map(transactions.map(t => [t.id, t]));

        journalEntries.forEach(entry => {
            const entryDate = entry.date?.toDate();
            if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;

            entry.lines.forEach(line => {
                const profitCenterId = line.auto_profit_center;
                if (!profitCenterId) return;

                const current = pnlMap.get(profitCenterId) || { revenue: 0, directCosts: 0 };
                const account = accounts.find(a => a.id === line.accountId);
                if(!account) return;

                if (account.code.startsWith('4')) {
                    current.revenue += (line.credit || 0) - (line.debit || 0);
                } else if (account.code.startsWith('51')) {
                    current.directCosts += (line.debit || 0) - (line.credit || 0);
                }
                
                pnlMap.set(profitCenterId, current);
            });
        });

        const results: ProjectPnl[] = [];
        pnlMap.forEach((data, transactionId) => {
            const tx = transactionMap.get(transactionId);
            if (!tx) return;

            const profit = data.revenue - data.directCosts;
            const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

            results.push({
                transactionId,
                clientId: tx.clientId,
                clientName: clientMap.get(tx.clientId) || '---',
                projectName: tx.transactionType,
                ...data,
                profit,
                margin
            });
        });

        setReportResults(results.sort((a, b) => b.profit - a.profit));
        setIsGenerating(false);
        toast({ title: 'نجاح الاستخراج', description: 'تم تجميع وتحليل مراكز الربحية للفترة المختارة.' });
    }, 600);
  };

  const finalDisplayData = useMemo(() => {
    if (!reportResults) return [];
    if (!searchQuery) return reportResults;
    const lower = searchQuery.toLowerCase();
    return reportResults.filter(r => r.projectName.toLowerCase().includes(lower) || r.clientName.toLowerCase().includes(lower));
  }, [reportResults, searchQuery]);

  const totals = useMemo(() => {
    if (!finalDisplayData.length) return { revenue: 0, costs: 0, profit: 0 };
    return finalDisplayData.reduce((acc, curr) => ({
        revenue: acc.revenue + curr.revenue,
        costs: acc.costs + curr.directCosts,
        profit: acc.profit + curr.profit
    }), { revenue: 0, costs: 0, profit: 0 });
  }, [finalDisplayData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end bg-muted/30 p-6 rounded-2xl border-2 border-dashed no-print">
        <div className="grid gap-2">
          <Label className="font-black text-xs pr-1">من تاريخ</Label>
          <DateInput value={dateFrom} onChange={setDateFrom} className="bg-white rounded-xl" />
        </div>
        <div className="grid gap-2">
          <Label className="font-black text-xs pr-1">إلى تاريخ</Label>
          <DateInput value={dateTo} onChange={setDateTo} className="bg-white rounded-xl" />
        </div>
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1">بحث سريع</Label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="اسم المشروع أو العميل..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl bg-white border-2" />
            </div>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || dataLoading} className="h-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
            استخراج نتائج مراكز الربحية
        </Button>
      </div>
      
      {reportResults ? (
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-muted/80 backdrop-blur-sm">
                    <TableRow className="h-14 border-b-2">
                        <TableHead className="px-8 font-black text-base text-foreground">مركز الربحية (المشروع)</TableHead>
                        <TableHead className="text-left font-black text-base text-foreground">إجمالي الإيرادات</TableHead>
                        <TableHead className="text-left font-black text-base text-foreground">التكاليف المباشرة</TableHead>
                        <TableHead className="text-left font-black text-base bg-primary/5 text-primary">صافي الربح</TableHead>
                        <TableHead className="text-center font-black text-base text-foreground px-8">الهامش (%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {finalDisplayData.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد بيانات لهذه اللقطة.</TableCell></TableRow>
                    ) : (
                        finalDisplayData.map(item => (
                            <TableRow key={item.transactionId} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                <TableCell className="px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-xl text-primary"><Target className="h-5 w-5"/></div>
                                        <div>
                                            <Link href={`/dashboard/clients/${item.clientId}/transactions/${item.transactionId}`} className="font-black hover:underline text-lg text-slate-900 leading-tight block">
                                                {item.projectName}
                                            </Link>
                                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 mt-1"><User className="h-3 w-3"/> {item.clientName}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-left font-mono font-black text-green-600 text-lg">{formatCurrency(item.revenue)}</TableCell>
                                <TableCell className="text-left font-mono font-bold text-red-600 text-lg">({formatCurrency(item.directCosts)})</TableCell>
                                <TableCell className="text-left font-mono font-black text-2xl bg-primary/[0.02] border-r border-primary/10">
                                    <div className="flex items-center justify-end gap-2 px-2">
                                        {formatCurrency(item.profit)}
                                        {item.profit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500"/> : <TrendingDown className="h-4 w-4 text-red-500"/>}
                                    </div>
                                </TableCell>
                                <TableCell className="px-8 w-48">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-black uppercase">
                                            <span className="text-muted-foreground">نسبة الربحية</span>
                                            <span className={cn(item.margin > 0 ? "text-green-600" : "text-red-600")}>{item.margin.toFixed(1)}%</span>
                                        </div>
                                        <Progress value={Math.max(0, Math.min(100, item.margin))} className="h-2" />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                <TableFooter className="bg-primary/5 h-24">
                    <TableRow className="border-t-4 border-primary/20 hover:bg-transparent">
                        <TableCell className="px-12 font-black text-2xl">إجمالي الأداء للفترة:</TableCell>
                        <TableCell className="text-left font-mono text-xl font-black text-green-700">{formatCurrency(totals.revenue)}</TableCell>
                        <TableCell className="text-left font-mono text-xl font-black text-red-700">({formatCurrency(totals.costs)})</TableCell>
                        <TableCell className="text-left font-mono text-3xl font-black text-primary px-4 border-r border-primary/20">{formatCurrency(totals.profit)}</TableCell>
                        <TableCell className="px-8 text-center"><Badge className="bg-primary px-4 py-1 text-xs font-black rounded-full">مركز ربحية سيادي</Badge></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
            <div className="p-10 bg-muted rounded-full mb-6">
                <BarChart3 className="h-24 w-24 text-muted-foreground" />
            </div>
            <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحليل مراكز الربحية</h3>
            <p className="text-lg font-bold mt-2">حدد الفترة الزمنية واضغط على "استخراج" لرؤية الأداء المالي الحقيقي للمشاريع.</p>
        </div>
      )}
    </div>
  );
}
