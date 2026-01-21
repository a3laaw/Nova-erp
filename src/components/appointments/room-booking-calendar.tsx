'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { format, startOfDay, endOfDay, addMinutes, setHours, setMinutes, getHours, getMinutes } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Save, Pencil, Trash2, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { InlineSearchList } from '../ui/inline-search-list';

// --- Constants ---
const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];
const morningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 8), i * 30), 'HH:mm')); // 8:00 to 9:30
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 13), i * 30), 'HH:mm')); // 13:00 to 14:30


const departmentStyles: Record<string, React.CSSProperties> = {
  "الكهرباء": { backgroundColor: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#991b1b' },
  "الصحي": { backgroundColor: '#dbeafe', borderLeft: '4px solid #3b82f6', color: '#1e40af' },
  "الإنشائي": { backgroundColor: '#dcfce7', borderLeft: '4px solid #22c55e', color: '#166534' },
  "المعماري": { backgroundColor: '#f3e8ff', borderLeft: '4px solid #a855f7', color: '#7e22ce' },
  "أخرى": { backgroundColor: '#f3f4f6', borderLeft: '4px solid #6b7280', color: '#374151' },
};
const departmentOptions = ['الكهرباء', 'الصحي', 'الإنشائي', 'المعماري', 'أخرى'];

// --- Helper Functions ---
const parseTime = (timeStr: string): { hours: number, minutes: number } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
};


