'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Save, Pencil, Trash2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';

const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];

const departmentStyles: Record<string, React.CSSProperties> = {
  "الكهرباء": { backgroundColor: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#991b1b' },
  "الصحي": { backgroundColor: '#dbeafe', borderLeft: '4px solid #3b82f6', color: '#1e40af' },
  "الإنشائي": { backgroundColor: '#dcfce7', borderLeft: '4px solid #22c55e', color: '#166534' },
  "المعماري": { backgroundColor: '#f3e8ff', borderLeft: '4px solid #a855f7', color: '#7e22ce' },
  "أخرى": { backgroundColor: '#f3f4f6', borderLeft: '4px solid #6b7280', color: '#374151' },
};
const departmentOptions = ['الكهرباء', 'الصحي', 'الإنشائي', 'المعماري', 'أخرى'];

const parseTime = (timeStr: string): { hours: number, minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};

const generateTimeSlots = (start: string, end: string, slotDuration: number, buffer: number): string[] => {
    if (!start || !end || !slotDuration || slotDuration <= 0) return [];
    
    const slots: string[] = [];
    let currentTime = parse(start, 'HH:mm', new Date());
    const endTime = parse(end, 'HH:mm', new Date());

    if (buffer > 0) {
      currentTime = new Date(currentTime.getTime() + buffer * 60000);
    }
    
    while (currentTime < endTime) {
        const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
        
        if (slotEndTime > endTime) {
            break;
        }
        
        slots.push(format(currentTime, 'HH:mm'));
        
        currentTime = new Date(slotEndTime.getTime() + buffer * 60000);
    }
    return slots;
};


const weekDays: { id: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday', label: string }[] = [
    { id: 'Saturday', label: 'السبت' },
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
];


export function RoomBookingCalendar() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();

    const [date, setDate] = useState<Date | undefined>(undefined);
    const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
    
        const workHours = branding?.work_hours?.general;
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
            isRamadan: false,
        };
    }, [branding, date]);

    useEffect(() => {
        if (!date) {
            setDate(new Date());
        }
    }, [date]);

    useEffect(() => {
        if (!firestore) return;
        const fetchStaticData = async () => {
            try {
                const [clientSnap, engSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                ]);
                
                const fetchedClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(fetchedClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
                
                const fetchedEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee));
                setEngineers(fetchedEngineers.sort((a,b) => a.fullName.localeCompare(b.fullName, 'ar')));
            } catch (error) {
                console.error("Error fetching static booking data:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العملاء والمهندسين.' });
            }
        };
        fetchStaticData();
    }, [firestore, toast]);
    
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
            
            const allAppointmentsForDay = apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

            const roomAppointments = allAppointmentsForDay.filter(appt => appt.type === 'room');
            setRawAppointments(roomAppointments);
            
        } catch (error) {
            console.error("Error fetching room appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحديث قائمة الحجوزات.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);

    useEffect(() => {
        if(date) {
            fetchAppointments(date);
        }
    }, [date, fetchAppointments]);

    const appointments = useMemo(() => {
        if (!rawAppointments) return [];
        if (clients.length === 0 || engineers.length === 0) return rawAppointments;
        
        return rawAppointments
            .filter(appt => appt.status !== 'cancelled')
            .map(appt => ({
            ...appt,
            clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName,
            engineerName: appt.engineerId ? engineers.find(e => e.id === appt.engineerId)?.fullName : undefined,
        }));
    }, [rawAppointments, clients, engineers]);

    const bookingsGrid = useMemo(() => {
        const grid: Record<string, Record<string, Appointment | null>> = {};
        const allSlots = [...morningSlots, ...eveningSlots];
        rooms.forEach(room => {
            grid[room] = {};
            allSlots.forEach(slot => {
                grid[room][slot] = null;
            });
        });

        appointments.forEach(appt => {
            if (!appt || !appt.meetingRoom || !grid[appt.meetingRoom]) {
                return; 
            }
            
            const startTime = toFirestoreDate(appt.appointmentDate);
            if (!startTime) {
                console.error("Could not process appointment with invalid date:", appt);
                return;
            }

            try {
                const timeKey = format(startTime, 'HH:mm');
                if (timeKey in grid[appt.meetingRoom]) {
                    grid[appt.meetingRoom][timeKey] = appt;
                }
            } catch (e) {
                console.error("Could not process appointment:", appt, e);
            }
        });

        return grid;
    }, [appointments, morningSlots, eveningSlots]);


    const handleOpenDialog = (data: Partial<Appointment> & { room: string, time?: string, id?: string }) => {
        if (!date) return;
        if (data.id) { // Editing existing appointment
            setDialogData({
                ...data,
                appointmentDate: toFirestoreDate(data.appointmentDate)
            });
        } else { // Creating new
            const { hours, minutes } = parseTime(data.time!);
            const startTime = setMinutes(setHours(date, hours), minutes);
            
            if (isPast(startTime)) {
                toast({
                    title: 'لا يمكن الحجز في الماضي',
                    description: 'لا يمكن إنشاء موعد في وقت قد مضى.',
                    variant: 'default',
                });
                return;
            }
            
            setDialogData({
                room: data.room,
                appointmentDate: startTime,
            });
        }
        setIsDialogOpen(true);
    };

    const handleSaveBooking = async () => {
        if (date) {
            await fetchAppointments(date);
        }
    };
    
    const handleDeleteBooking = async () => {
        if (!appointmentToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'appointments', appointmentToDelete.id!));
            toast({ title: 'تم الحذف', description: 'تم إلغاء الموعد بنجاح.' });
            setRawAppointments(prev => prev.filter(appt => appt.id !== appointmentToDelete.id!));
        } catch (error) {
            console.error("Error deleting appointment:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء الموعد.' });
        } finally {
            setIsDeleting(false);
            setAppointmentToDelete(null);
        }
    };
    
    const handlePrint = () => {
        const element = document.getElementById('room-booking-printable-area');
        if (!element || !date) return;

        const opt = {
          margin:       [0.5, 0.2, 0.5, 0.2],
          filename:     `room_bookings_${format(date, "yyyy-MM-dd")}.pdf`,
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
        <div dir="rtl" className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border no-print">
                <h1 className="text-lg font-bold">تقويم حجوزات القاعات</h1>
                    <div className="flex items-center gap-2">
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

    if (date === undefined || brandingLoading) {
        return renderSkeleton();
    }
    
    if (!hasWorkHours && !loading) {
        return (
             <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-center">لم يتم تكوين أوقات الدوام</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground">
                    <p>الرجاء الذهاب إلى صفحة الإعدادات لتحديد أوقات الدوام العامة للقاعات.</p>
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
                        <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">القاعة</th>
                        {slots.map(time => <th key={time} className="p-1 sm:p-2 text-center text-sm font-mono border-l">{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rooms.map(room => (
                        <tr key={room} className='border-b'>
                            <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">{room}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[room]?.[time];
                                const appointmentDate = booking ? toFirestoreDate(booking.appointmentDate) : null;
                                return (
                                    <td key={`${room}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking && appointmentDate ? (
                                            isPast(appointmentDate) ? (
                                                <div 
                                                    className="flex flex-col items-center justify-center text-center opacity-75 cursor-not-allowed"
                                                    style={{
                                                        height: '100%',
                                                        width: '100%',
                                                        borderRadius: '0.375rem',
                                                        padding: '0.25rem',
                                                        fontSize: '0.7rem',
                                                        ...(departmentStyles[booking.department || 'أخرى'] || {})
                                                    }}
                                                    title="لا يمكن تعديل المواعيد السابقة."
                                                >
                                                    <p style={{ fontWeight: 'bold' }}>{booking.title}</p>
                                                    <p>{booking.clientName}</p>
                                                    <p style={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{booking.engineerName}</p>
                                                </div>
                                            ) : (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div 
                                                        className="flex flex-col items-center justify-center text-center"
                                                        style={{
                                                            height: '100%',
                                                            width: '100%',
                                                            borderRadius: '0.375rem',
                                                            padding: '0.25rem',
                                                            fontSize: '0.7rem',
                                                            cursor: 'pointer',
                                                            ...(departmentStyles[booking.department || 'أخرى'] || {})
                                                        }}
                                                    >
                                                        <p style={{ fontWeight: 'bold' }}>{booking.title}</p>
                                                        <p>{booking.clientName}</p>
                                                        <p style={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>{booking.engineerName}</p>
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl">
                                                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleOpenDialog(booking)}>
                                                        <Pencil className="ml-2 h-4 w-4" />
                                                        <span>تعديل الموعد</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                        <Trash2 className="ml-2 h-4 w-4" />
                                                        <span>إلغاء الموعد</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            )
                                        ) : (
                                            <button 
                                                onClick={() => handleOpenDialog({ room, time })}
                                                className="h-full w-full text-muted-foreground/50 hover:bg-muted transition-colors rounded-md no-print"
                                                aria-label={`حجز ${room} الساعة ${time}`}
                                            />
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
        <div dir="rtl" className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border no-print">
                <h1 className="text-lg font-bold">تقويم حجوزات القاعات</h1>
                 <div className="flex items-center gap-2">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn("w-[280px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}
                        >
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

            <div id="room-booking-printable-area" className="printable-content">
                <div className="hidden print:block mb-4 p-4">
                    <h1 className="text-xl font-bold">{isRamadan ? "تقويم حجوزات القاعات (دوام شهر رمضان المبارك)" : "تقويم حجوزات القاعات"}</h1>
                    {date && <p className="text-sm text-muted-foreground">{format(date, "PPP", { locale: ar })}</p>}
                </div>
                
                {loading ? (
                  <div className='space-y-4'>
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : (
                    <div className="space-y-4">
                        {isRamadan ? renderGridSection('فترة دوام رمضان', morningSlots) : (
                            <>
                                {renderGridSection('الفترة الصباحية', morningSlots)}
                                {renderGridSection('الفترة المسائية', eveningSlots)}
                            </>
                        )}
                    </div>
                )}
            </div>

             <div className="flex justify-center gap-4 pt-4 text-xs print:text-[8px]">
                {Object.entries(departmentStyles).map(([dept, style]) => (
                    <div key={dept} className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-sm" style={{ backgroundColor: style.backgroundColor, borderLeft: style.borderLeft }} />
                        <span className="text-sm">{dept}</span>
                    </div>
                ))}
            </div>

            {isDialogOpen && (
                <BookingDialog 
                    isOpen={isDialogOpen}
                    onClose={() => setIsDialogOpen(false)}
                    onSaveSuccess={handleSaveBooking}
                    dialogData={dialogData}
                    clients={clients}
                    engineers={engineers}
                    firestore={firestore}
                />
            )}
            
            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الإلغاء؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف هذا الموعد بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBooking} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, engineers, firestore }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState('');
    const [title, setTitle] = useState('');
    const [department, setDepartment] = useState('');
    const [notes, setNotes] = useState('');

    const isEditing = !!dialogData?.id;

    useEffect(() => {
        if (isOpen && dialogData) {
            setSelectedClientId(dialogData.clientId || '');
            setSelectedEngineerId(dialogData.engineerId || '');
            setTitle(dialogData.title || '');
            setDepartment(dialogData.department || '');
            setNotes(dialogData.notes || '');
        }
    }, [isOpen, dialogData]);
    
    const clientOptions = useMemo(() => clients.map((c: Client) => ({ value: c.id, label: c.nameAr, searchKey: c.mobile })), [clients]);
    const engineerOptions = useMemo(() => engineers.map((e: Employee) => ({ value: e.id, label: e.fullName, searchKey: e.employeeNumber })), [engineers]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        if (!selectedClientId || !selectedEngineerId || !title || !department) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول.' });
            setIsSaving(false);
            return;
        }

        try {
            const dataToSave = {
                clientId: selectedClientId,
                engineerId: selectedEngineerId,
                title,
                department,
                notes,
                meetingRoom: dialogData.room,
                appointmentDate: Timestamp.fromDate(dialogData.appointmentDate),
                type: 'room' as const,
            };

            if (isEditing) {
                await updateDoc(doc(firestore, 'appointments', dialogData.id), dataToSave);
            } else {
                await addDoc(collection(firestore, 'appointments'), { ...dataToSave, createdAt: serverTimestamp() });
            }
            toast({ title: 'نجاح', description: 'تم حفظ الحجز بنجاح.' });
            onSaveSuccess();
            onClose();
        } catch (error) {
            console.error("Error saving room booking:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الحجز.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                 <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل الحجز' : 'حجز جديد'}</DialogTitle>
                        <DialogDescription>
                            حجز {dialogData.room} يوم {format(dialogData.appointmentDate, 'PP', { locale: ar })} الساعة {format(dialogData.appointmentDate, 'p', { locale: ar })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 grid gap-4">
                         <div className="grid gap-2">
                            <Label>عنوان الاجتماع</Label>
                            <Input value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label>العميل</Label>
                            <InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clientOptions} placeholder="اختر العميل..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2">
                                <Label>القسم</Label>
                                <select value={department} onChange={e => setDepartment(e.target.value)} required className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="" disabled>اختر القسم...</option>
                                    {departmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>المهندس المسؤول</Label>
                                <InlineSearchList value={selectedEngineerId} onSelect={setSelectedEngineerId} options={engineerOptions} placeholder="اختر المهندس..." />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>ملاحظات إضافية</Label>
                            <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}
                            {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    );
}
