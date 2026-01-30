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
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/context/language-context';
import type { Appointment, Client, Employee } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useSubscription } from '@/hooks/use-subscription';

export function UpcomingAppointments() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const [engineersMap, setEngineersMap] = useState<Map<string, string>>(new Map());
  const [clientsMap, setClientsMap] = useState<Map<string, string>>(new Map());
  const [relatedDataLoading, setRelatedDataLoading] = useState(true);

  // Memoize the query constraints to prevent re-renders
  const appointmentsQuery = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      orderBy('appointmentDate', 'asc'),
      limit(5)
    ];
  }, []);

  const { data: appointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments', appointmentsQuery);

  // Fetch related data (engineers and clients) once
  useEffect(() => {
    if (!firestore) return;

    const fetchRelatedData = async () => {
      setRelatedDataLoading(true);
      try {
        const [engineersSnapshot, clientsSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'employees')),
          getDocs(collection(firestore, 'clients'))
        ]);

        const newEngineersMap = new Map<string, string>();
        engineersSnapshot.forEach(doc => newEngineersMap.set(doc.id, doc.data().fullName));
        setEngineersMap(newEngineersMap);

        const newClientsMap = new Map<string, string>();
        clientsSnapshot.forEach(doc => newClientsMap.set(doc.id, doc.data().nameAr));
        setClientsMap(newClientsMap);

      } catch (error) {
        console.error("Error fetching related data for appointments:", error);
      } finally {
        setRelatedDataLoading(false);
      }
    };
    
    fetchRelatedData();
  }, [firestore]);
  
  const augmentedAppointments = useMemo(() => {
      return appointments.map(appt => ({
          ...appt,
          clientName: appt.clientId ? clientsMap.get(appt.clientId) || '...' : appt.clientName,
          engineerName: appt.engineerId ? engineersMap.get(appt.engineerId) || '...' : '...',
      }));
  }, [appointments, clientsMap, engineersMap]);
    
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

  const loading = appointmentsLoading || relatedDataLoading;

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
            {!loading && augmentedAppointments.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">{t.noAppointments}</TableCell>
                </TableRow>
            )}
            {!loading && augmentedAppointments.map((appt) => {
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
