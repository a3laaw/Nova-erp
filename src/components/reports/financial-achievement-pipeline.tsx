'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Coins, FileSearch, Loader2, Wallet, 
    ArrowDownLeft, CheckCircle2, TrendingUp, Filter 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * تقرير الموقف المالي والإنجاز (The Revenue Pipeline):
 * يربط (الموقف المالي + الإنجاز الفني للمراحل).
 * تم تحديث المسميات لتناسب البيئة العربية المحترفة.
 */
export function FinancialAchievementPipeline() {
  const { transactions, clients, journalEntries, accounts, loading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportResults] = useState<any[] | null>(null);
  
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all', 'pending', 'paid'

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
        const clientMap = new Map(clients.map(c => [c.id, c.nameAr]));
        const arAccountIds = new Set(accounts.filter(a => a.code.startsWith('1102')).map(a => a.id));

        const results = transactions.filter(tx => !!tx.contract).map(tx => {
            const contract = tx.contract;
            const totalContractValue = contract.totalAmount || 0;
            
            // حساب المحصل الفعلي لهذا المشروع (من واقع القيود)
            const collected = journalEntries
                .filter(e => e.status === 'posted' && e.transactionId === tx.id)
                .flatMap(e => e.lines)
                .filter(l => arAccountIds.has(l.accountId))
                .reduce((sum, l) => sum + (l.credit || 0) - (l.debit || 0), 0);

            // استخراج الدفعة المطلوبة حالياً بناءً على آخر مرحلة منجزة
            const activeMilestone = (contract.clauses || []).find((c: any) => c.status === 'مستحقة');
            
            return {
                id: tx.id,
                clientName: clientMap.get(tx.clientId) || '---',
                txType: tx.transactionType,
                contractValue: totalContractValue,
                collected,
                pendingAmount: Math.max(0, totalContractValue - collected),
                currentMilestone: activeMilestone ? activeMilestone.name : 'لا توجد دفعات معلقة',
                dueNow: activeMilestone ? activeMilestone.amount : 0,
            };
        });

        setReportResults(results);
        setIsGenerating(false);
        toast({ title: 'تم جرد الموقف المالي', description: 'تم تحديث ميزان التدفق والتحصيل للمشاريع.' });
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportData) return [];
    return reportData.filter(item => {
        if (paymentFilter === 'pending') return item.dueNow > 0;
        if (paymentFilter === 'paid') return item.pendingAmount === 0;
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
      <div className="flex justify-between items-end bg-white p-6 rounded-[2rem] border shadow-sm no-print">
        <div className="grid gap-2 w-64">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">فلتر حالة التحصيل</Label>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-10 rounded-xl border-2 font-bold text-[#1e1b4b]"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                    <SelectItem value="all">كل العقود</SelectItem>
                    <SelectItem value="pending">بانتظار التحصيل (دفعات مستحقة)</SelectItem>
                    <SelectItem value="paid">مسدد بالكامل</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || loading} className="h-10 px-12 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20 bg-green-600 hover:bg-green-700">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Coins className="h-5 w-5" />} 
            تحديث ميزان التدفق والتحصيل
        </Button>
      </div>

      {reportData ? (
        <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-slate-900 text-white">
                    <TableRow className="h-14 border-none">
                        <TableHead className="px-8 font-black text-white text-right">العميل والمعاملة</TableHead>
                        <TableHead className="text-left font-black text-white">قيمة العقد</TableHead>
                        <TableHead className="text-left font-black text-white">المحصل فعلياً</TableHead>
                        <TableHead className="text-left font-black text-white bg-green-600/20">المطلوب حالياً</TableHead>
                        <TableHead className="font-black text-white px-8">شرط استحقاق الدفعة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                         <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-black italic">لا توجد حركات مطابقة للفلتر.</TableCell></TableRow>
                    ) : filteredData.map(item => (
                        <TableRow key={item.id} className="h-20 hover:bg-muted/5 transition-colors border-b">
                            <TableCell className="px-8">
                                <p className="font-black text-slate-900 leading-tight">{item.clientName}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{item.txType}</p>
                            </TableCell>
                            <TableCell className="text-left font-mono font-bold text-slate-600">{formatCurrency(item.contractValue)}</TableCell>
                            <TableCell className="text-left font-mono font-black text-green-600">{formatCurrency(item.collected)}</TableCell>
                            <TableCell className="text-left font-mono font-black text-xl text-blue-700 bg-blue-50/30 border-r border-blue-100">
                                {item.dueNow > 0 ? formatCurrency(item.dueNow) : <span className="text-xs text-muted-foreground font-bold italic">لا يوجد مطالبة</span>}
                            </TableCell>
                            <TableCell className="px-8">
                                <Badge variant="secondary" className={cn("px-4 font-black rounded-full", item.dueNow > 0 ? "bg-orange-100 text-orange-700 border-orange-200" : "opacity-30")}>
                                    {item.currentMilestone}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter className="bg-slate-50 h-24">
                    <TableRow className="border-t-4 border-slate-200">
                        <TableCell className="px-12 font-black text-xl text-slate-900">إجمالي الموقف المالي:</TableCell>
                        <TableCell className="text-left font-mono text-lg font-black">{formatCurrency(totals.total)}</TableCell>
                        <TableCell className="text-left font-mono text-lg font-black text-green-700">{formatCurrency(totals.collected)}</TableCell>
                        <TableCell className="text-left font-mono text-2xl font-black text-blue-700 bg-blue-100/50 border-r border-blue-200">{formatCurrency(totals.due)}</TableCell>
                        <TableCell />
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30 grayscale">
            <Coins className="h-20 w-20 text-muted-foreground mb-4" />
            <p className="text-xl font-black">ميزان التحصيل بانتظار التدقيق</p>
        </div>
      )}
    </div>
  );
}
