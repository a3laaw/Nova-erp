'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import Link from 'next/link';

export function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    const [clientsMap, setClientsMap] = useState<Map<string, string>>(new Map());
    const [engineersMap, setEngineersMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        if (!firestore) return;
        
        const fetchMaps = async () => {
            try {
                const [clientSnap, engSnap] = await Promise.all([
                    getDocs(collection(firestore, 'clients')),
                    getDocs(collection(firestore, 'employees'))
                ]);
                const newClientsMap = new Map(clientSnap.docs.map(doc => [doc.id, doc.data().nameAr]));
                const newEngineersMap = new Map(engSnap.docs.map(doc => [doc.id, doc.data().fullName]));
                setClientsMap(newClientsMap);
                setEngineersMap(newEngineersMap);
            } catch (error) {
                console.error("Error fetching map data: ", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العملاء والمهندسين.' });
            }
        };

        fetchMaps();
    }, [firestore, toast]);
    
    useEffect(() => {
        if (!firestore || !date) return;
        setLoading(true);

        const fetchAppointments = async () => {
            try {
                const dayStart = startOfDay(date);
                const dayEnd = endOfDay(date);

                const q = query(
                    collection(firestore, 'appointments'),
                    where('appointmentDate', '>=', dayStart),
                    where('appointmentDate', '<=', dayEnd),
                    orderBy('appointmentDate', 'asc')
                );
                const querySnapshot = await getDocs(q);
                const fetchedAppointments = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
                    .filter(appt => appt.type === 'architectural');
                setAppointments(fetchedAppointments);
            } catch (error) {
                console.error("Error fetching architectural appointments:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد المعمارية.' });
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [date, firestore, toast]);

    const formatDate = (dateValue: any) => {
        if (!dateValue) return '';
        const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return format(date, "h:mm a", { locale: ar });
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold">مواعيد اليوم المحدد</h2>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-[280px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}
                        >
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: ar }) : <span>اختر يوما</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                 <Button asChild>
                    <Link href="/dashboard/appointments/new">
                        <PlusCircle className="ml-2 h-4 w-4" />
                        إضافة موعد معماري
                    </Link>
                </Button>
            </div>

             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الوقت</TableHead>
                            <TableHead>العميل</TableHead>
                            <TableHead>المهندس المسؤول</TableHead>
                            <TableHead>الغرض</TableHead>
                            <TableHead>ملاحظات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length:3}).map((_,i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8" /></TableCell></TableRow>)}
                        {!loading && appointments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    لا توجد مواعيد معمارية لهذا اليوم.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && appointments.map(appt => (
                            <TableRow key={appt.id}>
                                <TableCell className="font-mono">{formatDate(appt.appointmentDate)}</TableCell>
                                <TableCell>{clientsMap.get(appt.clientId) || appt.clientId}</TableCell>
                                <TableCell>{engineersMap.get(appt.engineerId) || appt.engineerId}</TableCell>
                                <TableCell>{appt.title}</TableCell>
                                <TableCell>{appt.notes || '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
        </div>
    );
}
