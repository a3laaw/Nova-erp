'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, Timestamp } from 'firebase/firestore';
import type { Appointment } from '@/lib/types';

export function UpcomingAppointmentsCard() {
    const { firestore } = useFirebase();

    const appointmentsQuery = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        return [
            where('appointmentDate', '>=', Timestamp.fromDate(today))
        ];
    }, []);

    const { data: appointments, loading } = useSubscription<Appointment>(firestore, 'appointments', appointmentsQuery);

    const count = useMemo(() => {
        if (loading || !appointments) return 0;
        return appointments.length;
    }, [appointments, loading]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : count}</div>
                <p className="text-xs text-muted-foreground">
                    All upcoming appointments
                </p>
            </CardContent>
        </Card>
    );
}
