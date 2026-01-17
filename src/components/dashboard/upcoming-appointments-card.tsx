'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { appointments } from '@/lib/data';

export function UpcomingAppointmentsCard() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const upcomingCount = appointments.filter(a => new Date(a.date) >= new Date()).length;
        setCount(upcomingCount);
    }, []);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                    in the next 7 days
                </p>
            </CardContent>
        </Card>
    );
}
