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
import type { Appointment, Client, Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '@/components/ui/textarea';
import { useBranding } from '@/context/branding-context';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';

// --- مساعدات النظام ---

const generateTimeSlots = (start: string, end: string, slotDuration: number, buffer: number): string[] => {
    if (!start || !end || !slotDuration || slotDuration <= 0) return [];
    const slots: string[] = [];
    try {
        let currentTime = parse(start, 'HH:mm', new Date());
        const endTime = parse(end, 'HH:mm', new Date());
        
        while (currentTime < endTime) {
            const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
            if (slotEndTime > endTime) break;
            slots.push(format(currentTime, 'HH:mm'));
            currentTime = new Date(slotEndTime.getTime() + buffer * 60000);
        }
    } catch (e) {
        console.error("Slot generation error:", e);
    }
    return slots;
};

function getVisitColor(visit: { visitCount?: number, contractSigned?: boolean }) {
  if (visit.visitCount === 1) return "#facc15"; 
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; 
  if (visit.visitCount! > 1 && visit.contractSigned) return "#3b82f6"; 
  return "#9ca3af"; 
}

async function reconcileClientAppointments(firestore: any, identifier: { clientId?: string | null; clientMobile?: string | null }) {
    if (!identifier.clientId && !identifier.clientMobile) return;
    try {
        const apptsQueryConstraints = [where('type', '==', 'architectural')];
        if (identifier.clientId) {
            apptsQueryConstraints.push(where('clientId', '==', identifier.clientId));
        } else if (identifier.clientMobile) {
            apptsQueryConstraints.push(where('clientMobile', '==', identifier.clientMobile));
        } else { return; }

        const clientApptsSnap = await getDocs(query(collection(firestore, 'appointments'), ...apptsQueryConstraints));
        const appointments = clientApptsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Appointment))
            .filter(appt => appt.status !== 'cancelled')
            .sort((a, b) => (a.appointmentDate?.toMillis() || 0) - (b.appointmentDate?.toMillis() || 0));

        let contractSigned = false;
        if (identifier.clientId) {
            const clientSnap = await getDoc(doc(firestore, 'clients', identifier.clientId));
            contractSigned = clientSnap.exists() && ['contracted', 'reContracted'].includes(clientSnap.data().status);
        }
        
        const batch = writeBatch(firestore);
        let hasUpdates = false;
        appointments.forEach((appt, index) => {
            const visitCount = index + 1;
            const newColor = getVisitColor({ visitCount, contractSigned });
            if (appt.visitCount !== visitCount || appt.color !== newColor) {
                batch.update(doc(firestore, 'appointments', appt.id!), { visitCount, color: newColor });
                hasUpdates = true;
            }
        });
        if (hasUpdates) await batch.commit();
    } catch (error) { console.error("Reconciliation failed:", error); }
}

