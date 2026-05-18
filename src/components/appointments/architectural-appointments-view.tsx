'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, Timestamp, doc, updateDoc, writeBatch, getDoc, orderBy, limit } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format, isPast, parse, isValid, isWithinInterval } from 'date-fns';
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
import { CalendarIcon, Loader2, Printer, Eye, Pencil, Trash2, CheckCircle, PlaneTakeoff, GripVertical } from 'lucide-react';
import { cn, getTenantPath } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee, LeaveRequest } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';

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

async function reconcileClientAppointments(firestore: any, tenantId: string | undefined, identifier: { clientId?: string | null; clientMobile?: string | null }) {
    if (!identifier.clientId && !identifier.clientMobile) return;
    try {
        const apptsPath = getTenantPath('appointments', tenantId);
        const apptsQueryConstraints = [where('type', '==', 'architectural')];
        if (identifier.clientId) {
            apptsQueryConstraints.push(where('clientId', '==', identifier.clientId));
        } else if (identifier.clientMobile) {
            apptsQueryConstraints.push(where('clientMobile', '==', identifier.clientMobile));
        } else { return; }

        const clientApptsSnap = await getDocs(query(collection(firestore, apptsPath), ...apptsQueryConstraints));
        const appointments = clientApptsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Appointment))
            .filter(appt => appt.status !== 'cancelled')
            .sort((a, b) => (a.appointmentDate?.toMillis() || 0) - (b.appointmentDate?.toMillis() || 0));

        let contractSigned = false;
        if (identifier.clientId) {
            const clientPath = getTenantPath(`clients/${identifier.clientId}`, tenantId);
            const clientSnap = await getDoc(doc(firestore, clientPath));
            contractSigned = clientSnap.exists() && ['contracted', 'reContracted'].includes(clientSnap.data().status);
        }
        
        const batch = writeBatch(firestore);
        let hasUpdates = false;
        appointments.forEach((appt, index) => {
            const visitCount = index + 1;
            const newColor = getVisitColor({ visitCount, contractSigned });
            if (appt.visitCount !== visitCount || appt.color !== newColor) {
                batch.update(doc(firestore, apptsPath, appt.id!), { visitCount, color: newColor });
                hasUpdates = true;
            }
        });
        if (hasUpdates) await batch.commit();
    } catch (error) { console.error("Reconciliation failed:", error); }
}

const weekDays = [
    { id: 'Sunday', label: 'الأحد' },
    { id: 'Monday', label: 'الاثنين' },
    { id: 'Tuesday', label: 'الثلاثاء' },
    { id: 'Wednesday', label: 'الأربعاء' },
    { id: 'Thursday', label: 'الخميس' },
    { id: 'Friday', label: 'الجمعة' },
    { id: 'Saturday', label: 'السبت' },
];

