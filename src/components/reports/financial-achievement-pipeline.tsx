'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    Coins, FileSearch, Loader2, Wallet, 
    ArrowDownLeft, CheckCircle2, TrendingUp, Filter, Building2, User, Clock, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';
import { startOfDay, endOfDay, isWithinInterval, differenceInDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

/**
 * تقرير ميزان التحصيل والتدفق المالي (v2.0):
 * - تلوين التقادم المالي (Aging).
 * - عداد أيام الانتظار.
 * - تصنيف مديونيات "تحت التحصيل".
 */
export function FinancialAchievementPipeline() {
  const { transactions, clients, journalEntries, accounts, loading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportResults] = useState<any[] | null>(null);
  
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
        const now = new Date();
        const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
        const arAccountIds = new Set(accounts.filter(a => a.code.startsWith('1102')).map(a => a.id));
        const start = dateFrom ? startOfDay(dateFrom) : null;
        const end = dateTo ? endOfDay(dateTo) : null;

        const results = transactions.filter(tx => {
            if (!tx.contract) return false;
            const createdAt = toFirestoreDate(tx.createdAt);
            if (!createdAt) return true;
            if (start && end) return isWithinInterval(createdAt, { start, end });
            return true;
        }).map(tx => {
            const contract = tx.contract;
            const totalContractValue = contract.totalAmount || 0;
            
            const collected = journalEntries
                .filter(e => e.status === 'posted' && e.transactionId === tx.id)
                .flatMap(e => e.lines)
                .filter(l => arAccountIds.has(l.accountId))
                .reduce((sum, l) => sum + (l.credit || 0) - (l.debit || 0), 0);

            const activeMilestone = (contract.clauses || []).find((c: any) => c.status === 'مستحقة');
            const pendingAmount = Math.max(0, totalContractValue - collected);
            
            // حساب التقادم (أيام منذ آخر تحديث أو استحقاق)
            const lastUpdate = toFirestoreDate(tx.updatedAt || tx.createdAt) || now;
            const agingDays = differenceInDays(now, lastUpdate);
            
            return {
                id: tx.id,
                clientName: clientMap.get(tx.clientId) || '---',
                txType: tx.transactionType,
                contractValue: totalContractValue,
                collected,
                pendingAmount,
                currentMilestone: activeMilestone ? activeMilestone.name : 'لا توجد دفعات مستحقة',
                dueNow: activeMilestone ? activeMilestone.amount : 0,
                agingDays,
                status: tx.status
            };
        });

        setReportResults(results);
        setIsGenerating(false);
        toast({ title: 'نجاح', description: 'تم تحديث ميزان التحصيل المالي والتقادم.' });
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportData) return [];
    return reportData.filter(item => {
        if (paymentFilter === 'pending') return item.dueNow > 0;
        if (paymentFilter === 'paid') return item.pendingAmount === 0;
        if (paymentFilter === 'critical') return item.dueNow > 0 && item.agingDays > 60;
        return true;
    });
  }, [reportData, paymentFilter]);

  const totals = useMemo(() => {
    if (!filteredData.length) return { total: 0, collected: 0, due: 0 };
    return filteredData.reduce((acc, curr) => ({
        total: acc.total + curr.contractValue,
        collected: acc.collected + curr.collected,
        due: acc.due + curr.dueNow
    }), { total: 0, collected: 0, due: 0 });
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-white p-8 rounded-[2.5rem] border shadow-sm no-print">
        <div className="lg:col-span-2 grid gap-2">
            <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">من تاريخ التوقيع</Label>
            <DateInput value={dateFrom} onChange={setDateFrom} className="h-10 rounded-xl border-2" />
        </div>
        <div className="lg:col-span-2 grid gap-2">
            <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">إلى تاريخ التوقيع</Label>
            <DateInput value={dateTo} onChange={setDateTo} className="h-10 rounded-xl border-2" />
        </div>
        <div className="lg:col-span-3 grid gap-2">
            <Label className="font-black text-[10px] text-slate-500 uppercase tracking-widest">نطاق المراجعة</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[#1e1b4b]"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                    <SelectItem value="all">كل العقود والمطالبات</SelectItem>
                    <SelectItem value="pending">المستحق للتحصيل فوراً</SelectItem>
                    <SelectItem value="critical" className="text-red-600 font-bold">⚠️ متأخرات حرجة (60+ يوم)</SelectItem>
                    <SelectItem value="paid">العقود المسددة بالكامل</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="lg:col-span-2" />
        <div className="lg:col-span-3">
            <Button onClick={handleGenerate} disabled={isGenerating || loading} className="w-full h-12 rounded-xl font-black text-lg gap-2 shadow-xl bg-green-600 hover:bg-green-700 text-white transition-all active:translate-y-1">
                {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Coins className="h-5 w-5" />} 
                تحديث ميزان التحصيل
            </Button>
        </div>
      </div>

      {reportData ? (
        <Card className="rounded-[2.5rem] overflow-hidden border-none shadow-xl bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-slate-900 text-white">
                    <TableRow className="h-14 border-none">
                        <TableHead className="px-8 font-black text-white text-right">العميل والمعاملة</TableHead>
                        <TableHead className="text-left font-black text-white">قيمة العقد</TableHead>
                        <TableHead className="text-left font-black text-white">المحصل</TableHead>
                        <TableHead className="text-left font-black text-white bg-green-600/20">المطلوب تحصيله</TableHead>
                        <TableHead className="text-center font-black text-white">التقادم (أيام)</TableHead>
                        <TableHead className="font-black text-white px-8">شرط الدفعة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد نتائج مطابقة.</TableCell></TableRow>
                    ) : filteredData.map(item => (
                        <TableRow key={item.id} className={cn("h-20 hover:bg-muted/5 border-b transition-colors", item.dueNow > 0 && item.agingDays > 60 && "bg-red-50/50")}>
                            <TableCell className="px-8">
                                <p className="font-black text-slate-900 text-lg leading-tight">{item.clientName}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{item.txType}</p>
                            </TableCell>
                            <TableCell className="text-left font-mono font-bold">{formatCurrency(item.contractValue)}</TableCell>
                            <TableCell className="text-left font-mono font-black text-green-600">{formatCurrency(item.collected)}</TableCell>
                            <TableCell className="text-left font-mono font-black text-2xl text-blue-700 bg-blue-50/30 border-r border-blue-100">
                                {item.dueNow > 0 ? formatCurrency(item.dueNow) : <span className="text-[10px] text-muted-foreground italic px-2">لا يوجد مطالبة</span>}
                            </TableCell>
                            <TableCell className="text-center">
                                {item.dueNow > 0 ? (
                                    <Badge variant="outline" className={cn(
                                        "font-mono font-black px-4",
                                        item.agingDays > 60 ? "bg-red-600 text-white border-none animate-pulse" : 
                                        item.agingDays > 30 ? "bg-orange-100 text-orange-700 border-orange-200" : 
                                        "bg-green-50 text-green-700 border-green-200"
                                    )}>
                                        {item.agingDays} يوم
                                    </Badge>
                                ) : '-'}
                            </TableCell>
                            <TableCell className="px-8">
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className={cn("px-4 font-bold rounded-full", item.dueNow > 0 ? "bg-blue-100 text-blue-700 border-blue-200" : "opacity-30")}>
                                        {item.currentMilestone}
                                    </Badge>
                                    {item.dueNow > 0 && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50 no-print" title="إرسال تذكير للعميل">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter className="bg-slate-50 h-24">
                    <TableRow className="border-t-4 border-slate-200">
                        <TableCell className="px-12 font-black text-2xl">إجمالي ميزان التحصيل:</TableCell>
                        <TableCell className="text-left font-mono text-lg">{formatCurrency(totals.total)}</TableCell>
                        <TableCell className="text-left font-mono text-lg text-green-700">{formatCurrency(totals.collected)}</TableCell>
                        <TableCell className="text-left font-mono text-3xl font-black text-blue-700 border-r border-blue-200">{formatCurrency(totals.due)}</TableCell>
                        <TableCell colSpan={2} />
                    </TableRow>
                </TableFooter>
            </Table>
        </Card>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
            <div className="p-10 bg-muted rounded-full mb-6">
                <Coins className="h-20 w-20 text-muted-foreground" />
            </div>
            <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحديث ميزان التحصيل</h3>
            <p className="text-lg font-bold mt-2">استخرج التقرير لرصد التدفقات النقدية المتوقعة وتقادم المديونيات.</p>
        </div>
      )}
    </div>
  );
}
