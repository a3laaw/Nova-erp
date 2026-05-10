'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Search, FileSearch, Loader2, Sparkles, Building2, 
    ArrowUpRight, ShoppingBag, FileCheck, Target, Calculator, UserPlus
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format } from 'date-fns';

/**
 * تقرير رصد فرص النمو والتحول (v2.0):
 * - تقدير القيمة المالية المتوقعة للفرصة.
 * - زر تحويل لطلب متابعة Lead.
 * - تحليل التقارب من إغلاق التراخيص.
 */
const LICENSING_KEYWORDS = ['بلدية', 'رخصة', 'تراخيص'];
const DESIGN_KEYWORDS = ['معماري', 'تصميم'];
const ALL_SERVICES = ['إشراف', 'واجهات', 'صحي', 'كهرباء', 'إنشائي'];

const ESTIMATED_VALUES: Record<string, number> = {
    'contracting': 45000, // متوسط عقد تنفيذ
    'upsell': 1500, // متوسط خدمة إضافية
};

export function GrowthOpportunitiesReport() {
  const { transactions, clients, loading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportResults, setReportResults] = useState<any[] | null>(null);
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState('');

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
        const start = startOfDay(dateFrom || new Date());
        const end = endOfDay(dateTo || new Date());

        const clientMap = new Map(clients.map(c => [c.id, c]));
        const clientTxs = new Map<string, any[]>();
        
        transactions.forEach(tx => {
            if (!clientTxs.has(tx.clientId)) clientTxs.set(tx.clientId, []);
            clientTxs.get(tx.clientId)!.push(tx);
        });

        const opportunities: any[] = [];

        clientTxs.forEach((txs, cid) => {
            const client = clientMap.get(cid);
            if (!client) return;

            const completedLicenses = txs.filter(tx => 
                (tx.status === 'completed' || tx.status === 'submitted') &&
                LICENSING_KEYWORDS.some(k => tx.transactionType.includes(k)) &&
                isWithinInterval(toFirestoreDate(tx.updatedAt || tx.createdAt) || new Date(), { start, end })
            );

            const completedDesigns = txs.filter(tx => 
                (tx.status === 'completed' || tx.status === 'submitted') &&
                DESIGN_KEYWORDS.some(k => tx.transactionType.includes(k)) &&
                !LICENSING_KEYWORDS.some(k => tx.transactionType.includes(k)) &&
                isWithinInterval(toFirestoreDate(tx.updatedAt || tx.createdAt) || new Date(), { start, end })
            );

            if (completedLicenses.length > 0) {
                const hasContracting = txs.some(tx => tx.transactionType.includes('مقاولات') || tx.transactionType.includes('تنفيذ'));
                if (!hasContracting) {
                    opportunities.push({
                        id: `growth-${cid}`,
                        clientName: client.nameAr,
                        clientId: cid,
                        trigger: 'إتمام التراخيص',
                        triggerDate: completedLicenses[0].updatedAt,
                        recommendation: 'عقد مقاولات / تنفيذ',
                        type: 'contracting',
                        severity: 'high',
                        estValue: ESTIMATED_VALUES.contracting
                    });
                }
            }

            if (completedDesigns.length > 0) {
                const existingServices = txs.map(tx => tx.transactionType);
                const missing = ALL_SERVICES.filter(s => !existingServices.some(es => es.includes(s)));
                
                if (missing.length > 0) {
                    opportunities.push({
                        id: `upsell-${cid}`,
                        clientName: client.nameAr,
                        clientId: cid,
                        trigger: 'إتمام المخططات المعمارية',
                        triggerDate: completedDesigns[0].updatedAt,
                        recommendation: `تقديم خدمات: ${missing.join('، ')}`,
                        type: 'upsell',
                        severity: 'medium',
                        missingCount: missing.length,
                        estValue: missing.length * ESTIMATED_VALUES.upsell
                    });
                }
            }
        });

        setReportResults(opportunities.sort((a,b) => (b.estValue - a.estValue)));
        setIsGenerating(false);
        toast({ title: 'نجاح', description: 'تم جرد فرص النمو وتقدير قيمتها السوقية.' });
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportResults) return [];
    if (!searchQuery) return reportResults;
    const lower = searchQuery.toLowerCase();
    return reportResults.filter(r => r.clientName.toLowerCase().includes(lower));
  }, [reportResults, searchQuery]);

  const totalPotentialValue = useMemo(() => 
    filteredData.reduce((sum, i) => sum + i.estValue, 0)
  , [filteredData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white p-6 rounded-[2rem] border shadow-sm no-print">
        <div className="grid gap-2">
            <Label className="font-bold text-xs text-slate-500 uppercase">من تاريخ الإنجاز</Label>
            <DateInput value={dateFrom} onChange={setDateFrom} className="h-10 rounded-xl border-2" />
        </div>
        <div className="grid gap-2">
            <Label className="font-bold text-xs text-slate-500 uppercase">إلى تاريخ الإنجاز</Label>
            <DateInput value={dateTo} onChange={setDateTo} className="h-10 rounded-xl border-2" />
        </div>
        <div className="grid gap-2">
            <Label className="font-bold text-xs text-slate-500 uppercase">بحث باسم العميل</Label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl border-2 font-bold" />
            </div>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || loading} className="h-10 rounded-xl font-bold text-base gap-2 shadow-lg shadow-primary/20 bg-amber-600 hover:bg-amber-700 text-white">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />} 
            رصد فرص النمو
        </Button>
      </div>

      {reportResults ? (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-slate-900 text-white">
                    <TableRow className="h-14 border-none">
                        <TableHead className="px-8 font-black text-white text-right">العميل المستهدف</TableHead>
                        <TableHead className="font-black text-white">الإنجاز السابق</TableHead>
                        <TableHead className="font-black text-white">القيمة المتوقعة</TableHead>
                        <TableHead className="font-black text-white bg-amber-500/20">الإجراء المقترح</TableHead>
                        <TableHead className="font-black text-white text-left px-8">المتابعة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد فرص مرصودة حالياً.</TableCell></TableRow>
                    ) : (
                        filteredData.map(item => (
                            <TableRow key={item.id} className="h-20 hover:bg-muted/5 border-b group">
                                <TableCell className="px-8">
                                    <Link href={`/dashboard/clients/${item.clientId}`} className="font-bold text-slate-900 text-lg hover:underline flex items-center gap-2">
                                        {item.clientName}
                                        <ArrowUpRight className="h-4 w-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                            {item.type === 'contracting' ? <FileCheck className="h-4 w-4 text-green-600" /> : <Calculator className="h-4 w-4 text-blue-600" />}
                                            {item.trigger}
                                        </div>
                                        <span className="text-[10px] opacity-40 font-mono">{toFirestoreDate(item.triggerDate) ? format(toFirestoreDate(item.triggerDate)!, 'dd/MM/yyyy') : '-'}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono font-black text-primary">
                                    {formatCurrency(item.estValue)}
                                </TableCell>
                                <TableCell className="bg-amber-50/30 border-r border-amber-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shadow-inner"><Target className="h-4 w-4"/></div>
                                        <span className="font-black text-amber-900">{item.recommendation}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-left px-8">
                                    <Button variant="outline" size="sm" className="rounded-xl font-bold h-9 gap-2 border-primary/20 text-primary hover:bg-primary hover:text-white" asChild>
                                        <Link href={`/dashboard/appointments/new?clientId=${item.clientId}&nameAr=${encodeURIComponent(item.clientName)}`}>
                                            <UserPlus className="h-4 w-4"/> تحويل لمتابعة
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
                <TableFooter className="bg-amber-50 h-24 border-t-4 border-amber-200">
                    <TableRow>
                        <TableCell colSpan={2} className="px-12 font-black text-2xl text-amber-900">إجمالي القيمة السوقية للفرص:</TableCell>
                        <TableCell className="text-left font-mono text-3xl font-black text-amber-700" colSpan={3}>
                            {formatCurrency(totalPotentialValue)}
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </Card>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30">
            <Sparkles className="h-20 w-20 text-muted-foreground mb-4" />
            <p className="text-xl font-bold">بانتظار رصد فرص النمو</p>
        </div>
      )}
    </div>
  );
}
