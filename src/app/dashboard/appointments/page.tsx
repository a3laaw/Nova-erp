'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { Appointment, Client, Employee } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

// Combine Appointment with related data for easier rendering
interface AugmentedAppointment extends Appointment {
    clientName: string;
    engineerName: string;
    engineerDepartment?: string;
}

const formatDate = (dateValue: any) => {
    if (!dateValue) return '';
    const date = dateValue instanceof Timestamp ? dateValue.toDate() : new Date(dateValue);
    try {
        return format(date, "EEE, dd MMM yyyy 'الساعة' h:mm a", { locale: ar });
    } catch {
        return 'تاريخ غير صالح';
    }
}

function AppointmentsTable({ appointments, loading }: { appointments: AugmentedAppointment[], loading: boolean }) {
    if (loading) {
        return (
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>العميل</TableHead>
                            <TableHead>المهندس</TableHead>
                            <TableHead>التاريخ والوقت</TableHead>
                            <TableHead>الغرض</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }
    
    if (appointments.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>لا توجد مواعيد في هذا القسم.</p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>العميل</TableHead>
                        <TableHead>المهندس</TableHead>
                        <TableHead>التاريخ والوقت</TableHead>
                        <TableHead>الغرض</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {appointments.map(appt => (
                        <TableRow key={appt.id}>
                            <TableCell className="font-medium">{appt.clientName}</TableCell>
                            <TableCell>{appt.engineerName}</TableCell>
                            <TableCell>{formatDate(appt.appointmentDate)}</TableCell>
                            <TableCell>{appt.title}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}


export default function AppointmentsPage() {
    const { firestore } = useFirebase();
    const [loading, setLoading] = useState(true);
    const [allAppointments, setAllAppointments] = useState<AugmentedAppointment[]>([]);

    useEffect(() => {
        if (!firestore) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [appointmentsSnap, clientsSnap, employeesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'appointments'), orderBy('appointmentDate', 'desc'))),
                    getDocs(collection(firestore, 'clients')),
                    getDocs(collection(firestore, 'employees')),
                ]);

                const clientsMap = new Map(clientsSnap.docs.map(doc => [doc.id, doc.data() as Client]));
                const employeesMap = new Map(employeesSnap.docs.map(doc => [doc.id, doc.data() as Employee]));

                const augmented = appointmentsSnap.docs.map(doc => {
                    const appt = { id: doc.id, ...doc.data() } as Appointment;
                    const client = clientsMap.get(appt.clientId);
                    const engineer = appt.engineerId ? employeesMap.get(appt.engineerId) : null;
                    
                    return {
                        ...appt,
                        clientName: client?.nameAr || 'عميل محذوف',
                        engineerName: engineer?.fullName || 'غير مسند',
                        engineerDepartment: engineer?.department || undefined,
                    };
                });
                setAllAppointments(augmented);
            } catch (error) {
                console.error("Failed to fetch appointments data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore]);
    
    const { architecturalAppointments, otherAppointments } = useMemo(() => {
        const architectural = allAppointments.filter(appt => appt.engineerDepartment === 'القسم المعماري');
        const other = allAppointments.filter(appt => appt.engineerDepartment !== 'القسم المعماري');
        return { architecturalAppointments: architectural, otherAppointments: other };
    }, [allAppointments]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>المواعيد</CardTitle>
                            <CardDescription>جدولة وإدارة جميع اجتماعات العملاء والزيارات الميدانية.</CardDescription>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="sm" className="gap-1">
                                    <PlusCircle className="h-4 w-4" />
                                    موعد جديد
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/appointments/new">موعد للقسم المعماري</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard/appointments/new-other">موعد لقسم آخر</Link>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="architectural">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="architectural">القسم المعماري</TabsTrigger>
                            <TabsTrigger value="other">الأقسام الأخرى</TabsTrigger>
                        </TabsList>
                        <TabsContent value="architectural" className="mt-4">
                            <AppointmentsTable appointments={architecturalAppointments} loading={loading} />
                        </TabsContent>
                        <TabsContent value="other" className="mt-4">
                            <AppointmentsTable appointments={otherAppointments} loading={loading} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
