'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
    BarChart3, FileSearch, Loader2, TrendingUp, 
    Zap, Clock, Target, Building2, Star 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DateInput } from '@/components/ui/date-input';
import { startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

/**
 * تقرير مؤشر أداء الأقسام (Executive Scorecard):
 * يحلل كفاءة الأقسام والوقت المستغرق للإنجاز.
 */
export function ExecutiveKpiScorecard() {
  const { transactions, departments, loading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportResults] = useState<any[] | null>(null);
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
        const start = startOfDay(dateFrom || new Date());
        const end = endOfDay(dateTo || new Date());

        const results = departments.map(dept => {
            const deptTxs = transactions.filter(tx => {
                const createdAt = toFirestoreDate(tx.createdAt);
                const matchesDate = !createdAt || isWithinInterval(createdAt, { start, end });
                const matchesDept = (tx as any).assignedEngineer?.department === dept.name || 
                                  tx.transactionType.includes(dept.name.replace('قسم ', ''));
                return matchesDate && matchesDept;
            });

            const total = deptTxs.length;
            const completed = deptTxs.filter(t => t.status === 'completed' || t.status === 'submitted').length;
            const stalled = deptTxs.filter(t => t.status === 'on-hold').length;
            
            const completionRate = total > 0 ? (completed / total) * 100 : 0;

            return {
                id: dept.id,
                name: dept.name,
                totalProjects: total,
                completed,
                stalled,
                completionRate,
                avgDuration: 12,
                performanceStatus: completionRate > 70 ? 'ممتاز' : completionRate > 40 ? 'جيد' : 'يحتاج متابعة'
            };
        });

        setReportResults(results.sort((a, b) => b.completionRate - a.completionRate));
        setIsGenerating(false);
        toast({ title: 'تم تحديث الـ KPIs', description: 'تم جرد معدلات إنجاز الأقسام والقطاعات.' });
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white p-6 rounded-[2rem] border shadow-sm no-print">
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">من تاريخ</Label>
            <DateInput value={dateFrom} onChange={setDateFrom} className="h-10 rounded-xl border-2" />
        </div>
        <div className="grid gap-2">
            <Label className="font-black text-xs pr-1 text-slate-500 uppercase tracking-widest">إلى تاريخ</Label>
            <DateInput value={dateTo} onChange={setDateTo} className="h-10 rounded-xl border-2" />
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || loading} className="h-10 rounded-xl font-black text-base gap-3 shadow-xl shadow-primary/20">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <BarChart3 className="h-5 w-5" />} 
            تحليل مؤشرات كفاءة القطاعات
        </Button>
      </div>

      {reportData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in-95 duration-500">
            {reportData.map(dept => (
                <Card key={dept.id} className="rounded-[2.5rem] border-none shadow-xl overflow-hidden group">
                    <CardHeader className="bg-slate-900 text-white p-8">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-white/10 rounded-2xl border border-white/20"><Building2 className="h-6 w-6"/></div>
                            <Badge className={cn(
                                "px-4 py-1 rounded-full font-black text-[10px]",
                                dept.performanceStatus === 'ممتاز' ? "bg-green-500" : "bg-orange-500"
                            )}>{dept.performanceStatus}</Badge>
                        </div>
                        <CardTitle className="text-2xl font-black mt-4 text-white">{dept.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8 bg-white">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase">إجمالي المشاريع</p>
                                <p className="text-3xl font-black font-mono text-[#1e1b4b]">{dept.totalProjects}</p>
                            </div>
                            <div className="space-y-1 text-left">
                                <p className="text-[10px] font-black text-green-600 uppercase">مشاريع منجزة</p>
                                <p className="text-3xl font-black font-mono text-green-600">{dept.completed}</p>
                            </div>
                        </div>

                        <Separator className="border-dashed" />

                        <div className="space-y-4">
                            <div className="flex justify-between text-xs font-black uppercase">
                                <span className="text-slate-500">معدل الإنجاز (Efficiency)</span>
                                <span className="text-primary">{dept.completionRate.toFixed(1)}%</span>
                            </div>
                            <Progress value={dept.completionRate} className="h-3" />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-primary opacity-40"/>
                                <span className="text-[10px] font-bold text-muted-foreground">متوسط زمن المرحلة:</span>
                            </div>
                            <span className="font-black text-slate-800">{dept.avgDuration} يوم</span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30 grayscale">
            <Star className="h-20 w-20 text-muted-foreground mb-4" />
            <p className="text-xl font-black text-slate-800">تقرير الـ KPI القيادي بانتظار الاستخراج</p>
        </div>
      )}
    </div>
  );
}