export function RoomBookingCalendar() {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const [date, setDate] = useState<Date | undefined>();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = useCallback(async (d: Date) => {
        if (!firestore) return;
        setLoading(true);
        try {
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);

            const [clientSnap, engSnap, apptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                getDocs(query(
                    collection(firestore, 'appointments'),
                    where('appointmentDate', '>=', dayStart),
                    where('appointmentDate', '<=', dayEnd),
                    where('type', '==', 'room')
                ))
            ]);
            
            const fetchedClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(fetchedClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr)));
            
            const fetchedEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEngineers(fetchedEngineers.sort((a,b) => a.fullName.localeCompare(b.fullName)));

            const augmentedAppointments = apptSnap.docs
                .map(doc => {
                    const appt = { id: doc.id, ...doc.data() } as Appointment;
                    return {
                        ...appt,
                        clientName: fetchedClients.find(c => c.id === appt.clientId)?.nameAr,
                        engineerName: appt.engineerId ? fetchedEngineers.find(e => e.id === appt.engineerId)?.fullName : undefined,
                    }
                });

            setAppointments(augmentedAppointments);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحديث قائمة المواعيد.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);
    
    useEffect(() => {
        // Set date on client side to avoid hydration mismatch and trigger initial data fetch.
        setDate(new Date());
    }, []);
    
    useEffect(() => {
        if (date) {
            fetchData(date);
        } else {
            setLoading(true);
        }
    }, [date, fetchData]);

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
            if (!appt || !appt.meetingRoom || !grid[appt.meetingRoom] || !appt.appointmentDate?.toDate) {
                return; 
            }

            try {
                const startTime = appt.appointmentDate.toDate();
                const timeKey = format(startTime, 'HH:mm');

                if (timeKey in grid[appt.meetingRoom]) {
                    grid[appt.meetingRoom][timeKey] = appt;
                }
            } catch (e) {
                console.error("Could not process appointment:", appt, e);
            }
        });

        return grid;
    }, [appointments]);


    const handleOpenDialog = (data: Partial<Appointment> & { room: string, time?: string }) => {
        if (!date) return;
        if (data.id) { // Editing existing appointment
            setDialogData(data);
        } else { // Creating new
            const { hours, minutes } = parseTime(data.time!);
            const startTime = setMinutes(setHours(date, hours), minutes);
            const endTime = addMinutes(startTime, 30);
            
            setDialogData({
                room: data.room,
                appointmentDate: startTime,
                endDate: endTime
            });
        }
        setIsDialogOpen(true);
    };

    const handleSaveBooking = async (formData: any) => {
        if (!firestore) return;

        const isEditing = !!formData.id;
        
        try {
            const dataToSave: any = {
                clientId: formData.clientId,
                engineerId: formData.engineerId,
                title: formData.title,
                notes: formData.notes || '',
                meetingRoom: formData.room,
                department: formData.department,
                appointmentDate: Timestamp.fromDate(formData.appointmentDate),
                endDate: Timestamp.fromDate(formData.endDate),
                type: 'room',
            };
            
            if(!isEditing) {
                dataToSave.createdAt = serverTimestamp();
            }

            if(isEditing) {
                const appointmentRef = doc(firestore, 'appointments', formData.id);
                await updateDoc(appointmentRef, dataToSave);
                toast({ title: "تم التعديل بنجاح!" });
            } else {
                await addDoc(collection(firestore, 'appointments'), dataToSave);
                toast({ title: "تم الحجز بنجاح!" });
            }
            
            setIsDialogOpen(false);
            if (date) {
                fetchData(date);
            }

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الموعد.' });
        }
    };
    
    const handleDeleteBooking = async () => {
        if (!appointmentToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'appointments', appointmentToDelete.id));
            toast({ title: 'تم الحذف', description: 'تم إلغاء الموعد بنجاح.' });
            if (date) { // Re-fetch to update the UI
                fetchData(date);
            }
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

    const renderGridSection = (title: string, slots: string[]) => (
        <div className="border rounded-lg overflow-x-auto">
            <h3 className="font-bold text-lg p-3 bg-muted print:text-base">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col style={{ width: '8rem' }} />
                    {slots.map((_, i) => <col key={i} style={{ minWidth: '8rem' }} />)}
                </colgroup>
                <thead>
                    <tr className='border-b'>
                        <th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l print:text-sm">القاعة</th>
                        {slots.map(time => <th key={time} className="p-2 text-center text-sm font-mono border-l">{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rooms.map(room => (
                        <tr key={room} className='border-b'>
                            <th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l print:text-sm">{room}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[room]?.[time];
                                return (
                                    <td key={`${room}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div 
                                                        style={{
                                                            height: '100%',
                                                            width: '100%',
                                                            borderRadius: '0.375rem',
                                                            padding: '0.5rem',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer',
                                                            ...(departmentStyles[booking.department || 'أخرى'] || {})
                                                        }}
                                                    >
                                                        <p style={{ fontWeight: 'bold' }}>{booking.title}</p>
                                                        <p>{booking.clientName}</p>
                                                        <p style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{booking.engineerName}</p>
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
    );

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
                            {date ? format(date, "PPP", { locale: ar }) : <span>اختر يوما</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(newDate) => {
                                setDate(newDate);
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
                    onSave={handleSaveBooking}
                    dialogData={dialogData}
                    clients={clients}
                    engineers={engineers}
                    currentDate={date}
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

function BookingDialog({ isOpen, onClose, onSave, dialogData, clients, engineers }: any) {
    const isEditing = !!dialogData?.id;
    const [formData, setFormData] = useState({
        clientId: '',
        department: '',
        engineerId: '',
        title: '',
        notes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    
    const roomName = useMemo(() => dialogData?.meetingRoom || dialogData?.room, [dialogData]);

    useEffect(() => {
        if (isOpen && dialogData) {
            setFormData({
                clientId: dialogData.clientId || '',
                department: dialogData.department || '',
                engineerId: dialogData.engineerId || '',
                title: dialogData.title || '',
                notes: dialogData.notes || '',
            });
        }
    }, [isOpen, dialogData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const appointmentDateToSave = dialogData.appointmentDate;
        const endDateToSave = dialogData.endDate;

        setIsSaving(true);
        await onSave({ 
            ...formData, 
            id: dialogData.id,
            room: roomName,
            appointmentDate: appointmentDateToSave,
            endDate: endDateToSave,
        });
        setIsSaving(false);
    };

    const clientOptions = useMemo(() => clients.map((c: Client) => ({ value: c.id, label: c.nameAr, searchKey: c.mobile })), [clients]);
    const engineerOptions = useMemo(() => engineers.map((e: Employee) => ({ value: e.id!, label: e.fullName, searchKey: e.civilId })), [engineers]);
    const departmentOptionsForSelect = useMemo(() => departmentOptions.map(d => ({ value: d, label: d, searchKey: d })), []);


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                dir="rtl"
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]') || target.closest('[data-radix-popper-content-wrapper]') || target.closest('[data-inline-search-list-options]')) {
                        e.preventDefault();
                    }
                }}
            >
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل موعد' : 'حجز موعد جديد'}</DialogTitle>
                        <DialogDescription>
                            حجز {roomName} في {format(dialogData.appointmentDate, "PPP", { locale: ar })} الساعة {format(dialogData.appointmentDate, "h:mm a", { locale: ar })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الموعد (اختياري)</Label>
                            <Input id="title" value={formData.title} onChange={(e) => setFormData(p => ({...p, title: e.target.value}))} />
                        </div>
                        <div className="grid gap-2">
                            <Label>العميل</Label>
                            <InlineSearchList value={formData.clientId} onSelect={(v) => setFormData(p => ({...p, clientId: v}))} options={clientOptions} placeholder="ابحث بالاسم أو رقم الجوال..." />
                        </div>
                        <div className="grid gap-2">
                            <Label>القسم</Label>
                             <InlineSearchList value={formData.department} onSelect={(v) => setFormData(p => ({...p, department: v}))} options={departmentOptionsForSelect} placeholder="ابحث عن قسم..." />
                        </div>
                         <div className="grid gap-2">
                            <Label>المهندس</Label>
                             <InlineSearchList value={formData.engineerId} onSelect={(v) => setFormData(p => ({...p, engineerId: v}))} options={engineerOptions} placeholder="ابحث بالاسم أو الرقم المدني..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ الموعد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
