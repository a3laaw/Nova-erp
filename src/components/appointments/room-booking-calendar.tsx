'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Save, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';

// --- Constants ---
const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];
const timeSlots = Array.from({ length: 8 }, (_, i) => { // From 7 AM, 8 slots (until 10:30 AM)
  const totalMinutes = 7 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
});
const departmentColors: Record<string, string> = {
  "الكهرباء": "bg-red-100 border-red-500 text-red-800",
  "الصحي": "bg-blue-100 border-blue-500 text-blue-800",
  "الإنشائي": "bg-green-100 border-green-500 text-green-800",
  "المعماري": "bg-purple-100 border-purple-500 text-purple-800",
  "أخرى": "bg-gray-100 border-gray-500 text-gray-800",
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

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);


    // --- Data Fetching ---
    useEffect(() => {
        if (!firestore) return;

        const fetchStaticData = async () => {
             try {
                const [clientSnap, engSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active')))
                ]);
                const fetchedClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                const fetchedEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                setClients(fetchedClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr)));
                setEngineers(fetchedEngineers.sort((a,b) => a.fullName.localeCompare(b.fullName)));
            } catch (error) {
                console.error("Error fetching static data: ", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العملاء والمهندسين.' });
            }
        }
        fetchStaticData();
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
                    where('type', '==', 'room'),
                    where('appointmentDate', '>=', dayStart),
                    where('appointmentDate', '<=', dayEnd)
                );
                const querySnapshot = await getDocs(q);
                const fetchedAppointments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
                setAppointments(fetchedAppointments);
            } catch (error) {
                console.error("Error fetching appointments:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد.' });
            } finally {
                setLoading(false);
            }
        };

        fetchAppointments();
    }, [date, firestore, toast]);

    const bookingsGrid = useMemo(() => {
        const grid: Record<string, Record<string, Appointment | null>> = {};
        rooms.forEach(room => {
            grid[room] = {};
            timeSlots.forEach(slot => {
                grid[room][slot] = null;
            });
        });

        appointments.forEach(appt => {
            if (!appt.meetingRoom) return;

            const startTime = appt.appointmentDate.toDate();
            const startHour = getHours(startTime);
            const startMinute = getMinutes(startTime);

            for (let i = 0; i < timeSlots.length; i++) {
                const slotTime = parseTime(timeSlots[i]);
                if (slotTime.hours === startHour && slotTime.minutes === startMinute) {
                    grid[appt.meetingRoom][timeSlots[i]] = appt;
                    break;
                }
            }
        });
        return grid;
    }, [appointments]);

    const handleOpenDialog = (data: Partial<Appointment> & { room: string, time?: string }) => {
        if (data.id) { // Editing existing appointment
            setDialogData(data);
        } else { // Creating new
            const { hours, minutes } = parseTime(data.time!);
            const startTime = setMinutes(setHours(date!, hours), minutes);
            const endTime = addMinutes(startTime, 30);
            
            setDialogData({
                room: data.room,
                startTime,
                endTime
            });
        }
        setIsDialogOpen(true);
    };

    const handleSaveBooking = async (formData: any) => {
        if (!firestore) return;

        const isEditing = !!formData.id;
        
        try {
            const dataToSave = {
                clientId: formData.clientId,
                engineerId: formData.engineerId,
                title: formData.title,
                notes: formData.notes,
                meetingRoom: formData.room,
                department: formData.department,
                appointmentDate: Timestamp.fromDate(formData.startTime),
                endDate: Timestamp.fromDate(formData.endTime),
                type: 'room',
                ...(!isEditing && { createdAt: serverTimestamp() })
            };

            if(isEditing) {
                const appointmentRef = doc(firestore, 'appointments', formData.id);
                await updateDoc(appointmentRef, dataToSave);
                toast({ title: "تم التعديل بنجاح!" });
                setAppointments(prev => prev.map(appt => appt.id === formData.id ? { ...appt, ...dataToSave } : appt));
            } else {
                const newDocRef = await addDoc(collection(firestore, 'appointments'), dataToSave);
                toast({ title: "تم الحجز بنجاح!" });
                setAppointments(prev => [...prev, {id: newDocRef.id, ...dataToSave} as Appointment]);
            }

            setIsDialogOpen(false);
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
            setAppointments(prev => prev.filter(appt => appt.id !== appointmentToDelete.id));
        } catch (error) {
            console.error("Error deleting appointment:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء الموعد.' });
        } finally {
            setIsDeleting(false);
            setAppointmentToDelete(null);
        }
    };


    return (
        <div dir="rtl" className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border">
                <h1 className="text-lg font-bold">تقويم حجوزات القاعات</h1>
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

            <div className="overflow-x-auto border rounded-lg">
                <div className="grid grid-cols-[6rem_repeat(8,8rem)]">
                    {/* Header Row */}
                    <div className="sticky top-0 left-0 bg-muted p-2 z-10 font-semibold text-center">القاعة</div>
                    {timeSlots.map(time => (
                        <div key={time} className="sticky top-0 bg-muted p-2 text-center text-sm font-mono border-r">
                            {time}
                        </div>
                    ))}

                    {/* Rooms Rows */}
                    {rooms.map(room => (
                        <React.Fragment key={room}>
                             <div className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-t">{room}</div>
                             {timeSlots.map(time => {
                                const booking = bookingsGrid[room]?.[time];
                                return (
                                    <div key={`${room}-${time}`} className="relative h-24 border-t border-r p-1">
                                        {booking ? (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div className={cn('h-full w-full rounded-md p-2 text-xs flex flex-col justify-between border-l-4 cursor-pointer', departmentColors[booking.department || 'أخرى'])}>
                                                        <div>
                                                            <p className="font-bold truncate">{booking.title}</p>
                                                            <p className="text-muted-foreground truncate">{clients.find(c => c.id === booking.clientId)?.nameAr}</p>
                                                        </div>
                                                        <p className="text-muted-foreground truncate font-mono text-xs">{engineers.find(e => e.id === booking.engineerId)?.fullName}</p>
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
                                                className="h-full w-full text-muted-foreground/50 hover:bg-muted transition-colors rounded-md"
                                                aria-label={`حجز ${room} الساعة ${time}`}
                                            />
                                        )}
                                    </div>
                                );
                             })}
                        </React.Fragment>
                    ))}
                </div>
            </div>
             {loading && <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>}

             <div className="flex justify-center gap-4 pt-4">
                {Object.entries(departmentColors).map(([dept, className]) => (
                    <div key={dept} className="flex items-center gap-2">
                        <div className={cn("h-4 w-4 rounded-sm border-l-4", className)} />
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

function BookingDialog({ isOpen, onClose, onSave, dialogData, clients, engineers, currentDate }: any) {
    const isEditing = !!dialogData?.id;
    const [formData, setFormData] = useState({
        clientId: '',
        department: '',
        engineerId: '',
        title: '',
        notes: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    
    const [appointmentDate, setAppointmentDate] = useState<Date | undefined>(currentDate);
    const [startTime, setStartTime] = useState('');

    const roomName = useMemo(() => dialogData?.room || dialogData?.meetingRoom, [dialogData]);

    useEffect(() => {
        if (isOpen && dialogData) {
            const initialDate = toFirestoreDate(dialogData.appointmentDate || dialogData.startTime);
            setAppointmentDate(initialDate || currentDate);
            setStartTime(initialDate ? format(initialDate, 'HH:mm') : format(dialogData.startTime, 'HH:mm'));

            setFormData({
                clientId: dialogData.clientId || '',
                department: dialogData.department || '',
                engineerId: dialogData.engineerId || '',
                title: dialogData.title || '',
                notes: dialogData.notes || '',
            });
        }
    }, [isOpen, dialogData, currentDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const newStartTime = new Date(appointmentDate!);
        const [hours, minutes] = startTime.split(':').map(Number);
        newStartTime.setHours(hours, minutes, 0, 0);

        const newEndTime = addMinutes(newStartTime, 30);
        
        setIsSaving(true);
        await onSave({ 
            ...formData, 
            id: dialogData.id,
            room: roomName,
            startTime: newStartTime,
            endTime: newEndTime,
        });
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'تعديل موعد' : 'حجز موعد جديد'}</DialogTitle>
                        <DialogDescription>
                            حجز {roomName}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                                <Label>التاريخ</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="ml-2 h-4 w-4" />
                                            {appointmentDate ? format(appointmentDate, "PPP", { locale: ar }) : <span>اختر يوما</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={appointmentDate} onSelect={setAppointmentDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label>وقت البدء</Label>
                                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="clientId">العميل</Label>
                            <Select dir="rtl" onValueChange={(v) => setFormData(p => ({ ...p, clientId: v }))} value={formData.clientId} required>
                                <SelectTrigger><SelectValue placeholder="اختر العميل..." /></SelectTrigger>
                                <SelectContent>{clients.map((c: Client) => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="department">القسم</Label>
                            <Select dir="rtl" onValueChange={(v) => setFormData(p => ({ ...p, department: v }))} value={formData.department} required>
                                <SelectTrigger><SelectValue placeholder="اختر القسم..." /></SelectTrigger>
                                <SelectContent>{departmentOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="engineerId">المهندس</Label>
                            <Select dir="rtl" onValueChange={(v) => setFormData(p => ({ ...p, engineerId: v }))} value={formData.engineerId} required>
                                <SelectTrigger><SelectValue placeholder="اختر المهندس..." /></SelectTrigger>
                                <SelectContent>{engineers.map((e: Employee) => <SelectItem key={e.id!} value={e.id!}>{e.fullName}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الموعد</Label>
                            <Input id="title" value={formData.title} onChange={(e) => setFormData(p => ({...p, title: e.target.value}))} required />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData(p => ({...p, notes: e.target.value}))} />
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
