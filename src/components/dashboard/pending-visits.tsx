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
import { AlertCircle, Trash2, Loader2 } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, getDocs, limit, type QueryConstraint, doc, deleteDoc } from 'firebase/firestore';
import type { Appointment, Client } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useToast } from '@/hooks/use-toast';

interface PendingVisit extends Appointment {
    clientName?: string;
}

export function PendingVisits() {
    const { firestore } = useFirebase();
    const { user, loading: userLoading } = useAuth();
    const { toast } = useToast();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    
    const pendingVisitsQuery = useMemo(() => {
        if (userLoading || !user) return null;
        
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

    const [clientsMap, setClientsMap] = useState<Map<string, Client>>(new Map());
    const [clientsFetched, setClientsFetched] = useState(false);

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
                console.error("Error fetching clients:", error);
            } finally {
                setClientsFetched(true);
            }
        };

        fetchClients();
    }, [processedVisits, firestore]);
    
    const augmentedVisits = useMemo(() => {
        return processedVisits.map(visit => ({
            ...visit,
            clientName: visit.clientId ? (clientsMap.get(visit.clientId)?.nameAr || visit.clientName) : visit.clientName,
        }));
    }, [processedVisits, clientsMap]);

    const handleDeleteGhostRecord = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (!firestore) return;
        
        setDeletingId(id);
        try {
            await deleteDoc(doc(firestore, 'appointments', id));
            toast({ title: 'تم التنظيف', description: 'تم حذف السجل اليتيم بنجاح.' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف السجل.' });
        } finally {
            setDeletingId(null);
        }
    };
    
    const loading = visitsLoading || !clientsFetched;
    
    if (loading) {
        return (
            <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle />
                        زيارات معلقة
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-5/6" />
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
                     <div key={visit.id} className="relative group">
                        <Link href={`/dashboard/appointments/${visit.id}`} className="block p-3 rounded-xl bg-white/50 border border-red-100 hover:bg-white transition-all shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <span className="font-black text-sm block">{visit.clientName || 'عميل غير معروف'}</span>
                                    <p className="text-[10px] text-muted-foreground font-bold">{visit.title}</p>
                                    <span className="text-[10px] text-red-600 font-mono font-bold bg-red-100/50 px-2 py-0.5 rounded-full">
                                        {toFirestoreDate(visit.appointmentDate) ? format(toFirestoreDate(visit.appointmentDate)!, 'dd/MM/yyyy') : ''}
                                    </span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    onClick={(e) => handleDeleteGhostRecord(e, visit.id!)}
                                    disabled={deletingId === visit.id}
                                >
                                    {deletingId === visit.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                                </Button>
                            </div>
                        </Link>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