// مصفوفة أيام الأسبوع المتوافقة مع getDay() (0 = الأحد)
const weekDays = [
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
    { id: 'Saturday', label: 'السبت' },
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
    
    useEffect(() => { if (!date) setDate(new Date()); }, [date]);

    const { morningSlots, eveningSlots, hasWorkHours, isRamadan } = useMemo(() => {
        if (!date) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        
        const ramadanSettings = branding?.work_hours?.ramadan;
        const isDateInRamadan = ramadanSettings?.is_enabled && ramadanSettings.start_date && ramadanSettings.end_date &&
            date >= toFirestoreDate(ramadanSettings.start_date)! && date <= toFirestoreDate(ramadanSettings.end_date)!;
    
        if (isDateInRamadan) {
            const slots = generateTimeSlots(ramadanSettings.start_time || '09:00', ramadanSettings.end_time || '15:00', ramadanSettings.appointment_slot_duration || 30, ramadanSettings.appointment_buffer_time || 0);
            return { morningSlots: slots, eveningSlots: [], hasWorkHours: slots.length > 0, isRamadan: true };
        }
    
        const workHours = branding?.work_hours?.architectural;
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

    useEffect(() => {
        if (!firestore) return;
        getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))).then(snap => {
            const arch = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)).filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
            setEngineers(arch);
        });
        getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))).then(snap => {
            setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)).sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
        });
    }, [firestore]);
    
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore) return;
        setLoading(true);
        try {
            const apptSnap = await getDocs(query(collection(firestore, 'appointments'), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d))));
            setRawAppointments(apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)).filter(appt => appt.type === 'architectural'));
        } finally { setLoading(false); }
    }, [firestore]);

    useEffect(() => { if (date) fetchAppointments(date); }, [date, fetchAppointments]);

    const appointments = useMemo(() => {
      if (!rawAppointments) return [];
      return rawAppointments.filter(appt => appt.status !== 'cancelled').map(appt => ({
          ...appt, clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName,
      }));
    }, [rawAppointments, clients]);

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
            if (grid[appt.engineerId] && time in grid[appt.engineerId]) grid[appt.engineerId][time] = appt;
        });
        return grid;
    }, [appointments, engineers, morningSlots, eveningSlots]);

    const handleCancelBooking = async () => {
        if (!appointmentToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await updateDoc(doc(firestore, 'appointments', appointmentToDelete.id!), { status: 'cancelled' });
            await reconcileClientAppointments(firestore, { clientId: appointmentToDelete.clientId, clientMobile: appointmentToDelete.clientMobile });
            toast({ title: 'نجاح', description: 'تم إلغاء الموعد وتحديث الجدول.' });
            if(date) fetchAppointments(date);
        } finally { setIsDeleting(false); setAppointmentToDelete(null); }
    };

    const renderGridSection = (title: string, slots: string[]) => {
      if (slots.length === 0) return null;
      return (
        <div className="border rounded-lg overflow-x-auto bg-card">
            <h3 className="font-bold text-lg p-3 bg-muted print:text-base">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup><col className="w-[8rem]" />{slots.map((_, i) => <col key={i} className="w-[8rem]" />)}</colgroup>
                <thead><tr className='border-b'><th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l">المهندس</th>{slots.map(time => <th key={time} className="p-2 text-center text-sm font-mono border-l">{time}</th>)}</tr></thead>
                <tbody>
                    {engineers.map(eng => (
                        <tr key={eng.id} className='border-b'>
                            <th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l">{eng.fullName}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[eng.id!]?.[time];
                                const isClosed = !!booking?.workStageUpdated;
                                return (
                                    <td key={`${eng.id}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking ? (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                     <div className="relative h-full w-full rounded-md p-2 text-xs text-gray-800 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm hover:brightness-95 transition-all" style={{ backgroundColor: booking.color }}>
                                                        {isClosed && <CheckCircle className="h-4 w-4 absolute top-1 right-1 text-white/80" />}
                                                        <p className="font-black leading-tight">{booking.clientName}</p>
                                                        {booking.visitCount && <span className="text-[10px] mt-1 opacity-75 font-bold">(الزيارة {booking.visitCount})</span>}
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl">
                                                    <DropdownMenuItem asChild><Link href={`/dashboard/appointments/${booking.id}`}><Eye className="ml-2 h-4 w-4" />عرض وتحديث الزيارة</Link></DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" />إلغاء الموعد</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <div className="h-full w-full hover:bg-muted/30 transition-colors rounded-md no-print cursor-pointer" onClick={() => {
                                                const apptDate = setMinutes(setHours(date!, Number(time.split(':')[0])), Number(time.split(':')[1]));
                                                if (isPast(apptDate)) return toast({ title: 'لا يمكن الحجز في الماضي' });
                                                setDialogData({ isEditing: false, engineerId: eng.id, engineerName: eng.fullName, appointmentDate: apptDate });
                                                setIsDialogOpen(true);
                                            }} />
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

    if (brandingLoading || loading) return <Skeleton className="h-[500px] w-full rounded-3xl" />;

    if (!hasWorkHours) {
        return (
             <Card className="mt-4 rounded-3xl border-2 border-dashed">
                <CardHeader>
                    <CardTitle className="text-center">لم يتم تكوين أوقات الدوام</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground pb-10">
                    <p>الرجاء الذهاب إلى صفحة الإعدادات لتحديد أوقات عمل القسم المعماري.</p>
                    <Button asChild className="mt-6 rounded-xl font-bold">
                        <Link href="/dashboard/settings/work-hours">الذهاب إلى الإعدادات</Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6" dir='rtl'>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-2xl border no-print">
                <div className="flex items-center gap-3">
                    <CalendarIcon className="text-primary h-6 w-6" />
                    <h2 className="text-lg font-black">جدول زيارات القسم المعماري</h2>
                </div>
                <div className='flex items-center gap-2'>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild><Button variant="outline" className="w-[240px] font-bold rounded-xl"><CalendarIcon className="ml-2 h-4 w-4" />{date ? format(date, "PPP", { locale: ar }) : "اختر تاريخ"}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={(d) => { if(d) setDate(d); setIsCalendarOpen(false); }} initialFocus /></PopoverContent>
                    </Popover>
                </div>
            </div>
            
            <div id="architectural-appointments-printable-area" className="space-y-6">
                {isRamadan ? renderGridSection('فترة دوام رمضان', morningSlots) : (
                    <>
                        {renderGridSection('الفترة الصباحية', morningSlots)}
                        {renderGridSection('الفترة المسائية', eveningSlots)}
                    </>
                )}
            </div>

            <BookingDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSaveSuccess={() => date && fetchAppointments(date)} dialogData={dialogData} clients={clients} firestore={firestore} currentUser={currentUser} />
            
            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle>تأكيد الإلغاء؟</AlertDialogTitle><AlertDialogDescription>سيتم تغيير حالة الموعد إلى ملغي وتعديل ترقيم الزيارات المتبقية.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel><AlertDialogAction onClick={handleCancelBooking} className="bg-destructive rounded-xl">{isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'إلغاء الموعد'}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// --- مكون نافذة الحجز ---
function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, firestore, currentUser }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [title, setTitle] = useState('');
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (isNewClient) {
                const newAppt = { title: title || newClientName, clientName: newClientName, clientMobile: newClientMobile, engineerId: dialogData.engineerId, appointmentDate: Timestamp.fromDate(dialogData.appointmentDate), type: 'architectural', status: 'scheduled', visitCount: 1, color: '#facc15', createdAt: serverTimestamp(), workStageUpdated: false };
                await addDoc(collection(firestore, 'appointments'), newAppt);
            } else {
                const client = clients.find((c: any) => c.id === selectedClientId);
                const batch = writeBatch(firestore);
                const clientApptsQuery = query(collection(firestore, 'appointments'), where('clientId', '==', selectedClientId), where('type', '==', 'architectural'), where('status', '!=', 'cancelled'));
                const snap = await getDocs(clientApptsQuery);
                const existing = snap.docs.map(d => ({id: d.id, ...d.data()}));
                const visitCount = existing.length + 1;
                const newApptRef = doc(collection(firestore, 'appointments'));
                batch.set(newApptRef, { clientId: selectedClientId, engineerId: dialogData.engineerId, title: title || client.nameAr, appointmentDate: Timestamp.fromDate(dialogData.appointmentDate), type: 'architectural', status: 'scheduled', visitCount, color: getVisitColor({ visitCount, contractSigned: client.status !== 'new' }), createdAt: serverTimestamp(), workStageUpdated: false });
                await batch.commit();
            }
            toast({ title: 'نجاح', description: 'تم حفظ الموعد.' });
            onSaveSuccess(); onClose();
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحفظ' }); } finally { setIsSaving(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-3xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader><DialogTitle>حجز موعد جديد</DialogTitle><DialogDescription>{dialogData?.engineerName} - {dialogData?.appointmentDate && format(dialogData.appointmentDate, 'p', { locale: ar })}</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label>الغرض من الزيارة</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: مناقشة المخططات..." className="rounded-xl" /></div>
                        <div className="flex items-center gap-2 pt-2"><Checkbox checked={isNewClient} onCheckedChange={(c) => setIsNewClient(!!c)} /><Label>عميل جديد (غير مسجل)</Label></div>
                        {isNewClient ? (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                <div className="grid gap-2"><Label>الاسم</Label><Input value={newClientName} onChange={e => setNewClientName(e.target.value)} required className="rounded-xl" /></div>
                                <div className="grid gap-2"><Label>الجوال</Label><Input value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} required className="rounded-xl" /></div>
                            </div>
                        ) : (
                            <div className="grid gap-2 animate-in fade-in"><Label>العميل المسجل</Label><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clients.map((c: any) => ({ value: c.id, label: c.nameAr }))} placeholder="ابحث..." className="rounded-xl" /></div>
                        )}
                    </div>
                    <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={isSaving} className="rounded-xl font-bold">{isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'تأكيد الحجز'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
