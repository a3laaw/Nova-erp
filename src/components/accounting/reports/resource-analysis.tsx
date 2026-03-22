'use client';
import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Search, Loader2, FileSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResourceStats {
  id: string;
  name: string;
  totalProfit: number;
  totalSalary: number;
  netContribution: number;
  projectCount: number;
}

/**
 * تقرير إنتاجية المهندسين:
 * يربط الأرباح الميدانية بالمسؤول المالي للمشروع (Resource) لبيان مساهمة الموظف.
 */
export function ResourceAnalysisReport() {
  const { journalEntries, employees, accounts, loading: dataLoading } = useAnalyticalData();
  const { toast } = useToast();
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportResults, setReportResults] = useState<ResourceStats[] | null>(null);

  const handleGenerate = () => {
    if (!dateFrom || !dateTo) return;
    setIsGenerating(true);
    
    setTimeout(() => {
        const startDate = dateFrom;
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        const monthsInPeriod = Math.max(1, differenceInMonths(endDate, startDate) + 1);

        const engineerStats = new Map<string, ResourceStats>();
        const projectsPerEngineer = new Map<string, Set<string>>();

        // حصر المهندسين النشطين وتكلفة رواتبهم في الفترة
        employees.filter(e => e.status === 'active' && e.jobTitle?.includes('مهندس')).forEach(emp => {
            const monthlySalary = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0);
            engineerStats.set(emp.id!, {
                id: emp.id!,
                name: emp.fullName,
                totalProfit: 0,
                totalSalary: monthlySalary * monthsInPeriod,
                netContribution: 0,
                projectCount: 0,
            });
            projectsPerEngineer.set(emp.id!, new Set());
        });

        // تجميع النتائج المالية بناءً على الإسناد المباشر للمهندس (auto_resource_id)
        journalEntries.forEach(entry => {
            const entryDate = entry.date?.toDate();
            if (!entryDate || entryDate < startDate || entryDate > endDate || entry.status !== 'posted') return;
            
            entry.lines.forEach(line => {
                const resourceId = line.auto_resource_id;
                if (!resourceId || !engineerStats.has(resourceId)) return;

                const stats = engineerStats.get(resourceId)!;
                const account = accounts.find(a => a.id === line.accountId);
                if(!account) return;

                if (account.code.startsWith('4')) {
                    stats.totalProfit += (line.credit || 0) - (line.debit || 0);
                } else if (account.code.startsWith('51')) {
                    stats.totalProfit -= (line.debit || 0) - (line.credit || 0);
                }
                
                if (line.auto_profit_center) projectsPerEngineer.get(resourceId)?.add(line.auto_profit_center);
            });
        });

        const results: ResourceStats[] = [];
        engineerStats.forEach(stats => {
            stats.netContribution = stats.totalProfit - stats.totalSalary;
            stats.projectCount = projectsPerEngineer.get(stats.id)?.size || 0;
            if (stats.projectCount > 0 || stats.totalSalary > 0) results.push(stats);
        });

        setReportResults(results.sort((a,b) => b.netContribution - a.netContribution));
        setIsGenerating(false);
        toast({ title: 'تم التحليل', description: 'تم حصر مساهمة المهندسين المالية.' });
    }, 600);
  };

  const finalDisplayData = useMemo(() => {
    if (!reportResults) return [];
    if (!searchQuery) return reportResults;
    const lower = searchQuery.toLowerCase();
    return reportResults.filter(r => r.name.toLowerCase().includes(lower));
  }, [reportResults, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-muted/30 p-6 rounded-2xl border-2 border-dashed no-print">
        <div className="grid gap-2"><Label className="font-black text-xs pr-1">من تاريخ</Label><DateInput value={dateFrom} onChange={setDateFrom} className="bg-white rounded-xl" /></div>
        <div className="grid gap-2"><Label className="font-black text-xs pr-1">إلى تاريخ</Label><DateInput value={dateTo} onChange={setDateTo} className="bg-white rounded-xl" /></div>
        <div className="grid gap-2"><Label className="font-black text-xs pr-1">بحث بالاسم</Label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input placeholder="اسم المهندس..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-white border-2" /></div></div>
        <Button onClick={handleGenerate} disabled={isGenerating || dataLoading} className="h-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
            {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />} استخراج إنتاجية الموارد
        </Button>
      </div>
      
      {reportResults ? (
        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white animate-in fade-in zoom-in-95 duration-500">
          <Table>
            <TableHeader className="bg-muted/80 h-14 border-b-2">
              <TableRow>
                <TableHead className="px-8 font-black text-base text-foreground">المهندس المختص</TableHead>
                <TableHead className="text-left font-black text-base text-foreground">ربحية المشاريع المشرف عليها</TableHead>
                <TableHead className="text-left font-black text-base text-foreground">تكلفة الراتب (الفترة)</TableHead>
                <TableHead className="text-left font-black text-base bg-primary/5 text-primary">صافي المساهمة الربحية</TableHead>
                <TableHead className="text-center font-black text-base text-foreground px-8">مشاريع فعالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalDisplayData.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد نتائج مسجلة.</TableCell></TableRow>
              ) : (
                finalDisplayData.map(item => (
                  <TableRow key={item.id} className="h-20 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                    <TableCell className="px-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><UserCheck className="h-5 w-5"/></div>
                            <span className="font-black text-lg text-slate-900">{item.name}</span>
                        </div>
                    </TableCell>
                    <TableCell className="text-left font-mono font-black text-green-600">{formatCurrency(item.totalProfit)}</TableCell>
                    <TableCell className="text-left font-mono font-bold text-red-600">({formatCurrency(item.totalSalary)})</TableCell>
                    <TableCell className="text-left font-mono font-black text-xl bg-primary/[0.02] border-r border-primary/10">
                        {formatCurrency(item.netContribution)}
                    </TableCell>
                    <TableCell className="text-center px-8">
                        <Badge variant="outline" className="bg-white font-black px-4 h-7 rounded-full border-2 border-primary/20">{item.projectCount} مشروع</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
            <div className="p-10 bg-muted rounded-full mb-6"><UserCheck className="h-24 w-24 text-muted-foreground" /></div>
            <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحليل الموارد البشرية</h3>
            <p className="text-lg font-bold mt-2">استخرج التقرير لتقييم مساهمة المهندسين في صافي أرباح الشركة.</p>
        </div>
      )}
    </div>
  );
}
