'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UserX } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import type { Appointment, Employee } from '@/lib/types';

interface ProspectiveClient {
  name: string;
  mobile: string;
  engineerId: string;
  engineerName: string;
  lastAppointmentDate: Date;
  visitCount: number;
}

interface ProspectiveClientsReportProps {
    appointments: Appointment[];
    employees: Employee[];
    loading: boolean;
}

export function ProspectiveClientsReport({ appointments, employees, loading }: ProspectiveClientsReportProps) {
    const prospectiveClients = useMemo(() => {
        if (loading || !appointments || !employees) return [];
        
        const prospectiveAppointments = appointments.filter(a => !a.clientId && a.clientMobile);

        const clientsMap = new Map<string, ProspectiveClient>();

        prospectiveAppointments.forEach(appt => {
            if (!appt.clientMobile || !appt.clientName) return;

            const existing = clientsMap.get(appt.clientMobile);
            const appointmentDate = appt.appointmentDate?.toDate ? appt.appointmentDate.toDate() : new Date();

            const engineerName = employees.find(e => e.id === appt.engineerId)?.fullName || 'غير معروف';

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
        return Array.from(clientsMap.values()).sort((a,b) => b.visitCount - a.visitCount);
    }, [appointments, employees, loading]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-600"><UserX /> عملاء محتملون</CardTitle>
                <CardDescription>العملاء الذين قاموا بزيارات ولم يتم إنشاء ملف لهم بعد.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading && <Skeleton className="h-24" />}
                {!loading && prospectiveClients.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا يوجد عملاء محتملون حاليًا.</p>}
                {!loading && (
                    <div className="space-y-3">
                        {prospectiveClients.slice(0, 5).map((opp) => (
                           <div key={opp.mobile} className="flex justify-between items-center text-sm p-2 rounded-md hover:bg-muted/50">
                                <div>
                                     <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(opp.name)}&mobile=${encodeURIComponent(opp.mobile)}`} className="font-semibold hover:underline">{opp.name}</Link>
                                    <p className="text-xs text-muted-foreground">آخر زيارة: {format(opp.lastAppointmentDate, 'dd/MM/yyyy')} بواسطة {opp.engineerName}</p>
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
