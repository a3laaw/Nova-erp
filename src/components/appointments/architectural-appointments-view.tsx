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
import { CalendarIcon, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { Appointment, Client, Employee } from '@/lib/types';

// --- Constants & Helpers ---
const morningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 7), i * 30), 'HH:mm'));
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(addMinutes(setHours(new Date(), 14), i * 30), 'HH:mm'));

function getVisitColor(visit: Partial<Appointment>) {
  if (visit.visitCount === 1) return "#facc15"; // yellow-400
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; // green-500
  if (visit.visitCount! > 1 && visit.contractSigned && visit.projectType?.includes("بلدية سكن خاص")) return "#3b82f6"; // blue-500
  return "#9ca3af"; // gray-400
}

const colorMap: Record<string, string> = {
  '#facc15': 'bg-yellow-400',
  '#22c55e': 'bg-green-500',
  '#3b82f6': 'bg-blue-500',
  '#9ca3af': 'bg-gray-400',
};


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
    
    // Fetch appointments for the selected date
    useEffect(() => {
        if (!firestore || !date) return;
        setLoading(true);
        const fetchAppointments = async () => {
            try {
                const dayStart = startOfDay(date);
                const dayEnd = endOfDay(date);
                const q = query(
                    collection(firestore, 'appointments'),
                    where('appointmentDate', '>=', dayStart),
                    where('appointmentDate', '<=', dayEnd)
                );
                const querySnapshot = await getDocs(q);
                const dayAppointments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
                const architecturalAppointments = dayAppointments.filter(appt => appt.type === 'architectural');
                setAppointments(architecturalAppointments);
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
            const newDocRef = await addDoc(collection(firestore, 'appointments'), data);
            setAppointments(prev => [...prev, {...data, id: newDocRef.id} as Appointment]);
            toast({ title: 'نجاح', description: 'تم حجز الموعد بنجاح.' });
            setIsDialogOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ الموعد.' });
        }
    };
    
    const renderGridSection = (title: string, slots: string[]) => (
        <div className="border rounded-lg overflow-x-auto">
            <h3 className="font-bold text-lg p-3 bg-muted">{title}</h3>
            <div className="grid" style={{ gridTemplateColumns: `8rem repeat(${slots.length}, minmax(8rem, 1fr))` }}>
                <div className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-b border-l">المهندس</div>
                {slots.map(time => <div key={time} className="p-2 text-center text-sm font-mono border-b">{time}</div>)}
                {engineers.map(eng => (
                    <React.Fragment key={eng.id}>
                        <div className="sticky left-0 bg-muted p-2 z-10 font-semibold text-center border-l">{eng.fullName}</div>
                        {slots.map(time => {
                            const booking = bookingsGrid[eng.id!]?.[time];
                            return (
                                <div key={`${eng.id}-${time}`} className="relative h-24 border-b p-1">
                                    {booking ? (
                                        <div className={cn('h-full w-full rounded-md p-2 text-xs flex flex-col justify-center text-white', colorMap[booking.color!] || 'bg-gray-400')}>
                                            <p className="font-bold truncate">{booking.clientName}</p>
                                            <p className="opacity-80 truncate">{booking.appointmentDate ? format(booking.appointmentDate.toDate(), 'h:mm a') : ''}</p>
                                            <p className="opacity-80 truncate">{booking.title}</p>
                                        </div>
                                    ) : (
                                        <button onClick={() => handleCellClick(eng, time)} className="h-full w-full text-muted-foreground/50 hover:bg-muted transition-colors rounded-md" />
                                    )}
                                </div>
                            );
                        })}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6" dir='rtl'>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/50 p-4 rounded-lg border">
                <h2 className="text-lg font-bold">جدول زيارات القسم المعماري</h2>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}>
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: ar }) : <span>اختر يوما</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} initialFocus /></PopoverContent>
                </Popover>
            </div>
            
            {loading && <div className='space-y-4'><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></div>}

            {!loading && (
                <>
                    {renderGridSection('الفترة الصباحية', morningSlots)}
                    {renderGridSection('الفترة المسائية', eveningSlots)}
                </>
            )}
             <div className="flex justify-center gap-4 pt-4 text-xs">
                <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full bg-yellow-400" /><span>أول زيارة</span></div>
                <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full bg-green-500" /><span>متابعة (بدون عقد)</span></div>
                <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full bg-blue-500" /><span>متابعة (بعد العقد)</span></div>
                <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full bg-gray-400" /><span>أخرى</span></div>
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
    
    // State for the inline combobox
    const [clientSearch, setClientSearch] = useState('');
    const [showClientOptions, setShowClientOptions] = useState(false);
    const [selectedClient, setSelectedClient] = useState<{id: string, name: string} | null>(null);

    const [visitCount, setVisitCount] = useState(1);
    const [contractSigned, setContractSigned] = useState(false);
    const [projectType, setProjectType] = useState('بلدية سكن خاص');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');

    const MAX_DISPLAY_ITEMS = 50;
    
    useEffect(() => {
        if (!isOpen) { // Reset on close
            setClientSearch('');
            setShowClientOptions(false);
            setSelectedClient(null);
            setTitle('');
            setNotes('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!selectedClient?.id || !firestore) {
            setVisitCount(1);
            setContractSigned(false);
            return;
        };
        const fetchClientHistory = async () => {
            const q = query(collection(firestore, 'appointments'), where('clientId', '==', selectedClient.id));
            const snapshot = await getDocs(q);
            const visits = snapshot.docs.map(doc => doc.data());
            setVisitCount(visits.length + 1);
            const hasSigned = visits.some(v => v.contractSigned && v.projectType === 'بلدية سكن خاص');
            setContractSigned(hasSigned);
        };
        fetchClientHistory();
    }, [selectedClient, firestore]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient?.id || !title) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار العميل وإدخال الغرض من الموعد.' });
            return;
        }
        setIsSaving(true);
        const data = {
            ...dialogData,
            clientId: selectedClient.id,
            clientName: selectedClient.name,
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
    
    const filteredClients = clients.filter((opt: Client) =>
        opt.nameAr.toLowerCase().includes(clientSearch.toLowerCase())
    );

    const displayClients = filteredClients.slice(0, MAX_DISPLAY_ITEMS);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
             <DialogContent
                dir="rtl"
                onPointerDownOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]')) {
                        e.preventDefault();
                    }
                }}
                onInteractOutside={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]')) {
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
                             <Label htmlFor="client-search">العميل</Label>
                             <div className="relative">
                                <Input
                                    id="client-search"
                                    value={clientSearch}
                                    placeholder="ابحث عن عميل..."
                                    onFocus={() => setShowClientOptions(true)}
                                    onBlur={() => setTimeout(() => setShowClientOptions(false), 150)} // Delay to allow click
                                    onChange={(e) => {
                                        setClientSearch(e.target.value);
                                        setShowClientOptions(true);
                                        if(selectedClient) setSelectedClient(null);
                                    }}
                                />
                                {showClientOptions && (
                                    <div className="absolute z-20 mt-1 w-full rounded-md border bg-background shadow-md">
                                        <ul className="max-h-48 overflow-y-auto">
                                            {filteredClients.length === 0 ? (
                                                <li className="p-2 text-sm text-muted-foreground">لا توجد نتائج</li>
                                            ) : (
                                                <>
                                                    {displayClients.map((client: Client) => (
                                                        <li
                                                            key={client.id}
                                                            className="cursor-pointer p-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                                            onMouseDown={(e) => {
                                                                e.preventDefault(); 
                                                                setSelectedClient({id: client.id, name: client.nameAr});
                                                                setClientSearch(client.nameAr);
                                                                setShowClientOptions(false);
                                                            }}
                                                        >
                                                            {client.nameAr}
                                                        </li>
                                                    ))}
                                                    {filteredClients.length > MAX_DISPLAY_ITEMS && (
                                                        <li className="p-2 text-xs text-center text-muted-foreground">
                                                            ... و {filteredClients.length - MAX_DISPLAY_ITEMS} نتائج أخرى
                                                        </li>
                                                    )}
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                )}
                             </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الزيارة</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required />
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
                        <Button type="submit" disabled={isSaving || !selectedClient}>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            حفظ الموعد
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
