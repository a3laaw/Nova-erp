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
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, getDocs, Timestamp, orderBy, limit, type QueryConstraint } from 'firebase/firestore';
import type { Appointment, Client } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';

interface PendingVisit extends Appointment {
    clientName?: string;
}

export function PendingVisits() {
    const { firestore } = useFirebase();
    const { user, loading: userLoading } = useAuth();
    
    // NEW: Direct query for pending visits. This is the core of the fix.
    const pendingVisitsQuery = useMemo(() => {
        if (userLoading || !user) return null;
        
        // Base query for past, non-updated architectural appointments
        const now = new Date();
        const constraints: QueryConstraint[] = [
            where('type', '==', 'architectural'),
            where('status', '!=', 'cancelled'),
            where('appointmentDate', '<', Timestamp.fromDate(now)),
            where('workStageUpdated', '==', false),
            orderBy('appointmentDate', 'desc'),
            limit(10) // Limit to a reasonable number for the dashboard
        ];

        // Add user-specific filter if not an admin
        if (user.role !== 'Admin' && user.employeeId) {
            constraints.push(where('engineerId', '==', user.employeeId));
        }
        
        return constraints;
    }, [user, userLoading]);

    const { data: pendingVisits, loading: visitsLoading } = useSubscription<Appointment>(
        firestore, 
        pendingVisitsQuery ? 'appointments' : null, 
        pendingVisitsQuery || []
    );

    const [augmentedVisits, setAugmentedVisits] = useState<PendingVisit[]>([]);
    const [clientsMap, setClientsMap] = useState<Map<string, Client>>(new Map());
    const [clientsFetched, setClientsFetched] = useState(false);

    // Effect to fetch client data only for the pending visits received from the subscription
    useEffect(() => {
        if (!firestore || pendingVisits.length === 0) {
            setClientsFetched(true);
            return;
        }

        const clientIds = [...new Set(pendingVisits.map(v => v.clientId).filter(Boolean) as string[])];
        const newClientIdsToFetch = clientIds.filter(id => !clientsMap.has(id));

        if (newClientIdsToFetch.length === 0) {
            if(!clientsFetched) setClientsFetched(true);
            return;
        }
        
        const fetchClients = async () => {
            const batches = [];
            for (let i = 0; i < newClientIdsToFetch.length; i += 30) {
                batches.push(newClientIdsToFetch.slice(i, i + 30));
            }
            
            try {
                const newClientsMap = new Map<string, Client>();
                for (const batch of batches) {
                    const clientsQuery = query(collection(firestore, 'clients'), where('__name__', 'in', batch));
                    const clientsSnapshot = await getDocs(clientsQuery);
                    clientsSnapshot.forEach(doc => {
                        newClientsMap.set(doc.id, doc.data() as Client);
                    });
                }
                setClientsMap(prev => new Map([...prev, ...newClientsMap]));
            } catch (error) {
                console.error("Error fetching clients for pending visits:", error);
            } finally {
                setClientsFetched(true);
            }
        };

        fetchClients();
    }, [pendingVisits, firestore, clientsMap, clientsFetched]);
    
    // Augment visits with client names once clients are fetched
    useEffect(() => {
        const augmented = pendingVisits.map(visit => ({
            ...visit,
            clientName: visit.clientId ? (clientsMap.get(visit.clientId)?.nameAr || visit.clientName) : visit.clientName,
        }));
        setAugmentedVisits(augmented);
    }, [pendingVisits, clientsMap]);
    
    const loading = visitsLoading || !clientsFetched;
    
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
    
    if (augmentedVisits.length === 0) {
        return null; // Don't render the card if there are no pending visits
    }

    return (
         <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle />
                    زيارات معلقة بانتظار تحديث ({augmentedVisits.length})
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400/80">
                    هذه الزيارات قد مضى تاريخها ولم يتم تحديث مرحلة العمل الخاصة بها.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 overflow-y-auto">
                {augmentedVisits.map(visit => (
                     <Link href={`/dashboard/appointments/${visit.id}`} key={visit.id} className="block p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{visit.clientName || 'عميل غير معروف'}</span>
                             <span className="text-xs text-muted-foreground">{toFirestoreDate(visit.appointmentDate) ? format(toFirestoreDate(visit.appointmentDate)!, 'dd/MM/yyyy') : ''}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{visit.title}</p>
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}
