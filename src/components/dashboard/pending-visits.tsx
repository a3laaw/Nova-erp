
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { Appointment, Client } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PendingVisit extends Appointment {
    clientName?: string;
}

export function PendingVisits() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) {
            setLoading(false);
            return;
        }
        
        const fetchPendingVisits = async () => {
            setLoading(true);
            try {
                let appointmentsQuery;
                const appointmentsRef = collection(firestore, 'appointments');

                // If user is Admin, fetch all pending visits. Otherwise, fetch only for the current user.
                if (user.role === 'Admin') {
                    // Admin sees all architectural appointments. Filtering for pending happens client-side.
                    appointmentsQuery = query(
                        appointmentsRef,
                        where('type', '==', 'architectural')
                    );
                } else if (user.employeeId) {
                    // Other users only see their own.
                    appointmentsQuery = query(
                        appointmentsRef,
                        where('engineerId', '==', user.employeeId),
                        where('type', '==', 'architectural')
                    );
                } else {
                    setPendingVisits([]);
                    setLoading(false);
                    return;
                }

                const appointmentsSnapshot = await getDocs(appointmentsQuery);
                const allUserAppointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

                // CLIENT-SIDE FILTERING:
                const filteredPending = allUserAppointments.filter(appt => 
                    appt.status !== 'cancelled' &&
                    appt.appointmentDate && // Ensure date exists
                    isPast(appt.appointmentDate.toDate()) &&
                    !appt.workStageUpdated
                );
                
                // CLIENT-SIDE SORTING:
                filteredPending.sort((a, b) => b.appointmentDate.toDate().getTime() - a.appointmentDate.toDate().getTime());

                if (filteredPending.length === 0) {
                    setPendingVisits([]);
                    setLoading(false);
                    return;
                }

                // Fetch client names for the pending visits
                const clientIds = [...new Set(filteredPending.map(a => a.clientId).filter(Boolean) as string[])];

                if (clientIds.length > 0) {
                    // Use a 'in' query which is efficient for up to 30 IDs.
                    const clientsQuery = query(collection(firestore, 'clients'), where('__name__', 'in', clientIds));
                    const clientsSnapshot = await getDocs(clientsQuery);
                    const clientsMap = new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client]));
    
                    const augmentedPendingVisits = filteredPending.map(appt => ({
                        ...appt,
                        clientName: clientsMap.get(appt.clientId)?.nameAr || appt.clientName || 'عميل غير معروف'
                    }));
    
                    setPendingVisits(augmentedPendingVisits);
                } else {
                     setPendingVisits(filteredPending.map(appt => ({...appt, clientName: appt.clientName || 'عميل غير معروف'})));
                }


            } catch (error) {
                console.error("Error fetching pending visits:", error);
                // I won't toast here to avoid spamming the user if the error persists.
            } finally {
                setLoading(false);
            }
        };
        fetchPendingVisits();
    }, [firestore, user]);

    if (loading) {
        return (
            <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle />
                        زيارات معلقة بانتظار تحديث
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-5/6" />
                    <Skeleton className="h-5 w-3/4" />
                </CardContent>
            </Card>
        );
    }
    
    if (pendingVisits.length === 0) {
        return null; // Don't render the card if there are no pending visits
    }

    return (
         <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle />
                    زيارات معلقة بانتظار تحديث ({pendingVisits.length})
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400/80">
                    هذه الزيارات قد مضى تاريخها ولم يتم تحديث مرحلة العمل الخاصة بها.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 overflow-y-auto">
                {pendingVisits.slice(0, 5).map(visit => (
                     <Link href={`/dashboard/appointments/${visit.id}`} key={visit.id} className="block p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{visit.clientName}</span>
                             <span className="text-xs text-muted-foreground">{format(visit.appointmentDate.toDate(), 'dd/MM/yyyy')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{visit.title}</p>
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}
