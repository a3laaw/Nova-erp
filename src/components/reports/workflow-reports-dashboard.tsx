'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { useFirebase, useSubscription } from '@/firebase';
import type { Client, ClientTransaction, Employee, Appointment } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { AlertTriangle, UserX, Clock, ArrowRight, Hourglass } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import Link from 'next/link';
import { Button } from '../ui/button';

// Report 1: Delayed Stages
function DelayedStagesReport({ transactions, clients, employees, loading }: any) {
    const delayedStages = useMemo(() => {
        if (loading || !transactions) return [];
        const now = new Date();
        return transactions
            .flatMap((tx: ClientTransaction) => (tx.stages || [])
                .filter(stage => stage.status === 'in-progress' && stage.expectedEndDate && isPast(stage.expectedEndDate.toDate()))
                .map(stage => ({
                    ...stage,
                    transactionId: tx.id,
                    transactionType: tx.transactionType,
                    clientId: tx.clientId,
                    clientName: clients.find((c: Client) => c.id === tx.clientId)?.nameAr,
                    engineerName: employees.find((e: Employee) => e.id === tx.assignedEngineerId)?.fullName,
                    delay: differenceInDays(now, stage.expectedEndDate!.toDate()),
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

// Report 2: Lost Opportunities
function LostOpportunitiesReport({ clients, appointments, employees, loading }: any) {
    const lostOpportunities = useMemo(() => {
        if (loading) return [];
        const newClients = clients.filter((c: Client) => c.status === 'new');
        return newClients
            .map((client: Client) => {
                const clientAppointments = appointments.filter((a: Appointment) => a.clientId === client.id && a.type === 'architectural');
                if (clientAppointments.length === 0) return null;
                
                clientAppointments.sort((a,b) => b.appointmentDate.toDate() - a.appointmentDate.toDate());
                const lastAppointment = clientAppointments[0];

                return {
                    clientId: client.id,
                    clientName: client.nameAr,
                    visitCount: clientAppointments.length,
                    lastVisit: lastAppointment.appointmentDate.toDate(),
                    engineerName: employees.find((e: Employee) => e.id === lastAppointment.engineerId)?.fullName,
                }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b.visitCount - a.visitCount);

    }, [clients, appointments, employees, loading]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600"><UserX /> الفرص الضائعة</CardTitle>
                <CardDescription>العملاء الذين قاموا بزيارات ولم يتعاقدوا.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && <Skeleton className="h-24" />}
                {!loading && lostOpportunities.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد فرص ضائعة حاليًا.</p>}
                {!loading && (
                    <div className="space-y-3">
                        {lostOpportunities.slice(0, 5).map((opp: any) => (
                           <div key={opp.clientId} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                    <Link href={`/dashboard/clients/${opp.clientId}`} className="font-semibold hover:underline">{opp.clientName}</Link>
                                    <p className="text-xs text-muted-foreground">آخر زيارة: {format(opp.lastVisit, 'dd/MM/yyyy')} بواسطة {opp.engineerName}</p>
                                </div>
                                <div className="font-bold text-orange-600">{opp.visitCount} زيارات</div>
                           </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Report 3: Stalled Stages
function StalledStagesReport({ transactions, clients, employees, loading }: any) {
    const stalledStages = useMemo(() => {
        if (loading || !transactions) return [];
        const now = new Date();
        const STALLED_THRESHOLD_DAYS = 14;

        return transactions
            .flatMap((tx: ClientTransaction) => (tx.stages || [])
                .filter(stage => stage.status === 'in-progress' && stage.startDate && differenceInDays(now, stage.startDate.toDate()) > STALLED_THRESHOLD_DAYS)
                .map(stage => ({
                    ...stage,
                    transactionId: tx.id,
                    transactionType: tx.transactionType,
                    clientId: tx.clientId,
                    clientName: clients.find((c: Client) => c.id === tx.clientId)?.nameAr,
                    engineerName: employees.find((e: Employee) => e.id === tx.assignedEngineerId)?.fullName,
                    stalledDays: differenceInDays(now, stage.startDate!.toDate()),
                }))
            )
            .sort((a, b) => b.stalledDays - a.stalledDays);
    }, [transactions, clients, employees, loading]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600"><Hourglass /> المراحل الخاملة</CardTitle>
                <CardDescription>المراحل التي لم يتم تحديثها لأكثر من 14 يومًا.</CardDescription>
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

// Main Dashboard Component
export function WorkflowReportsDashboard() {
    const { firestore } = useFirebase();

    const { data: clients, loading: clientsLoading } = useSubscription<Client>(firestore, 'clients');
    const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction>(firestore, 'clients'); // This seems incorrect
    const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
    const { data: appointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments');

    const loading = clientsLoading || transactionsLoading || employeesLoading || appointmentsLoading;

    return (
        <div className="grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            <DelayedStagesReport transactions={transactions} clients={clients} employees={employees} loading={loading} />
            <LostOpportunitiesReport clients={clients} appointments={appointments} employees={employees} loading={loading} />
            <StalledStagesReport transactions={transactions} clients={clients} employees={employees} loading={loading} />
        </div>
    );
}
