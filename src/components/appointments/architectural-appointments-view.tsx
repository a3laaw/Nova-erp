'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, orderBy, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { format, startOfDay, endOfDay, setHours, setMinutes, getHours, getMinutes, addMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarIcon, Loader2, Printer, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';

// --- Constants & Helpers ---
const morningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 7), i * 30), 'HH:mm'));
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 14), i * 30), 'HH:mm'));

function getVisitColor(visit: Partial<Appointment>) {
  if (visit.visitCount === 1) return "#facc15"; // yellow-400
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; // green-500
  if (visit.visitCount! > 1 && visit.contractSigned && visit.projectType?.includes("بلدية سكن خاص")) return "#3b82f6"; // blue-500
  return "#9ca3af"; // gray-400
}

export function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogData, setDialogData] = useState<any>(null);

    const clientsMap = useMemo(() => new Map(clients.map(c => [c.id, c.nameAr])), [clients]);
    const engineersMap = useMemo(() => new Map(engineers.map(e => [e.id!, e.fullName])), [engineers]);


    // Fetch static data (engineers, clients)
    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const clientQuery = query(collection(firestore, 'clients'), where('isActive', '==', true));
                
                const [engSnap, clientSnap] = await Promise.all([getDocs(engQuery), getDocs(clientQuery)]);

                const allEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                setEngineers(allEngineers.filter(e => e.department?.includes('المعماري')).sort((a,b) => a.fullName.localeCompare(b.fullName)));

                const allClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(allClients.sort((a,b) => a.nameAr.localeCompare(b.nameAr)));

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات المهندسين والعملاء.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, toast]);
    
    const fetchAppointments = useCallback(async (d: Date) => {
        if (!firestore) return;
        setLoading(true);
        try {
            const dayStart = startOfDay(d);
            const dayEnd = endOfDay(d);
            const q = query(
                collection(firestore, 'appointments'),
                where('appointmentDate', '>=', dayStart),
                where('appointmentDate', '<=', dayEnd)
            );
            const querySnapshot = await getDocs(q);
            const dayAppointments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
            const architecturalAppointments = dayAppointments.filter(appt => appt.type === 'architectural');

            const augmentedAppointments = architecturalAppointments.map(appt => ({
                ...appt,
                clientName: clientsMap.get(appt.clientId),
                engineerName: appt.engineerId ? engineersMap.get(appt.engineerId) : undefined
            }));
            
            setAppointments(augmentedAppointments);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast, clientsMap, engineersMap]);

    // Fetch appointments for the selected date
    useEffect(() => {
        if (date && clients.length > 0 && engineers.length > 0) { // Ensure clients are loaded before fetching
            fetchAppointments(date);
        }
    }, [date, clients, engineers, fetchAppointments]);

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
        const appointmentDate = setMinutes(setHours(date!, Number(time.split(':')[0])), Number(time.split(':')[1]));
        setDialogData({
            engineerId: engineer.id,
            engineerName: engineer.fullName,
            appointmentDate,
            session: Number(time.split(':')[0]) < 14 ? 'صباحية' : 'مسائية'
        });
        setIsDialogOpen(true);
    };

    const handleSave = async (data: any) => {
        if (!firestore) return;
        try {
            await addDoc(collection(firestore, 'appointments'), data);
            toast({ title: 'نجاح', description: 'تم حجز الموعد بنجاح.' });
            if (date) {
                fetchAppointments(date);
            }
            setIsDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الموعد.' });
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
                                             <div style={{
                                                height: '100%',
                                                width: '100%',
                                                borderRadius: '0.375rem',
                                                padding: '0.5rem',
                                                fontSize: '0.75rem',
                                                color: '#1f2937',
                                                backgroundColor: getVisitColor(booking),
                                            }}>
                                                <p style={{ fontWeight: 'bold' }}>{booking.clientName}</p>
                                                <p>{booking.appointmentDate ? format(booking.appointmentDate.toDate(), 'h:mm a') : ''}</p>
                                                <p>{booking.title}</p>
                                            </div>
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
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}>
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
                              onDayPointerDown={(e) => e.preventDefault()}
                              onMonthChange={(month) => {
                                // This logic can be complex, for now we just prevent default
                                // to stop popover from closing on month change navigation.
                                const target = document.activeElement;
                                if (target && target instanceof HTMLElement && !target.closest('.rdp-day')) {
                                    // e.preventDefault();
                                }
                              }}
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
                    onSave={handleSave}
                    dialogData={dialogData}
                    clients={clients}
                    firestore={firestore}
                />
            )}
        </div>
    );
}


// --- Sub-components ---

function BookingDialog({ isOpen, onClose, onSave, dialogData, clients, firestore }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const [selectedClientId, setSelectedClientId] = useState('');
    const [visitCount, setVisitCount] = useState(1);
    const [contractSigned, setContractSigned] = useState(false);
    const [projectType, setProjectType] = useState('بلدية سكن خاص');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!isOpen) { // Reset on close
            setSelectedClientId('');
            setTitle('');
            setNotes('');
            setVisitCount(1);
            setContractSigned(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!selectedClientId || !firestore) {
            setVisitCount(1);
            setContractSigned(false);
            return;
        };
        const fetchClientHistory = async () => {
            const q = query(collection(firestore, 'appointments'), where('clientId', '==', selectedClientId));
            const snapshot = await getDocs(q);
            const visits = snapshot.docs.map(doc => doc.data());
            setVisitCount(visits.length + 1);
            const hasSigned = visits.some(v => v.contractSigned && v.projectType === 'بلدية سكن خاص');
            setContractSigned(hasSigned);
        };
        fetchClientHistory();
    }, [selectedClientId, firestore]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const client = clients.find((c: Client) => c.id === selectedClientId);

        if (!client || !title) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار العميل وإدخال الغرض من الموعد.' });
            return;
        }
        setIsSaving(true);
        const data = {
            ...dialogData,
            clientId: client.id,
            clientName: client.nameAr,
            title,
            notes,
            visitCount,
            contractSigned,
            projectType,
            type: 'architectural',
            color: getVisitColor({ visitCount, contractSigned, projectType }),
            createdAt: serverTimestamp(),
            appointmentDate: Timestamp.fromDate(dialogData.appointmentDate),
            endDate: Timestamp.fromDate(addMinutes(dialogData.appointmentDate, 30)),
        };
        await onSave(data);
        setIsSaving(false);
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
                        <DialogTitle>حجز موعد جديد</DialogTitle>
                        <DialogDescription>
                            للمهندس: {dialogData.engineerName} | الساعة: {format(dialogData.appointmentDate, 'h:mm a', { locale: ar })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الزيارة</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                             <Label htmlFor="client-search">العميل</Label>
                             <InlineSearchList 
                                value={selectedClientId}
                                onSelect={setSelectedClientId}
                                options={clientOptions}
                                placeholder="ابحث بالاسم أو رقم الجوال..."
                             />
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="projectType">نوع المشروع</Label>
                            <Input id="projectType" value={projectType} onChange={e => setProjectType(e.target.value)} />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="contractSigned" checked={contractSigned} onCheckedChange={(checked) => setContractSigned(checked as boolean)} />
                            <Label htmlFor="contractSigned">تم توقيع عقد (بلدية سكن خاص) لهذا العميل؟</Label>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} />
                        </div>
                         <div className="text-sm text-muted-foreground">سيتم تسجيل هذه الزيارة رقم {visitCount} للعميل.</div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || !selectedClientId}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            حفظ الموعد
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
