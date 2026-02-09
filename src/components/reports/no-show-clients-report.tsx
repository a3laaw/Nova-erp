
'use client';
import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import type { Appointment, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

interface ProspectiveClient {
  name: string;
  mobile: string;
  engineerId: string;
  engineerName: string;
  lastAppointmentDate: Date;
  visitCount: number;
}

interface NoShowClientsReportProps {
    appointments: Appointment[];
    employees: Employee[];
    loading: boolean;
}

export function NoShowClientsReport({ appointments, employees, loading }: NoShowClientsReportProps) {
    const noShowClients = useMemo(() => {
        if (loading || !appointments || !employees) return [];
        
        const prospectiveAppointments = appointments.filter(a => 
            !a.clientId && 
            a.clientMobile &&
            a.status !== 'cancelled' && 
            !a.workStageUpdated &&
            a.appointmentDate &&
            isPast(a.appointmentDate.toDate())
        );

        const clientsMap = new Map<string, ProspectiveClient>();
        const engineersMap = new Map(employees.map(e => [e.id, e.fullName]));

        prospectiveAppointments.forEach(appt => {
            if (!appt.clientMobile || !appt.clientName) return;

            const existing = clientsMap.get(appt.clientMobile);
            const appointmentDate = toFirestoreDate(appt.appointmentDate)!;
            const engineerName = engineersMap.get(appt.engineerId) || 'غير معروف';

            if (existing) {
                existing.visitCount += 1;
                if (appointmentDate > existing.lastAppointmentDate) {
                    existing.lastAppointmentDate = appointmentDate;
                    existing.engineerName = engineerName;
                    existing.engineerId = appt.engineerId;
                }
            } else {
                clientsMap.set(appt.clientMobile, {
                    name: appt.clientName,
                    mobile: appt.clientMobile,
                    engineerId: appt.engineerId,
                    engineerName: engineerName,
                    lastAppointmentDate: appointmentDate,
                    visitCount: 1,
                });
            }
        });
        return Array.from(clientsMap.values()).sort((a,b) => b.lastAppointmentDate.getTime() - a.lastAppointmentDate.getTime());
    }, [appointments, employees, loading]);

    return (
        <div className="space-y-3">
            {loading && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded-md">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/4" />
                </div>
            ))}
            {!loading && noShowClients.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا يوجد عملاء لم يحضروا مواعيدهم.</p>}
            {!loading && noShowClients.map(client => (
                <div key={client.mobile} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                    <div>
                        <p className="font-semibold">{client.name}</p>
                        <p className="text-xs text-muted-foreground">آخر موعد: {format(client.lastAppointmentDate, 'dd/MM/yyyy')} مع {client.engineerName}</p>
                    </div>
                    <div className="font-bold text-destructive">{client.visitCount} زيارات</div>
                </div>
            ))}
        </div>
    );
}

  