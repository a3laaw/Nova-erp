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
    ArrowUpRight, ShoppingBag, FileCheck, Target, Calculator 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const LICENSING_KEYWORDS = ['بلدية', 'رخصة', 'تراخيص'];
const DESIGN_KEYWORDS = ['معماري', 'تصميم'];
const ALL_SERVICES = ['إشراف', 'واجهات', 'صحي', 'كهرباء', 'إنشائي'];

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
                        trigger: 'إتمام التراخيص والبلدية',
                        triggerDate: completedLicenses[0].updatedAt,
                        recommendation: 'عقد مقاولات / تنفيذ هيكل أسود',
                        type: 'contracting',
                        severity: 'high'
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
                        recommendation: `بيع خدمات: ${missing.join('، ')}`,
                        type: 'upsell',
                        severity: 'medium',
                        missingCount: missing.length
                    });
                }
            }
        });

        setReportResults(opportunities.sort((a,b) => (a.type === 'contracting' ? -1 : 1)));
        setIsGenerating(false);
        toast({ title: 'تم رصد الفرص', description: 'تم جرد العملاء الجاهزين للتحول للمقاولات والخدمات الإضافية.' });
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportResults) return [];
    if (!searchQuery) return reportResults;
    const lower = searchQuery.toLowerCase();
    return reportResults.filter(r => r.clientName.toLowerCase().includes(lower));
  }, [reportResults, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white p-6 rounded-[2rem] border shadow-sm no-print">
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">من تاريخ الإنجاز</Label>
            <DateInput value={dateFrom} onChange={setDateFrom} className="h-10 rounded-xl border-2" />
        </div>
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">إلى تاريخ الإنجاز</Label>
            <DateInput value={dateTo} onChange={setDateTo} className="h-10 rounded-xl border-2" />
        </div>
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">بحث باسم العميل</Label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl border-2 font-bold" />
            </div>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || loading} className="h-10 rounded-xl font-black text-base gap-2 shadow-xl shadow-primary/20 bg-amber-600 hover:bg-amber-700 text-white">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-5 w-5" />} 
            رصد فرص النمو والتحول
        </Button>
      </div>

      {reportResults ? (
        <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-slate-900 text-white">
                    <TableRow className="h-14 border-none">
                        <TableHead className="px-8 font-black text-white text-right">العميل المستهدف</TableHead>
                        <TableHead className="font-black text-white">محفز الفرصة (إنجاز سابق)</TableHead>
                        <TableHead className="font-black text-white">تاريخ الإنجاز</TableHead>
                        <TableHead className="font-black text-white bg-amber-500/20">الإجراء البيعي المقترح</TableHead>
                        <TableHead className="font-black text-white text-left px-8">الأهمية</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground font-black italic">لا توجد فرص نمو مرصودة في هذه الفترة.</TableCell></TableRow>
                    ) : (
                        filteredData.map(item => (
                            <TableRow key={item.id} className="h-20 hover:bg-muted/5 transition-colors border-b group">
                                <TableCell className="px-8">
                                    <Link href={`/dashboard/clients/${item.clientId}`} className="font-black text-slate-900 text-lg hover:underline flex items-center gap-2">
                                        {item.clientName}
                                        <ArrowUpRight className="h-4 w-4 opacity-20 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {item.type === 'contracting' ? <FileCheck className="h-4 w-4 text-green-600" /> : <Calculator className="h-4 w-4 text-blue-600" />}
                                        <span className="font-bold text-slate-700">{item.trigger}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs opacity-60">
                                    {toFirestoreDate(item.triggerDate) ? format(toFirestoreDate(item.triggerDate)!, 'dd/MM/yyyy') : '-'}
                                </TableCell>
                                <TableCell className="bg-amber-50/30 border-r border-amber-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 rounded-xl text-amber-700"><Target className="h-4 w-4"/></div>
                                        <span className="font-black text-amber-900">{item.recommendation}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-left px-8">
                                    <Badge className={cn(
                                        "px-4 py-1 rounded-full font-black text-[10px]",
                                        item.severity === 'high' ? "bg-red-600" : "bg-blue-600"
                                    )}>{item.severity === 'high' ? 'فرصة مقاولات (عالية)' : 'بيع إضافي (متوسط)'}</Badge>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30 grayscale">
            <div className="p-6 bg-amber-50 rounded-full mb-4 shadow-inner">
                <Sparkles className="h-20 w-20 text-amber-400 animate-pulse" />
            </div>
            <p className="text-xl font-black text-slate-800">محرك رصد الفرص بانتظار تحديد الفترة</p>
            <p className="text-sm font-bold text-muted-foreground mt-2">سيقوم النظام بمسح من رخصوا أو صمموا ليرشح لك من تبيع له المقاولات.</p>
        </div>
      )}
    </div>
  );
}
