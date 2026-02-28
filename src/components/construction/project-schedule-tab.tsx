
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ConstructionProject, BoqItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock3, AlertCircle, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, differenceInDays, startOfMonth, addMonths, eachMonthOfInterval, isWithinInterval, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn } from '@/lib/utils';

interface ProjectScheduleTabProps {
  project: ConstructionProject;
}

export function ProjectScheduleTab({ project }: ProjectScheduleTabProps) {
  const { firestore } = useFirebase();
  
  const itemsQuery = React.useMemo(() => {
    if (!project.boqId) return null;
    return [orderBy('itemNumber')];
  }, [project.boqId]);

  const { data: items, loading } = useSubscription<BoqItem>(
    firestore, 
    project.boqId ? `boqs/${project.boqId}/items` : null, 
    itemsQuery || []
  );

  const scheduleRange = React.useMemo(() => {
    if (!project.startDate || !project.endDate) return null;
    const start = toFirestoreDate(project.startDate)!;
    const end = toFirestoreDate(project.endDate)!;
    
    return {
        start: startOfMonth(start),
        end: endOfMonth(addMonths(end, 1)), // Add one month buffer for display
        months: eachMonthOfInterval({ start, end: addMonths(end, 1) })
    };
  }, [project]);

  if (loading) return <Skeleton className="h-96 w-full rounded-3xl" />;

  if (!project.boqId) {
    return (
        <Card className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10">
            <Clock3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">لم يتم ربط مقايسة للمشروع</h3>
            <p className="text-muted-foreground mt-2">يجب ربط جدول كميات (BOQ) أولاً وتحديد تواريخ البدء والانتهاء للبنود لعرض الجدول الزمني.</p>
        </Card>
    );
  }

  const getPositionStyles = (itemStart: Date | null, itemEnd: Date | null) => {
    if (!scheduleRange || !itemStart || !itemEnd) return { display: 'none' };
    
    const totalDays = differenceInDays(scheduleRange.end, scheduleRange.start);
    const startOffset = differenceInDays(itemStart, scheduleRange.start);
    const duration = differenceInDays(itemEnd, itemStart) + 1;

    const left = (startOffset / totalDays) * 100;
    const width = (duration / totalDays) * 100;

    return {
        right: `${left}%`, // RTL
        width: `${width}%`,
    };
  };

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="rounded-3xl border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black">مخطط الجدول الزمني للمشروع (Gantt Chart)</CardTitle>
                    <CardDescription>التوزيع الزمني لبنود المقايسة المعتمدة حسب تواريخ التنفيذ.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">المخطط الزمني</Badge>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    {/* Time Header */}
                    <div className="flex border-b bg-muted/10">
                        <div className="w-1/3 p-4 font-bold border-l bg-muted/20 sticky right-0 z-10">بيان الأعمال</div>
                        <div className="flex-1 flex">
                            {scheduleRange?.months.map((month, i) => (
                                <div key={i} className="flex-1 text-center p-4 text-[10px] font-black border-l border-muted-foreground/10 uppercase tracking-tighter">
                                    {format(month, 'MMM yyyy', { locale: ar })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Items Grid */}
                    <div className="divide-y">
                        {items.map((item) => {
                            const itemStart = toFirestoreDate(item.startDate);
                            const itemEnd = toFirestoreDate(item.endDate);
                            const hasDates = itemStart && itemEnd;

                            return (
                                <div key={item.id} className={cn("flex group transition-colors", item.isHeader ? "bg-muted/30 font-bold h-12" : "hover:bg-muted/5 h-10")}>
                                    <div 
                                        style={{ paddingRight: `${(item.level || 0) * 1.5 + 1}rem` }}
                                        className="w-1/3 p-2 text-sm border-l flex items-center truncate sticky right-0 bg-background group-hover:bg-muted/10 z-10"
                                    >
                                        <span className="font-mono text-[10px] text-muted-foreground ml-2">{item.itemNumber}</span>
                                        {item.description}
                                    </div>
                                    <div className="flex-1 relative bg-grid-slate-100">
                                        {hasDates && scheduleRange && (
                                            <div 
                                                className={cn(
                                                    "absolute top-2 bottom-2 rounded-full shadow-sm flex items-center justify-center text-[8px] font-bold text-white overflow-hidden transition-all group-hover:scale-y-110",
                                                    item.isHeader ? "bg-primary opacity-40 h-1" : "bg-blue-600"
                                                )}
                                                style={getPositionStyles(itemStart, itemEnd)}
                                            >
                                                {!item.isHeader && (
                                                    <span className="px-2 truncate">{differenceInDays(itemEnd, itemStart)} يوم</span>
                                                )}
                                            </div>
                                        )}
                                        {/* Grid Lines Overlay */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {scheduleRange?.months.map((_, i) => (
                                                <div key={i} className="flex-1 border-l border-muted-foreground/5" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alert className="rounded-2xl border-blue-200 bg-blue-50/50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-black">تحليل الجدولة</AlertTitle>
              <AlertDescription className="text-blue-700 text-xs">
                  يتم رسم المخطط بناءً على تواريخ البدء والانتهاء المحددة في المقايسة (BOQ). يمكنك تعديل هذه التواريخ من "محرر المقايسة".
              </AlertDescription>
          </Alert>
          <Alert className="rounded-2xl border-orange-200 bg-orange-50/50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-800 font-black">تنبيهات التأخير</AlertTitle>
              <AlertDescription className="text-orange-700 text-xs">
                  يقوم النظام مستقبلاً بمقارنة تواريخ التقارير اليومية مع هذا المخطط لتحديد التأخيرات آلياً بالذكاء الاصطناعي.
              </AlertDescription>
          </Alert>
      </div>
    </div>
  );
}
