
'use client';

import * as React from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { ConstructionProject, BoqItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock3, AlertCircle, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import { format, differenceInDays, startOfMonth, addMonths, eachMonthOfInterval, isWithinInterval, endOfMonth, min, max } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
    if (loading || items.length === 0) return null;

    const dates = items
        .flatMap(i => [toFirestoreDate(i.startDate), toFirestoreDate(i.endDate)])
        .filter((d): d is Date => d !== null);

    if (dates.length === 0) return null;

    const start = startOfMonth(min(dates));
    const end = endOfMonth(max(dates));
    
    return {
        start,
        end,
        totalDays: Math.max(1, differenceInDays(end, start)),
        months: eachMonthOfInterval({ start, end })
    };
  }, [items, loading]);

  const getPositionStyles = (itemStart: Date | null, itemEnd: Date | null) => {
    if (!scheduleRange || !itemStart || !itemEnd) return { display: 'none' };
    
    const startOffset = Math.max(0, differenceInDays(itemStart, scheduleRange.start));
    const duration = Math.max(1, differenceInDays(itemEnd, itemStart) + 1);

    const right = (startOffset / scheduleRange.totalDays) * 100;
    const width = (duration / scheduleRange.totalDays) * 100;

    return {
        right: `${right}%`, // RTL support
        width: `${width}%`,
    };
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-3xl" />;

  if (!project.boqId || items.length === 0) {
    return (
        <Card className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10">
            <Clock3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">لم يتم ربط مقايسة للمشروع</h3>
            <p className="text-muted-foreground mt-2">يجب ربط جدول كميات (BOQ) أولاً وتحديد تواريخ البدء والانتهاء للبنود لعرض الجدول الزمني.</p>
        </Card>
    );
  }

  if (!scheduleRange) {
    return (
        <Card className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold">تواريخ التنفيذ غير محددة</h3>
            <p className="text-muted-foreground mt-2">يرجى الدخول لـ "محرر المقايسة" وتحديد تاريخ البدء والانتهاء لكل بند لتتمكن من رؤية المخطط الزمني.</p>
        </Card>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white dark:bg-card">
        <CardHeader className="bg-muted/30 border-b">
            <div className="flex justify-between items-center">
                <div className="space-y-1">
                    <CardTitle className="text-xl font-black">مخطط الجدول الزمني (Gantt Chart)</CardTitle>
                    <CardDescription>التوزيع الزمني لبنود المقايسة المعتمدة حسب تواريخ التنفيذ المخططة.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-600" />
                        <span className="text-[10px] font-bold">بند عمل</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1 w-6 bg-primary/40 rounded-full" />
                        <span className="text-[10px] font-bold">مرحلة رئيسية (WBS)</span>
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                    {/* Time Header */}
                    <div className="flex border-b bg-muted/10">
                        <div className="w-1/3 p-4 font-bold border-l bg-muted/20 sticky right-0 z-20 shadow-xl">بيان الأعمال</div>
                        <div className="flex-1 flex">
                            {scheduleRange.months.map((month, i) => (
                                <div key={i} className="flex-1 text-center p-4 text-[10px] font-black border-l border-muted-foreground/10 uppercase tracking-tighter bg-muted/5">
                                    {format(month, 'MMM yyyy', { locale: ar })}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Items Grid */}
                    <div className="divide-y relative">
                        {items.map((item) => {
                            const itemStart = toFirestoreDate(item.startDate);
                            const itemEnd = toFirestoreDate(item.endDate);
                            const hasDates = itemStart && itemEnd;

                            return (
                                <div key={item.id} className={cn("flex group transition-colors", item.isHeader ? "bg-muted/30 font-bold h-12" : "hover:bg-primary/5 h-10")}>
                                    <div 
                                        style={{ paddingRight: `${(item.level || 0) * 1.5 + 1}rem` }}
                                        className="w-1/3 p-2 text-sm border-l flex items-center truncate sticky right-0 bg-background group-hover:bg-muted/10 z-10"
                                    >
                                        <span className="font-mono text-[9px] text-muted-foreground ml-2 opacity-60">[{item.itemNumber}]</span>
                                        <span className="truncate">{item.description}</span>
                                    </div>
                                    <div className="flex-1 relative bg-grid-slate-50">
                                        {hasDates && (
                                            <div 
                                                className={cn(
                                                    "absolute top-2 bottom-2 rounded-full shadow-md flex items-center justify-center text-[8px] font-bold text-white overflow-hidden transition-all group-hover:brightness-110",
                                                    item.isHeader ? "bg-primary opacity-30 h-1 mt-2" : "bg-blue-600"
                                                )}
                                                style={getPositionStyles(itemStart, itemEnd)}
                                            >
                                                {!item.isHeader && (
                                                    <span className="px-2 truncate">{differenceInDays(itemEnd, itemStart)} يوم</span>
                                                )}
                                            </div>
                                        )}
                                        {/* Grid Line vertical markers */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {scheduleRange.months.map((_, i) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
          <Card className="p-4 border-blue-200 bg-blue-50/20">
              <div className="flex gap-3">
                  <Info className="h-5 w-5 text-blue-600 mt-1" />
                  <div className="space-y-1">
                      <p className="font-black text-blue-900">كيفية تحديث الجدولة؟</p>
                      <p className="text-xs text-blue-700 leading-relaxed">
                          يتم رسم هذا المخطط آلياً بناءً على تواريخ البدء والانتهاء المحددة لكل بند داخل "محرر المقايسة (BOQ)". لتغيير المواعيد، يرجى تعديلها من هناك.
                      </p>
                  </div>
              </div>
          </Card>
          <Card className="p-4 border-orange-200 bg-orange-50/20">
              <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-orange-600 mt-1" />
                  <div className="space-y-1">
                      <p className="font-black text-orange-900">تتبع الإنجاز الفعلي</p>
                      <p className="text-xs text-orange-700 leading-relaxed">
                          هذا المخطط يعرض التواريخ "المخططة". قريباً سيتم دمج بيانات التقارير اليومية لعرض "الإنجاز الفعلي" جنباً إلى جنب مع المخطط (S-Curve).
                      </p>
                  </div>
              </div>
          </Card>
      </div>
    </div>
  );
}
