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
import { ArrowUpRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/context/language-context';
import type { Appointment, Client, Employee } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

export function UpcomingAppointments() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firestore) return;

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. Fetch appointments
            const appointmentsQuery = query(
                collection(firestore, 'appointments'),
                where('appointmentDate', '>=', Timestamp.fromDate(today)),
                orderBy('appointmentDate', 'asc'),
                limit(5)
            );
            const appointmentsSnapshot = await getDocs(appointmentsQuery);
            const fetchedAppointments: Appointment[] = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

            if (fetchedAppointments.length === 0) {
                setAppointments([]);
                setLoading(false);
                return;
            }

            // 2. Fetch related clients and engineers
            const clientIds = [...new Set(fetchedAppointments.map(a => a.clientId))];
            const engineerIds = [...new Set(fetchedAppointments.map(a => a.engineerId).filter(Boolean))];

            const clientsQuery = query(collection(firestore, 'clients'), where('__name__', 'in', clientIds));
            const engineersQuery = query(collection(firestore, 'employees'), where('__name__', 'in', engineerIds));

            const [clientsSnapshot, engineersSnapshot] = await Promise.all([
                 clientIds.length > 0 ? getDocs(clientsQuery) : { docs: [] },
                 engineerIds.length > 0 ? getDocs(engineersQuery) : { docs: [] },
            ]);
            
            const clientsMap = new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client]));
            const engineersMap = new Map(engineersSnapshot.docs.map(doc => [doc.id, doc.data() as Employee]));

            // 3. Augment appointments with names
            const augmentedAppointments = fetchedAppointments.map(appt => ({
                ...appt,
                clientName: clientsMap.get(appt.clientId)?.nameAr || 'عميل غير معروف',
                engineerName: appt.engineerId ? (engineersMap.get(appt.engineerId)?.fullName || 'مهندس غير معروف') : 'غير مسند',
            }));
            
            setAppointments(augmentedAppointments);
        } catch (error) {
            console.error("Error fetching upcoming appointments: ", error);
        } finally {
            setLoading(false);
        }
    };

    fetchAppointments();
  }, [firestore]);
    
  const t = (language === 'ar') ? 
    { title: 'المواعيد القادمة', description: 'زياراتك الميدانية واجتماعاتك المجدولة التالية.', viewAll: 'عرض الكل', client: 'العميل', engineer: 'المهندس', dateTime: 'التاريخ والوقت', purpose: 'الغرض', noAppointments: 'لا توجد مواعيد قادمة.' } : 
    { title: 'Upcoming Appointments', description: 'Your next scheduled site visits and meetings.', viewAll: 'View All', client: 'Client', engineer: 'Engineer', dateTime: 'Date & Time', purpose: 'Purpose', noAppointments: 'No upcoming appointments.' };
  
  const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if(language === 'ar') {
        return format(date, "EEE, dd MMM yyyy 'الساعة' h:mm a", { locale: ar });
    }
    return format(date, "EEE, dd MMM yyyy 'at' h:mm a");
  }


  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/dashboard/appointments">
            {t.viewAll}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.client}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.engineer}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.dateTime}</TableHead>
              <TableHead className="text-right">{t.purpose}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({length: 3}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                </TableRow>
            ))}
            {!loading && appointments.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">{t.noAppointments}</TableCell>
                </TableRow>
            )}
            {!loading && appointments.map((appt) => {
              return (
                <TableRow key={appt.id}>
                  <TableCell>
                    <div className="font-medium">{appt.clientName}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {appt.engineerName}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                     {formatDate(appt.appointmentDate)}
                  </TableCell>
                  <TableCell className="text-right">{appt.title}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
