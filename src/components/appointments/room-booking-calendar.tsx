'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format, isPast, parse, isValid } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';

const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];

const departmentStyles: Record<string, React.CSSProperties> = {
  "الكهرباء": { backgroundColor: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#991b1b' },
  "الصحي": { backgroundColor: '#dbeafe', borderLeft: '4px solid #3b82f6', color: '#1e40af' },
  "الإنشائي": { backgroundColor: '#dcfce7', borderLeft: '4px solid #22c55e', color: '#166534' },
  "المعماري": { backgroundColor: '#f3e8ff', borderLeft: '4px solid #a855f7', color: '#7e22ce' },
  "أخرى": { backgroundColor: '#f3f4f6', borderLeft: '4px solid #6b7280', color: '#374151' },
};
const departmentOptions = ['الكهرباء', 'الصحي', 'الإنشائي', 'المعماري', 'أخرى'];

const parseTime = (timeStr: string): { hours: number, minutes: number } | null => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours) || !isValidNumber(minutes)) return null;
  return { hours, minutes };
};

function isValidNumber(n: any) { return typeof n === 'number' && !isNaN(n); }

const generateTimeSlots = (start: string, end: string, slotDuration: number, buffer: number): string[] => {
    if (!start || !end || !slotDuration || slotDuration <= 0) return [];
    const slots: string[] = [];
    try {
        const startTime = parse(start, 'HH:mm', new Date());
        const endTime = parse(end, 'HH:mm', new Date());
        
        if (!isValid(startTime) || !isValid(endTime) || startTime >= endTime) {
            return [];
        }

        let currentTime = startTime;
        while (currentTime < endTime) {
            const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
            if (slotEndTime > endTime) break;
            slots.push(format(currentTime, 'HH:mm'));
            currentTime = new Date(slotEndTime.getTime() + buffer * 60000);
        }
    } catch (e) { console.error(e); }
    return slots;
};

const weekDays = [
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
    { id: 'Saturday', label: 'السبت' },
];

