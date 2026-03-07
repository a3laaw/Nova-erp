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
import { AlertCircle } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, getDocs, limit, type QueryConstraint } from 'firebase/firestore';
import type { Appointment, Client } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';

interface PendingVisit extends Appointment {
    clientName?: string;
}

/**
 * مكون الزيارات المعلقة: تم تبسيط الاستعلام ليعتمد على التصفية البرمجية 
 * لتجنب أخطاء الفهارس المركبة في Firestore.
 */
export function PendingVisits() {
    const { firestore } = useFirebase();
    const { user, loading: userLoading } = useAuth();
    
    const pendingVisitsQuery = useMemo(() => {
        if (userLoading || !user) return null;
        
        // استعلام مبسط: جلب الزيارات المعمارية التي لم يتم تحديث مرحلتها فقط
        const constraints: QueryConstraint[] = [
            where('type', '==', 'architectural'),
            where('workStageUpdated', '==', false),
            limit(50) 
        ];

        if (user.role !== 'Admin' && user.employeeId) {
            constraints.push(where('engineerId', '==', user.employeeId));
        }
        
        return constraints;
    }, [user, userLoading]);

    const { data: rawPendingVisits, loading: visitsLoading } = useSubscription<Appointment>(
        firestore, 
        pendingVisitsQuery ? 'appointments' : null, 
        pendingVisitsQuery || []
    );

    const [augmentedVisits, setAugmentedVisits] = useState<PendingVisit[]>([]);
    const [clientsMap, setClientsMap] = useState<Map<string, Client>>(new Map());
    const [clientsFetched, setClientsFetched] = useState(false);

    // تصفية الزيارات التي مضى تاريخها وترتيبها برمجياً
    const processedVisits = useMemo(() => {
        return rawPendingVisits
            .filter(v => {
                const date = toFirestoreDate(v.appointmentDate);
                return v.status !== 'cancelled' && date && isPast(date);
            })
            .sort((a, b) => (toFirestoreDate(b.appointmentDate)?.getTime() || 0) - (toFirestoreDate(a.appointmentDate)?.getTime() || 0))
            .slice(0, 10);
    }, [rawPendingVisits]);

    useEffect(() => {
        if (!firestore || processedVisits.length === 0) {
            setClientsFetched(true);
            return;
        }

        const clientIds = [...new Set(processedVisits.map(v => v.clientId).filter(Boolean) as string[])];
        const newClientIdsToFetch = clientIds.filter(id => !clientsMap.has(id));

        if (newClientIdsToFetch.length === 0) {
            setClientsFetched(true);
            return;
        }
        
        const fetchClients = async () => {
            try {
                const newClientsMap = new Map<string, Client>();
                const clientsQuery = query(collection(firestore, 'clients'), where('__name__', 'in', newClientIdsToFetch));
                const clientsSnapshot = await getDocs(clientsQuery);
                clientsSnapshot.forEach(doc => {
                    newClientsMap.set(doc.id, doc.data() as Client);
                });
                setClientsMap(prev => new Map([...prev, ...newClientsMap]));
            } catch (error) {
                console.error("Error fetching clients for pending visits:", error);
            } finally {
                setClientsFetched(true);
            }
        };

        fetchClients();
    }, [processedVisits, firestore, clientsMap]);
    
    useEffect(() => {
        const augmented = processedVisits.map(visit => ({
            ...visit,
            clientName: visit.clientId ? (clientsMap.get(visit.clientId)?.nameAr || visit.clientName) : visit.clientName,
        }));
        setAugmentedVisits(augmented);
    }, [processedVisits, clientsMap]);
    
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
    
    if (augmentedVisits.length === 0) return null;

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
