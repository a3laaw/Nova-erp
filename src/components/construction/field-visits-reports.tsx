
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy, where } from 'firebase/firestore';
import type { FieldVisit, ConstructionProject, WorkTeam } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileBarChart, Search, Printer, ArrowRight, Calendar, Users, 
  Target, CheckCircle2, Clock, Filter, HardHat, Building2,
  FileSearch, Loader2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export function FieldVisitsReports() {
  const { firestore } = useFirebase();
  const router = useRouter();

  // فلاتر الحالة (تتحكم فيما سيظهر عند الضغط على زر التوليد)
  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = React.useState<Date | undefined>(() => endOfMonth(new Date()));
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [selectedStageNames, setSelectedStageNames] = React.useState<string[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  // حالة نتائج التقرير المثبتة (Stable Report Results)
  const [reportResults, setReportResults] = React.useState<FieldVisit[] | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const { data: visits, loading: visitsLoading } = useSubscription<FieldVisit>(firestore, 'field_visits', [orderBy('scheduledDate', 'desc')]);
  const { data: projects = [] } = useSubscription<ConstructionProject>(firestore, 'projects', [orderBy('projectName')]);
  const { data: teams = [] } = useSubscription<WorkTeam>(firestore, 'workTeams', [orderBy('name')]);

  const projectOptions: MultiSelectOption[] = React.useMemo(() => 
    projects.map(p => ({ value: p.id!, label: p.projectName })), 
  [projects]);

  const teamOptions: MultiSelectOption[] = React.useMemo(() => 
    teams.map(t => ({ value: t.id!, label: t.name })), 
  [teams]);

  const stageOptions: MultiSelectOption[] = React.useMemo(() => {
    const stages = new Set(visits.map(v => v.plannedStageName).filter(Boolean));
    return Array.from(stages).sort().map(s => ({ value: s, label: s }));
  }, [visits]);

  // محرك إنشاء التقرير بطلب (On-Demand)
  const handleGenerateReport = () => {
    setIsGenerating(true);
    
    // محاكاة تأخير بسيط لإعطاء انطباع بالمعالجة
    setTimeout(() => {
        const filtered = visits.filter(visit => {
            const visitDate = toFirestoreDate(visit.scheduledDate);
            if (!visitDate) return false;

            const matchesDate = !dateFrom || !dateTo || isWithinInterval(visitDate, { start: dateFrom, end: dateTo });
            const matchesProject = selectedProjectIds.length === 0 || selectedProjectIds.includes(visit.projectId);
            const matchesTeam = selectedTeamIds.length === 0 || visit.teamIds?.some(id => selectedTeamIds.includes(id));
            const matchesStage = selectedStageNames.length === 0 || selectedStageNames.includes(visit.plannedStageName);
            
            const matchesSearch = !searchQuery || 
                visit.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                visit.clientName.toLowerCase().includes(searchQuery.toLowerCase());

            return matchesDate && matchesProject && matchesTeam && matchesStage && matchesSearch;
        });

        setReportResults(filtered);
        setIsGenerating(false);
    }, 600);
  };

  const stats = React.useMemo(() => {
    if (!reportResults) return { total: 0, confirmed: 0, planned: 0, successRate: 0 };
    const total = reportResults.length;
    const confirmed = reportResults.filter(v => v.status === 'confirmed').length;
    const planned = total - confirmed;
    const successRate = total > 0 ? (confirmed / total) * 100 : 0;

    return { total, confirmed, planned, successRate };
  }, [reportResults]);

  if (visitsLoading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header - No Print */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 no-print">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <FileBarChart className="text-primary h-7 w-7" />
              تقارير الأداء الميداني واللوجستيات
            </CardTitle>
            <CardDescription>تحليل شامل للزيارات الميدانية الموزعة على المشاريع وفرق التنفيذ.</CardDescription>
          </div>
        </div>
        <Button onClick={() => window.print()} className="gap-2 font-bold rounded-xl shadow-lg" disabled={!reportResults}>
          <Printer className="h-4 w-4" /> طباعة التقرير
        </Button>
      </div>

      {/* Filters Section - No Print */}
      <Card className="rounded-[2rem] border-none shadow-sm bg-muted/30 no-print">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-black text-primary mr-1">الفترة الزمنية</Label>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''} onChange={e => setDateFrom(e.target.value ? new Date(e.target.value) : undefined)} className="h-10 text-xs rounded-xl bg-background border-2" />
                <Input type="date" value={dateTo ? format(dateTo, 'yyyy-MM-dd') : ''} onChange={e => setDateTo(e.target.value ? new Date(e.target.value) : undefined)} className="h-10 text-xs rounded-xl bg-background border-2" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-primary mr-1">المشاريع</Label>
              <MultiSelect 
                options={projectOptions}
                selected={selectedProjectIds}
                onChange={setSelectedProjectIds}
                placeholder="اختر مشروعاً..."
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-primary mr-1">فرق العمل</Label>
              <MultiSelect 
                options={teamOptions}
                selected={selectedTeamIds}
                onChange={setSelectedTeamIds}
                placeholder="اختر الفرق..."
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black text-primary mr-1">مراحل الـ WBS</Label>
              <MultiSelect 
                options={stageOptions}
                selected={selectedStageNames}
                onChange={setSelectedStageNames}
                placeholder="اختر المراحل..."
                className="bg-background"
              />
            </div>
          </div>
          
          <div className="mt-6 flex justify-center border-t pt-6">
            <Button onClick={handleGenerateReport} disabled={isGenerating} className="h-12 px-12 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSearch className="h-5 w-5" />}
                إنشاء التقرير وتثبيت القراءات
            </Button>
          </div>
        </CardContent>
      </Card>

      {reportResults ? (
        <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-none shadow-sm p-6 bg-primary text-primary-foreground">
                <Label className="text-[10px] font-black uppercase opacity-80 block mb-1">إجمالي الزيارات</Label>
                <div className="flex justify-between items-end">
                    <p className="text-4xl font-black font-mono">{stats.total}</p>
                    <Calendar className="h-8 w-8 opacity-20" />
                </div>
                </Card>

                <Card className="rounded-2xl border-none shadow-sm p-6 bg-green-50">
                <Label className="text-[10px] font-black uppercase text-green-700 block mb-1">الزيارات المنفذة</Label>
                <div className="flex justify-between items-end">
                    <p className="text-4xl font-black font-mono text-green-700">{stats.confirmed}</p>
                    <CheckCircle2 className="h-8 w-8 text-green-200" />
                </div>
                </Card>

                <Card className="rounded-2xl border-none shadow-sm p-6 bg-blue-50">
                <Label className="text-[10px] font-black uppercase text-blue-700 block mb-1">الزيارات المجدولة</Label>
                <div className="flex justify-between items-end">
                    <p className="text-4xl font-black font-mono text-blue-700">{stats.planned}</p>
                    <Clock className="h-8 w-8 text-blue-200" />
                </div>
                </Card>

                <Card className="rounded-2xl border-none shadow-sm p-6 bg-white">
                <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">معدل الإنجاز</Label>
                <div className="flex justify-between items-end">
                    <p className="text-4xl font-black font-mono text-primary">{stats.successRate.toFixed(0)}%</p>
                    <Target className="h-8 w-8 text-muted-foreground opacity-10" />
                </div>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-card">
                <CardHeader className="bg-muted/10 border-b pb-6 px-8">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-xl font-black">سجل الحركة الميدانية التفصيلي</CardTitle>
                        <CardDescription>عرض النتائج المثبتة للفترة من {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : ''} إلى {dateTo ? format(dateTo, 'dd/MM/yyyy') : ''}.</CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-bold px-4 h-7 rounded-full">
                        {reportResults.length} سجل متاح
                    </Badge>
                </div>
                </CardHeader>
                <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-muted/50">
                    <TableRow className="h-12">
                        <TableHead className="px-8 font-black text-slate-900">تاريخ الزيارة</TableHead>
                        <TableHead className="font-black text-slate-900">المشروع / العميل</TableHead>
                        <TableHead className="font-black text-slate-900">المرحلة (WBS)</TableHead>
                        <TableHead className="font-black text-slate-900">فرق العمل</TableHead>
                        <TableHead className="font-black text-slate-900">الحالة</TableHead>
                        <TableHead className="text-left px-8 font-black text-slate-900">المسؤول</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {reportResults.length === 0 ? (
                        <TableRow>
                        <TableCell colSpan={6} className="h-64 text-center text-muted-foreground italic">
                            لا توجد بيانات تطابق الفلاتر في هذه الفترة.
                        </TableCell>
                        </TableRow>
                    ) : (
                        reportResults.map((visit) => (
                        <TableRow key={visit.id} className="h-16 hover:bg-muted/30 transition-colors border-b last:border-0">
                            <TableCell className="px-8 font-bold text-xs">
                            {toFirestoreDate(visit.scheduledDate) ? format(toFirestoreDate(visit.scheduledDate)!, 'dd/MM/yyyy', { locale: ar }) : '-'}
                            </TableCell>
                            <TableCell>
                            <p className="font-black text-primary text-sm">{visit.projectName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{visit.clientName}</p>
                            </TableCell>
                            <TableCell>
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] border-blue-100 font-bold">
                                {visit.plannedStageName}
                            </Badge>
                            </TableCell>
                            <TableCell>
                            <div className="flex flex-wrap gap-1">
                                {visit.teamNames?.length ? visit.teamNames.map((t, i) => (
                                <Badge key={i} variant="secondary" className="text-[8px] h-4 font-black">{t}</Badge>
                                )) : <span className="text-[10px] italic text-muted-foreground">-</span>}
                                {visit.subcontractorName && <Badge className="bg-orange-100 text-orange-700 text-[8px] h-4 border-none font-black">{visit.subcontractorName}</Badge>}
                            </div>
                            </TableCell>
                            <TableCell>
                            <Badge variant={visit.status === 'confirmed' ? 'default' : 'outline'} className={cn(
                                "font-black text-[9px] px-3",
                                visit.status === 'confirmed' ? "bg-green-600" : "text-blue-600 border-blue-200"
                            )}>
                                {visit.status === 'confirmed' ? 'تمت الزيارة' : 'مجدولة'}
                            </Badge>
                            </TableCell>
                            <TableCell className="text-left px-8 text-xs font-bold text-muted-foreground">
                            {visit.engineerName || 'إشراف عام'}
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
                <CardFooter className="bg-muted/10 p-4 justify-between border-t text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span>Nova ERP - Field Logistics Stable Reporting</span>
                <span>Generated At: {format(new Date(), 'PPpp', { locale: ar })}</span>
                </CardFooter>
            </Card>
        </div>
      ) : (
        <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-40">
            <div className="p-6 bg-muted rounded-full mb-4">
                <FileBarChart className="h-16 w-16 text-muted-foreground" />
            </div>
            <p className="text-xl font-black text-muted-foreground">اضبط الفلاتر في الأعلى واضغط على "إنشاء التقرير" للمتابعة.</p>
        </div>
      )}
    </div>
  );
}
