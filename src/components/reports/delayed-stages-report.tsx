'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import Link from 'next/link';
import type { Client, ClientTransaction, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

interface DelayedStagesReportProps {
    transactions: (ClientTransaction & { clientId: string })[];
    clients: Client[];
    employees: Employee[];
    loading: boolean;
}

export function DelayedStagesReport({ transactions, clients, employees, loading }: DelayedStagesReportProps) {
    const delayedStages = useMemo(() => {
        if (loading || !transactions) return [];
        const now = new Date();
        return transactions
            .flatMap((tx: ClientTransaction) => (tx.stages || [])
                .filter(stage => {
                    const expectedEndDate = toFirestoreDate(stage.expectedEndDate);
                    return stage.status === 'in-progress' && expectedEndDate && isPast(expectedEndDate);
                })
                .map(stage => ({
                    ...stage,
                    transactionId: tx.id,
                    transactionType: tx.transactionType,
                    clientId: tx.clientId,
                    clientName: clients.find((c: Client) => c.id === tx.clientId)?.nameAr,
                    engineerName: employees.find((e: Employee) => e.id === tx.assignedEngineerId)?.fullName,
                    delay: differenceInDays(now, toFirestoreDate(stage.expectedEndDate)!),
                }))
            )
            .sort((a, b) => b.delay - a.delay);
    }, [transactions, clients, employees, loading]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><Clock /> المهام المتأخرة</CardTitle>
                <CardDescription>المراحل التي تجاوزت تاريخ الانتهاء المتوقع.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && <Skeleton className="h-24" />}
                {!loading && delayedStages.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد مهام متأخرة حاليًا.</p>}
                {!loading && (
                    <div className="space-y-3">
                        {delayedStages.slice(0, 5).map((stage: any) => (
                            <div key={`${stage.transactionId}-${stage.stageId}`} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/dashboard/clients/${stage.clientId}/transactions/${stage.transactionId}`} className="font-semibold hover:underline">{stage.transactionType}</Link>
                                    <p className="text-xs text-muted-foreground">{stage.clientName} - {stage.name}</p>
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-destructive">{stage.delay} أيام</p>
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
