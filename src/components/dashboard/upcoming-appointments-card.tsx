'use client';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, where, Timestamp } from 'firebase/firestore';
import type { Appointment } from '@/lib/types';

export function UpcomingAppointmentsCard() {
    const { firestore } = useFirebase();

    const appointmentsQuery = useMemo(() => {
        if (!firestore) return null;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        return query(
            collection(firestore, 'appointments'), 
            where('appointmentDate', '>=', Timestamp.fromDate(today))
        );
    }, [firestore]);

    const [snapshot, loading] = useCollection(appointmentsQuery);

    const count = useMemo(() => {
        if (loading || !snapshot) return 0;
        return snapshot.docs.length;
    }, [snapshot, loading]);

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
