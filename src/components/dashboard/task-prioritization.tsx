'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { ClipboardList, Clock, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isPast, differenceInDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

export function TaskPrioritization() {
  const { transactions, projects, loading } = useAnalyticalData();
  const { theme } = useAppTheme();
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);

  useEffect(() => {
    if (loading || !transactions || !projects) return;
    
    const now = new Date();
    const tasks: any[] = [];
    const activeProjectIds = new Set(projects.map(p => p.id));

    transactions.forEach(tx => {
        if (tx.status !== 'in-progress') return;
        if (tx.projectId && !activeProjectIds.has(tx.projectId)) return;

        (tx.stages || []).forEach(stage => {
            const expectedEnd = toFirestoreDate(stage.expectedEndDate);
            if (stage.status === 'in-progress' && expectedEnd && isPast(expectedEnd)) {
                tasks.push({
                    id: `${tx.id}-${stage.stageId}`,
                    projectName: tx.transactionType,
                    stageName: stage.name,
                    delayDays: differenceInDays(now, expectedEnd),
                    clientId: tx.clientId,
                    transactionId: tx.id
                });
            }
        });
    });

    const sortedTasks = tasks.sort((a, b) => b.delayDays - a.delayDays).slice(0, 5);
    
    setUrgentTasks(prev => {
        if (JSON.stringify(prev) === JSON.stringify(sortedTasks)) return prev;
        return sortedTasks;
    });
  }, [transactions, projects, loading]); 

  const isGlass = theme === 'glass';

  return (
    <Card className={cn(
        "h-full flex flex-col rounded-3xl border-none shadow-sm overflow-hidden",
        isGlass && "glass-effect active-glow"
    )}>
      <CardHeader className={cn(
          "border-b pb-4",
          isGlass ? "bg-white/5" : "bg-orange-500/5"
      )}>
        <CardTitle className="text-lg font-black flex items-center gap-2">
          {isGlass ? <Sparkles className="h-5 w-5 text-primary animate-pulse" /> : <ClipboardList className="h-5 w-5 text-orange-600" />}
          تنبيهات الأولويات (WBS)
        </CardTitle>
        <CardDescription className={isGlass ? "text-white/60" : ""}>المهام الميدانية التي تجاوزت جدولها الزمني المخطط.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-6">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : urgentTasks.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center opacity-40 grayscale">
            <ClipboardList className="h-10 w-10 mb-2" />
            <p className="text-sm font-bold">لا توجد مهام متأخرة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {urgentTasks.map((task) => (
              <Link 
                href={`/dashboard/clients/${task.clientId}/transactions/${task.transactionId}`}
                key={task.id} 
                className={cn(
                    "flex items-center justify-between p-3 border-2 border-transparent transition-all rounded-2xl group",
                    isGlass ? "bg-white/5 hover:bg-white/10 hover:border-primary/30" : "bg-muted/20 hover:bg-white hover:border-orange-200 hover:shadow-md"
                )}
              >
                <div className="space-y-1">
                  <p className={cn("font-black text-sm transition-colors", isGlass ? "text-white" : "group-hover:text-orange-700")}>{task.projectName}</p>
                  <p className={cn("text-[10px] font-bold flex items-center gap-1", isGlass ? "text-white/50" : "text-muted-foreground")}>
                    <Clock className="h-3 w-3" /> متأخر في مرحلة: {task.stageName}
                  </p>
                </div>
                <div className="text-left">
                    <Badge variant="destructive" className={cn(
                        "border-none font-black text-[10px]",
                        isGlass ? "bg-neon-pink text-white" : "bg-red-100 text-red-700"
                    )}>
                        +{task.delayDays} يوم
                    </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}