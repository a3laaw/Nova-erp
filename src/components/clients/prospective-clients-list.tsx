'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { UserPlus, Calendar, User } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import type { Appointment, Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ProspectiveClient {
  name: string;
  mobile: string;
  engineerName: string;
  lastAppointmentDate: Date;
  visitCount: number;
}

export function ProspectiveClientsList() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch prospective appointments by checking for the existence of 'clientMobile'
  const prospectiveQuery = useMemo(() => [where('clientMobile', '>', '')], []);
  const { data: prospectiveAppointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments', prospectiveQuery);

  // Fetch all employees to map engineer IDs to names
  const { data: employees, loading: employeesLoading } = useSubscription<Employee>(firestore, 'employees');
  
  const engineersMap = useMemo(() => {
    if (!employees) return new Map();
    const newMap = new Map<string, string>();
    employees.forEach(e => {
        if(e.id) newMap.set(e.id, e.fullName)
    });
    return newMap;
  }, [employees]);

  const prospectiveClients = useMemo(() => {
    if (!prospectiveAppointments) return [];

    const clientsMap = new Map<string, ProspectiveClient>();

    prospectiveAppointments.forEach(appt => {
      if (!appt.clientMobile || !appt.clientName) return;

      const existing = clientsMap.get(appt.clientMobile);
      const appointmentDate = appt.appointmentDate?.toDate ? appt.appointmentDate.toDate() : new Date();

      if (existing) {
        existing.visitCount += 1;
        if (appointmentDate > existing.lastAppointmentDate) {
          existing.lastAppointmentDate = appointmentDate;
          existing.engineerName = engineersMap.get(appt.engineerId) || 'غير معروف';
        }
      } else {
        clientsMap.set(appt.clientMobile, {
          name: appt.clientName,
          mobile: appt.clientMobile,
          engineerName: engineersMap.get(appt.engineerId) || 'غير معروف',
          lastAppointmentDate: appointmentDate,
          visitCount: 1,
        });
      }
    });

    return Array.from(clientsMap.values()).sort((a,b) => b.lastAppointmentDate.getTime() - a.lastAppointmentDate.getTime());
  }, [prospectiveAppointments, engineersMap]);
  
  const filteredClients = useMemo(() => {
      if (!searchQuery) return prospectiveClients;
      const lowercasedQuery = searchQuery.toLowerCase();
      return prospectiveClients.filter(
          client => client.name.toLowerCase().includes(lowercasedQuery) ||
          client.mobile.includes(lowercasedQuery)
      );
  }, [prospectiveClients, searchQuery]);

  const loading = appointmentsLoading || employeesLoading;

  return (
      <div className="space-y-4">
          <Input
              placeholder="ابحث بالاسم أو رقم الجوال..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
          />
          <div className="border rounded-lg">
              <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead>الاسم</TableHead>
                          <TableHead>الجوال</TableHead>
                          <TableHead>آخر زيارة</TableHead>
                          <TableHead>المهندس المسؤول</TableHead>
                          <TableHead className="text-center">عدد الزيارات</TableHead>
                          <TableHead className="text-center">الإجراء</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {loading && Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                          </TableRow>
                      ))}
                      {!loading && filteredClients.length === 0 && (
                           <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">لا يوجد عملاء محتملون حالياً.</TableCell>
                           </TableRow>
                      )}
                      {!loading && filteredClients.map(client => (
                          <TableRow key={client.mobile}>
                              <TableCell className="font-medium">{client.name}</TableCell>
                              <TableCell dir="ltr" className="text-left">{client.mobile}</TableCell>
                              <TableCell>{format(client.lastAppointmentDate, "PPP", { locale: ar })}</TableCell>
                              <TableCell>{client.engineerName}</TableCell>
                              <TableCell className="text-center">{client.visitCount}</TableCell>
                              <TableCell className="text-center">
                                  <Button asChild variant="outline" size="sm">
                                      <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(client.name)}&mobile=${encodeURIComponent(client.mobile)}`}>
                                          <UserPlus className="ml-2 h-4 w-4" />
                                          إنشاء ملف
                                      </Link>
                                  </Button>
                              </TableCell>
                          </TableRow>
                      ))}
                  </TableBody>
              </Table>
          </div>
      </div>
  );
}