export default function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();
    
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);
    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    useEffect(() => { if (!date) setDate(new Date()); }, [date]);

    const tenantId = currentUser?.currentCompanyId;

    const { morningSlots, eveningSlots, hasWorkHours, isRamadan } = useMemo(() => {
        if (!date) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        const ramadanSettings = branding?.work_hours?.ramadan;
        const isDateInRamadan = ramadanSettings?.is_enabled && date >= toFirestoreDate(ramadanSettings.start_date)! && date <= toFirestoreDate(ramadanSettings.end_date)!;
        if (isDateInRamadan) {
            const slots = generateTimeSlots(ramadanSettings.start_time || '09:00', ramadanSettings.end_time || '15:00', ramadanSettings.appointment_slot_duration || 30, ramadanSettings.appointment_buffer_time || 0);
            return { morningSlots: slots, eveningSlots: [], hasWorkHours: slots.length > 0, isRamadan: true };
        }
        const workHours = branding?.work_hours?.architectural;
        if (!workHours) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
        const slotDuration = workHours.appointment_slot_duration || 30;
        const buffer = workHours.appointment_buffer_time || 0;
        const todayDayName = weekDays[date.getDay()].id;
        if (branding?.work_hours?.holidays?.includes(todayDayName)) return { morningSlots: [], eveningSlots: [], hasWorkHours: true, isRamadan: false };
        const halfDaySettings = branding?.work_hours?.half_day;
        const isHalfDay = halfDaySettings?.day === todayDayName;
        let { morning_start_time, morning_end_time, evening_start_time, evening_end_time } = workHours;
        if (isHalfDay) {
            if (halfDaySettings.type === 'morning_only') { evening_start_time = ''; evening_end_time = ''; } 
            else if (halfDaySettings.type === 'custom_end_time' && halfDaySettings.end_time) {
                if (halfDaySettings.end_time <= morning_end_time) { morning_end_time = halfDaySettings.end_time; evening_start_time = ''; evening_end_time = ''; } 
                else { evening_end_time = halfDaySettings.end_time < evening_end_time ? halfDaySettings.end_time : evening_end_time; }
            }
        }
        const mSlots = generateTimeSlots(morning_start_time, morning_end_time, slotDuration, buffer);
        const eSlots = generateTimeSlots(evening_start_time, evening_end_time, slotDuration, buffer);
        return { morningSlots: mSlots, eveningSlots: eSlots, hasWorkHours: mSlots.length > 0 || eSlots.length > 0, isRamadan: false };
    }, [branding, date]);

    useEffect(() => {
        if (!firestore || !tenantId) return;
        const employeesPath = getTenantPath('employees', tenantId);
        const clientsPath = getTenantPath('clients', tenantId);
        const leavesPath = getTenantPath('leaveRequests', tenantId);
        getDocs(query(collection(firestore, employeesPath), where('status', 'in', ['active', 'on-leave']))).then(snap => {
            const arch = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)).filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
            setEngineers(arch);
        });
        getDocs(query(collection(firestore, clientsPath), where('isActive', '==', true))).then(snap => {
            setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)).sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
        });
        getDocs(query(collection(firestore, leavesPath), where('status', 'in', ['approved', 'on-leave', 'returned']))).then(snap => {
            setLeaveRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest)));
        });
    }, [firestore, tenantId]);
    
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore || !tenantId) return;
        setLoading(true);
        try {
            const apptsPath = getTenantPath('appointments', tenantId);
            const apptSnap = await getDocs(query(collection(firestore, apptsPath), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d))));
            setRawAppointments(apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)).filter(appt => appt.type === 'architectural'));
        } finally { setLoading(false); }
    }, [firestore, tenantId]);

    useEffect(() => { if (date) fetchAppointments(date); }, [date, fetchAppointments]);

    const getEmployeeLeaveForDate = useCallback((employeeId: string, checkDate: Date) => {
        return leaveRequests.find(req => {
            if (req.employeeId !== employeeId) return false;
            const start = toFirestoreDate(req.startDate);
            const end = toFirestoreDate(req.endDate);
            if (!start || !end) return false;
            return isWithinInterval(startOfDay(checkDate), { start: startOfDay(start), end: endOfDay(end) });
        });
    }, [leaveRequests]);

    const appointments = useMemo(() => rawAppointments.filter(appt => appt.status !== 'cancelled').map(appt => ({ ...appt, clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName })), [rawAppointments, clients]);

    const bookingsGrid = useMemo(() => {
        const grid: Record<string, Record<string, Appointment | null>> = {};
        engineers.forEach(eng => { grid[eng.id!] = {}; [...morningSlots, ...eveningSlots].forEach(slot => grid[eng.id!][slot] = null); });
        appointments.forEach(appt => {
            const appointmentDate = toFirestoreDate(appt.appointmentDate);
            if(!appointmentDate) return;
            const time = format(appointmentDate, 'HH:mm');
            if (grid[appt.engineerId] && time in grid[appt.engineerId]) grid[appt.engineerId][time] = appt;
        });
        return grid;
    }, [appointments, engineers, morningSlots, eveningSlots]);

    const handleCancelBooking = async () => {
        if (!appointmentToDelete || !firestore || !tenantId) return;
        setIsDeleting(true);
        try {
            const apptsPath = getTenantPath('appointments', tenantId);
            await updateDoc(doc(firestore, apptsPath, appointmentToDelete.id!), { status: 'cancelled' });
            await reconcileClientAppointments(firestore, tenantId, { clientId: appointmentToDelete.clientId, clientMobile: appointmentToDelete.clientMobile });
            toast({ title: 'نجاح التحديث' });
            if(date) fetchAppointments(date);
        } finally { setIsDeleting(false); setAppointmentToDelete(null); }
    };

    const handlePrint = () => window.print();

    const renderGridSection = (title: string, slots: string[]) => {
      if (slots.length === 0) return null;
      return (
        <div className="border-2 rounded-[2rem] overflow-x-auto bg-white shadow-xl mb-8">
            <h3 className="font-black text-lg p-5 bg-[#F8F9FE] text-[#7209B7] border-b-2">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col className="w-[10rem]" />
                    {slots.map((_, i) => <col key={i} className="w-[8rem]" />)}
                </colgroup>
                <thead><tr className='border-b bg-[#F8F9FE]/50'><th className="sticky left-0 bg-[#F8F9FE] p-4 z-10 font-black text-[#7209B7] text-center border-l">المهندس المختص</th>{slots.map(time => <th key={time} className="p-4 text-center text-sm font-mono font-black text-[#7209B7] border-l">{time}</th>)}</tr></thead>
                <tbody>
                    {engineers.map(eng => {
                        const activeLeave = date ? getEmployeeLeaveForDate(eng.id!, date) : null;
                        const isOnLeave = !!activeLeave;
                        return (
                        <tr key={eng.id} className={cn('border-b transition-colors hover:bg-[#F3E8FF]/10', isOnLeave && "bg-red-50/20")}>
                            <th className={cn("sticky left-0 bg-[#F8F9FE] p-4 z-10 font-black text-gray-800 text-center border-l", isOnLeave && "text-red-300 opacity-50")}>
                                {eng.fullName}
                                {isOnLeave && <div className="flex flex-col items-center mt-1"><Badge variant="outline" className="bg-red-50 text-[8px] font-black text-red-600 border-red-200">في إجازة رسمية</Badge></div>}
                            </th>
                            {slots.map(time => {
                                const booking = bookingsGrid[eng.id!]?.[time];
                                const isClosed = !!booking?.workStageUpdated;
                                return (
                                    <td key={`${eng.id}-${time}`} className="relative h-24 border-l p-1.5 align-top">
                                        {isOnLeave ? (
                                            <div className="h-full w-full bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,rgba(239,68,68,0.03)_5px,rgba(239,68,68,0.03)_10px)] flex items-center justify-center">
                                                <span className="text-[10px] font-black text-red-300 opacity-40 uppercase tracking-tighter rotate-[-15deg]">في إجازة رسمية</span>
                                            </div>
                                        ) : booking ? (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                     <div className="relative h-full w-full rounded-2xl p-2 text-xs text-gray-800 flex flex-col items-center justify-center text-center cursor-pointer shadow-md hover:brightness-95 transition-all" style={{ backgroundColor: booking.color }}>
                                                        {isClosed && <CheckCircle className="h-4 w-4 absolute top-1 right-1 text-white/80" />}
                                                        <p className="font-black leading-tight">{booking.clientName}</p>
                                                        {booking.visitCount && <span className="text-[10px] mt-1 opacity-75 font-bold">(الزيارة {booking.visitCount})</span>}
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl" className="rounded-xl shadow-2xl">
                                                    <DropdownMenuItem asChild className="rounded-lg py-3 font-bold gap-2"><Link href={`/dashboard/appointments/${booking.id}`}><Eye className="h-4 w-4" />عرض وتحديث الزيارة</Link></DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-red-600 font-bold gap-2 rounded-lg py-3"><Trash2 className="h-4 w-4" />إلغاء الموعد</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <div className="h-full w-full hover:bg-[#7209B7]/5 transition-colors rounded-2xl no-print cursor-pointer" onClick={() => {
                                                const apptDate = setMinutes(setHours(date!, Number(time.split(':')[0])), Number(time.split(':')[1]));
                                                if (isPast(apptDate) && currentUser?.role !== 'Admin') return toast({ title: 'لا يمكن الحجز في الماضي' });
                                                setDialogData({ isEditing: false, engineerId: eng.id, engineerName: eng.fullName, appointmentDate: apptDate });
                                                setIsDialogOpen(true);
                                            }} />
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
    )};

    if (brandingLoading || loading) return <Skeleton className="h-[500px] w-full rounded-[2.5rem]" />;

    return (
        <div className="space-y-6" dir='rtl'>
            {/* 🛡️ شريط التحكم الزمني (Sovereign Date & Control Bar) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/40 backdrop-blur-md p-4 rounded-[2rem] border-2 border-white/60 shadow-sm no-print mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary shadow-inner">
                        <CalendarIcon className="h-5 w-5" />
                    </div>
                    <span className="font-black text-sm text-[#1e1b4b]">تصفح جدول المواعيد</span>
                </div>
                <div className="flex items-center gap-3">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[240px] justify-start text-right font-black h-11 rounded-xl border-2 bg-white shadow-sm">
                                <CalendarIcon className="ml-2 h-4 w-4 text-primary" />
                                {date ? format(date, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-2xl" align="start">
                            <Calendar mode="single" selected={date} onSelect={(d) => { if(d) setDate(d); setIsCalendarOpen(false); }} initialFocus locale={ar} />
                        </PopoverContent>
                    </Popover>
                    <Button onClick={handlePrint} variant="outline" className="h-11 rounded-xl font-bold border-2 bg-white gap-2">
                        <Printer className="h-4 w-4" /> طباعة الجدول
                    </Button>
                </div>
            </div>

            <div id="architectural-appointments-printable-area" className="space-y-4">
                {isRamadan ? renderGridSection('بروتوكول دوام رمضان', morningSlots) : (
                    <>{renderGridSection('الفترة الصباحية', morningSlots)}{renderGridSection('الفترة المسائية', eveningSlots)}</>
                )}
            </div>

            <BookingDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSaveSuccess={() => date && fetchAppointments(date)} dialogData={dialogData} clients={clients} firestore={firestore} currentUser={currentUser} />
            
            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader><AlertDialogTitle className="text-xl font-black text-red-700">تأكيد الإلغاء؟</AlertDialogTitle><AlertDialogDescription className="text-base font-medium">سيتم تغيير حالة الموعد إلى ملغي وتعديل ترقيم الزيارات المتبقية للعميل آلياً.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel><AlertDialogAction onClick={handleCancelBooking} className="bg-red-600 hover:bg-red-700 rounded-xl font-black px-8">{isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، إلغاء الموعد'}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, firestore, currentUser }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [title, setTitle] = useState('');
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');

    const tenantId = currentUser?.currentCompanyId;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;
        setIsSaving(true);
        try {
            const apptsPath = getTenantPath('appointments', tenantId);
            const appointmentDateTime = dialogData.appointmentDate;
            if (isPast(appointmentDateTime) && currentUser?.role !== 'Admin') {
                toast({ variant: 'destructive', title: 'عائق زمني', description: 'لا يمكن حجز موعد في الماضي.'});
                setIsSaving(false); return;
            }
            if (isNewClient) {
                await addDoc(collection(firestore, apptsPath), { title: title || newClientName, clientName: newClientName, clientMobile: newClientMobile, engineerId: dialogData.engineerId, appointmentDate: Timestamp.fromDate(appointmentDateTime), type: 'architectural', status: 'scheduled', visitCount: 1, color: '#facc15', createdAt: serverTimestamp(), workStageUpdated: false, companyId: tenantId });
            } else {
                const client = clients.find((c: any) => c.id === selectedClientId);
                const batch = writeBatch(firestore);
                const snap = await getDocs(query(collection(firestore, apptsPath), where('clientId', '==', selectedClientId), where('type', '==', 'architectural'), where('status', '!=', 'cancelled')));
                const visitCount = snap.size + 1;
                batch.set(doc(collection(firestore, apptsPath)), { clientId: selectedClientId, engineerId: dialogData.engineerId, title: title || client.nameAr, appointmentDate: Timestamp.fromDate(appointmentDateTime), type: 'architectural', status: 'scheduled', visitCount, color: getVisitColor({ visitCount, contractSigned: client.status !== 'new' }), createdAt: serverTimestamp(), workStageUpdated: false, companyId: tenantId });
                await batch.commit();
            }
            toast({ title: 'تم الحجز بنجاح' });
            onSaveSuccess(); onClose();
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ في الحجز' }); } finally { setIsSaving(false); }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-8 bg-primary/5 border-b">
                        <DialogTitle className="text-xl font-black">حجز موعد جديد</DialogTitle>
                        <DialogDescription className="font-bold">{dialogData?.engineerName} • {dialogData?.appointmentDate && format(dialogData.appointmentDate, 'p', { locale: ar })}</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="grid gap-2"><Label className="font-black text-gray-700 pr-1">الغرض من الزيارة</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: مناقشة المخططات..." className="h-12 rounded-xl border-2" /></div>
                        <div className="flex items-center gap-2 pt-2"><Checkbox checked={isNewClient} onCheckedChange={(c) => setIsNewClient(!!c)} /><Label className="font-black cursor-pointer">إضافة عميل جديد (Lead)</Label></div>
                        {isNewClient ? (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in"><div className="grid gap-2"><Label className="font-bold text-xs">الاسم</Label><Input value={newClientName} onChange={e => setNewClientName(e.target.value)} required className="h-10 rounded-xl" /></div><div className="grid gap-2"><Label className="font-bold text-xs">الجوال</Label><Input value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} required className="h-10 rounded-xl" /></div></div>
                        ) : (
                            <div className="grid gap-2 animate-in fade-in"><Label className="font-bold text-xs">العميل المسجل</Label><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clients.map((c: any) => ({ value: c.id, label: c.nameAr }))} placeholder="ابحث..." className="h-10" /></div>
                        )}
                    </div>
                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3"><Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-bold h-12 px-8">إلغاء</Button><Button type="submit" disabled={isSaving} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-primary/30">{isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الحجز'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
