'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, writeBatch, getDoc, collectionGroup, orderBy, limit } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format, isPast, parse } from 'date-fns';
import { ar } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Printer, Eye, Pencil, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee, WorkStage, TransactionStage } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '@/components/ui/textarea';
import { useBranding } from '@/context/branding-context';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import { DateInput } from '../ui/date-input';


// --- Constants & Helpers ---
const generateTimeSlots = (start: string, end: string, slotDuration: number, buffer: number): string[] => {
    if (!start || !end || !slotDuration || slotDuration <= 0) return [];
    
    const slots: string[] = [];
    let currentTime = parse(start, 'HH:mm', new Date());
    const endTime = parse(end, 'HH:mm', new Date());

    // Apply an initial buffer before the first slot
    if (buffer > 0) {
      currentTime = new Date(currentTime.getTime() + buffer * 60000);
    }
    
    while (currentTime < endTime) {
        const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
        
        if (slotEndTime > endTime) {
            break; // This slot would end too late
        }
        
        slots.push(format(currentTime, 'HH:mm'));
        
        // Move to the end of the current slot, then add the buffer for the next one
        currentTime = new Date(slotEndTime.getTime() + buffer * 60000);
    }
    return slots;
};

function getVisitColor(visit: { visitCount?: number, contractSigned?: boolean }) {
  if (visit.visitCount === 1) return "#facc15"; // yellow-400
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; // green-500
  if (visit.visitCount! > 1 && visit.contractSigned) return "#3b82f6"; // blue-500
  return "#9ca3af"; // gray-400
}

async function reconcileClientAppointments(firestore: any, identifier: { clientId?: string | null; clientMobile?: string | null }) {
    if (!identifier.clientId && !identifier.clientMobile) return;

    try {
        const apptsQueryConstraints = [
            where('type', '==', 'architectural'),
        ];
        if (identifier.clientId) {
            apptsQueryConstraints.push(where('clientId', '==', identifier.clientId));
        } else if (identifier.clientMobile) {
            apptsQueryConstraints.push(where('clientMobile', '==', identifier.clientMobile));
        } else {
            return;
        }

        const clientApptsQuery = query(collection(firestore, 'appointments'), ...apptsQueryConstraints);
        const clientApptsSnap = await getDocs(clientApptsQuery);
        
        const appointments = clientApptsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Appointment))
            .filter(appt => appt.status !== 'cancelled')
            .sort((a, b) => (a.appointmentDate?.toMillis() || 0) - (b.appointmentDate?.toMillis() || 0));

        let contractSigned = false;
        if (identifier.clientId) {
            const clientRef = doc(firestore, 'clients', identifier.clientId);
            const clientSnap = await getDoc(clientRef);
            contractSigned = clientSnap.exists() && ['contracted', 'reContracted'].includes(clientSnap.data().status);
        }
        
        const batch = writeBatch(firestore);
        let hasUpdates = false;

        appointments.forEach((appt, index) => {
            const visitCount = index + 1;
            const newColor = getVisitColor({ visitCount, contractSigned });
            
            const needsUpdate = appt.visitCount !== visitCount || appt.color !== newColor;

            if (needsUpdate) {
                const apptRef = doc(firestore, 'appointments', appt.id!);
                batch.update(apptRef, { visitCount, color: newColor });
                hasUpdates = true;
            }
        });

        if (hasUpdates) {
           await batch.commit();
        }
    } catch (error) {
        console.error("Failed to reconcile client appointments:", error);
    }
}


const weekDays: { id: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday', label: string }[] = [
    { id: 'Saturday', label: 'السبت' },
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
];


