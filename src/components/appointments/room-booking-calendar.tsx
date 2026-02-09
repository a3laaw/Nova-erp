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
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

     const workHours = useMemo(() => {
        return branding?.work_hours?.general;
    }, [branding]);

    const { morningSlots, eveningSlots } = useMemo(() => {
        if (!workHours || !date) {
            return { morningSlots: [], eveningSlots: [] };
        }
        
        const slotDuration = workHours.appointment_slot_duration || 30;
        const buffer = workHours.appointment_buffer_time || 0;
    
        const todayDayIndex = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const todayDayName = weekDays[todayDayIndex].id;
    
        const isHoliday = branding?.work_hours?.holidays?.includes(todayDayName);
    
        if (isHoliday) {
            return { morningSlots: [], eveningSlots: [] };
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
    
        return {
            morningSlots: generateTimeSlots(morning_start_time, morning_end_time, slotDuration, buffer),
            eveningSlots: generateTimeSlots(evening_start_time, evening_end_time, slotDuration, buffer)
        };
    }, [workHours, date, branding]);

    const hasWorkHours = useMemo(() => morningSlots.length > 0 || eveningSlots.length > 0, [morningSlots, eveningSlots]);

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
                setClients(fetchedClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr)));
                
                const fetchedEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                setEngineers(fetchedEngineers.sort((a,b) => a.fullName.localeCompare(b.fullName)));
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

            const augmentedAppointments = allAppointmentsForDay
                .filter(appt => appt.type === 'room')
                .map(appt => ({
                    ...appt,
                    clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName,
                    engineerName: appt.engineerId ? engineers.find(e => e.id === appt.engineerId)?.fullName : undefined,
                }));
            setAppointments(augmentedAppointments);
        } catch (error) {
            console.error("Error fetching room appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحديث قائمة الحجوزات.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast, clients, engineers]);

    useEffect(() => {
        if(date && (clients.length > 0 || engineers.length > 0)) {
            fetchAppointments(date);
        } else if (date && !loading) {
            fetchAppointments(date);
        }
    }, [date, clients, engineers, fetchAppointments, loading]);

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
            setAppointments(prev => prev.filter(appt => appt.id !== appointmentToDelete.id!));
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
                    <h1 className="text-xl font-bold">تقويم حجوزات القاعات</h1>
                    {date && <p className="text-sm text-muted-foreground">{format(date, "PPP", { locale: ar })}</p>}
                </div>
                
                {loading ? (
                  <div className='space-y-4'>
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : !hasWorkHours ? (
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
                ) : (
                    <div className="space-y-4">
                        {renderGridSection('الفترة الصباحية', morningSlots)}
                        {renderGridSection('الفترة المسائية', eveningSlots)}
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

// --- Booking Dialog Component ---

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, engineers, firestore }: any) {
    const { toast } = useToast();
    const isEditing = !!dialogData?.id;
    const [formData, setFormData] = useState({
        clientId: '',
        clientName: '',
        clientMobile: '',
        department: '',
        engineerId: '',
        title: '',
        notes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [isNewClient, setIsNewClient] = useState(false);
    
    const roomName = useMemo(() => dialogData?.meetingRoom || dialogData?.room, [dialogData]);

    useEffect(() => {
        if (isOpen && dialogData) {
             const appointmentDate = toFirestoreDate(dialogData.appointmentDate);
            if (isEditing && appointmentDate instanceof Date) {
                setNewDate(format(appointmentDate, 'yyyy-MM-dd'));
                setNewTime(format(appointmentDate, 'HH:mm'));
            } else {
                 setNewDate('');
                 setNewTime('');
            }
            setFormData({
                clientId: dialogData.clientId || '',
                clientName: dialogData.clientName || '',
                clientMobile: dialogData.clientMobile || '',
                department: dialogData.department || '',
                engineerId: dialogData.engineerId || '',
                title: dialogData.title || '',
                notes: dialogData.notes || '',
            });
            setIsNewClient(!dialogData.clientId);
        }
    }, [isOpen, dialogData, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (isNewClient && (!formData.clientName || !formData.clientMobile)) {
            toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء تعبئة اسم وجوال العميل الجديد.' });
            return;
        }
        if (!isNewClient && !formData.clientId) {
            toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء اختيار عميل مسجل.' });
            return;
        }
        if (!formData.department || !formData.engineerId) {
            toast({ variant: 'destructive', title: 'حقول مطلوبة', description: 'الرجاء اختيار القسم والمهندس المسؤول.' });
            return;
        }

        setIsSaving(true);
        
        try {
            // Check for existing mobile for new clients
            if (isNewClient) {
                const clientsRef = collection(firestore, 'clients');
                const q = query(clientsRef, where('mobile', '==', formData.clientMobile));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    throw new Error(`رقم الجوال هذا مسجل بالفعل للعميل: ${querySnapshot.docs[0].data().nameAr}. الرجاء اختيار العميل من القائمة.`);
                }
            }

            const appointmentDateTime = isEditing ? new Date(`${newDate}T${newTime}`) : dialogData.appointmentDate;
            if (isPast(appointmentDateTime) && !isEditing) {
                throw new Error('لا يمكن حجز موعد في وقت قد مضى.');
            }

            // Conflict validation
            const appointmentsRef = collection(firestore, 'appointments');
            const dayStart = startOfDay(appointmentDateTime);
            const dayEnd = endOfDay(appointmentDateTime);
            const dayAppointmentsQuery = query(appointmentsRef, where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
            const dayAppointmentsSnap = await getDocs(dayAppointmentsQuery);
            const latestDayAppointments = dayAppointmentsSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const windowStart = new Date(appointmentDateTime.getTime() - 29 * 60 * 1000);
            const windowEnd = new Date(appointmentDateTime.getTime() + 29 * 60 * 1000);
            
            const roomHasConflict = latestDayAppointments.some((appt: any) => {
                if (isEditing && appt.id === dialogData.id) return false;
                const apptDate = toFirestoreDate(appt.appointmentDate);
                return appt.meetingRoom === roomName && apptDate && apptDate >= windowStart && apptDate <= windowEnd;
            });
            if (roomHasConflict) throw new Error('قاعة الاجتماعات محجوزة في هذا الوقت.');

            if (formData.engineerId) {
                const engineerHasConflict = latestDayAppointments.some((appt: any) => {
                    if (isEditing && appt.id === dialogData.id) return false;
                    const apptDate = toFirestoreDate(appt.appointmentDate);
                    return appt.engineerId === formData.engineerId && apptDate && apptDate >= windowStart && apptDate <= windowEnd;
                });
                if (engineerHasConflict) throw new Error('المهندس لديه موعد آخر في نفس الوقت.');
            }
            
            const checkClientId = isNewClient ? null : formData.clientId;
            if (checkClientId) {
                const clientHasConflict = latestDayAppointments.some((appt: any) => {
                    if (isEditing && appt.id === dialogData.id) return false;
                    const apptDate = toFirestoreDate(appt.appointmentDate);
                    return appt.clientId === checkClientId && apptDate && apptDate >= windowStart && apptDate <= windowEnd;
                });
                if (clientHasConflict) throw new Error('العميل لديه موعد آخر في نفس الوقت.');
            }
            
            // Prepare data for saving
            const dataToSave: any = {
                clientId: isNewClient ? undefined : formData.clientId,
                clientName: isNewClient ? formData.clientName : undefined,
                clientMobile: isNewClient ? formData.clientMobile : undefined,
                engineerId: formData.engineerId,
                title: formData.title,
                notes: formData.notes || '',
                meetingRoom: roomName,
                department: formData.department,
                appointmentDate: Timestamp.fromDate(appointmentDateTime),
                type: 'room',
            };
            if (!dataToSave.clientId) delete dataToSave.clientId;

            if (isEditing) {
                const appointmentRef = doc(firestore, 'appointments', dialogData.id);
                await updateDoc(appointmentRef, dataToSave);
                toast({ title: "تم التعديل بنجاح!" });
            } else {
                dataToSave.createdAt = serverTimestamp();
                await addDoc(collection(firestore, 'appointments'), dataToSave);
                toast({ title: "تم الحجز بنجاح!" });
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
    
    const clientOptions = useMemo(() => clients.map((c: Client) => ({ value: c.id, label: c.nameAr, searchKey: c.mobile })), [clients]);
    const engineerOptions = useMemo(() => engineers.map((e: Employee) => ({ value: e.id!, label: e.fullName, searchKey: e.civilId })), [engineers]);
    const departmentOptionsForSelect = useMemo(() => departmentOptions.map(d => ({ value: d, label: d, searchKey: d })), []);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                dir="rtl"
                className="w-[95vw] sm:max-w-lg"
            >
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل موعد' : 'حجز موعد جديد'}</DialogTitle>
                         <DialogDescription>
                            حجز {roomName}
                            {!isEditing && ` في ${format(dialogData.appointmentDate, "PPP 'الساعة' HH:mm", { locale: ar })}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                         {isEditing && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="date">التاريخ</Label>
                                    <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="time">الوقت</Label>
                                    <Input id="time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required step="1800" />
                                </div>
                            </div>
                         )}
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الموعد (اختياري)</Label>
                            <Input id="title" value={formData.title} onChange={(e) => setFormData(p => ({...p, title: e.target.value}))} />
                        </div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(checked) => setIsNewClient(checked as boolean)} disabled={isEditing} />
                            <Label htmlFor="isNewClient">إضافة عميل جديد غير مسجل</Label>
                        </div>
                         {isNewClient ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-name">اسم العميل <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-name" value={formData.clientName} onChange={e => setFormData(p => ({...p, clientName: e.target.value}))} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-mobile" value={formData.clientMobile} onChange={e => setFormData(p => ({...p, clientMobile: e.target.value}))} dir="ltr" required />
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                <Label>العميل <span className="text-destructive">*</span></Label>
                                <InlineSearchList value={formData.clientId} onSelect={(v) => setFormData(p => ({...p, clientId: v}))} options={clientOptions} placeholder="ابحث بالاسم أو رقم الجوال..." disabled={isEditing}/>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label>القسم <span className="text-destructive">*</span></Label>
                             <InlineSearchList value={formData.department} onSelect={(v) => setFormData(p => ({...p, department: v}))} options={departmentOptionsForSelect} placeholder="ابحث عن قسم..." />
                        </div>
                         <div className="grid gap-2">
                            <Label>المهندس <span className="text-destructive">*</span></Label>
                             <InlineSearchList value={formData.engineerId} onSelect={(v) => setFormData(p => ({...p, engineerId: v}))} options={engineerOptions} placeholder="ابحث بالاسم أو الرقم المدني..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || (isNewClient ? (!formData.clientName || !formData.clientMobile) : !formData.clientId) || !formData.department || !formData.engineerId}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ الموعد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
