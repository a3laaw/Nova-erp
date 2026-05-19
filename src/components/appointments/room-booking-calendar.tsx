'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Save, Pencil, Trash2, Printer, MousePointer2 } from 'lucide-react';
import { cn, getTenantPath } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee, LeaveRequest } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Checkbox } from '../ui/checkbox';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/card';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '../ui/badge';

// ✨ استيرادات محرك الإزاحة (DnD) الصحيحة ✨
import {
  DndContext, 
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';

const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];

const departmentStyles: Record<string, React.CSSProperties> = {
  "الكهرباء": { backgroundColor: '#fee2e2', borderLeft: '4px solid #ef4444', color: '#991b1b' },
  "الصحي": { backgroundColor: '#dbeafe', borderLeft: '4px solid #3b82f6', color: '#1e40af' },
  "الإنشائي": { backgroundColor: '#dcfce7', borderLeft: '4px solid #22c55e', color: '#166534' },
  "المعماري": { backgroundColor: '#f3e8ff', borderLeft: '4px solid #a855f7', color: '#7e22ce' },
  "أخرى": { backgroundColor: '#f3f4f6', borderLeft: '4px solid #6b7280', color: '#374151' },
};
const departmentOptions = ['الكهرباء', 'الصحي', 'الإنشائي', 'المعماري', 'أخرى'];

const generateTimeSlots = (start: string, end: string, slotDuration: number, buffer: number): string[] => {
    if (!start || !end || !slotDuration || slotDuration <= 0) return [];
    const slots: string[] = [];
    try {
        const startTime = parse(start, 'HH:mm', new Date());
        const endTime = parse(end, 'HH:mm', new Date());
        if (!isValid(startTime) || !isValid(endTime) || startTime >= endTime) return [];

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

// 🎨 مكون الموعد القابل للسحب
function DraggableRoomAppointment({ appointment, isOnLeave }: { appointment: Appointment, isOnLeave: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: appointment.id!,
        data: appointment
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 1000,
        opacity: 0.8
    } : undefined;

    return (
        <div 
            ref={setNodeRef}
            style={{ ...(departmentStyles[appointment.department || 'أخرى'] || {}), ...style }}
            {...attributes}
            {...listeners}
            className={cn(
                "flex flex-col items-center justify-center text-center p-1 sm:p-2 rounded-2xl cursor-grab active:cursor-grabbing transition-all hover:brightness-95 shadow-md h-full relative",
                isDragging && "opacity-0"
            )}
        >
            {isOnLeave && <Badge variant="destructive" className="absolute top-0.5 right-0.5 text-[6px] h-3 px-1 font-black">في إجازة رسمية</Badge>}
            <p className="font-bold text-[10px] sm:text-xs leading-tight select-none">{appointment.title}</p>
            <p className="text-[9px] sm:text-[10px] mt-1 font-black select-none">{appointment.clientName}</p>
        </div>
    );
}

// 📥 مكون خانة وقت القاعة
function DroppableRoomSlot({ id, children, onClick }: { id: string, children: React.ReactNode, onClick: () => void }) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
    });

    return (
        <td 
            ref={setNodeRef}
            onClick={onClick}
            className={cn(
                "relative h-24 border-l p-1 transition-all",
                isOver ? "bg-primary/20 scale-[0.98] ring-4 ring-primary/10 rounded-2xl z-20" : ""
            )}
        >
            {children}
        </td>
    );
}

