
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { query, orderBy, where } from 'firebase/firestore';
import type { FieldVisit, ConstructionProject, Client, WorkTeam } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { 
  FileBarChart, Search, Printer, ArrowRight, Calendar, Users, 
  Target, CheckCircle2, Clock, Filter, HardHat, Building2 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useRouter } from 'next/navigation';

export function FieldVisitsReports() {
  const { firestore } = useFirebase();
  const router = useRouter();

  const [dateFrom, setDateFrom] = React.useState<Date | undefined>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = React.useState<Date | undefined>(() => endOfMonth(new Date()));
  const [selectedClientId, setSelectedClientId] = React.useState('all');
  const [selectedTeamId, setSelectedTeamId] = React.useState('all');
  const [selectedStageName, setSelectedStageName] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const { data: visits, loading: visitsLoading } = useSubscription<FieldVisit>(firestore, 'field_visits', [orderBy('scheduledDate', 'desc')]);
  const { data: clients = [] } = useSubscription<Client>(firestore, 'clients', [orderBy('nameAr')]);
  const { data: teams = [] } = useSubscription<WorkTeam>(firestore, 'workTeams', [orderBy('name')]);

  const filteredData = React.useMemo(() => {
    if (!visits) return [];

    return visits.filter(visit => {
      const visitDate = toFirestoreDate(visit.scheduledDate);
      if (!visitDate) return false;

      const matchesDate = !dateFrom || !dateTo || isWithinInterval(visitDate, { start: dateFrom, end: dateTo });
      const matchesClient = selectedClientId === 'all' || visit.clientId === selectedClientId;
      const matchesTeam = selectedTeamId === 'all' || visit.teamIds?.includes(selectedTeamId);
      const matchesStage = selectedStageName === 'all' || visit.plannedStageName === selectedStageName;
      const matchesSearch = !searchQuery || 
        visit.projectName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        visit.clientName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesDate && matchesClient && matchesTeam && matchesStage && matchesSearch;
    });
  }, [visits, dateFrom, dateTo, selectedClientId, selectedTeamId, selectedStageName, searchQuery]);

  const stats = React.useMemo(() => {
    const total = filteredData.length;
    const confirmed = filteredData.filter(v => v.status === 'confirmed').length;
    const planned = total - confirmed;
    const successRate = total > 0 ? (confirmed / total) * 100 : 0;

    const chartData = [
      { name: 'مؤكدة (منفذة)', value: confirmed, fill: '#10b981' },
      { name: 'مجدولة (قادمة)', value: planned, fill: '#3b82f6' }
    ];

    return { total, confirmed, planned, successRate, chartData };
  }, [filteredData]);

  const uniqueStages = React.useMemo(() => {
    const stages = new Set(visits.map(v => v.plannedStageName).filter(Boolean));
    return Array.from(stages).sort();
  }, [visits]);

  if (visitsLoading) return <div className="space-y-6"><Skeleton className="h-20 w-full rounded-2xl"/><Skeleton className="h-96 w-full rounded-2xl"/></div>;

  return (
    <div className="space-y-6" dir="rtl">
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
            <CardDescription>تحليل شامل للزيارات الميدانية، إنجاز الفرق، ومتابعة مشاريع المقاولات.</CardDescription>
          </div>
        </div>
        <Button onClick={() => window.print()} className="gap-2 font-bold rounded-xl shadow-lg">
          <Printer className="h-4 w-4" /> طباعة التقرير
        </Button>
      </div>

      <Card className="rounded-[2rem] border-none shadow-sm bg-muted/30 no-print">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold mr-1">الفترة الزمنية</Label>
              <div className="flex gap-2">
                <Input type="date" value={dateFrom ? format(dateFrom, 'yyyy-MM-dd') : ''} onChange={e => setDateFrom(e.target.value ? new Date(e.target.value) : undefined)} className="h-9 text-xs rounded-xl" />
                <Input type="date" value={dateTo ? format(dateTo, 'yyyy-MM-dd') : ''} onChange={e => setDateTo(e.target.value ? new Date(e.target.value) : undefined)} className="h-9 text-xs rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold mr-1">العميل</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-9 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل العملاء</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id!}>{c.nameAr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold mr-1">فريق العمل</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger className="h-9 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفرق</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id!}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold mr-1">مرحلة العمل (WBS)</Label>
              <Select value={selectedStageName} onValueChange={setSelectedStageName}>
                <SelectTrigger className="h-9 rounded-xl bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المراحل</SelectItem>
                  {uniqueStages.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-1">معدل الإنجاز الميداني</Label>
          <div className="flex justify-between items-end">
            <p className="text-4xl font-black font-mono text-primary">{stats.successRate.toFixed(0)}%</p>
            <Target className="h-8 w-8 text-muted-foreground opacity-10" />
          </div>
        </Card>
      </div>

      <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-card">
        <CardHeader className="bg-muted/10 border-b pb-6">
          <CardTitle className="text-xl font-black">سجل الزيارات التفصيلي</CardTitle>
          <CardDescription>قائمة بالزيارات المفلترة مع تفاصيل الإنجاز والموقع.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-6">تاريخ الزيارة</TableHead>
                <TableHead>المشروع / العميل</TableHead>
                <TableHead>المرحلة (WBS)</TableHead>
                <TableHead>الفرق المنفذة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-left px-6">المسؤول</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                    لا توجد بيانات تطابق الفلاتر المختارة.
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((visit) => (
                  <TableRow key={visit.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="px-6 font-bold text-xs">
                      {toFirestoreDate(visit.scheduledDate) ? format(toFirestoreDate(visit.scheduledDate)!, 'dd/MM/yyyy', { locale: ar }) : '-'}
                    </TableCell>
                    <TableCell>
                      <p className="font-black text-primary text-sm">{visit.projectName}</p>
                      <p className="text-[10px] text-muted-foreground font-bold">{visit.clientName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 text-[10px] border-blue-100">
                        {visit.plannedStageName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {visit.teamNames?.length ? visit.teamNames.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-[8px] h-4">{t}</Badge>
                        )) : <span className="text-[10px] italic text-muted-foreground">-</span>}
                        {visit.subcontractorName && <Badge className="bg-orange-100 text-orange-700 text-[8px] h-4 border-none">{visit.subcontractorName}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={visit.status === 'confirmed' ? 'default' : 'outline'} className={cn(
                        "font-black text-[9px]",
                        visit.status === 'confirmed' ? "bg-green-600" : "text-blue-600 border-blue-200"
                      )}>
                        {visit.status === 'confirmed' ? 'منفذة' : 'مخططة'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left px-6 text-xs font-bold text-muted-foreground">
                      {visit.engineerName || 'إشراف عام'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="bg-muted/10 p-4 justify-between border-t">
          <p className="text-xs text-muted-foreground italic">تم عرض {filteredData.length} زيارة ميدانية بناءً على الفلترة الحالية.</p>
          <p className="text-[10px] font-black uppercase text-muted-foreground">Nova ERP - Field Logistics System</p>
        </CardFooter>
      </Card>
    </div>
  );
}
