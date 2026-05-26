'use client';

import { useState, useMemo } from 'react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Search, FileSearch, Loader2, Clock, MapPin, 
    AlertTriangle, CheckCircle2, User, Building2, 
    Activity 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { differenceInDays, format, isWithinInterval, startOfDay, endOfDay, Timestamp } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateInput } from '@/components/ui/date-input';

/**
 * رادار متابعة العمل والميدان:
 * تم تطهير الألوان الداكنة واستبدالها بخلفيات لؤلؤية مع رؤوس جداول برتقالية/لؤلؤية.
 */
export function UnifiedOperationalRadar() {
  const { transactions, clients, employees, departments, appointments, loading } = useAnalyticalData();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportResults] = useState<any[] | null>(null);
  
  const [selectedDept, setSelectedDept] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [threshold, setThreshold] = useState('14');

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
        const now = new Date();
        const start = dateFrom ? startOfDay(dateFrom) : null;
        const end = dateTo ? endOfDay(dateTo) : null;
        const limitDays = parseInt(threshold);

        const results = transactions.filter(tx => {
            const createdAt = toFirestoreDate(tx.createdAt);
            if (!createdAt) return true;
            if (start && end) return isWithinInterval(createdAt, { start, end });
            return true;
        }).map(tx => {
            const client = clients.find(c => c.id === tx.clientId);
            const engineer = employees.find(e => e.id === tx.assignedEngineerId);
            
            const lastUpdate = toFirestoreDate(tx.updatedAt) || toFirestoreDate(tx.createdAt) || now;
            const daysStalled = differenceInDays(now, lastUpdate);
            
            const visit = appointments
                .filter(a => a.clientId === tx.clientId && a.status === 'confirmed')
                .sort((a, b) => (toFirestoreDate(b.appointmentDate)?.getTime() || 0) - (toFirestoreDate(a.appointmentDate)?.getTime() || 0))[0];

            let severity: 'active' | 'warning' | 'critical' | 'stopped' = 'active';
            if (daysStalled > 60) severity = 'stopped';
            else if (daysStalled > limitDays) severity = 'critical';
            else if (daysStalled > (limitDays / 2)) severity = 'warning';

            return {
                id: tx.id,
                deptName: engineer?.department || 'غير مسند',
                clientName: client?.nameAr || '---',
                txType: tx.transactionType,
                engineerName: engineer?.fullName || 'غير مسجل',
                daysStalled,
                severity,
                lastVisitDate: visit ? toFirestoreDate(visit.appointmentDate) : null,
                currentStage: (tx.stages || []).find(s => s.status === 'in-progress')?.name || 'بانتظار البدء',
            };
        });

        setReportResults(results.sort((a, b) => b.daysStalled - a.daysStalled));
        setIsGenerating(false);
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportData) return [];
    return reportData.filter(item => {
        const matchesDept = selectedDept === 'all' || item.deptName === selectedDept;
        const matchesSearch = !searchQuery || item.clientName.includes(searchQuery) || item.txType.includes(searchQuery);
        return matchesDept && matchesSearch;
    });
  }, [reportData, selectedDept, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end bg-white p-8 rounded-[2.5rem] border shadow-sm no-print">
        <div className="lg:col-span-2 grid gap-2">
            <Label className="font-black text-[10px] pr-1 text-slate-500 uppercase">من تاريخ</Label>
            <DateInput value={dateFrom} onChange={setDateFrom} className="h-10 rounded-xl border-2" />
        </div>
        <div className="lg:col-span-2 grid gap-2">
            <Label className="font-black text-[10px] pr-1 text-slate-500 uppercase">إلى تاريخ</Label>
            <DateInput value={dateTo} onChange={setDateTo} className="h-10 rounded-xl border-2" />
        </div>
        <div className="lg:col-span-2 grid gap-2">
            <Label className="font-black text-[10px] pr-1 text-slate-500 uppercase">عتبة الخمول (أيام)</Label>
            <Select value={threshold} onValueChange={setThreshold}>
                <SelectTrigger className="h-10 rounded-xl border-2 font-black text-[#1e1b4b]"><SelectValue /></SelectTrigger>
                <SelectContent dir="rtl">
                    <SelectItem value="7">7 أيام (ميداني)</SelectItem>
                    <SelectItem value="14">14 يوم (تصميم)</SelectItem>
                    <SelectItem value="30">30 يوم (تراخيص)</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="lg:col-span-3 grid gap-2">
            <Label className="font-black text-[10px] pr-1 text-slate-500 uppercase">بحث سريع</Label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="اسم العميل أو المعاملة..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl border-2 font-bold" />
            </div>
        </div>
        <div className="lg:col-span-3">
            <Button onClick={handleGenerate} disabled={isGenerating || loading} className="w-full h-12 rounded-xl font-black text-base gap-2 shadow-xl shadow-primary/20 bg-primary text-white">
                {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <Activity className="h-5 w-5" />} 
                تحديث الرادار العملياتي
            </Button>
        </div>
      </div>

      {reportData ? (
        <div className="border-2 rounded-[2.5rem] overflow-hidden shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-500">
            <Table>
                <TableHeader className="bg-primary/5 border-b-2">
                    <TableRow className="h-14 border-none">
                        <TableHead className="px-8 font-black text-primary text-right">المشروع والعميل</TableHead>
                        <TableHead className="font-black text-primary">المرحلة الحالية</TableHead>
                        <TableHead className="font-black text-primary text-center">أيام التوقف</TableHead>
                        <TableHead className="font-black text-primary text-center">درجة الخطورة</TableHead>
                        <TableHead className="font-black text-primary">آخر زيارة</TableHead>
                        <TableHead className="font-black text-primary text-left px-8">المسؤول</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد بيانات لهذه الفترة.</TableCell></TableRow>
                    ) : (
                        filteredData.map(item => (
                            <TableRow key={item.id} className={cn("h-20 hover:bg-muted/5 transition-colors border-b", item.severity === 'critical' && "bg-red-50/50")}>
                                <TableCell className="px-8">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Building2 className="h-4 w-4"/></div>
                                        <div>
                                            <p className="font-black text-slate-900 leading-tight">{item.clientName}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">{item.txType}</p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-black bg-white text-primary border-primary/20 px-3">{item.currentStage}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={cn("text-lg font-black font-mono", item.severity === 'critical' ? "text-red-600" : "text-green-600")}>
                                        {item.daysStalled} <span className="text-[10px]">يوم</span>
                                    </span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge className={cn(
                                        "px-4 py-1 rounded-full font-black text-[9px] border-none shadow-sm",
                                        item.severity === 'active' ? "bg-green-600 text-white" :
                                        item.severity === 'warning' ? "bg-orange-400 text-white" :
                                        item.severity === 'critical' ? "bg-red-600 text-white animate-pulse" :
                                        "bg-slate-400 text-white"
                                    )}>{item.severity === 'active' ? 'نشط' : item.severity === 'warning' ? 'تحذير' : item.severity === 'critical' ? 'خامل (حرج)' : 'متوقف'}</Badge>
                                </TableCell>
                                <TableCell>
                                    {item.lastVisitDate ? (
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                            <MapPin className="h-3 w-3 text-red-500" />
                                            {format(item.lastVisitDate, 'dd/MM/yyyy')}
                                        </div>
                                    ) : <span className="text-[10px] text-muted-foreground italic">بدون زيارة</span>}
                                </TableCell>
                                <TableCell className="text-left px-8">
                                    <div className="flex items-center justify-end gap-2">
                                        <span className="font-bold text-sm text-slate-700">{item.engineerName}</span>
                                        <div className="p-1.5 bg-slate-100 rounded-full"><User className="h-3.5 w-3.5 opacity-40"/></div>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] opacity-30 grayscale">
            <Activity className="h-20 w-20 text-muted-foreground mb-4" />
            <p className="text-xl font-bold text-slate-800">بانتظار تحديث الرادار العملياتي</p>
        </div>
      )}
    </div>
  );
}