export function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    useEffect(() => {
        // Set date on client-side to avoid hydration mismatch
        if (!date) {
            setDate(new Date());
        }
    }, [date]);

    const { morningSlots, eveningSlots, hasWorkHours, isRamadan } = useMemo(() => {
        if (!date) {
            return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        }
    
        const ramadanSettings = branding?.work_hours?.ramadan;
        const isDateInRamadan = ramadanSettings?.is_enabled &&
            ramadanSettings.start_date &&
            ramadanSettings.end_date &&
            date >= toFirestoreDate(ramadanSettings.start_date)! &&
            date <= toFirestoreDate(ramadanSettings.end_date)!;
    
        if (isDateInRamadan) {
            const slots = generateTimeSlots(
                ramadanSettings.start_time!,
                ramadanSettings.end_time!,
                ramadanSettings.appointment_slot_duration || 30,
                ramadanSettings.appointment_buffer_time || 0
            );
            return { morningSlots: slots, eveningSlots: [], hasWorkHours: slots.length > 0, isRamadan: true };
        }
    
        const workHours = branding?.work_hours?.architectural;
        if (!workHours) {
            return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        }
        
        const slotDuration = workHours.appointment_slot_duration || 30;
        const buffer = workHours.appointment_buffer_time || 0;
    
        const todayDayIndex = date.getDay();
    
        const todayDayName = weekDays[todayDayIndex].id;
    
        const isHoliday = branding?.work_hours?.holidays?.includes(todayDayName);
    
        if (isHoliday) {
            return { morningSlots: [], eveningSlots: [], hasWorkHours: true, isRamadan: false };
        }
    
        const halfDaySettings = branding?.work_hours?.half_day;
        const isHalfDay = halfDaySettings?.day === todayDayName;
    
        let { morning_start_time, morning_end_time, evening_start_time, evening_end_time } = workHours;
    
        if (isHalfDay) {
            if (halfDaySettings.type === 'morning_only') {
                evening_start_time = morning_end_time;
                evening_end_time = morning_end_time;
            } else if (halfDaySettings.type === 'custom_end_time' && halfDaySettings.end_time) {
                const customEnd = halfDaySettings.end_time;
                if (customEnd <= morning_end_time) {
                    morning_end_time = customEnd;
                    evening_start_time = customEnd;
                    evening_end_time = customEnd;
                } else if (customEnd > evening_start_time) {
                    evening_end_time = customEnd < evening_end_time ? customEnd : evening_end_time;
                }
            }
        }
    
        const mSlots = generateTimeSlots(morning_start_time, morning_end_time, slotDuration, buffer);
        const eSlots = generateTimeSlots(evening_start_time, evening_end_time, slotDuration, buffer);
        
        return {
            morningSlots: mSlots,
            eveningSlots: eSlots,
            hasWorkHours: mSlots.length > 0 || eSlots.length > 0,
            isRamadan: false
        };
    }, [branding, date]);


    // Fetch static data (engineers and clients) once on mount
    useEffect(() => {
        if (!firestore) return;
        const fetchStaticData = async () => {
            try {
                const [engSnap, clientSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                ]);

                const allEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                const archEngineers = allEngineers.filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
                setEngineers(archEngineers);
                
                const allClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(allClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
            } catch (error) {
                 console.error("Error fetching static appointment data:", error);
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات المهندسين والعملاء.' });
            }
        }
        fetchStaticData();
    }, [firestore, toast]);
    
    // Fetch only appointments when date changes
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore) return;
        setLoading(true);
        try {
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);
            
            const apptSnap = await getDocs(query(
                collection(firestore, 'appointments'),
                where('appointmentDate', '>=', dayStart),
                where('appointmentDate', '<=', dayEnd)
            ));
            
            const appts = apptSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
                .filter(appt => appt.type === 'architectural');


            setRawAppointments(appts);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);

    useEffect(() => {
        if (date) {
            fetchAppointments(date);
        }
    }, [date, fetchAppointments]);

    const appointments = useMemo(() => {
      if (!rawAppointments) return [];
      // If clients haven't loaded yet, return raw data to avoid losing appointments from view
      if (clients.length === 0 && !brandingLoading) return rawAppointments.map(appt => ({ ...appt, clientName: appt.clientName || '...' }));

      return rawAppointments
          .filter(appt => appt.status !== 'cancelled')
          .map(appt => ({
          ...appt,
          clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName,
      }));
    }, [rawAppointments, clients, brandingLoading]);


    const bookingsGrid = useMemo(() => {
        const grid: Record<string, Record<string, Appointment | null>> = {};
        engineers.forEach(eng => {
            grid[eng.id!] = {};
            [...morningSlots, ...eveningSlots].forEach(slot => grid[eng.id!][slot] = null);
        });

        appointments.forEach(appt => {
            const appointmentDate = toFirestoreDate(appt.appointmentDate);
            if(!appointmentDate) return;
            const time = format(appointmentDate, 'HH:mm');
            if (grid[appt.engineerId] && time in grid[appt.engineerId]) {
                grid[appt.engineerId][time] = appt;
            }
        });
        return grid;
    }, [appointments, engineers, morningSlots, eveningSlots]);

    const handleCellClick = (engineer: Employee, time: string) => {
        if (!date) return;
        const appointmentDate = setMinutes(setHours(date, Number(time.split(':')[0])), Number(time.split(':')[1]));

        // Check if the appointment is in the past
        if (isPast(appointmentDate)) {
            toast({
                title: 'لا يمكن الحجز في الماضي',
                description: 'لا يمكن إنشاء موعد في وقت قد مضى.',
                variant: 'default',
            });
            return;
        }

        setDialogData({
            isEditing: false,
            engineerId: engineer.id,
            engineerName: engineer.fullName,
            appointmentDate,
            appointments, // Pass current appointments to dialog
        });
        setIsDialogOpen(true);
    };

    const handleOpenDialogForEdit = (appointment: Appointment) => {
        setDialogData({
            isEditing: true,
            id: appointment.id,
            engineerId: appointment.engineerId,
            engineerName: engineers.find(e => e.id === appointment.engineerId)?.fullName,
            clientId: appointment.clientId,
            clientName: appointment.clientName,
            clientMobile: appointment.clientMobile,
            appointmentDate: toFirestoreDate(appointment.appointmentDate),
            title: appointment.title,
            notes: appointment.notes,
            transactionId: appointment.transactionId,
        });
        setIsDialogOpen(true);
    };

    const handleCancelBooking = async () => {
        if (!appointmentToDelete || !firestore || !currentUser) return;
    
        setIsDeleting(true);
        try {
            const { id: apptId, clientId, clientMobile } = appointmentToDelete;
    
            const apptToDeleteRef = doc(firestore, 'appointments', apptId!);
            await updateDoc(apptToDeleteRef, { status: 'cancelled' });
    
            if (clientId || clientMobile) {
                await reconcileClientAppointments(firestore, { clientId, clientMobile });
            }
    
            toast({ title: 'نجاح', description: 'تم إلغاء الموعد وتحديث الجدول.' });
            if(date) await fetchAppointments(date);
    
        } catch (error) {
            console.error("Error cancelling appointment:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء الموعد.' });
        } finally {
            setIsDeleting(false);
            setAppointmentToDelete(null);
        }
    };


    const handleSave = async () => {
        if (date) { // Re-fetch data for the current date
            await fetchAppointments(date);
        }
    };
    
    const handlePrint = () => {
        const element = document.getElementById('architectural-appointments-printable-area');
        if (!element || !date) return;
        
        const opt = {
          margin:       [0.5, 0.2, 0.5, 0.2], // [top, left, bottom, right]
          filename:     `architectural_appointments_${format(date, "yyyy-MM-dd")}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
          jsPDF:        { unit: 'in', format: 'a3', orientation: 'landscape' }
        };

        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            html2pdf().from(element).set(opt).save();
        });
    };
    
    const renderSkeleton = () => (
      <div className="space-y-6" dir='rtl'>
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border no-print">
              <h2 className="text-lg font-bold">جدول زيارات القسم المعماري</h2>
              <div className='flex items-center gap-2'>
                  <Skeleton className="h-10 w-[280px]" />
                  <Skeleton className="h-10 w-32" />
              </div>
          </div>
          <div className="space-y-4">
              <div className="border rounded-lg overflow-x-auto">
                    <h3 className="font-bold text-lg p-3 bg-muted print:text-base">
                      <Skeleton className="h-6 w-24" />
                    </h3>
                  <Skeleton className="h-48 w-full" />
              </div>
              <div className="border rounded-lg overflow-x-auto">
                    <h3 className="font-bold text-lg p-3 bg-muted print:text-base">
                      <Skeleton className="h-6 w-24" />
                    </h3>
                  <Skeleton className="h-48 w-full" />
              </div>
          </div>
      </div>
    );
    
    if (brandingLoading || loading) {
        return renderSkeleton();
    }

    if (!hasWorkHours) {
        return (
             <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-center">لم يتم تكوين أوقات الدوام</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                    <p>الرجاء الذهاب إلى صفحة الإعدادات لتحديد أوقات عمل القسم المعماري.</p>
                    <Button asChild className="mt-4">
                        <Link href="/dashboard/settings">
                            الذهاب إلى الإعدادات
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    const renderGridSection = (title: string, slots: string[]) => {
      if (slots.length === 0) return null;
      return (
        <div className="border rounded-lg overflow-x-auto">
            <h3 className="font-bold text-lg p-3 bg-muted print:text-base">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col className="w-[6rem] sm:w-[8rem]" />
                    {slots.map((_, i) => <col key={i} className="w-[7rem] sm:w-[8rem]" />)}
                </colgroup>
                <thead>
                    <tr className='border-b'>
                        <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">المهندس</th>
                        {slots.map(time => <th key={time} className="p-1 sm:p-2 text-center text-sm font-mono border-l">{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {engineers.map(eng => (
                        <tr key={eng.id} className='border-b'>
                            <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">{eng.fullName}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[eng.id!]?.[time];
                                const isClosed = !!booking?.workStageUpdated;
                                const canAdminEdit = currentUser?.role === 'Admin' && booking;
                                const canUserEdit = booking && !isClosed;

                                return (
                                    <td key={`${eng.id}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking ? (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild disabled={!canAdminEdit && !canUserEdit}>
                                                     <div
                                                        className="relative h-full w-full rounded-md p-2 text-xs sm:text-sm text-gray-800 flex flex-col items-center justify-center text-center"
                                                        style={{ backgroundColor: booking.color, cursor: (canAdminEdit || canUserEdit) ? 'pointer' : 'not-allowed' }}
                                                    >
                                                        {isClosed && <CheckCircle className="h-4 w-4 absolute top-1 right-1 text-white/80" />}
                                                        <p className="font-bold">{booking.clientName}</p>
                                                        {booking.visitCount && (
                                                            <span className="text-xs mt-1 opacity-75">
                                                                (الزيارة رقم {booking.visitCount})
                                                            </span>
                                                        )}
                                                    </div>
                                                </DropdownMenuTrigger>
                                                {(canAdminEdit || canUserEdit) && (
                                                    <DropdownMenuContent dir="rtl">
                                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/appointments/${booking.id}`}>
                                                                <Eye className="ml-2 h-4 w-4" />
                                                                <span>عرض التفاصيل</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenDialogForEdit(booking)}>
                                                            <Pencil className="ml-2 h-4 w-4" />
                                                            <span>تعديل/جدولة</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-destructive focus:bg-destructive/10">
                                                            <Trash2 className="ml-2 h-4 w-4" />
                                                            <span>إلغاء الموعد</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                )}
                                            </DropdownMenu>
                                        ) : (
                                            <button onClick={() => handleCellClick(eng, time)} className="h-full w-full text-muted-foreground/50 hover:bg-muted transition-colors rounded-md no-print" />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )};

    return (
        <div className="space-y-6" dir='rtl'>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border no-print">
                <h2 className="text-lg font-bold">جدول زيارات القسم المعماري</h2>
                <div className='flex items-center gap-2'>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}>
                                <CalendarIcon className="ml-2 h-4 w-4" />
                                {date ? format(date, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar 
                              mode="single" 
                              selected={date} 
                              onSelect={(newDate) => {
                                  if (newDate) {
                                    setDate(newDate);
                                  }
                                  setIsCalendarOpen(false);
                              }} 
                              initialFocus 
                            />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handlePrint} variant="outline">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة الجدول
                    </Button>
                </div>
            </div>
            
            <div id="architectural-appointments-printable-area" className="printable-content">
                <div className="hidden print:block mb-4">
                    <h1 className="text-xl font-bold">{isRamadan ? "جدول زيارات القسم المعماري (دوام شهر رمضان المبارك)" : "جدول زيارات القسم المعماري"}</h1>
                    {date && <p className="text-sm text-muted-foreground">{format(date, "PPP", { locale: ar })}</p>}
                </div>
                
                <div className="space-y-4">
                    {isRamadan ? renderGridSection('فترة دوام رمضان', morningSlots) : (
                        <>
                            {renderGridSection('الفترة الصباحية', morningSlots)}
                            {renderGridSection('الفترة المسائية', eveningSlots)}
                        </>
                    )}
                </div>
                
                 <div className="flex justify-center gap-4 pt-4 text-xs print:text-[8px]">
                    <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full" style={{ backgroundColor: '#facc15' }} /><span>أول زيارة</span></div>
                    <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full" style={{ backgroundColor: '#22c55e' }} /><span>متابعة (بدون عقد)</span></div>
                    <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full" style={{ backgroundColor: '#3b82f6' }} /><span>متابعة (بعد العقد)</span></div>
                    <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full" style={{ backgroundColor: '#9ca3af' }} /><span>أخرى</span></div>
                </div>
            </div>

            {isDialogOpen && (
                <BookingDialog 
                    isOpen={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                    onSaveSuccess={handleSave}
                    dialogData={dialogData}
                    clients={clients}
                    firestore={firestore}
                    currentUser={currentUser}
                />
            )}

            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الإلغاء؟</AlertDialogTitle>
                        <AlertDialogDescription>
                           سيتم تغيير حالة الموعد إلى "ملغي". سيؤثر هذا الإجراء على ترقيم وتلوين الزيارات المتبقية للعميل.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelBooking} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'جاري الإلغاء...' : 'نعم، قم بالإلغاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, firestore, currentUser }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    // Form state
    const [selectedClientId, setSelectedClientId] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [clientTransactions, setClientTransactions] = useState<any[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState('');

    const [newDate, setNewDate] = useState<Date | undefined>();
    const [newTime, setNewTime] = useState('');
    
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');

    const isEditing = !!dialogData?.id;
    
    const filteredClients = useMemo(() => {
        if (!dialogData?.engineerId) return [];
        return clients.filter((c: Client) => !c.assignedEngineer || c.assignedEngineer === dialogData.engineerId);
    }, [clients, dialogData?.engineerId]);

    useEffect(() => {
        if (isOpen && dialogData) {
             if(isEditing) {
                const apptDate = toFirestoreDate(dialogData.appointmentDate); // This is already a Date object
                setSelectedClientId(dialogData.clientId || '');
                setTitle(dialogData.title || '');
                setNotes(dialogData.notes || '');
                setSelectedTransactionId(dialogData.transactionId || '');
                if (apptDate) {
                  setNewDate(apptDate);
                  setNewTime(format(apptDate, 'HH:mm'));
                }
                setIsNewClient(!dialogData.clientId);
                if (!dialogData.clientId) {
                    setNewClientName(dialogData.clientName || '');
                    setNewClientMobile(dialogData.clientMobile || '');
                }
            } else {
                // Reset for new appointment
                setSelectedClientId('');
                setTitle('');
                setNotes('');
                setSelectedTransactionId('');
                setNewDate(undefined);
                setNewTime('');
                setIsNewClient(false);
                setNewClientName('');
                setNewClientMobile('');
            }
        }
    }, [isOpen, dialogData, isEditing]);

    // Make sure selected client is still in the filtered list
    useEffect(() => {
        if (selectedClientId && !filteredClients.some((c:any) => c.id === selectedClientId)) {
            setSelectedClientId('');
        }
    }, [filteredClients, selectedClientId]);

    // Fetch transactions when client changes
    useEffect(() => {
        if (!firestore || !selectedClientId) {
            setClientTransactions([]);
            setSelectedTransactionId('');
            return;
        }
    
        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const transQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
                const transSnap = await getDocs(transQuery);
                const transactions = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setClientTransactions(transactions);
                if (isEditing && dialogData.transactionId && !transactions.some(t => t.id === dialogData.transactionId)) {
                    setSelectedTransactionId(''); // Reset if old selection is invalid
                }
            } catch (error) {
                console.error("Error fetching client transactions:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب معاملات العميل.' });
            } finally {
                setLoadingTransactions(false);
            }
        };
    
        fetchTransactions();
    }, [selectedClientId, firestore, toast, isEditing, dialogData]);

    const transactionOptions = useMemo(() => clientTransactions.map((tx: any) => ({
        value: tx.id,
        label: tx.transactionType,
        searchKey: tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd/MM/yyyy') : ''
    })), [clientTransactions]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        let appointmentDateTime = dialogData.appointmentDate;
        if(isEditing && newDate && newTime) {
            const [hours, minutes] = newTime.split(':').map(Number);
            appointmentDateTime = new Date(newDate);
            appointmentDateTime.setHours(hours, minutes, 0, 0);
        }
        
        if (isPast(appointmentDateTime) && !isEditing) {
            toast({ variant: 'destructive', title: 'تاريخ غير صالح', description: 'لا يمكن إنشاء موعد في وقت قد مضى.'});
            setIsSaving(false); return;
        }

        try {
            if (isNewClient) {
                if (!newClientName || !newClientMobile) {
                    throw new Error('الرجاء إدخال اسم وجوال العميل الجديد.');
                }
                 // Check if prospective client already exists
                const prospectiveApptsRef = collection(firestore, 'appointments');
                const prospectiveQuery = query(prospectiveApptsRef, where('clientMobile', '==', newClientMobile), where('status', '!=', 'cancelled'), limit(1));
                const prospectiveSnapshot = await getDocs(prospectiveQuery);
                if (!prospectiveSnapshot.empty && (!isEditing || prospectiveSnapshot.docs[0].id !== dialogData.id)) {
                    toast({
                        variant: 'destructive',
                        title: 'عميل محتمل موجود',
                        description: `هذا العميل المحتمل موجود بالفعل في النظام. يمكنك إعادة متابعته من قائمة "العملاء المحتملون".`,
                    });
                    setIsSaving(false);
                    return;
                }

                const newAppointmentData = {
                    title: title || newClientName, clientName: newClientName, clientMobile: newClientMobile,
                    engineerId: dialogData.engineerId, appointmentDate: Timestamp.fromDate(appointmentDateTime),
                    type: 'architectural' as const, status: 'scheduled' as const, visitCount: 1, color: '#facc15', createdAt: serverTimestamp(),
                    workStageUpdated: false, // Ensure this is set
                };
                if(isEditing) {
                    await updateDoc(doc(firestore, 'appointments', dialogData.id), newAppointmentData);
                } else {
                    await addDoc(collection(firestore, 'appointments'), newAppointmentData);
                }
                toast({ title: 'نجاح', description: 'تم حفظ الموعد للعميل الجديد بنجاح.' });
            } else { // Existing Client
                const client = clients.find((c: Client) => c.id === selectedClientId);
                if (!client) {
                    throw new Error('الرجاء اختيار العميل.');
                }
                
                const batch = writeBatch(firestore);
                if (isEditing) {
                    // When editing, we "cancel" the old one by deleting it and create a new one to re-run reconciliation.
                    // This is simpler than trying to update in place and manage all edge cases of reordering.
                    const oldApptRef = doc(firestore, 'appointments', dialogData.id);
                    batch.delete(oldApptRef);
                }

                const allClientApptsQuery = query(collection(firestore, 'appointments'), where('clientId', '==', selectedClientId), where('type', '==', 'architectural'));
                const allClientApptsSnap = await getDocs(allClientApptsQuery);
                const existingAppointments = allClientApptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)).filter(a => isEditing ? a.id !== dialogData.id : true);
                const contractSigned = client.status === 'contracted' || client.status === 'reContracted';
                
                // Create a temporary object for the new appointment to be included in sorting
                const newAppointmentObject = {
                    id: 'new-temp-id', // temporary ID
                    appointmentDate: Timestamp.fromDate(appointmentDateTime),
                    clientId: client.id, title: title || client.nameAr, notes: notes, engineerId: dialogData.engineerId,
                    contractSigned, type: 'architectural' as const, status: 'scheduled' as const, transactionId: selectedTransactionId,
                    workStageUpdated: false, // Ensure this is set
                };
                let processingList: (Appointment | typeof newAppointmentObject)[] = [...existingAppointments, newAppointmentObject];
                processingList = processingList.filter(appt => appt.status !== 'cancelled');
                processingList.sort((a, b) => a.appointmentDate!.toMillis() - b.appointmentDate!.toMillis());

                processingList.forEach((appt, index) => {
                    const visitCount = index + 1;
                    const newColor = getVisitColor({ visitCount, contractSigned });

                    if (appt.id === 'new-temp-id') {
                        const newApptRef = doc(collection(firestore, 'appointments'));
                        const { id, ...dataToSave } = appt;
                        batch.set(newApptRef, { ...dataToSave, color: newColor, visitCount, createdAt: serverTimestamp() });
                        
                        const logContent = `${isEditing ? 'عدل' : 'حجز'} ${currentUser.fullName} موعداً بعنوان "${title || client.nameAr}" بتاريخ ${format(appointmentDateTime, "PPp", { locale: ar })}. (الزيارة رقم ${visitCount})`;
                        const logData = {
                            type: 'log' as const,
                            content: logContent,
                            userId: currentUser.id,
                            userName: currentUser.fullName,
                            userAvatar: currentUser.avatarUrl,
                            createdAt: serverTimestamp(),
                        };
                        const clientHistoryRef = doc(collection(firestore, `clients/${client.id}/history`));
                        batch.set(clientHistoryRef, logData);
                        if (selectedTransactionId) {
                            const txTimelineRef = doc(collection(firestore, `clients/${client.id}/transactions/${selectedTransactionId}/timelineEvents`));
                            batch.set(txTimelineRef, logData);
                        }
                    } else {
                        // Re-evaluate existing appointments
                        const existingData = existingAppointments.find(e => e.id === appt.id);
                        if (existingData && (existingData.visitCount !== visitCount || existingData.color !== newColor)) {
                            const apptRef = doc(firestore, 'appointments', appt.id!);
                            batch.update(apptRef, { visitCount, color: newColor });
                        }
                    }
                });
                await batch.commit();
                toast({ title: 'نجاح', description: `تم ${isEditing ? 'تعديل' : 'حفظ'} الموعد وتحديث الجدول بنجاح.` });
            }
            onClose();
            onSaveSuccess();
        } catch (error) {
             console.error("Error during save:", error);
             const message = error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ.';
             toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const clientOptions = useMemo(() => filteredClients.map((c: Client) => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile
    })), [filteredClients]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
             <DialogContent
                dir="rtl"
                className="w-[95vw] max-w-md"
             >
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل موعد' : 'حجز موعد جديد'}</DialogTitle>
                        <DialogDescription>
                             {isEditing 
                                ? `تعديل الموعد الخاص بـ: ${dialogData.clientName || dialogData.clientId}`
                                : `للمهندس: ${dialogData.engineerName} في ${format(dialogData.appointmentDate, "PPP 'الساعة' HH:mm", { locale: ar })}`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        {isEditing && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="date">التاريخ الجديد</Label>
                                    <DateInput id="date" value={newDate} onChange={setNewDate} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="time">الوقت الجديد</Label>
                                    <Input id="time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required step="1800" />
                                </div>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الزيارة (اختياري)</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder='سيتم استخدام اسم العميل اذا ترك فارغاً' />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                        </div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(checked) => setIsNewClient(checked as boolean)} disabled={isEditing} />
                            <Label htmlFor="isNewClient">إضافة عميل جديد غير مسجل</Label>
                        </div>
                        {isNewClient ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-name">اسم العميل <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-name" value={newClientName} onChange={e => setNewClientName(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-mobile" value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} dir="ltr" required />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="client-search">العميل <span className="text-destructive">*</span></Label>
                                    <InlineSearchList 
                                        value={selectedClientId}
                                        onSelect={setSelectedClientId}
                                        options={clientOptions}
                                        placeholder={clientOptions.length === 0 && dialogData?.engineerId ? "لا يوجد عملاء متاحون لهذا المهندس" : "ابحث بالاسم أو رقم الجوال..."}
                                        disabled={isEditing && !!dialogData.clientId}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="transaction-search">المعاملة</Label>
                                    <InlineSearchList
                                        value={selectedTransactionId}
                                        onSelect={setSelectedTransactionId}
                                        options={transactionOptions}
                                        placeholder={!selectedClientId ? 'اختر عميلاً أولاً' : loadingTransactions ? 'جاري جلب المعاملات...' : 'اختر المعاملة (اختياري)...'}
                                        disabled={!selectedClientId || loadingTransactions}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || (isNewClient ? (!newClientName || !newClientMobile) : !selectedClientId) }>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ الموعد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