export default function RoomBookingCalendar() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();

    const [date, setDate] = useState<Date | undefined>(undefined);
    const [rawAppointments, setRawAppointments] = useState<Appointment[]>([]);
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [activeDragId, setActiveDragId] = useState<string | null>(null);

    const tenantId = currentUser?.currentCompanyId;
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    useEffect(() => { if (!date) setDate(new Date()); }, [date]);

    const { morningSlots, eveningSlots, hasWorkHours, isRamadan } = useMemo(() => {
        if (!date) return { morningSlots: [], eveningSlots: [], hasWorkHours: false, isRamadan: false };
    
        const ramadanSettings = branding?.work_hours?.ramadan;
        const isDateInRamadan = ramadanSettings?.is_enabled && ramadanSettings.start_date && ramadanSettings.end_date && date >= toFirestoreDate(ramadanSettings.start_date)! && date <= toFirestoreDate(ramadanSettings.end_date)!;
        if (isDateInRamadan) {
            const slots = generateTimeSlots(ramadanSettings.start_time || '09:00', ramadanSettings.end_time || '15:00', ramadanSettings.appointment_slot_duration || 30, ramadanSettings.appointment_buffer_time || 0);
            return { morningSlots: slots, eveningSlots: [], hasWorkHours: slots.length > 0, isRamadan: true };
        }
    
        const workHours = branding?.work_hours?.general;
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
                const customEnd = halfDaySettings.end_time;
                if (customEnd <= morning_end_time) { morning_end_time = customEnd; evening_start_time = ''; evening_end_time = ''; } 
                else { evening_end_time = customEnd < evening_end_time ? customEnd : evening_end_time; }
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

        const fetchStaticData = async () => {
            try {
                const [clientSnap, engSnap, leavesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, clientsPath), where('isActive', '==', true))),
                    getDocs(query(collection(firestore, employeesPath), where('status', 'in', ['active', 'on-leave']))),
                    getDocs(query(collection(firestore, leavesPath), where('status', 'in', ['approved', 'on-leave', 'returned']))),
                ]);
                const fetchedClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(fetchedClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
                const fetchedEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee));
                setEngineers(fetchedEngineers.sort((a,b) => a.fullName.localeCompare(b.fullName, 'ar')));
                setLeaveRequests(leavesSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as LeaveRequest)));
            } catch (error) { console.error(error); }
        };
        fetchStaticData();
    }, [firestore, tenantId]);
    
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore || !tenantId) return;
        setLoading(true);
        try {
            const apptsPath = getTenantPath('appointments', tenantId);
            const apptSnap = await getDocs(query(collection(firestore, apptsPath), where('appointmentDate', '>=', startOfDay(d)), where('appointmentDate', '<=', endOfDay(d))));
            setRawAppointments(apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)).filter(appt => appt.type === 'room'));
        } finally { setLoading(false); }
    }, [firestore, tenantId]);

    useEffect(() => { if(date) fetchAppointments(date); }, [date, fetchAppointments]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveDragId(null);
        if (!over || !firestore || !tenantId || !date) return;

        const apptId = active.id as string;
        const [targetType, targetRoomName, targetTime] = (over.id as string).split('|');

        if (targetType === 'room') {
            const [hours, minutes] = targetTime.split(':').map(Number);
            const newDateTime = setMinutes(setHours(date, hours), minutes);

            if (isPast(newDateTime) && currentUser?.role !== 'Admin') {
                toast({ variant: 'destructive', title: 'عائق زمني', description: 'لا يمكن نقل الحجز للماضي.' });
                return;
            }

            const hasConflict = rawAppointments.some(a => a.id !== apptId && a.meetingRoom === targetRoomName && format(toFirestoreDate(a.appointmentDate)!, 'HH:mm') === targetTime && a.status !== 'cancelled');
            if (hasConflict) {
                toast({ variant: 'destructive', title: 'تعارض في المواعيد', description: 'القاعة محجوزة بالفعل في هذا الوقت.' });
                return;
            }

            try {
                const apptRef = doc(firestore, getTenantPath('appointments', tenantId), apptId);
                await updateDoc(apptRef, {
                    meetingRoom: targetRoomName,
                    appointmentDate: Timestamp.fromDate(newDateTime),
                    updatedAt: serverTimestamp()
                });
                toast({ title: 'تمت الإزاحة' });
                fetchAppointments(date);
            } catch (e) { toast({ variant: 'destructive', title: 'خطأ في التحديث' }); }
        }
    };

    const getEmployeeLeaveForDate = useCallback((employeeId: string, checkDate: Date) => {
        return leaveRequests.find(req => {
            if (req.employeeId !== employeeId) return false;
            const start = toFirestoreDate(req.startDate);
            const end = toFirestoreDate(req.endDate);
            if (!start || !end) return false;
            return isWithinInterval(startOfDay(checkDate), { start: startOfDay(start), end: endOfDay(end) });
        });
    }, [leaveRequests]);

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

    const renderGridSection = (title: string, slots: string[]) => {
        if (slots.length === 0) return null;
        return (
        <div className="border-2 rounded-[2rem] overflow-x-auto bg-white shadow-xl mb-8">
            <h3 className="font-black text-lg p-5 bg-[#F8F9FE] text-[#7209B7] border-b-2 print:text-base">{title}</h3>
             <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col className="w-[6rem] sm:w-[8rem]" />
                    {slots.map((_, i) => <col key={i} className="w-[7rem] sm:w-[8rem]" />)}
                </colgroup>
                <thead><tr className='border-b bg-[#F8F9FE]/50'><th className="sticky left-0 bg-[#F8F9FE] p-1 sm:p-2 z-10 font-black text-[#7209B7] text-center border-l print:text-sm">القاعة</th>{slots.map(time => <th key={time} className="p-1 sm:p-2 text-center text-sm font-mono border-l font-black text-[#7209B7]">{time}</th>)}</tr></thead>
                <tbody>
                    {rooms.map(room => (
                        <tr key={room} className='border-b hover:bg-[#F3E8FF]/10 transition-colors'>
                            <th className="sticky left-0 bg-[#F8F9FE] p-1 sm:p-2 z-10 font-black text-gray-800 text-center border-l print:text-sm">{room}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[room]?.[time];
                                const activeLeave = (booking && booking.engineerId && date) ? getEmployeeLeaveForDate(booking.engineerId, date) : null;
                                const slotId = `room|${room}|${time}`;

                                return (
                                    <DroppableRoomSlot 
                                        key={slotId} 
                                        id={slotId}
                                        onClick={() => {
                                            if (booking) return;
                                            const [h, m] = time.split(':').map(Number);
                                            const startTime = setMinutes(setHours(date!, h), m);
                                            if (isPast(startTime)) return toast({ title: 'لا يمكن الحجز في الماضي' });
                                            setDialogData({ room, appointmentDate: startTime });
                                            setIsDialogOpen(true);
                                        }}
                                    >
                                        {booking ? (
                                            <DraggableRoomAppointment appointment={booking} isOnLeave={!!activeLeave} />
                                        ) : null}
                                    </DroppableRoomSlot>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )};

    if (brandingLoading || (loading && rawAppointments.length === 0)) return <Skeleton className="h-[500px] w-full rounded-3xl" />;
    
    return (
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragStart={(e) => setActiveDragId(e.active.id as string)}
            onDragEnd={handleDragEnd}
        >
            <div dir="rtl" className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/40 backdrop-blur-md p-4 rounded-[2rem] border-2 border-white/60 shadow-sm no-print mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-600/10 rounded-xl text-indigo-600 shadow-inner">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-black text-sm text-[#1e1b4b]">تصفح حجوزات القاعات</span>
                            <span className="text-[9px] font-bold text-indigo-600 flex items-center gap-1 uppercase tracking-widest animate-pulse">
                                <MousePointer2 className="h-2 w-2"/> خاصية الإزاحة نشطة
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-[240px] justify-start text-right font-black h-11 rounded-xl border-2 bg-white shadow-sm">
                                    <CalendarIcon className="ml-2 h-4 w-4 text-indigo-600" />
                                    {date ? format(date, "PPP", { locale: ar }) : <span>اختر تاريخ</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-2xl" align="start">
                                <Calendar mode="single" selected={date} onSelect={(d) => { if(d) setDate(d); setIsCalendarOpen(false); }} initialFocus locale={ar} />
                            </PopoverContent>
                        </Popover>
                        <Button onClick={() => window.print()} variant="outline" className="h-11 rounded-xl font-bold border-2 bg-white gap-2">
                            <Printer className="h-4 w-4" /> طباعة
                        </Button>
                    </div>
                </div>

                <div id="room-booking-printable-area" className="space-y-4">
                    {isRamadan ? renderGridSection('فترة دوام رمضان', morningSlots) : (
                        <>{renderGridSection('الفترة الصباحية', morningSlots)}{renderGridSection('الفترة المسائية', eveningSlots)}</>
                    )}
                </div>

                <div className="flex justify-center gap-4 pt-4 text-xs">
                    {Object.entries(departmentStyles).map(([dept, style]) => (
                        <div key={dept} className="flex items-center gap-2"><div className="h-4 w-4 rounded-lg" style={{ backgroundColor: style.backgroundColor, borderLeft: style.borderLeft }} /><span className="text-sm font-black opacity-60">{dept}</span></div>
                    ))}
                </div>

                {isDialogOpen && <BookingDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} onSaveSuccess={() => date && fetchAppointments(date)} dialogData={dialogData} clients={clients} engineers={engineers} firestore={firestore} currentUser={currentUser} leaveRequests={leaveRequests} />}
                
                <DragOverlay>
                    {activeDragId ? (
                        <div 
                            className="flex flex-col items-center justify-center text-center p-2 rounded-2xl shadow-2xl scale-110 rotate-3 border-2 border-white/40 glass-effect min-w-[120px]"
                            style={{ ...(departmentStyles[rawAppointments.find(a => a.id === activeDragId)?.department || 'أخرى'] || {}) }}
                        >
                            <p className="font-bold text-xs leading-tight">{rawAppointments.find(a => a.id === activeDragId)?.title}</p>
                        </div>
                    ) : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, engineers, firestore, currentUser, leaveRequests }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedEngineerId, setSelectedEngineerId] = useState('');
    const [title, setTitle] = useState('');
    const [department, setDepartment] = useState('');
    const [notes, setNotes] = useState('');

    const tenantId = currentUser?.currentCompanyId;
    const isEditing = !!dialogData?.id;

    useEffect(() => {
        if (isOpen && dialogData) {
            setSelectedClientId(dialogData.clientId || '');
            setSelectedEngineerId(dialogData.engineerId || '');
            setTitle(dialogData.title || '');
            setDepartment(dialogData.department || 'أخرى');
            setNotes(dialogData.notes || '');
        }
    }, [isOpen, dialogData]);
    
    const getEmployeeLeaveForDate = (empId: string, checkDate: Date) => {
        return leaveRequests.find((req: any) => {
            if (req.employeeId !== empId) return false;
            const start = toFirestoreDate(req.startDate);
            const end = toFirestoreDate(req.endDate);
            if (!start || !end) return false;
            return isWithinInterval(startOfDay(checkDate), { start: startOfDay(start), end: endOfDay(end) });
        });
    };

    const clientOptions = useMemo(() => clients.map((c: Client) => ({ value: c.id, label: c.nameAr, searchKey: c.mobile })), [clients]);
    const engineerOptions = useMemo(() => engineers.filter((e: Employee) => e.status === 'active' && !getEmployeeLeaveForDate(e.id!, dialogData.appointmentDate)).map((e: Employee) => ({ value: e.id, label: e.fullName, searchKey: e.employeeNumber })), [engineers, dialogData.appointmentDate, leaveRequests]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;
        setIsSaving(true);
        try {
            const apptsPath = getTenantPath('appointments', tenantId);
            const dataToSave = { clientId: selectedClientId, engineerId: selectedEngineerId, title, department, notes, meetingRoom: dialogData.room || dialogData.meetingRoom, appointmentDate: Timestamp.fromDate(dialogData.appointmentDate), type: 'room' as const, companyId: tenantId };
            if (isEditing) await updateDoc(doc(firestore, apptsPath, dialogData.id), dataToSave);
            else await addDoc(collection(firestore, apptsPath), { ...dataToSave, createdAt: serverTimestamp() });
            toast({ title: 'نجاح الحجز' });
            onSaveSuccess(); onClose();
        } finally { setIsSaving(false); }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent dir="rtl" className="max-w-md rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                 <form onSubmit={handleSubmit}>
                    <DialogHeader className="p-8 bg-indigo-50 border-b">
                        <DialogTitle className="text-xl font-black text-indigo-900">{isEditing ? 'تعديل حجز القاعة' : 'حجز قاعة جديد'}</DialogTitle>
                        <DialogDescription className="font-bold text-indigo-700">{dialogData?.room || dialogData?.meetingRoom} • {format(dialogData?.appointmentDate, 'PPp', { locale: ar })}</DialogDescription>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                         <div className="grid gap-2"><Label className="font-black pr-1">عنوان الاجتماع / الغرض</Label><Input value={title} onChange={e => setTitle(e.target.value)} required className="h-12 rounded-xl border-2 font-bold" placeholder="مناقشة المشروع..." /></div>
                        <div className="grid gap-2"><Label className="font-black pr-1">العميل</Label><InlineSearchList value={selectedClientId} onSelect={setSelectedClientId} options={clientOptions} placeholder="ابحث..." className="h-11" /></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="grid gap-2"><Label className="font-black pr-1">القسم</Label><select value={department} onChange={e => setDepartment(e.target.value)} required className="w-full h-11 rounded-xl border-2 border-input bg-background px-3 py-2 text-sm font-black">{departmentOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                            <div className="grid gap-2">
                                <Label className="font-black pr-1">المهندس المسؤول</Label>
                                <InlineSearchList value={selectedEngineerId} onSelect={setSelectedEngineerId} options={engineerOptions} placeholder="اختر..." className="h-11" />
                            </div>
                        </div>
                        <div className="grid gap-2"><Label className="font-black pr-1">ملاحظات</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="rounded-xl border-2" rows={2} /></div>
                    </div>
                    <DialogFooter className="p-8 bg-muted/10 border-t flex gap-3"><Button type="button" variant="outline" onClick={onClose} className="rounded-xl font-bold h-12 px-8">إلغاء</Button><Button type="submit" disabled={isSaving} className="rounded-xl font-black px-12 h-12 shadow-xl shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">{isSaving && <Loader2 className="animate-spin h-5 w-5"/>}{isSaving ? 'جاري الحفظ...' : 'تأكيد الحجز'}</Button></DialogFooter>
                 </form>
            </DialogContent>
        </Dialog>
    );
}
