
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
import { ClipboardList, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isPast, differenceInDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';

export function TaskPrioritization() {
  const { transactions, projects, loading } = useAnalyticalData();
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
    
    // Safety check to prevent infinite loop
    setUrgentTasks(prev => {
        if (JSON.stringify(prev) === JSON.stringify(sortedTasks)) return prev;
        return sortedTasks;
    });
  }, [transactions, projects, loading]); 

  return (
    <Card className="h-full flex flex-col rounded-3xl border-none shadow-sm overflow-hidden">
      <CardHeader className="bg-orange-500/5 border-b pb-4">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-orange-600" />
          تنبيهات الأولويات (WBS)
        </CardTitle>
        <CardDescription>المهام الميدانية التي تجاوزت جدولها الزمني المخطط.</CardDescription>
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
                className="flex items-center justify-between p-3 border-2 border-transparent bg-muted/20 hover:bg-white hover:border-orange-200 hover:shadow-md transition-all rounded-2xl group"
              >
                <div className="space-y-1">
                  <p className="font-black text-sm group-hover:text-orange-700 transition-colors">{task.projectName}</p>
                  <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-1">
                    <Clock className="h-3 w-3" /> متأخر في مرحلة: {task.stageName}
                  </p>
                </div>
                <div className="text-left">
                    <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none font-black text-[10px]">
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
