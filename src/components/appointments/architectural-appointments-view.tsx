'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format } from 'date-fns';
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
import { CalendarIcon, Loader2, Printer, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import { Checkbox } from '../ui/checkbox';

// --- Constants & Helpers ---
const morningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 8 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`));
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 13 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`));


function getVisitColor(visit: { visitCount?: number, contractSigned?: boolean }) {
  if (visit.visitCount === 1) return "#facc15"; // yellow-400
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; // green-500
  if (visit.visitCount! > 1 && visit.contractSigned) return "#3b82f6"; // blue-500
  return "#9ca3af"; // gray-400
}

export function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);
    
    useEffect(() => {
        // Set date on client-side to avoid hydration mismatch
        if (!date) {
            setDate(new Date());
        }
    }, [date]);


    const fetchData = useCallback(async (d: Date | undefined) => {
        if (!firestore || !d) return;
        setLoading(true);
        try {
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);
            
            const [engSnap, clientSnap, apptSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                getDocs(query(
                    collection(firestore, 'appointments'),
                    where('appointmentDate', '>=', dayStart),
                    where('appointmentDate', '<=', dayEnd)
                ))
            ]);

            const allEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            const archEngineers = allEngineers.filter(e => e.department?.includes('المعماري')).sort((a, b) => a.fullName.localeCompare(b.fullName));
            setEngineers(archEngineers);
            
            const allClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(allClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr)));
            
            const allAppointmentsForDay = apptSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

            const augmentedAppointments = allAppointmentsForDay
                .filter(appt => appt.type === 'architectural')
                .map(appt => {
                    return {
                        ...appt,
                        clientName: allClients.find(c => c.id === appt.clientId)?.nameAr,
                    }
                });
            
            setAppointments(augmentedAppointments);

        } catch (error) {
            console.error("Error fetching appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);
    
    useEffect(() => {
        if (date) {
            fetchData(date);
        }
    }, [date, fetchData]);


    const bookingsGrid = useMemo(() => {
        const grid: Record<string, Record<string, Appointment | null>> = {};
        engineers.forEach(eng => {
            grid[eng.id!] = {};
            [...morningSlots, ...eveningSlots].forEach(slot => grid[eng.id!][slot] = null);
        });

        appointments.forEach(appt => {
            if(!appt.appointmentDate) return;
            const time = format(appt.appointmentDate.toDate(), 'HH:mm');
            if (grid[appt.engineerId] && time in grid[appt.engineerId]) {
                grid[appt.engineerId][time] = appt;
            }
        });
        return grid;
    }, [appointments, engineers]);

    const handleCellClick = (engineer: Employee, time: string) => {
        if (!date) return;
        const appointmentDate = setMinutes(setHours(date, Number(time.split(':')[0])), Number(time.split(':')[1]));
        setDialogData({
            engineerId: engineer.id,
            engineerName: engineer.fullName,
            appointmentDate,
        });
        setIsDialogOpen(true);
    };

    const handleEditClick = (booking: Appointment) => {
        setDialogData({
            ...booking,
            id: booking.id, // Make sure ID is passed
            appointmentDate: booking.appointmentDate.toDate(), // Convert timestamp to Date for dialog
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (date) { // Re-fetch data for the current date
            await fetchData(date);
        }
    };
    
    const handleDeleteBooking = async () => {
        if (!appointmentToDelete || !firestore) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'appointments', appointmentToDelete.id!));
            toast({ title: 'تم الحذف', description: 'تم إلغاء الموعد بنجاح.' });
            
            // Local state update to avoid race conditions with fetching
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
    
    if (date === undefined) {
        return (
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
    }

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
                        <th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l print:text-sm">المهندس</th>
                        {slots.map(time => <th key={time} className="p-2 text-center text-sm font-mono border-l">{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {engineers.map(eng => (
                        <tr key={eng.id} className='border-b'>
                            <th className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l print:text-sm">{eng.fullName}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[eng.id!]?.[time];
                                return (
                                    <td key={`${eng.id}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <div
                                                        className="h-full w-full rounded-md p-2 text-sm text-gray-800 flex items-center justify-center text-center cursor-pointer"
                                                        style={{ backgroundColor: booking.color }}
                                                    >
                                                        <p className="font-bold">{booking.clientName}</p>
                                                    </div>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl">
                                                    <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEditClick(booking)}>
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
    );

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
                    <h1 className="text-xl font-bold">جدول زيارات القسم المعماري</h1>
                    {date && <p className="text-sm text-muted-foreground">{format(date, "PPP", { locale: ar })}</p>}
                </div>

                {loading && <div className='space-y-4'><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>}

                {!loading && (
                    <div className="space-y-4">
                        {renderGridSection('الفترة الصباحية', morningSlots)}
                        {renderGridSection('الفترة المسائية', eveningSlots)}
                    </div>
                )}
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


// --- Sub-components ---

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, firestore }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const isEditing = !!dialogData?.id;
    
    const [selectedClientId, setSelectedClientId] = useState('');
    const [title, setTitle] = useState('');
    
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');


    useEffect(() => {
        if (isOpen && dialogData) {
            if (isEditing) {
                const appointmentDate = dialogData.appointmentDate;
                if (appointmentDate instanceof Date) {
                    setNewDate(format(appointmentDate, 'yyyy-MM-dd'));
                    setNewTime(format(appointmentDate, 'HH:mm'));
                }
                setSelectedClientId(dialogData.clientId || '');
                setTitle(dialogData.title || '');
            } else {
                setSelectedClientId('');
                setTitle('');
                setNewDate(''); 
                setNewTime('');
            }
        }
    }, [isOpen, dialogData, isEditing]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const client = clients.find((c: Client) => c.id === selectedClientId);

        if (!client) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار العميل.' });
            return;
        }
        
        setIsSaving(true);
        
        try {
            // --- Conflict Validation ---
            const appointmentDateTime = isEditing 
                ? new Date(`${newDate}T${newTime}`) 
                : dialogData.appointmentDate;
            
            const dayStart = startOfDay(appointmentDateTime);
            const dayEnd = endOfDay(appointmentDateTime);

            const dayApptsQuery = query(collection(firestore, 'appointments'), where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
            const dayApptsSnap = await getDocs(dayApptsQuery);
            const latestDayAppointments = dayApptsSnap.docs.map(d => ({id: d.id, ...d.data()}));
            
            const windowStart = new Date(appointmentDateTime.getTime() - 29 * 60 * 1000);
            const windowEnd = new Date(appointmentDateTime.getTime() + 29 * 60 * 1000);
            
            const engineerHasConflict = latestDayAppointments.some((appt: any) => {
                if (isEditing && appt.id === dialogData.id) return false;
                return appt.engineerId === dialogData.engineerId && appt.appointmentDate.toDate() >= windowStart && appt.appointmentDate.toDate() <= windowEnd;
            });
            if (engineerHasConflict) {
                toast({ variant: 'destructive', title: 'تعارض في المواعيد', description: 'المهندس لديه موعد آخر في نفس الوقت.' });
                setIsSaving(false); return;
            }

            const clientHasConflict = latestDayAppointments.some((appt: any) => {
                if (isEditing && appt.id === dialogData.id) return false;
                return appt.clientId === selectedClientId && appt.appointmentDate.toDate() >= windowStart && appt.appointmentDate.toDate() <= windowEnd;
            });
            if (clientHasConflict) {
                toast({ variant: 'destructive', title: 'تعارض في المواعيد', description: 'العميل لديه موعد آخر في نفس الوقت.' });
                setIsSaving(false); return;
            }
            
            // --- Color & Batch Write Logic ---
            const batch = writeBatch(firestore);

            const allClientApptsQuery = query(
                collection(firestore, 'appointments'),
                where('clientId', '==', selectedClientId),
                where('type', '==', 'architectural')
            );
            const allClientApptsSnap = await getDocs(allClientApptsQuery);
            const existingAppointments = allClientApptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));

            const contractSigned = client.status === 'contracted' || client.status === 'reContracted';
            
            const currentAppointmentObject = {
                id: isEditing ? dialogData.id : 'new-temp-id',
                appointmentDate: Timestamp.fromDate(appointmentDateTime),
                clientId: client.id,
                title: title || client.nameAr,
                engineerId: dialogData.engineerId,
                contractSigned,
                type: 'architectural' as const,
            };

            let processingList: (Partial<Appointment> & { id: string })[];
            if (isEditing) {
                processingList = existingAppointments.map(appt => 
                    appt.id === currentAppointmentObject.id ? { ...appt, ...currentAppointmentObject } : appt
                );
            } else {
                processingList = [...existingAppointments, currentAppointmentObject];
            }
            
            processingList.sort((a, b) => a.appointmentDate!.toMillis() - b.appointmentDate!.toMillis());

            processingList.forEach((appt, index) => {
                const visitCount = index + 1;
                const newColor = getVisitColor({ visitCount, contractSigned });

                if (appt.id === 'new-temp-id') {
                    const newApptRef = doc(collection(firestore, 'appointments'));
                    const { id, ...dataToSave } = appt;
                    batch.set(newApptRef, {
                        ...dataToSave,
                        color: newColor,
                        visitCount,
                        createdAt: serverTimestamp()
                    });
                } else {
                    const existingData = existingAppointments.find(e => e.id === appt.id);
                    let needsUpdate = false;
                    const updatePayload: any = {};
                    
                    if (existingData?.color !== newColor) {
                        updatePayload.color = newColor;
                        needsUpdate = true;
                    }
                    if (existingData?.visitCount !== visitCount) {
                        updatePayload.visitCount = visitCount;
                        needsUpdate = true;
                    }

                    if (isEditing && appt.id === dialogData.id) {
                         const { id, ...dataToSave } = currentAppointmentObject;
                         Object.assign(updatePayload, dataToSave);
                         needsUpdate = true;
                    }

                    if (needsUpdate) {
                        const apptRef = doc(firestore, 'appointments', appt.id!);
                        batch.update(apptRef, updatePayload);
                    }
                }
            });

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم حفظ الموعد وتحديث الألوان بنجاح.' });
            onClose();
            onSaveSuccess();

        } catch (error) {
             console.error("Error during save:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'حدث خطأ أثناء التحقق من المواعيد أو حفظها.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const clientOptions = useMemo(() => clients.map((c: Client) => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile
    })), [clients]);

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
                            للمهندس: {dialogData.engineerName}
                            {!isEditing && ` في ${format(dialogData.appointmentDate, "PPP 'الساعة' HH:mm", { locale: ar })}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الزيارة (اختياري)</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder='سيتم استخدام اسم العميل اذا ترك فارغاً' />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="client-search">العميل <span className="text-destructive">*</span></Label>
                            <InlineSearchList 
                                value={selectedClientId}
                                onSelect={setSelectedClientId}
                                options={clientOptions}
                                placeholder="ابحث بالاسم أو رقم الجوال..."
                            />
                        </div>
                        {isEditing && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="date">التاريخ</Label>
                                    <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="time">الوقت</Label>
                                    <Input id="time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required step="1800" />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !selectedClientId}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ الموعد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
    

    