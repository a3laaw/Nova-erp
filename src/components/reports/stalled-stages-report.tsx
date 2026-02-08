'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Hourglass } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import Link from 'next/link';
import type { Client, ClientTransaction, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

interface StalledStagesReportProps {
    transactions: (ClientTransaction & { clientId: string })[];
    clients: Client[];
    employees: Employee[];
    loading: boolean;
}

const STALLED_THRESHOLD_DAYS = 14;

export function StalledStagesReport({ transactions, clients, employees, loading }: StalledStagesReportProps) {
    const stalledStages = useMemo(() => {
        if (loading || !transactions) return [];
        const now = new Date();
        
        return transactions
            .flatMap((tx: ClientTransaction) => (tx.stages || [])
                .filter(stage => {
                    const startDate = toFirestoreDate(stage.startDate);
                    return stage.status === 'in-progress' && startDate && differenceInDays(now, startDate) > STALLED_THRESHOLD_DAYS;
                })
                .map(stage => ({
                    ...stage,
                    transactionId: tx.id,
                    transactionType: tx.transactionType,
                    clientId: tx.clientId,
                    clientName: clients.find((c: Client) => c.id === tx.clientId)?.nameAr,
                    engineerName: employees.find((e: Employee) => e.id === tx.assignedEngineerId)?.fullName,
                    stalledDays: differenceInDays(now, toFirestoreDate(stage.startDate)!),
                }))
            )
            .sort((a, b) => b.stalledDays - a.stalledDays);
    }, [transactions, clients, employees, loading]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600"><Hourglass /> المراحل الخاملة</CardTitle>
                <CardDescription>المراحل التي لم يتم تحديثها لأكثر من {STALLED_THRESHOLD_DAYS} يومًا.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && <Skeleton className="h-24" />}
                {!loading && stalledStages.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد مراحل خاملة حاليًا.</p>}
                {!loading && (
                    <div className="space-y-3">
                        {stalledStages.slice(0, 5).map((stage: any) => (
                           <div key={`${stage.transactionId}-${stage.stageId}`} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/dashboard/clients/${stage.clientId}/transactions/${stage.transactionId}`} className="font-semibold hover:underline">{stage.transactionType}</Link>
                                    <p className="text-xs text-muted-foreground">{stage.clientName} - {stage.name}</p>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-amber-600">متوقفة منذ {stage.stalledDays} يوم</p>
                                    <p className="text-xs text-muted-foreground">{stage.engineerName}</p>
                                </div>
                           </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
