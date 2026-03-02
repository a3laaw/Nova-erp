
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy } from 'firebase/firestore';
import type { FieldVisit, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Eye, MapPin, HardHat, Users, Building2, Clock, AlertTriangle, CheckCircle2, Scale, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

/**
 * مكون عرض يوميات المواقع (التصميم الفني الهندسي المكثف):
 * يربط التقدم بالجدول الزمني المخطط ويكشف الانحرافات الزمنية.
 */
export function FieldVisitsGrid() {
  const { firestore } = useFirebase();

  const visitsQuery = React.useMemo(() => [orderBy('scheduledDate', 'desc')], []);
  const { data: visits, loading: visitsLoading } = useSubscription<FieldVisit>(firestore, 'field_visits', visitsQuery);
  const { data: employees } = useSubscription<Employee>(firestore, 'employees');

  if (visitsLoading) return <Skeleton className="h-[600px] w-full rounded-[2rem] animate-pulse" />;

  if (visits.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-[3rem] bg-muted/10">
        <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
        <p className="text-xl font-bold text-muted-foreground">لا توجد زيارات ميدانية مسجلة حالياً.</p>
      </div>
    );
  }

  return (
    <Card className="rounded-3xl border-none shadow-2xl overflow-hidden bg-card">
      <ScrollArea className="w-full">
        <div className="min-w-[1600px]">
          <Table className="border-collapse table-fixed w-full">
            <TableHeader className="bg-slate-900 text-white sticky top-0 z-30">
              <TableRow className="h-12 border-none">
                <TableHead className="w-12 text-center text-white border-l border-slate-700 font-black">#</TableHead>
                <TableHead className="w-64 text-right text-white border-l border-slate-700 font-black">العميل والمشروع</TableHead>
                <TableHead className="w-48 text-center text-white border-l border-slate-700 font-black">حالة الإنجاز والجدولة</TableHead>
                <TableHead className="w-56 text-center text-white border-l border-slate-700 font-black">مرحلة العمل (WBS)</TableHead>
                <TableHead className="w-48 text-center text-white border-l border-slate-700 font-black">فرق العمل المنفذة</TableHead>
                <TableHead className="w-full text-right text-white border-l border-slate-700 font-black">الأعمال الموثقة ميدانياً</TableHead>
                <TableHead className="w-20 text-center text-white font-black">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.map((visit, index) => {
                const scheduledDate = toFirestoreDate(visit.scheduledDate);
                const phaseEndDate = toFirestoreDate(visit.phaseEndDate);
                const isCancelled = visit.status === 'cancelled';
                const isConfirmed = visit.status === 'confirmed';
                
                const isDelayed = scheduledDate && phaseEndDate && scheduledDate > phaseEndDate;
                
                return (
                  <TableRow key={visit.id} className={cn("h-48 group border-b border-slate-200 hover:bg-muted/5 transition-colors", isCancelled && "opacity-50 grayscale bg-red-50/10")}>
                    <TableCell className="text-center font-black bg-slate-50 border-l border-slate-200">{index + 1}</TableCell>
                    
                    <TableCell className="p-4 border-l align-top space-y-3">
                        <div className="flex justify-between items-start">
                            <p className="font-black text-lg text-slate-900 border-b border-slate-100 pb-2">{visit.clientName}</p>
                            {isCancelled && <Badge variant="destructive" className="text-[8px] px-2 py-0">ملغي</Badge>}
                        </div>
                        <div className="space-y-1 bg-sky-50/50 p-3 rounded-xl border border-sky-100">
                            <p className="text-[10px] font-black text-sky-700 uppercase flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> المشروع:
                            </p>
                            <p className="text-xs font-bold leading-relaxed">{visit.projectName}</p>
                        </div>
                        {visit.numFloors && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                <Scale className="h-3 w-3" /> {visit.numFloors}
                            </div>
                        )}
                    </TableCell>

                    <TableCell className="p-0 border-l align-top">
                        <div className="p-4 flex flex-col justify-center h-full space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                    <span>نسبة الإنجاز</span>
                                    <span>{isConfirmed ? (visit.confirmationData?.progressAchieved || 0) : 0}%</span>
                                </div>
                                <Progress value={isConfirmed ? visit.confirmationData?.progressAchieved : 0} className="h-2" />
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                                <span className="text-[9px] font-black text-muted-foreground block uppercase">الحالة الزمنية:</span>
                                {isDelayed ? (
                                    <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-red-700 flex items-center gap-2">
                                        <AlertTriangle className="h-3 w-3" />
                                        <span className="text-[10px] font-bold">تأخير عن الجدول</span>
                                    </div>
                                ) : (
                                    <div className="p-2 bg-green-50 border border-green-100 rounded-lg text-green-700 flex items-center gap-2">
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span className="text-[10px] font-bold">ضمن الجدول الزمني</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TableCell>

                    <TableCell className="p-0 border-l align-top">
                        <div className="bg-orange-500 text-white p-2 text-center text-xs font-black">المرحلة التنفيذية</div>
                        <div className="p-3 space-y-3">
                            <div className="flex justify-between items-center border-b border-dashed pb-2">
                                <span className="text-[9px] font-bold text-muted-foreground">بند المقايسة:</span>
                                <span className="text-xs font-black text-orange-700">{visit.plannedStageName}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-dashed pb-2">
                                <span className="text-[9px] font-bold text-muted-foreground">التسليم المخطط:</span>
                                <span className="text-[10px] font-bold font-mono">
                                    {phaseEndDate ? format(phaseEndDate, 'dd/MM/yyyy') : 'غير محدد'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-muted-foreground">تاريخ الزيارة:</span>
                                <span className="text-[10px] font-bold font-mono text-primary">
                                    {scheduledDate ? format(scheduledDate, 'dd/MM/yyyy') : '-'}
                                </span>
                            </div>
                        </div>
                    </TableCell>

                    <TableCell className="p-0 border-l align-top">
                        <div className="bg-emerald-600 text-white p-2 text-center text-xs font-black">فرق العمل / الموارد</div>
                        <div className="p-2 h-[calc(100%-32px)] overflow-y-auto bg-emerald-50/20">
                            {visit.subcontractorName ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-1">
                                    <HardHat className="h-6 w-6 text-orange-500" />
                                    <p className="text-xs font-black text-orange-800">{visit.subcontractorName}</p>
                                    <span className="text-[8px] font-bold text-orange-600 uppercase">مقاول باطن</span>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {visit.teamNames?.map((teamName, i) => (
                                        <div key={i} className="bg-white border border-emerald-100 rounded-lg p-2 shadow-sm">
                                            <p className="text-[10px] font-black text-emerald-700 mb-1 flex items-center gap-1">
                                                <Users className="h-3 w-3" /> {teamName}
                                            </p>
                                            <div className="space-y-0.5 border-t pt-1">
                                                {employees?.filter(e => e.teamId === visit.teamIds?.[i]).slice(0, 2).map(e => (
                                                    <p key={e.id} className="text-[9px] font-medium text-slate-600 truncate">• {e.fullName}</p>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {!visit.teamNames?.length && <p className="text-[10px] italic text-center pt-4 text-muted-foreground">لم يتم تعيين فرق</p>}
                                </div>
                            )}
                        </div>
                    </TableCell>

                    <TableCell className="p-4 border-l align-top">
                        <div className="space-y-3 h-full">
                            <Badge className={cn(
                                "border-none font-black text-[9px] uppercase px-3",
                                isConfirmed ? "bg-green-600 text-white" : "bg-slate-100 text-slate-800"
                            )}>
                                {isConfirmed ? 'تقرير الإنجاز الفعلي المعتمد' : 'يوميات الأعمال المطلوبة'}
                            </Badge>
                            <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed border-slate-200 h-[calc(100%-35px)] overflow-y-auto">
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                    {isConfirmed ? visit.confirmationData?.notes : (visit.details || 'بانتظار تنفيذ الأعمال...') }
                                </p>
                            </div>
                        </div>
                    </TableCell>

                    <TableCell className="text-center align-middle">
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl hover:bg-primary hover:text-white transition-all shadow-md bg-white border" asChild>
                            <Link href={`/dashboard/construction/field-visits/${visit.id}`}>
                                <Eye className="h-6 w-6" />
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </Card>
  );
}