export default function RoomBookingCalendar() {
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
        if (!date) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
    
        const ramadanSettings = branding?.work_hours?.ramadan;
        const isDateInRamadan = ramadanSettings?.is_enabled &&
            ramadanSettings.start_date &&
            ramadanSettings.end_date &&
            date >= toFirestoreDate(ramadanSettings.start_date)! &&
            date <= toFirestoreDate(ramadanSettings.end_date)!;
    
        if (isDateInRamadan) {
            const slots = generateTimeSlots(ramadanSettings.start_time || '09:00', ramadanSettings.end_time || '15:00', ramadanSettings.appointment_slot_duration || 30, ramadanSettings.appointment_buffer_time || 0);
            return { morningSlots: slots, eveningSlots: [], hasWorkHours: slots.length > 0, isRamadan: true };
        }
    
        const workHours = branding?.work_hours?.general;
        if (!workHours) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        
        const slotDuration = workHours.appointment_slot_duration || 30;
        const buffer = workHours.appointment_buffer_time || 0;
        const todayDayName = weekDays[date.getDay()].id;
    
        if (branding?.work_hours?.holidays?.includes(todayDayName)) {
            return { morningSlots: [], eveningSlots: [], hasWorkHours: true, isRamadan: false };
        }
    
        const halfDaySettings = branding?.work_hours?.half_day;
        const isHalfDay = halfDaySettings?.day === todayDayName;
        let { morning_start_time, morning_end_time, evening_start_time, evening_end_time } = workHours;
    
        if (isHalfDay) {
            if (halfDaySettings.type === 'morning_only') {
                evening_start_time = '';
                evening_end_time = '';
            } else if (halfDaySettings.type === 'custom_end_time' && halfDaySettings.end_time) {
                const customEnd = halfDaySettings.end_time;
                if (customEnd <= morning_end_time) {
                    morning_end_time = customEnd;
                    evening_start_time = '';
                    evening_end_time = '';
                } else {
                    evening_end_time = customEnd < evening_end_time ? customEnd : evening_end_time;
                }
            }
        }
    
        const mSlots = generateTimeSlots(morning_start_time, morning_end_time, slotDuration, buffer);
        const eSlots = generateTimeSlots(evening_start_time, evening_end_time, slotDuration, buffer);
        
        return { morningSlots: mSlots, eveningSlots: eSlots, hasWorkHours: mSlots.length > 0 || eSlots.length > 0, isRamadan: false };
    }, [branding, date]);

    useEffect(() => { if (!date) setDate(new Date()); }, [date]);

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
            } catch (error) { console.error(error); }
        };
        fetchStaticData();
    }, [firestore]);
    
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore) return;
        setLoading(true);
        try {
            const apptSnap = await getDocs(query(collection(firestore, 'appointments'), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d))));
            setRawAppointments(apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)).filter(appt => appt.type === 'room'));
        } finally { setLoading(false); }
    }, [firestore]);

    useEffect(() => { if(date) fetchAppointments(date); }, [date, fetchAppointments]);

    const appointments = useMemo(() => {
        if (!rawAppointments || clients.length === 0 || engineers.length === 0) return rawAppointments;
        return rawAppointments.filter(appt => appt.status !== 'cancelled').map(appt => ({
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
            allSlots.forEach(slot => { grid[room][slot] = null; });
        });
        appointments.forEach(appt => {
            if (!appt || !appt.meetingRoom || !grid[appt.meetingRoom]) return;
            const startTime = toFirestoreDate(appt.appointmentDate);
            if (!startTime) return;
            const timeKey = format(startTime, 'HH:mm');
            if (timeKey in grid[appt.meetingRoom]) grid[appt.meetingRoom][timeKey] = appt;
        });
        return grid;
    }, [appointments, morningSlots, eveningSlots]);

    const handleOpenDialog = (data: Partial<Appointment> & { room: string, time?: string, id?: string }) => {
        if (!date) return;
        if (data.id) {
            setDialogData({ ...data, appointmentDate: toFirestoreDate(data.appointmentDate) });
        } else {
            const parsedTime = parseTime(data.time!);
            if (!parsedTime) return;
            const startTime = setMinutes(setHours(date, parsedTime.hours), parsedTime.minutes);
            if (isPast(startTime)) return toast({ title: 'لا يمكن الحجز في الماضي' });
            setDialogData({ room: data.room, appointmentDate: startTime });
        }
        setIsDialogOpen(true);
    };

    const handleDeleteBooking = async () => {
        if (!appointmentToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'appointments', appointmentToDelete.id!));
            toast({ title: 'تم الحذف', description: 'تم إلغاء الموعد بنجاح.' });
            setRawAppointments(prev => prev.filter(appt => appt.id !== appointmentToDelete.id!));
        } finally { setIsDeleting(false); setAppointmentToDelete(null); }
    };
    
    const renderGridSection = (title: string, slots: string[]) => {
        if (slots.length === 0) return null;
        return (
        <div className="border rounded-lg overflow-x-auto bg-card">
            <h3 className="font-bold text-lg p-3 bg-muted print:text-base">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup><col className="w-[6rem] sm:w-[8rem]" />{slots.map((_, i) => <col key={i} className="w-[7rem] sm:w-[8rem]" />)}</colgroup>
                <thead><tr className='border-b'><th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">القاعة</th>{slots.map(time => <th key={time} className="p-1 sm:p-2 text-center text-sm font-mono border-l">{time}</th>)}</tr></thead>
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
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div className="flex flex-col items-center justify-center text-center p-1 sm:p-2 rounded-md cursor-pointer transition-all hover:brightness-95 shadow-sm h-full" style={{ ...(departmentStyles[booking.department || 'أخرى'] || {}) }}>
                                                        <p className="font-bold text-[10px] sm:text-xs leading-tight">{booking.title}</p>
                                                        <p className="text-[9px] sm:text-[10px] mt-1">{booking.clientName}</p>
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl">
                                                    <DropdownMenuItem onClick={() => handleOpenDialog(booking)}><Pencil className="ml-2 h-4 w-4" />تعديل الموعد</DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" />إلغاء الموعد</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <button onClick={() => handleOpenDialog({ room, time })} className="h-full w-full hover:bg-muted/30 transition-colors rounded-md no-print cursor-pointer" />
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

    if (brandingLoading || (loading && rawAppointments.length === 0)) return <Skeleton className="h-[500px] w-full rounded-3xl" />;
    
    if (!hasWorkHours) return <Card className="mt-4 rounded-3xl border-2 border-dashed"><CardHeader><CardTitle className="text-center">لم يتم تكوين أوقات القاعات</CardTitle></CardHeader><CardContent className="text-center text-muted-foreground pb-10"><p>الرجاء الذهاب إلى صفحة الإعدادات لتحديد أوقات الدوام العامة.</p><Button asChild className="mt-6 rounded-xl font-bold"><Link href="/dashboard/settings/work-hours">الذهاب إلى الإعدادات</Link></Button></CardContent></Card>;

    return (
        <div dir="rtl" className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-2xl border no-print">
                <h1 className="text-lg font-bold">تقويم حجوزات القاعات</h1>
                 <div className="flex items-center gap-2">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild><Button variant={"outline"} className="w-[280px] justify-start text-left font-normal rounded-xl"><CalendarIcon className="ml-2 h-4 w-4" />{date ? format(date, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(newDate) => { if (newDate) setDate(newDate); setIsCalendarOpen(false); }} initialFocus /></PopoverContent>
                    </Popover>
                 </div>
            </div>

            <div id="room-booking-printable-area" className="space-y-6">
                {isRamadan ? renderGridSection('فترة دوام رمضان', morningSlots) : (
                    <>{renderGridSection('الفترة الصباحية', morningSlots)}{renderGridSection('الفترة المسائية', eveningSlots)}</>
                )}
            </div>

             <div className="flex justify-center gap-4 pt-4 text-xs">
                {Object.entries(departmentStyles).map(([dept, style]) => (
                    <div key={dept} className="flex items-center gap-2"><div className="h-4 w-4 rounded-sm" style={{ backgroundColor: style.backgroundColor, borderLeft: style.borderLeft }} /><span className="text-sm">{dept}</span></div>
                ))}
            </div>

            {isDialogOpen && <BookingDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSaveSuccess={() => date && fetchAppointments(date)} dialogData={dialogData} clients={clients} engineers={engineers} firestore={firestore} />}
            
            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle>تأكيد الإلغاء؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف هذا الموعد بشكل دائم. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel><AlertDialogAction onClick={handleDeleteBooking} disabled={isDeleting} className="bg-destructive rounded-xl">{isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، قم بالحذف'}</AlertDialogAction></AlertDialogFooter>
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
        try {
            const dataToSave = { clientId: selectedClientId, engineerId: selectedEngineerId, title, department, notes, meetingRoom: dialogData.room, appointmentDate: Timestamp.fromDate(dialogData.appointmentDate), type: 'room' as const };
            if (isEditing) await updateDoc(doc(firestore, 'appointments', dialogData.id), dataToSave);
            else await addDoc(collection(firestore, 'appointments'), { ...dataToSave, createdAt: serverTimestamp() });
            toast({ title: 'نجاح', description: 'تم حفظ الحجز بنجاح.' });
            onSaveSuccess(); onClose();
        } finally { setIsSaving(false); }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-3xl">
                 <form onSubmit={handleSubmit}>
                    <DialogHeader><DialogTitle>{isEditing ? 'تعديل الحجز' : 'حجز جديد'}</DialogTitle><DialogDescription>حجز {dialogData.room} يوم {format(dialogData.appointmentDate, 'PP', { locale: ar })} الساعة {format(dialogData.appointmentDate, 'p', { locale: ar })}</DialogDescription></DialogHeader>
                    <div className="py-4 grid gap-4">
                         <div className="grid gap-2"><Label>عنوان الاجتماع</Label><Input value={title} onChange={e => setTitle(e.target.value)} required className="rounded-xl" /></div>
                        <div className="grid gap-2"><Label>العميل</Label><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clientOptions} placeholder="اختر العميل..." className="rounded-xl" /></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2"><Label>القسم</Label><select value={department} onChange={e => setDepartment(e.target.value)} required className="w-full h-10 rounded-xl border-2 border-input bg-background px-3 py-2 text-sm">{departmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                            <div className="grid gap-2"><Label>المهندس المسؤول</Label><InlineSearchList value={selectedEngineerId} onSelect={setSelectedEngineerId} options={engineerOptions} placeholder="اختر..." className="rounded-xl" /></div>
                        </div>
                        <div className="grid gap-2"><Label>ملاحظات إضافية</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl" /></div>
                    </div>
                    <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={isSaving} className="rounded-xl font-bold">{isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin"/>}{isSaving ? 'جاري الحفظ...' : 'حفظ'}</Button></DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    );
}