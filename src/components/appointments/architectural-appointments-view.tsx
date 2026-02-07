'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, Timestamp, deleteDoc, doc, updateDoc, writeBatch, getDoc, collectionGroup, orderBy, runTransaction } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format, isPast } from 'date-fns';
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
import type { Appointment, Client, Employee, WorkStage, TransactionStage } from '@/lib/types';
import { InlineSearchList } from '../ui/inline-search-list';
import Link from 'next/link';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';


// --- Constants & Helpers ---
const morningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 8 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`));
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 13 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`));


function getVisitColor(visit: { visitCount?: number, contractSigned?: boolean }) {
  if (visit.visitCount === 1) return "#facc15"; // yellow-400
  if (visit.visitCount! > 1 && !visit.contractSigned) return "#22c55e"; // green-500
  if (visit.visitCount! > 1 && visit.contractSigned) return "#3b82f6"; // blue-500
  return "#9ca3af"; // gray-400
}

async function reconcileClientAppointments(firestore: any, clientId: string) {
    if (!clientId) return;

    try {
        const clientApptsQuery = query(
            collection(firestore, 'appointments'),
            where('clientId', '==', clientId),
            where('type', '==', 'architectural')
        );
        const clientApptsSnap = await getDocs(clientApptsQuery);

        const appointments = clientApptsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Appointment))
            .sort((a, b) => (a.appointmentDate?.toMillis() || 0) - (b.appointmentDate?.toMillis() || 0));

        if (appointments.length === 0) return;

        const clientRef = doc(firestore, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        const contractSigned = clientSnap.exists() && ['contracted', 'reContracted'].includes(clientSnap.data().status);

        const batch = writeBatch(firestore);

        appointments.forEach((appt, index) => {
            const visitCount = index + 1;
            const newColor = getVisitColor({ visitCount, contractSigned });
            const apptRef = doc(firestore, 'appointments', appt.id!);
            batch.update(apptRef, { visitCount, color: newColor });
        });

        await batch.commit();
    } catch (error) {
        console.error("Failed to reconcile client appointments:", error);
    }
}


export function ArchitecturalAppointmentsView() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { user: currentUser } = useAuth();
    
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
    
    useEffect(() => {
        if (!date) {
            setDate(new Date());
        }
    }, [date]);


    useEffect(() => {
        if (!firestore) return;
        const fetchStaticData = async () => {
            try {
                const [engSnap, clientSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
                    getDocs(query(collection(firestore, 'clients'), where('isActive', '==', true))),
                ]);

                const allEngineers = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
                const archEngineers = allEngineers.filter(e => e.department?.includes('المعماري')).sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', 'ar'));
                setEngineers(archEngineers);
                
                const allClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                setClients(allClients.sort((a,b) => (a.nameAr || '').localeCompare(b.nameAr || '', 'ar')));
            } catch (error) {
                 console.error("Error fetching static appointment data:", error);
                 toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات المهندسين والعملاء.' });
            }
        }
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
            
            const appts = apptSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
                .filter(appt => appt.type === 'architectural');


            setRawAppointments(appts);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب المواعيد.' });
        } finally {
            setLoading(false);
        }
    }, [firestore, toast]);

    useEffect(() => {
        if (date) {
            fetchAppointments(date);
        }
    }, [date, fetchAppointments]);

    const appointments = useMemo(() => {
      if (!rawAppointments) return [];
      if (clients.length === 0) return rawAppointments.map(appt => ({ ...appt, clientName: appt.clientName || '...' }));

      return rawAppointments.map(appt => ({
          ...appt,
          clientName: appt.clientId ? clients.find(c => c.id === appt.clientId)?.nameAr : appt.clientName,
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
            if (grid[appt.engineerId] && time in grid[appt.engineerId]) {
                grid[appt.engineerId][time] = appt;
            }
        });
        return grid;
    }, [appointments, engineers]);

    const handleCellClick = (engineer: Employee, time: string) => {
        if (!date) return;
        const appointmentDate = setMinutes(setHours(date, Number(time.split(':')[0])), Number(time.split(':')[1]));

        if (isPast(appointmentDate)) {
            toast({
                title: 'لا يمكن الحجز في الماضي',
                description: 'لا يمكن إنشاء موعد في وقت قد مضى.',
                variant: 'default',
            });
            return;
        }

        setDialogData({
            isEditing: false,
            engineerId: engineer.id,
            engineerName: engineer.fullName,
            appointmentDate,
            appointments,
        });
        setIsDialogOpen(true);
    };

    const handleOpenDialogForEdit = (appointment: Appointment) => {
        setDialogData({
            isEditing: true,
            id: appointment.id,
            engineerId: appointment.engineerId,
            engineerName: engineers.find(e => e.id === appointment.engineerId)?.fullName,
            clientId: appointment.clientId,
            clientName: appointment.clientName,
            clientMobile: appointment.clientMobile,
            appointmentDate: toFirestoreDate(appointment.appointmentDate),
            title: appointment.title,
            notes: appointment.notes,
            transactionId: appointment.transactionId,
        });
        setIsDialogOpen(true);
    };

     const handleDeleteBooking = async () => {
        if (!appointmentToDelete || !firestore || !currentUser) return;
    
        setIsDeleting(true);
        const { id: apptId, clientId } = appointmentToDelete;

        try {
            await deleteDoc(doc(firestore, 'appointments', apptId!));
            
            if (clientId) {
                await reconcileClientAppointments(firestore, clientId); 

                const logBatch = writeBatch(firestore);
                const logContent = `قام ${currentUser.fullName} بحذف موعد الزيارة رقم ${appointmentToDelete.visitCount || ''} ("${appointmentToDelete.title}").`;
                const logData = {
                    type: 'log' as const, content: logContent, userId: currentUser.id,
                    userName: currentUser.fullName, userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                };
                const historyRef = doc(collection(firestore, `clients/${clientId}/history`));
                logBatch.set(historyRef, { ...logData, content: `[موعد] ${logContent}` });
                if (appointmentToDelete.transactionId) {
                    const timelineRef = doc(collection(firestore, `clients/${clientId}/transactions/${appointmentToDelete.transactionId}/timelineEvents`));
                    logBatch.set(timelineRef, logData);
                }
                await logBatch.commit();
            }
    
            toast({ title: 'نجاح', description: 'تم إلغاء الموعد بنجاح.' });
            if(date) await fetchAppointments(date);
    
        } catch (error) {
            console.error("Error deleting appointment:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء الموعد.' });
        } finally {
            setIsDeleting(false);
            setAppointmentToDelete(null);
        }
    };


    const handleSave = async () => {
        if (date) {
            await fetchAppointments(date);
        }
    };
    
    const handlePrint = () => {
        const element = document.getElementById('architectural-appointments-printable-area');
        if (!element || !date) return;
        
        const opt = {
          margin:       [0.5, 0.2, 0.5, 0.2],
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
                    <col className="w-[6rem] sm:w-[8rem]" />
                    {slots.map((_, i) => <col key={i} className="w-[7rem] sm:w-[8rem]" />)}
                </colgroup>
                <thead>
                    <tr className='border-b'>
                        <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">المهندس</th>
                        {slots.map(time => <th key={time} className="p-1 sm:p-2 text-center text-sm font-mono border-l">{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {engineers.map(eng => (
                        <tr key={eng.id} className='border-b'>
                            <th className="sticky left-0 bg-muted p-1 sm:p-2 z-10 font-semibold text-center border-l print:text-sm">{eng.fullName}</th>
                            {slots.map(time => {
                                const booking = bookingsGrid[eng.id!]?.[time];
                                const isClosed = !!booking?.workStageUpdated;
                                const canAdminEdit = currentUser?.role === 'Admin' && booking;
                                const canUserEdit = booking && !isClosed;

                                return (
                                    <td key={`${eng.id}-${time}`} className="relative h-24 border-l p-1 align-top">
                                        {booking ? (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild disabled={!canAdminEdit && !canUserEdit}>
                                                     <div
                                                        className="relative h-full w-full rounded-md p-2 text-xs sm:text-sm text-gray-800 flex flex-col items-center justify-center text-center"
                                                        style={{ backgroundColor: booking.color, cursor: (canAdminEdit || canUserEdit) ? 'pointer' : 'not-allowed' }}
                                                    >
                                                        {isClosed && <CheckCircle className="h-4 w-4 absolute top-1 right-1 text-white/80" />}
                                                        <p className="font-bold">{booking.clientName}</p>
                                                        {booking.visitCount && (
                                                            <span className="text-xs mt-1 opacity-75">
                                                                (الزيارة رقم {booking.visitCount})
                                                            </span>
                                                        )}
                                                    </div>
                                                </DropdownMenuTrigger>
                                                {(canAdminEdit || canUserEdit) && (
                                                    <DropdownMenuContent dir="rtl">
                                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/appointments/${booking.id}`}>
                                                                <Eye className="ml-2 h-4 w-4" />
                                                                <span>عرض التفاصيل</span>
                                                            </Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleOpenDialogForEdit(booking)}>
                                                            <Pencil className="ml-2 h-4 w-4" />
                                                            <span>تعديل/جدولة</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setAppointmentToDelete(booking)} className="text-destructive focus:bg-destructive/10">
                                                            <Trash2 className="ml-2 h-4 w-4" />
                                                            <span>إلغاء الموعد</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                )}
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
                    currentUser={currentUser}
                />
            )}

            <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من الإلغاء؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف هذا الموعد بشكل دائم، وسيتم إعادة ترقيم وتلوين الزيارات المتبقية للعميل. إذا كان هذا الموعد مرتبطاً بإكمال مرحلة عمل، فسيتم التراجع عن ذلك الإجراء أيضاً.
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

function BookingDialog({ isOpen, onClose, onSaveSuccess, dialogData, clients, firestore, currentUser }: any) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const [selectedClientId, setSelectedClientId] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [clientTransactions, setClientTransactions] = useState<any[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState('');

    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');

    const isEditing = !!dialogData?.id;
    
    const filteredClients = useMemo(() => {
        if (!dialogData?.engineerId) return [];
        return clients.filter((c: Client) => !c.assignedEngineer || c.assignedEngineer === dialogData.engineerId);
    }, [clients, dialogData?.engineerId]);

    useEffect(() => {
        if (isOpen && dialogData) {
             if(isEditing) {
                const apptDate = toFirestoreDate(dialogData.appointmentDate); // This is already a Date object
                setSelectedClientId(dialogData.clientId || '');
                setTitle(dialogData.title || '');
                setNotes(dialogData.notes || '');
                setSelectedTransactionId(dialogData.transactionId || '');
                if (apptDate) {
                  setNewDate(format(apptDate, 'yyyy-MM-dd'));
                  setNewTime(format(apptDate, 'HH:mm'));
                }
                setIsNewClient(!dialogData.clientId);
                if (!dialogData.clientId) {
                    setNewClientName(dialogData.clientName || '');
                    setNewClientMobile(dialogData.clientMobile || '');
                }
            } else {
                setSelectedClientId('');
                setTitle('');
                setNotes('');
                setSelectedTransactionId('');
                setNewDate('');
                setNewTime('');
                setIsNewClient(false);
                setNewClientName('');
                setNewClientMobile('');
            }
        }
    }, [isOpen, dialogData, isEditing]);

    useEffect(() => {
        if (selectedClientId && !filteredClients.some((c:any) => c.id === selectedClientId)) {
            setSelectedClientId('');
        }
    }, [filteredClients, selectedClientId]);

    useEffect(() => {
        if (!firestore || !selectedClientId) {
            setClientTransactions([]);
            setSelectedTransactionId('');
            return;
        }
    
        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const transQuery = query(collection(firestore, `clients/${selectedClientId}/transactions`));
                const transSnap = await getDocs(transQuery);
                const transactions = transSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setClientTransactions(transactions);
                if (isEditing && dialogData.transactionId && !transactions.some(t => t.id === dialogData.transactionId)) {
                    setSelectedTransactionId(''); 
                }
            } catch (error) {
                console.error("Error fetching client transactions:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب معاملات العميل.' });
            } finally {
                setLoadingTransactions(false);
            }
        };
    
        fetchTransactions();
    }, [selectedClientId, firestore, toast, isEditing, dialogData]);

    const transactionOptions = useMemo(() => clientTransactions.map((tx: any) => ({
        value: tx.id,
        label: tx.transactionType,
        searchKey: tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd/MM/yyyy') : ''
    })), [clientTransactions]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser) return;
        setIsSaving(true);
    
        try {
            const finalClientId = isNewClient ? null : selectedClientId;
            const appointmentDateTime = isEditing ? new Date(`${newDate}T${newTime}`) : dialogData.appointmentDate;
    
            if (!isEditing && isPast(appointmentDateTime)) throw new Error('لا يمكن حجز موعد في وقت قد مضى.');
            if (isNewClient && (!newClientName || !newClientMobile)) throw new Error('الرجاء إدخال اسم وجوال العميل الجديد.');
            if (!isNewClient && !finalClientId) throw new Error('الرجاء اختيار عميل.');
    
            if (isEditing) {
                const appointmentRef = doc(firestore, 'appointments', dialogData.id);
                await updateDoc(appointmentRef, {
                    title: title.trim() || 'موعد',
                    notes: notes,
                    appointmentDate: Timestamp.fromDate(appointmentDateTime),
                    transactionId: selectedTransactionId || null,
                });
            } else {
                const dataToSave: any = {
                    title: title.trim() || (isNewClient ? newClientName : clients.find((c:any) => c.id === finalClientId)?.nameAr),
                    notes: notes,
                    engineerId: dialogData.engineerId,
                    appointmentDate: Timestamp.fromDate(appointmentDateTime),
                    transactionId: selectedTransactionId || null,
                    type: 'architectural',
                    createdAt: serverTimestamp(),
                };
                 if (isNewClient) {
                    dataToSave.clientName = newClientName;
                    dataToSave.clientMobile = newClientMobile;
                } else {
                    dataToSave.clientId = finalClientId;
                }
                await addDoc(collection(firestore, 'appointments'), dataToSave);
            }
    
            if (finalClientId) {
                await reconcileClientAppointments(firestore, finalClientId);
            }
    
            toast({ title: 'نجاح!', description: `تم ${isEditing ? 'تعديل' : 'حفظ'} الموعد بنجاح.` });
            onClose();
            onSaveSuccess();
    
        } catch (error) {
            console.error("Error saving appointment:", error);
            const message = error instanceof Error ? error.message : 'حدث خطأ أثناء الحفظ.';
            toast({ variant: 'destructive', title: 'خطأ', description: message });
        } finally {
            setIsSaving(false);
        }
    };
    
    
    const clientOptions = useMemo(() => filteredClients.map((c: Client) => ({
      value: c.id,
      label: c.nameAr,
      searchKey: c.mobile
    })), [filteredClients]);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
             <DialogContent
                dir="rtl"
                className="w-[95vw] max-w-md"
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
                             {isEditing 
                                ? `تعديل الموعد الخاص بـ: ${dialogData.clientName || dialogData.clientId}`
                                : `للمهندس: ${dialogData.engineerName} في ${format(dialogData.appointmentDate, "PPP 'الساعة' HH:mm", { locale: ar })}`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        {isEditing && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="date">التاريخ الجديد</Label>
                                    <Input id="date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required/>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="time">الوقت الجديد</Label>
                                    <Input id="time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required step="1800" />
                                </div>
                            </div>
                        )}
                        <div className="grid gap-2">
                            <Label htmlFor="title">الغرض من الزيارة (اختياري)</Label>
                            <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder='سيتم استخدام اسم العميل اذا ترك فارغاً' />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                            <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                        </div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(checked) => setIsNewClient(checked as boolean)} disabled={isEditing} />
                            <Label htmlFor="isNewClient">إضافة عميل جديد غير مسجل</Label>
                        </div>
                        {isNewClient ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-name">اسم العميل <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-name" value={newClientName} onChange={e => setNewClientName(e.target.value)} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="new-client-mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                                    <Input id="new-client-mobile" value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} dir="ltr" required />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="client-search">العميل <span className="text-destructive">*</span></Label>
                                    <InlineSearchList 
                                        value={selectedClientId}
                                        onSelect={setSelectedClientId}
                                        options={clientOptions}
                                        placeholder={clientOptions.length === 0 && dialogData?.engineerId ? "لا يوجد عملاء متاحون لهذا المهندس" : "ابحث بالاسم أو رقم الجوال..."}
                                        disabled={isEditing && !!dialogData.clientId}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="transaction-search">المعاملة</Label>
                                    <InlineSearchList
                                        value={selectedTransactionId}
                                        onSelect={setSelectedTransactionId}
                                        options={transactionOptions}
                                        placeholder={!selectedClientId ? 'اختر عميلاً أولاً' : loadingTransactions ? 'جاري جلب المعاملات...' : 'اختر المعاملة (اختياري)...'}
                                        disabled={!selectedClientId || loadingTransactions}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                        <Button type="submit" disabled={isSaving || (isNewClient ? (!newClientName || !newClientMobile) : !selectedClientId) }>
                            {isSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                            {isEditing ? 'حفظ التعديلات' : 'حفظ الموعد'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

```
- src/components/appointments/room-booking-calendar.tsx:
```tsx
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, Timestamp, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { setHours, setMinutes, startOfDay, endOfDay, format, isPast } from 'date-fns';
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

// --- Constants ---
const rooms = ['قاعة الاجتماعات 1', 'قاعة الاجتماعات 2', 'قاعة الاجتماعات 3'];
const morningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 8 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`)); // 8:00 to 9:30
const eveningSlots = Array.from({ length: 4 }, (_, i) => format(setHours(setMinutes(new Date(), 0), 13 + Math.floor(i/2)), `HH:${i%2 === 0 ? '00' : '30'}`)); // 13:00 to 14:30


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

    useEffect(() => {
        // Set date on client-side to avoid hydration mismatch
        if (!date) {
            setDate(new Date());
        }
    }, [date]);

    // Fetch static data (clients and engineers) once
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
    
    // Fetch appointments when date or static data changes
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
            setRawAppointments(augmentedAppointments);
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

    const appointments = useMemo(() => {
        return rawAppointments.map(appt => ({
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
    }, [appointments]);


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
            
            // Local state update to avoid race conditions with fetching
            setRawAppointments(prev => prev.filter(appt => appt.id !== appointmentToDelete.id!));
            
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
    
    if (!date) {
        return (
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
        )
    }

    const renderGridSection = (title: string, slots: string[]) => (
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

```
- src/components/clients/client-form.tsx:
```tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { Employee, Governorate, Area, Client } from '@/lib/types';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { DialogFooter } from '@/components/ui/dialog';


interface ClientFormProps {
    onSave: (data: Partial<Client>) => Promise<void>;
    onClose: () => void;
    initialData?: Partial<Client> | null;
    isSaving?: boolean;
}

export function ClientForm({ onSave, onClose, initialData = null, isSaving = false }: ClientFormProps) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState({
        nameAr: '', nameEn: '', mobile: '', governorateId: '', area: '',
        block: '', street: '', houseNumber: '',
    });
    const [assignedEngineerId, setAssignedEngineerId] = useState('');
    
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [refDataLoading, setRefDataLoading] = useState(true);
    const [isAreaLoading, setIsAreaLoading] = useState(false);

    const handleGovernorateChange = useCallback(async (govId: string, preselectArea?: string) => {
        setFormData(prev => ({ ...prev, governorateId: govId, area: '' }));
        setAreas([]);
        if (govId && firestore) {
            setIsAreaLoading(true);
            const areasQuery = query(collection(firestore, `governorates/${govId}/areas`), orderBy('name'));
            const areasSnapshot = await getDocs(areasQuery);
            const fetchedAreas = areasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
            setAreas(fetchedAreas);
            if(preselectArea && fetchedAreas.some(a => a.name === preselectArea)) {
                setFormData(prev => ({...prev, area: preselectArea}));
            }
            setIsAreaLoading(false);
        }
    }, [firestore]);
    
    useEffect(() => {
        if (initialData) {
            const initialGov = governorates.find(g => g.name === initialData.address?.governorate);
            setFormData({
                nameAr: initialData.nameAr || '',
                nameEn: initialData.nameEn || '',
                mobile: initialData.mobile || '',
                governorateId: initialGov?.id || '',
                area: initialData.address?.area || '',
                block: initialData.address?.block || '',
                street: initialData.address?.street || '',
                houseNumber: initialData.address?.houseNumber || '',
            });
            setAssignedEngineerId(initialData.assignedEngineer || '');
            if(initialGov?.id) {
                handleGovernorateChange(initialGov.id, initialData.address?.area);
            }
        }
    }, [initialData, governorates, handleGovernorateChange]);


    useEffect(() => {
        if (!firestore) return;
        const fetchReferenceData = async () => {
            setRefDataLoading(true);
            try {
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const govQuery = query(collection(firestore, 'governorates'), orderBy('name'));
                
                const [engSnapshot, govSnapshot] = await Promise.all([getDocs(engQuery), getDocs(govQuery)]);

                const fetchedEngineers: Employee[] = [];
                engSnapshot.forEach(doc => {
                    const employee = { id: doc.id, ...doc.data() } as Employee;
                    if ((employee.jobTitle?.includes('مهندس') || employee.jobTitle?.toLowerCase().includes('architect')) && employee.department?.includes('المعماري')) {
                        fetchedEngineers.push(employee);
                    }
                });
                setEngineers(fetchedEngineers);
                setGovernorates(govSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Governorate)));

            } catch (error) {
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب البيانات المرجعية.' });
            } finally {
                setRefDataLoading(false);
            }
        };

        fetchReferenceData();
    }, [firestore, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        let sanitizedValue = value;
        if (id === 'nameAr') sanitizedValue = value.replace(/[^ \u0600-\u06FF]/g, '');
        else if (id === 'nameEn') sanitizedValue = value.replace(/[^ a-zA-Z]/g, '');
        setFormData(prev => ({ ...prev, [id]: sanitizedValue }));
    };

    const handleSelectChange = (id: string, value: string) => {
        setFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const engineerOptions = useMemo(() => engineers.map(e => ({value: e.id!, label: e.fullName})), [engineers]);
    const governorateOptions = useMemo(() => governorates.map(g => ({value: g.id, label: g.name})), [governorates]);
    const areaOptions = useMemo(() => areas.map(a => ({value: a.name, label: a.name})), [areas]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.nameAr || !formData.mobile) {
            toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء تعبئة اسم العميل بالعربية ورقم الجوال.' });
            return;
        }
        if (!initialData && !assignedEngineerId) {
             toast({ variant: 'destructive', title: 'خطأ في الإدخال', description: 'الرجاء اختيار المهندس المسؤول.' });
            return;
        }
        
        const selectedGov = governorates.find(g => g.id === formData.governorateId);

        const dataToSave = {
            nameAr: formData.nameAr,
            nameEn: formData.nameEn,
            mobile: formData.mobile,
            address: {
                governorate: selectedGov?.name || '',
                area: formData.area,
                block: formData.block,
                street: formData.street,
                houseNumber: formData.houseNumber,
            },
            assignedEngineer: assignedEngineerId,
        };
        
        await onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="space-y-6 py-4 px-1 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="nameAr">اسم العميل (بالعربية) <span className="text-destructive">*</span></Label>
                        <Input id="nameAr" value={formData.nameAr} onChange={handleInputChange} required />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="nameEn">اسم العميل (بالإنجليزية)</Label>
                        <Input id="nameEn" dir="ltr" value={formData.nameEn} onChange={handleInputChange} />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="mobile">رقم الجوال <span className="text-destructive">*</span></Label>
                    <Input id="mobile" dir="ltr" value={formData.mobile} onChange={handleInputChange} required />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="assignedEngineerId">المهندس المسؤول <span className="text-destructive">*</span></Label>
                     <InlineSearchList 
                        value={assignedEngineerId}
                        onSelect={setAssignedEngineerId}
                        options={engineerOptions}
                        placeholder={refDataLoading ? "تحميل..." : "اختر مهندسًا..."}
                        disabled={refDataLoading}
                     />
                </div>
                <Separator />
                <div className="space-y-4">
                    <Label className="font-semibold">عنوان العميل</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="grid gap-2">
                            <Label htmlFor="governorate">المحافظة</Label>
                            <InlineSearchList value={formData.governorateId} onSelect={handleGovernorateChange} options={governorateOptions} placeholder={refDataLoading ? "تحميل..." : "اختر محافظة..."} disabled={refDataLoading}/>
                        </div>
                         <div className="grid gap-2">
                            <Label htmlFor="area">المنطقة</Label>
                            <InlineSearchList value={formData.area} onSelect={(v) => handleSelectChange('area', v)} options={areaOptions} placeholder={!formData.governorateId ? "اختر محافظة أولاً" : isAreaLoading ? "تحميل..." : "اختر منطقة..."} disabled={!formData.governorateId || isAreaLoading}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="block">القطعة</Label>
                            <Input id="block" value={formData.block} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="street">الشارع</Label>
                            <Input id="street" value={formData.street} onChange={handleInputChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="houseNumber">رقم المنزل / القسيمة</Label>
                            <Input id="houseNumber" value={formData.houseNumber} onChange={handleInputChange} />
                        </div>
                    </div>
                </div>
            </div>
            <DialogFooter className="mt-6 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isSaving ? 'جاري الحفظ...' : 'حفظ'}
                </Button>
            </DialogFooter>
        </form>
    );
}

```
- src/components/clients/transaction-timeline.tsx:
```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore'; 
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, History, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
}

interface TransactionTimelineProps {
  clientId: string;
  transactionId: string;
  filterType: 'comment' | 'log';
  showInput?: boolean;
  title: string;
  icon: React.ReactNode;
  client: any;
  transaction: any;
}

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
}

export function TransactionTimeline({ clientId, transactionId, filterType, showInput = false, title, icon, client, transaction }: TransactionTimelineProps) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  const { 
    items: events, 
    setItems: setEvents, 
    loading, 
    loadingMore, 
    hasMore, 
    loaderRef 
  } = useInfiniteScroll<TimelineEvent>(`clients/${clientId}/transactions/${transactionId}/timelineEvents`);

  const handlePostComment = async () => {
    if (!newComment.trim() || !currentUser || !firestore) return;

    setIsPosting(true);
    const tempId = `temp_${Date.now()}`;
    const optimisticComment: TimelineEvent = {
        id: tempId,
        type: 'comment',
        content: newComment,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: new Date(),
    };
    
    setEvents(prev => [optimisticComment, ...prev]);
    setNewComment('');

    try {
      const timelineCollection = collection(firestore, `clients/${clientId}/transactions/${transactionId}/timelineEvents`);
      const commentData = {
          type: 'comment' as const,
          content: newComment,
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.avatarUrl,
          createdAt: serverTimestamp(),
      };

      await addDoc(timelineCollection, commentData);
      
      const clientName = client?.nameAr || 'عميل';
      const transactionType = transaction?.transactionType || 'معاملة';
      const recipients = new Set<string>();
      if (currentUser.id) recipients.add(currentUser.id);

      if (transaction?.assignedEngineerId) {
          const assigneeUserId = await findUserIdByEmployeeId(firestore, transaction.assignedEngineerId);
          if (assigneeUserId && assigneeUserId !== currentUser.id) {
              recipients.add(assigneeUserId);
          }
      }

      for (const recipientId of recipients) {
          const isCreator = recipientId === currentUser.id;
          const title = isCreator ? 'تم إرسال تعليقك' : `تعليق جديد من ${currentUser.fullName}`;
          const body = isCreator ? `تم إرسال تعليقك على معاملة العميل ${clientName} بنجاح.` : `أضاف ${currentUser.fullName} تعليقًا على المعاملة "${transactionType}" للعميل ${clientName}.`;
          
          createNotification(firestore, { userId: recipientId, title, body, link: `/dashboard/clients/${clientId}/transactions/${transactionId}` });
      }
      
    } catch (err) {
      setEvents(prev => prev.filter(e => e.id !== tempId));
      setNewComment(optimisticComment.content);
      console.error('Failed to post comment:', err);
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إرسال التعليق.' });
    } finally {
      setIsPosting(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(event => event.type === filterType);
  }, [events, filterType]);

  return (
    <Card className='lg:col-span-3'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {showInput && currentUser && (
          <div className="flex items-start gap-4">
            <Avatar className="h-9 w-9 border">
              <AvatarImage src={currentUser?.avatarUrl} />
              <AvatarFallback>{currentUser?.fullName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="أكتب تعليقاً أو تحديثاً..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button onClick={handlePostComment} disabled={isPosting || !newComment.trim()}>
                  <Send className="ml-2 h-4 w-4" />
                  {isPosting ? 'جاري الإرسال...' : 'إرسال'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
            {loading && Array.from({length: 3}).map((_, i) => (
                <div key={i} className="flex gap-4">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className='flex-1 space-y-2'>
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                </div>
            ))}
            {!loading && filteredEvents.length === 0 && (
                <div className="text-center text-muted-foreground pt-8">
                  <p>{filterType === 'comment' ? 'لا توجد تعليقات بعد. كن أول من يضيف تعليقاً.' : 'لا توجد أحداث مسجلة في السجل.'}</p>
                </div>
            )}
          {filteredEvents.map((event) => (
            <div key={event.id} className="flex items-start gap-4">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={event.userAvatar} />
                <AvatarFallback>{event.userName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-md border bg-muted/50 p-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-sm">{event.userName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</p>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{event.content}</p>
              </div>
            </div>
          ))}

            <div ref={loaderRef} className="flex justify-center p-4">
                {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                {!hasMore && filteredEvents.length > 0 && <p className="text-sm text-muted-foreground">وصلت إلى نهاية السجل</p>}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

```
- src/components/contract/ContractForm.tsx:
```tsx
// This file is intentionally left blank. 
// The generic ContractForm has been deprecated. Contracts are now created
// from the client's transaction page using the ContractClausesForm.

```
- src/components/dashboard/pending-visits.tsx:
```tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import type { Appointment, Client } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PendingVisit extends Appointment {
    clientName?: string;
}

export function PendingVisits() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !user) {
            setLoading(false);
            return;
        }
        
        const fetchPendingVisits = async () => {
            setLoading(true);
            try {
                let appointmentsQuery;
                const appointmentsRef = collection(firestore, 'appointments');

                // If user is Admin, fetch all pending visits. Otherwise, fetch only for the current user.
                if (user.role === 'Admin') {
                    // Admin sees all architectural appointments. Filtering for pending happens client-side.
                    appointmentsQuery = query(
                        appointmentsRef,
                        where('type', '==', 'architectural')
                    );
                } else if (user.employeeId) {
                    // Other users only see their own.
                    appointmentsQuery = query(
                        appointmentsRef,
                        where('engineerId', '==', user.employeeId),
                        where('type', '==', 'architectural')
                    );
                } else {
                    setPendingVisits([]);
                    setLoading(false);
                    return;
                }

                const appointmentsSnapshot = await getDocs(appointmentsQuery);
                const allUserAppointments = appointmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));

                // CLIENT-SIDE FILTERING:
                const filteredPending = allUserAppointments.filter(appt => 
                    appt.appointmentDate && // Ensure date exists
                    isPast(appt.appointmentDate.toDate()) &&
                    !appt.workStageUpdated
                );
                
                // CLIENT-SIDE SORTING:
                filteredPending.sort((a, b) => b.appointmentDate.toDate().getTime() - a.appointmentDate.toDate().getTime());

                if (filteredPending.length === 0) {
                    setPendingVisits([]);
                    setLoading(false);
                    return;
                }

                // Fetch client names for the pending visits
                const clientIds = [...new Set(filteredPending.map(a => a.clientId).filter(Boolean) as string[])];

                if (clientIds.length > 0) {
                    // Use a 'in' query which is efficient for up to 30 IDs.
                    const clientsQuery = query(collection(firestore, 'clients'), where('__name__', 'in', clientIds));
                    const clientsSnapshot = await getDocs(clientsQuery);
                    const clientsMap = new Map(clientsSnapshot.docs.map(doc => [doc.id, doc.data() as Client]));
    
                    const augmentedPendingVisits = filteredPending.map(appt => ({
                        ...appt,
                        clientName: clientsMap.get(appt.clientId)?.nameAr || appt.clientName || 'عميل غير معروف'
                    }));
    
                    setPendingVisits(augmentedPendingVisits);
                } else {
                     setPendingVisits(filteredPending.map(appt => ({...appt, clientName: appt.clientName || 'عميل غير معروف'})));
                }


            } catch (error) {
                console.error("Error fetching pending visits:", error);
                // I won't toast here to avoid spamming the user if the error persists.
            } finally {
                setLoading(false);
            }
        };
        fetchPendingVisits();
    }, [firestore, user]);

    if (loading) {
        return (
            <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle />
                        زيارات معلقة بانتظار تحديث
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-5/6" />
                    <Skeleton className="h-5 w-3/4" />
                </CardContent>
            </Card>
        );
    }
    
    if (pendingVisits.length === 0) {
        return null; // Don't render the card if there are no pending visits
    }

    return (
         <Card className="h-full flex flex-col bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle />
                    زيارات معلقة بانتظار تحديث ({pendingVisits.length})
                </CardTitle>
                <CardDescription className="text-red-600 dark:text-red-400/80">
                    هذه الزيارات قد مضى تاريخها ولم يتم تحديث مرحلة العمل الخاصة بها.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-3 overflow-y-auto">
                {pendingVisits.slice(0, 5).map(visit => (
                     <Link href={`/dashboard/appointments/${visit.id}`} key={visit.id} className="block p-2 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{visit.clientName}</span>
                             <span className="text-xs text-muted-foreground">{format(visit.appointmentDate.toDate(), 'dd/MM/yyyy')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{visit.title}</p>
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}

```
- src/components/dashboard/recent-activity.tsx:
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { users } from '@/lib/data';

const activities = [
  {
    userName: 'Fatima Al-Mansoori',
    userAvatar: users.find(u => u.id === 'user-2')?.avatarUrl,
    action: 'updated the timeline for',
    projectName: 'Downtown Dubai Villa',
    time: '5m ago',
  },
  {
    userName: 'Ali Ahmed',
    userAvatar: users.find(u => u.id === 'user-1')?.avatarUrl,
    action: 'added a new client',
    projectName: 'Aldar Properties',
    time: '30m ago',
  },
  {
    userName: 'Hassan Ibrahim',
    userAvatar: users.find(u => u.id === 'user-5')?.avatarUrl,
    action: 'submitted a daily report for',
    projectName: 'Yas Island Residential Tower',
    time: '1h ago',
  },
  {
    userName: 'Yusuf Khan',
    userAvatar: users.find(u => u.id === 'user-3')?.avatarUrl,
    action: 'marked an invoice as paid for',
    projectName: 'Downtown Dubai Villa',
    time: '2h ago',
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          An overview of the latest actions in your team.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {activities.map((activity, index) => (
          <div className="flex items-center gap-4" key={index}>
            <Avatar className="hidden h-9 w-9 sm:flex">
              <AvatarImage src={activity.userAvatar} alt="Avatar" />
              <AvatarFallback>{activity.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <p className="text-sm font-medium leading-none">
                {activity.userName}{' '}
                <span className="text-muted-foreground">{activity.action}</span>{' '}
                {activity.projectName}
              </p>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {activity.time}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

```
- src/components/dashboard/task-prioritization.tsx:
```tsx
'use client';
import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { suggestTaskPrioritization } from '@/ai/flows/suggest-task-prioritization';
import { Wand2 } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

const mockInput = {
    projectTimeline: "Project 'Downtown Villa' deadline is in 2 months. Structural phase is delayed by 1 week.",
    dependencies: "Electrical layout depends on final structural drawings. Interior design depends on electrical layout.",
    resourceAvailability: "Fatima Al-Mansoori (Lead Structural Engineer) is at 80% capacity. Hassan Ibrahim (Electrical Engineer) is at 30% capacity."
};

const mockSuggestion = `1. **Finalize Structural Drawings for 'Downtown Villa'**: This is the highest priority as it's currently blocking two other dependent phases (Electrical and Interior). Completing this will unlock other teams.
2. **Begin Electrical Layout for 'Downtown Villa'**: Once the structural drawings are approved, Hassan Ibrahim should immediately start this task, given his high availability.
3. **Client Follow-up for 'Yas Island Tower'**: As this project is in the planning phase, a follow-up is crucial to maintain momentum and clarify requirements.`;


export function TaskPrioritization() {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    setLoading(true);
    setError(null);
    setSuggestion(null);
    try {
        // In a real app, you would fetch real data
        // const response = await suggestTaskPrioritization(mockInput);
        // setSuggestion(response.prioritizedTasks);
        
        // Using mock response for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSuggestion(mockSuggestion);

    } catch (e) {
      setError('Failed to get suggestions. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>AI Task Prioritization</CardTitle>
        <CardDescription>
          Get AI-powered suggestions for your next tasks based on deadlines, dependencies, and resources.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        {loading && (
            <div className="space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-6 w-2/4 mt-4" />
                <Skeleton className="h-4 w-full" />
            </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {suggestion && !loading && (
          <div className="prose prose-sm max-w-none text-foreground">
            <ul className="space-y-2">
                {suggestion.split('\n').map((item, index) => {
                    if (!item.trim()) return null;
                    const isTitle = item.startsWith('1.') || item.startsWith('2.') || item.startsWith('3.');
                    return (
                        <li key={index} className="flex items-start">
                            <span className="mr-2 mt-1">{isTitle ? '✅' : ''}</span>
                            <span dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                        </li>
                    )
                })}
            </ul>
          </div>
        )}
        {!suggestion && !loading && (
            <div className="text-center text-muted-foreground p-8">
                <p>Click the button to generate task priorities.</p>
            </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSuggest} disabled={loading} className='w-full'>
          <Wand2 className="mr-2 h-4 w-4" />
          {loading ? 'Generating...' : 'Suggest Priorities'}
        </Button>
      </CardFooter>
    </Card>
  );
}

```
- src/components/dashboard/upcoming-appointments-card.tsx:
```tsx
'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck } from 'lucide-react';
import { useFirebase, useSubscription } from '@/firebase';
import { where, Timestamp } from 'firebase/firestore';
import type { Appointment } from '@/lib/types';

export function UpcomingAppointmentsCard() {
    const { firestore } = useFirebase();

    const appointmentsQuery = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        return [
            where('appointmentDate', '>=', Timestamp.fromDate(today))
        ];
    }, []);

    const { data: appointments, loading } = useSubscription<Appointment>(firestore, 'appointments', appointmentsQuery);

    const count = useMemo(() => {
        if (loading || !appointments) return 0;
        return appointments.length;
    }, [appointments, loading]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{loading ? '...' : count}</div>
                <p className="text-xs text-muted-foreground">
                    All upcoming appointments
                </p>
            </CardContent>
        </Card>
    );
}

```
- src/components/dashboard/upcoming-appointments.tsx:
```tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, Timestamp, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/context/language-context';
import type { Appointment, Client, Employee } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { useSubscription } from '@/hooks/use-subscription';
import { toFirestoreDate } from '@/services/date-converter';

export function UpcomingAppointments() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const [engineersMap, setEngineersMap] = useState<Map<string, string>>(new Map());
  const [clientsMap, setClientsMap] = useState<Map<string, string>>(new Map());
  const [relatedDataLoading, setRelatedDataLoading] = useState(true);

  // Memoize the query constraints to prevent re-renders
  const appointmentsQuery = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [
      where('appointmentDate', '>=', Timestamp.fromDate(today)),
      orderBy('appointmentDate', 'asc'),
      limit(5)
    ];
  }, []);

  const { data: appointments, loading: appointmentsLoading } = useSubscription<Appointment>(firestore, 'appointments', appointmentsQuery);

  // Fetch related data (engineers and clients) once
  useEffect(() => {
    if (!firestore) return;

    const fetchRelatedData = async () => {
      setRelatedDataLoading(true);
      try {
        const [engineersSnapshot, clientsSnapshot] = await Promise.all([
          getDocs(collection(firestore, 'employees')),
          getDocs(collection(firestore, 'clients'))
        ]);

        const newEngineersMap = new Map<string, string>();
        engineersSnapshot.forEach(doc => newEngineersMap.set(doc.id, doc.data().fullName));
        setEngineersMap(newEngineersMap);

        const newClientsMap = new Map<string, string>();
        clientsSnapshot.forEach(doc => newClientsMap.set(doc.id, doc.data().nameAr));
        setClientsMap(newClientsMap);

      } catch (error) {
        console.error("Error fetching related data for appointments:", error);
      } finally {
        setRelatedDataLoading(false);
      }
    };
    
    fetchRelatedData();
  }, [firestore]);
  
  const augmentedAppointments = useMemo(() => {
      return appointments.map(appt => ({
          ...appt,
          clientName: appt.clientId ? clientsMap.get(appt.clientId) || '...' : appt.clientName,
          engineerName: appt.engineerId ? engineersMap.get(appt.engineerId) || '...' : '...',
      }));
  }, [appointments, clientsMap, engineersMap]);
    
  const t = (language === 'ar') ? 
    { title: 'المواعيد القادمة', description: 'زياراتك الميدانية واجتماعاتك المجدولة التالية.', viewAll: 'عرض الكل', client: 'العميل', engineer: 'المهندس', dateTime: 'التاريخ والوقت', purpose: 'الغرض', noAppointments: 'لا توجد مواعيد قادمة.' } : 
    { title: 'Upcoming Appointments', description: 'Your next scheduled site visits and meetings.', viewAll: 'View All', client: 'Client', engineer: 'Engineer', dateTime: 'Date & Time', purpose: 'Purpose', noAppointments: 'No upcoming appointments.' };
  
  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    if (!date) {
        return '';
    }
    if(language === 'ar') {
        return format(date, "EEE, dd MMM yyyy 'الساعة' h:mm a", { locale: ar });
    }
    return format(date, "EEE, dd MMM yyyy 'at' h:mm a");
  }

  const loading = appointmentsLoading || relatedDataLoading;

  return (
    <Card dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <CardHeader className="flex flex-row items-center">
        <div className="grid gap-2">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </div>
        <Button asChild size="sm" className="ml-auto gap-1">
          <Link href="/dashboard/appointments">
            {t.viewAll}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.client}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.engineer}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.dateTime}</TableHead>
              <TableHead className="text-right">{t.purpose}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && Array.from({length: 3}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                </TableRow>
            ))}
            {!loading && augmentedAppointments.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">{t.noAppointments}</TableCell>
                </TableRow>
            )}
            {!loading && augmentedAppointments.map((appt) => {
              return (
                <TableRow key={appt.id}>
                  <TableCell>
                    <div className="font-medium">{appt.clientName}</div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {appt.engineerName}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                     {formatDate(appt.appointmentDate)}
                  </TableCell>
                  <TableCell className="text-right">{appt.title}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

```
- src/components/hr/attendance-uploader.tsx:
```tsx
// This file is marked for deletion and will be replaced.
export default function DeprecatedAttendanceUploader() {
    return null;
}

```
- src/components/hr/employee-audit-log.tsx:
```tsx

'use client';

import { useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { useInfiniteScroll } from '@/lib/hooks/use-infinite-scroll';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { AuditLog } from '@/lib/types';

interface EmployeeAuditLogProps {
  employeeId: string;
}

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
}

export function EmployeeAuditLog({ employeeId }: EmployeeAuditLogProps) {
  const {
    items: events,
    loading,
    loadingMore,
    hasMore,
    loaderRef
  } = useInfiniteScroll<AuditLog>(`employees/${employeeId}/auditLogs`);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'><History className='text-primary'/> سجل التدقيق</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
            {events.length > 0 && <div className="absolute left-4 top-1 h-full w-0.5 -translate-x-1/2 bg-border rtl:left-auto rtl:right-4"></div>}

            <div className="space-y-8">
                {loading && Array.from({length: 3}).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className='flex-1 space-y-2'>
                            <Skeleton className="h-4 w-1/4" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    </div>
                ))}
                {!loading && events.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                        <p>لا توجد تغييرات مسجلة بعد.</p>
                    </div>
                )}
                {events.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-4">
                        <div className="z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card ring-4 ring-card">
                             <Avatar className="h-8 w-8">
                                <AvatarFallback>{'S'}</AvatarFallback>
                            </Avatar>
                        </div>
                        
                        <div className="flex-1 pt-1">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold text-sm text-foreground">{event.changedBy}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(event.effectiveDate)}</p>
                            </div>
                            <div className="mt-1">
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.newValue}</p>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={loaderRef} className="flex justify-center p-4">
                    {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                    {!hasMore && events.length > 5 && <p className="text-sm text-muted-foreground">وصلت إلى نهاية السجل</p>}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}

```
- src/components/hr/employee-financials.tsx:
```tsx

'use client';

import { useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { PaymentVoucher } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Skeleton } from '../ui/skeleton';
import { WalletCards } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';

interface EmployeeFinancialsProps {
  employeeId: string;
}

export function EmployeeFinancials({ employeeId }: EmployeeFinancialsProps) {
  const { firestore } = useFirebase();

  const queryConstraints = useMemo(() => [
    where('employeeId', '==', employeeId),
    orderBy('paymentDate', 'desc')
  ], [employeeId]);

  const { data: vouchers, loading, error } = useSubscription<PaymentVoucher>(firestore, 'paymentVouchers', queryConstraints);

  const formatDate = (date: any) => {
    const d = toFirestoreDate(date);
    return d ? format(d, 'dd/MM/yyyy', { locale: ar }) : '-';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <WalletCards className="text-primary" />
          السندات المالية
        </CardTitle>
        <CardDescription>
          جميع سندات الصرف المرتبطة بالموظف (مثل تجديد إقامة، عهدة، وغيرها).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-destructive">
                    فشل تحميل البيانات المالية.
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && vouchers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    لا توجد سندات مالية مسجلة لهذا الموظف.
                  </TableCell>
                </TableRow>
              )}
              {!loading && vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell>
                    <Link href={`/dashboard/accounting/payment-vouchers/${voucher.id}`} className="font-mono hover:underline text-primary">
                      {voucher.voucherNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(voucher.paymentDate)}</TableCell>
                  <TableCell>{voucher.description}</TableCell>
                  <TableCell className="text-left font-mono">{formatCurrency(voucher.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

```
- src/components/hr/leave-request-form.tsx:
```tsx
// This file is marked for deletion and will be replaced.

```
- src/components/hr/payroll-generator.tsx:
```tsx
// This file is marked for deletion and will be replaced.
export default function DeprecatedPayrollGenerator() {
    return null;
}

```
- src/components/hr/residency-renewal-dialog.tsx:
```tsx

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DateInput } from '../ui/date-input';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Account } from '@/lib/types';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

interface ResidencyRenewalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
}

export function ResidencyRenewalDialog({ isOpen, onClose, employee }: ResidencyRenewalDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  
  const [newExpiryDate, setNewExpiryDate] = useState<Date | undefined>();
  const [cost, setCost] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const handleSaveAndCreateVoucher = async () => {
    if (!firestore || !currentUser || !newExpiryDate || !cost) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال تاريخ الانتهاء الجديد والتكلفة.' });
      return;
    }

    setIsSaving(true);
    
    try {
        const renewalCost = parseFloat(cost);
        const params = new URLSearchParams({
            payeeType: 'vendor',
            payeeName: 'وزارة الداخلية - شؤون الإقامة',
            amount: String(renewalCost),
            description: `رسوم تجديد إقامة للموظف: ${employee.fullName} (رقم مدني: ${employee.civilId})`,
            debitAccountCode: '110301', // مصروفات مدفوعة مقدماً
            employeeId: employee.id!,
            source: 'residency_renewal',
            newExpiryDate: newExpiryDate.toISOString(),
        });
        
        router.push(`/dashboard/accounting/payment-vouchers/new?${params.toString()}`);
        
        toast({ title: 'تم التوجيه', description: 'جاري تحويلك لإنشاء سند الصرف...' });
        onClose();
    } catch(error) {
        const message = error instanceof Error ? error.message : 'فشل إرسال طلب تجديد الإقامة.';
        toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تجديد إقامة موظف</DialogTitle>
          <DialogDescription>
            إدخال بيانات تجديد إقامة الموظف "{employee.fullName}". سيتم توجيهك لإنشاء سند صرف لتسجيل التكلفة.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-expiry-date">تاريخ الانتهاء الجديد <span className="text-destructive">*</span></Label>
            <DateInput id="new-expiry-date" value={newExpiryDate} onChange={setNewExpiryDate} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="renewal-cost">تكلفة التجديد (بالدينار) <span className="text-destructive">*</span></Label>
            <Input
              id="renewal-cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.000"
              dir="ltr"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          <Button type="button" onClick={handleSaveAndCreateVoucher} disabled={isSaving || !newExpiryDate || !cost}>
            {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4" />}
            {isSaving ? 'جاري...' : 'متابعة لإنشاء سند الصرف'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```
- src/lib/hooks/use-infinite-scroll.ts:
```ts
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  type Firestore,
  query,
  collection,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';

const PAGE_SIZE = 15;
const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

export function useInfiniteScroll<T extends { id?: string }>(
  collectionPath: string | null,
  constraints: QueryConstraint[] = EMPTY_CONSTRAINTS
) {
  const { firestore } = useFirebase();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async (isLoadMore: boolean) => {
    if (!firestore || !collectionPath || (isLoadMore && !hasMore)) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]); // Reset for new fetches
      setLastVisible(null);
      setHasMore(true);
    }

    try {
      const queryConstraints: QueryConstraint[] = [
        ...constraints,
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      ];

      if (isLoadMore && lastVisible) {
        queryConstraints.push(startAfter(lastVisible));
      }

      const q = query(collection(firestore, collectionPath), ...queryConstraints);
      const snapshot = await getDocs(q);

      const newItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      
      setItems(prev => isLoadMore ? [...prev, ...newItems] : newItems);
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);

      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (error) {
      console.error(`Error fetching from ${collectionPath}:`, error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, collectionPath, JSON.stringify(constraints), hasMore, lastVisible]);

  // Initial Fetch Effect
  useEffect(() => {
    if (collectionPath) {
        fetchItems(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath, JSON.stringify(constraints)]);

  // Intersection Observer Effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchItems(true);
        }
      },
      { threshold: 1.0 }
    );

    const loader = loaderRef.current;
    if (loader) {
      observer.observe(loader);
    }

    return () => {
      if (loader) {
        observer.unobserve(loader);
      }
    };
  }, [hasMore, loadingMore, loading, fetchItems]);

  return { items, setItems, loading, loadingMore, hasMore, loaderRef };
}

```
- src/lib/hooks/use-optimistic.ts:
```ts
'use client';
import { useState, useCallback } from 'react';

export function useOptimistic<T extends { id?: string }>(
  initialData: T[],
  updateFn: (newData: T[]) => Promise<void>
) {
  const [data, setData] = useState<T[]>(initialData);
  const [isOptimistic, setIsOptimistic] = useState(false);

  const addOptimistic = useCallback(async (item: T, tempId: string) => {
    const originalData = data;
    const optimisticItem = { ...item, id: tempId };
    const newData = [optimisticItem, ...originalData];

    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert to original data
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  const updateOptimistic = useCallback(async (id: string, updates: Partial<T>) => {
    const originalData = data;
    const newData = originalData.map(item => 
      item.id === id ? { ...item, ...updates } as T : item
    );
    
    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  const deleteOptimistic = useCallback(async (id: string) => {
    const originalData = data;
    const newData = originalData.filter(item => item.id !== id);

    setData(newData);
    setIsOptimistic(true);
    
    try {
      await updateFn(newData);
      setIsOptimistic(false);
    } catch (error) {
      setData(originalData); // Revert
      setIsOptimistic(false);
      throw error;
    }
  }, [data, updateFn]);

  return {
    data,
    setData, // Exposing setData to allow external updates from real-time listeners
    isOptimistic,
    addOptimistic,
    updateOptimistic,
    deleteOptimistic
  };
}

```
- src/lib/hooks/use-realtime.ts:
```ts
// This file is deprecated. Please use useSubscription instead.
export function useRealtime() {
    console.error('useRealtime is deprecated. Please use `useSubscription` for real-time collection data.');
    return { data: [], loading: true, error: new Error('useRealtime is deprecated.') };
}

```
- src/lib/placeholder-images.ts:
```ts
import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages;

```
- src/lib/types.ts:
```ts


export interface Company {
    id?: string;
    name: string;
    nameEn?: string;
    address?: string;
    phone?: string;
    email?: string;
    crNumber?: string;
    logoUrl?: string;
}

export type MultilingualString = {
    ar: string;
    en: string;
};

export type UserRole = 'Admin' | 'Engineer' | 'Accountant' | 'Secretary' | 'HR';

export type UserProfile = {
  id?: string;
  uid?: string; // Firebase Auth UID
  username: string; // Unique, for login
  email: string; // Auto-generated internal email
  passwordHash: string; // Hashed password
  employeeId: string; // Reference to 'employees' collection
  role: UserRole;
  isActive: boolean;
  createdAt?: any; 
  activatedAt?: any;
  createdBy?: string; // UID of the admin who created the user
  avatarUrl?: string; // Optional, from employee record
  fullName?:string; // Optional, from employee record
  jobTitle?: string; // Optional, from employee record
};

export type Client = {
  id: string;
  nameAr: string;
  nameEn?: string;
  mobile: string;
  civilId?: string;
  plotNumber?: string;
  address?: {
    governorate: string;
    area: string;
    block: string;
    street: string;
    houseNumber: string;
  };
  fileId: string;
  fileNumber: number;
  fileYear: number;
  status: 'new' | 'contracted' | 'cancelled' | 'reContracted';
  transactionCounter?: number;
  assignedEngineer?: string;
  createdAt: any;
  isActive: boolean;
  projectIds?: string[];
};

export type ProjectStatus = 'Planning' | 'In Progress' | 'Completed' | 'On Hold' | 'Cancelled';

export type EngineeringDiscipline = {
  name: MultilingualString;
  stages: { name: MultilingualString; status: 'Pending' | 'In Progress' | 'Completed' }[];
};

export type ProjectFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  type: 'image' | 'pdf' | 'document';
};

export type TimelineEvent = {
  id: string;
  type: 'Milestone' | 'Visit' | 'Task' | 'Report';
  title: MultilingualString;
  date: string;
  description: MultilingualString;
  authorId?: string;
};

export type DailyReport = {
  id:string;
  date: string;
  authorId: string;
  workCompleted: string;
  workersCount: number;
  issues: string;
  photos: string[]; // URLs
};

export type Project = {
  id: string;
  name: MultilingualString;
  clientId: string;
  leadEngineerId: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  description: MultilingualString;
  imageUrl: string;
  imageHint: string;
  disciplines: EngineeringDiscipline[];
  files: ProjectFile[];
  timeline: TimelineEvent[];
  reports: DailyReport[];
  contractId?: string;
};

export type Appointment = {
  id: string;
  title: string;
  appointmentDate: any; // This will be the start time
  endDate?: any; // This will be the end time
  clientId?: string;
  clientName?: string;
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
  meetingRoom?: string;
  department?: string;
  type: 'architectural' | 'room';
  notes?: string;
  transactionId?: string;
  workStageUpdated?: boolean;
  workStageProgressId?: string;
  // For architectural appointments with color logic
  session?: 'صباحية' | 'مسائية';
  visitCount?: number;
  contractSigned?: boolean;
  projectType?: string;
  color?: string; // Hex color code
  minutesContent?: string;
  // For display purposes, not stored in DB directly
};


export type PaymentMilestone = {
  id: string;
  name: MultilingualString;
  percentage: number;
  dueDate: string;
  status: 'Pending' | 'Completed' | 'Overdue';
};

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export type Invoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  type: 'Receivable' | 'Payable';
};

export type CashReceipt = {
    id: string;
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    clientId: string;
    clientNameAr: string;
    clientNameEn?: string;
    projectId?: string;
    projectNameAr?: string;
    amount: number;
    amountInWords: string;
    receiptDate: any; 
    paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer' | 'K-Net';
    description: string;
    reference?: string;
    journalEntryId?: string;
    createdAt: any; 
};

export interface PaymentVoucher {
  id?: string;
  voucherNumber: string;
  voucherSequence: number;
  voucherYear: number;
  payeeName: string;
  payeeType: 'vendor' | 'employee' | 'other';
  employeeId?: string;
  renewalExpiryDate?: any;
  amount: number;
  amountInWords: string;
  paymentDate: any; 
  paymentMethod: 'Cash' | 'Cheque' | 'Bank Transfer' | 'EmployeeCustody';
  description: string;
  reference?: string;
  debitAccountId: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountName: string;
  status: 'draft' | 'paid' | 'cancelled';
  journalEntryId?: string;
  createdAt: any; 
  clientId?: string;
  transactionId?: string;
}

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  invoiceId?: string;
};

export type Employee = {
    id?: string;
    employeeNumber?: string;
    fullName: string; 
    nameEn?: string;
    dob?: any;
    gender?: 'male' | 'female';
    civilId: string;
    nationality?: string;
    residencyExpiry?: any;
    contractExpiry?: any;
    mobile: string;
    emergencyContact?: string;
    email?: string;
    jobTitle?: string;
    position?: 'head' | 'employee' | 'assistant' | 'contractor';
    workStartTime?: string; 
    workEndTime?: string; 
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    bankName?: string;
    accountNumber?: string;
    iban?: string;
    profilePicture?: string;
    hireDate: any; 
    noticeStartDate: any | null; 
    terminationDate: any | null;
    terminationReason: 'resignation' | 'termination' | 'probation' | null;
    contractType: 'permanent' | 'temporary' | 'subcontractor' | 'percentage' | 'part-time';
    contractPercentage?: number;
    department: string;
    basicSalary: number; 
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    lastVacationAccrualDate: any; 
    annualLeaveAccrued?: number;
    annualLeaveUsed?: number;
    carriedLeaveDays?: number;
    sickLeaveUsed?: number;
    emergencyLeaveUsed?: number;
    maxEmergencyLeave?: number;
    lastLeaveResetDate?: any; 
    annualLeaveBalance?: number;
    createdAt?: any; 
    auditLogs?: AuditLog[];
    eosb?: number;
    leaveBalance?: number;
    lastLeave?: LeaveRequest | null;
    serviceDuration?: Duration;
};

export interface LeaveRequest {
    id: string;
    employeeId: string;
    employeeName: string;
    leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
    startDate: any;
    endDate: any;
    days: number;
    workingDays?: number;
    notes?: string;
    attachmentUrl?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any;
    approvedBy?: string;
    approvedAt?: any;
    rejectionReason?: string;
    isBackFromLeave?: boolean;
    actualReturnDate?: any;
}


export interface Holiday {
    id?: string;
    name: string;
    date: any; 
}


export type AuditLog = {
    id?: string;
    changeType: 'Creation' | 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'StatusChange' | 'ResidencyUpdate';
    field: string | string[]; 
    oldValue: any;
    newValue: any;
    effectiveDate: any; 
    changedBy: string; 
    notes?: string;
};

export type AttendanceRecord = {
    date: string; 
    checkIn?: string; 
    checkOut?: string; 
    status: 'present' | 'absent' | 'late' | 'leave';
};

export type AttendanceSummary = {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    leaveDays: number;
};

export type MonthlyAttendance = {
    id?: string;
    employeeId: string;
    year: number;
    month: number;
    records: AttendanceRecord[];
    summary: AttendanceSummary;
};

export type Payslip = {
    id?: string;
    employeeId: string;
    employeeName: string;
    year: number;
    month: number;
    attendanceId?: string;
    earnings: {
        basicSalary: number;
        housingAllowance?: number;
        transportAllowance?: number;
        commission?: number;
    };
    deductions: {
        absenceDeduction: number;
        otherDeductions: number;
    };
    netSalary: number;
    salaryPaymentType?: 'cash' | 'cheque' | 'transfer';
    status: 'draft' | 'processed' | 'paid';
    createdAt: any;
};

export interface TransactionStage {
  stageId: string;
  name: string;
  order?: number;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
  startDate: any | null;
  endDate: any | null;
  notes?: string;
  expectedEndDate?: any | null;
  completedCount?: number;
  modificationCount?: number;
  enableModificationTracking?: boolean;
  stageType?: 'sequential' | 'parallel';
  allowedRoles?: string[];
  nextStageIds?: string[];
  allowedDuringStages?: string[];
  trackingType?: 'duration' | 'occurrence' | 'none';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowManualCompletion?: boolean;
}
      
export type ClientTransaction = {
    id?: string;
    transactionNumber?: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    departmentId?: string;
    transactionTypeId?: string;
    assignedEngineerId?: string;
    createdAt: any;
    updatedAt?: any;
    stages?: Partial<TransactionStage>[]; 
    engineerName?: string;
    contract?: {
        clauses: ContractClause[];
        scopeOfWork?: ContractScopeItem[];
        termsAndConditions?: ContractTerm[];
        openClauses?: ContractTerm[];
        totalAmount: number;
        financialsType?: 'fixed' | 'percentage';
    };
};

export type TransactionAssignment = {
    id?: string;
    transactionId: string;
    clientId: string;
    departmentId: string;
    departmentName: string;
    engineerId?: string;
    notes?: string;
    status: 'pending' | 'in-progress' | 'completed';
    createdAt: any;
    createdBy: string;
};


export type TransactionTimelineEvent = {
  id: string;
  type: 'comment' | 'log';
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: any;
};

export interface Department {
    id: string;
    name: string;
    order?: number;
}
export interface Job {
    id: string;
    name: string;
    order?: number;
}
export interface Governorate {
    id: string;
    name: string;
    order?: number;
}
export interface Area {
    id: string;
    name: string;
    order?: number;
}
export interface TransactionType {
    id: string;
    name: string;
    departmentIds?: string[];
    order?: number;
}

export interface WorkStage {
  id: string;
  name: string;
  order?: number;
  stageType?: 'sequential' | 'parallel';
  allowedRoles?: string[];
  nextStageIds?: string[];
  allowedDuringStages?: string[];
  trackingType: 'duration' | 'occurrence' | 'none';
  enableModificationTracking?: boolean;
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowManualCompletion?: boolean;
}

export type ContractClause = {
  id: string;
  name: string;
  amount: number;
  status: 'مدفوعة' | 'مستحقة' | 'غير مستحقة'; 
  percentage?: number;
  condition?: string;
};

export interface ContractTerm {
  id: string;
  text: string;
}

export type ContractTemplate = {
  id?: string;
  title: string;
  description?: string;
  transactionTypes: string[];
  scopeOfWork: ContractScopeItem[];
  termsAndConditions: ContractTerm[];
  financials: {
    type: 'fixed' | 'percentage';
    totalAmount: number;
    discount: number;
    milestones: ContractFinancialMilestone[];
  };
  openClauses?: ContractTerm[];
  createdAt?: any;
  createdBy?: string;
};


export interface ContractScopeItem {
  id: string;
  title: string;
  description: string;
}

export interface ContractFinancialMilestone {
  id: string;
  name: string;
  condition: string;
  value: number;
}

export interface Contract {
  id?: string;
  clientId: string;
  clientName: string;
  companySnapshot: Partial<Company>;
  title: string;
  contractDate: any;
  scopeOfWork: ContractScopeItem[];
  termsAndConditions: ContractTerm[];
  financials: {
    type: 'fixed' | 'percentage';
    totalAmount: number;
    discount: number;
    milestones: ContractFinancialMilestone[];
  };
  openClauses?: ContractTerm[];
  createdAt?: any;
  createdBy?: string;
}

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: any;
}

export interface Account {
    id?: string;
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    statement?: 'Balance Sheet' | 'Income Statement';
    balanceType?: 'Debit' | 'Credit';
    level: number;
    description?: string;
    isPayable: boolean;
    parentCode: string | null;
}

export interface JournalEntryLine {
  id?: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  notes?: string;
  clientId?: string;
  transactionId?: string;
  auto_profit_center?: string;
  auto_resource_id?: string;
  auto_dept_id?: string;
}

export interface JournalEntry {
  id?: string;
  entryNumber: string;
  date: any; 
  narration: string;
  reference?: string;
  linkedReceiptId?: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
  lines: JournalEntryLine[];
  clientId?: string;
  transactionId?: string;
  createdAt: any; 
  createdBy?: string;
}

export interface WorkStageProgress {
  id?: string;
  transactionId?: string;
  visitId: string;
  stageId: string;
  stageName: string;
  selectedBy: string; 
  selectedAt: any; 
}

export interface QuotationItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  condition?: string;
}

export interface Quotation {
  id?: string;
  quotationNumber: string;
  quotationSequence: number;
  quotationYear: number;
  clientId: string;
  clientName: string;
  date: any; 
  validUntil: any; 
  subject: string;
  departmentId?: string;
  transactionTypeId?: string;
  items: QuotationItem[];
  totalAmount: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  createdAt: any; 
  createdBy?: string;
  scopeOfWork?: ContractScopeItem[];
  termsAndConditions?: ContractTerm[];
  openClauses?: ContractTerm[];
  templateDescription?: string;
  transactionId?: string;
}

export interface Vendor {
    id?: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
}

export interface PurchaseOrderItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface PurchaseOrder {
    id?: string;
    poNumber: string;
    orderDate: any;
    vendorId: string;
    vendorName: string;
    projectId?: string;
    items: PurchaseOrderItem[];
    totalAmount: number;
    paymentTerms?: string;
    notes?: string;
    status: 'draft' | 'approved' | 'partially_received' | 'received' | 'cancelled';
}

export interface ResidencyRenewal {
    id?: string;
    employeeId: string;
    renewalDate: any;
    newExpiryDate: any;
    cost: number;
    paymentVoucherId: string;
    monthlyAmortizationAmount: number;
    amortizationStatus: 'in-progress' | 'completed';
    lastAmortizationDate?: any;
}
    

```
- src/lib/utils.ts:
```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'KWD',
  }).format(amount);
}

function tafqeet(n: number, currency: { singular: string, dual: string, plural: string, accusative: string }): string {
    if (n === 0) return '';
    
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convert(num: number): string {
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) {
            const t = Math.floor(num / 10);
            const o = num % 10;
            return (o > 0 ? ones[o] + ' و' : '') + tens[t];
        }
        if (num < 1000) {
            const h = Math.floor(num / 100);
            const rest = num % 100;
            return hundreds[h] + (rest > 0 ? ' و' + convert(rest) : '');
        }
        if (num < 1000000) {
            const th = Math.floor(num / 1000);
            const rest = num % 1000;
            let thText = '';
            if (th === 1) thText = 'ألف';
            else if (th === 2) thText = 'ألفان';
            else if (th >= 3 && th <= 10) thText = convert(th) + ' آلاف';
            else thText = convert(th) + ' ألف';
            return thText + (rest > 0 ? ' و' + convert(rest) : '');
        }
        if (num < 1000000000) {
            const m = Math.floor(num / 1000000);
            const rest = num % 1000000;
            let mText = '';
            if (m === 1) mText = 'مليون';
            else if (m === 2) mText = 'مليونان';
            else if (m >= 3 && m <= 10) mText = convert(m) + ' ملايين';
            else mText = convert(m) + ' مليون';
            return mText + (rest > 0 ? ' و' + convert(rest) : '');
        }
        const b = Math.floor(n / 1000000000);
        const rest = n % 1000000000;
         let bText = '';
        if (b === 1) bText = 'مليار';
        else if (b === 2) bText = 'ملياران';
        else if (b >= 3 && b <= 10) bText = convert(b) + ' مليارات';
        else bText = convert(b) + ' مليار';
        return bText + (rest > 0 ? ' و' + convert(rest) : '');
    }

    function getUnit(num: number) {
        const lastTwo = num % 100;
        if (num === 1) return currency.singular;
        if (num === 2) return currency.dual;
        if (lastTwo >= 3 && lastTwo <= 10) return currency.plural;
        return currency.accusative;
    }
    
    const words = convert(n);
    const unit = getUnit(n);

    return words + ' ' + unit;
}


export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num)) return '';
    if (num === 0) return 'فقط صفر دينار كويتي لا غير';

    const dinars = Math.floor(num);
    const fils = Math.round((num - dinars) * 1000);

    const dinarCurrency = { singular: 'دينار كويتي', dual: 'ديناران كويتيان', plural: 'دنانير كويتية', accusative: 'ديناراً كويتياً' };
    const filsCurrency = { singular: 'فلس', dual: 'فلسان', plural: 'فلوس', accusative: 'فلساً' };

    let result = [];
    if (dinars > 0) {
        result.push(tafqeet(dinars, dinarCurrency));
    }
    if (fils > 0) {
        result.push(tafqeet(fils, filsCurrency));
    }
    
    if (result.length === 0) return '';
    
    return 'فقط ' + result.join(' و') + ' لا غير';
}


export function cleanFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(v => cleanFirestoreData(v));
  }

  // Do not recurse into Date or Timestamp objects
  if (typeof obj !== 'object' || obj instanceof Date || (obj.constructor && obj.constructor.name === 'Timestamp')) {
    return obj;
  }

  const cleaned: { [key: string]: any } = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      cleaned[key] = cleanFirestoreData(obj[key]);
    }
  }
  
  return cleaned;
}

```
- src/services/attendance-processor.ts:
```ts
// This file is intentionally left blank.
// The logic has been moved to the client-side component `src/components/hr/attendance-uploader.tsx`
// to ensure reliable Firebase interaction.

```
- src/services/leave-calculator.ts:
```ts
'use client';
import { differenceInCalendarDays, differenceInMonths, startOfYear } from 'date-fns';
import type { Employee, Holiday } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const KUWAIT_LABOR_LAW_ANNUAL_LEAVE_DAYS = 30;
const WORKING_DAYS_PER_WEEK = 5; // Assuming Friday, Saturday are weekends

const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday or Saturday
};

/**
 * Calculates the number of working days between two dates, excluding weekends and public holidays.
 * @param startDate - The start date of the period.
 * @param endDate - The end date of the period.
 * @param holidays - An array of public holiday dates.
 * @returns The number of working days.
 */
export function calculateWorkingDays(startDate: Date, endDate: Date, holidays: Holiday[]): number {
    let count = 0;
    const currentDate = new Date(startDate.getTime());
    const holidayDates = new Set(holidays.map(h => toFirestoreDate(h.date)?.toDateString()));

    while (currentDate <= endDate) {
        if (!isWeekend(currentDate) && !holidayDates.has(currentDate.toDateString())) {
            count++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
}


/**
 * Calculates the annual leave balance for an employee as of a specific date.
 * Based on Kuwait Labor Law (30 days per year, pro-rated).
 */
export function calculateAnnualLeaveBalance(employee: Partial<Employee>, asOfDate: Date = new Date()): number {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // Use lastLeaveResetDate if available, otherwise use start of the current year.
    const lastResetDate = toFirestoreDate(employee.lastLeaveResetDate) || startOfYear(new Date());

    // Calculate months of service since the last reset.
    let monthsOfService = differenceInMonths(asOfDate, hireDate > lastResetDate ? hireDate : lastResetDate);
    
    // Pro-rated leave earned in the current period.
    let earnedLeaveThisPeriod = (KUWAIT_LABOR_LAW_ANNUAL_LEAVE_DAYS / 12) * monthsOfService;
    
    // Total leave available is carried over leave + leave earned this period.
    const totalAvailable = (employee.carriedLeaveDays || 0) + earnedLeaveThisPeriod;
    
    // Subtract used leave.
    const currentBalance = totalAvailable - (employee.annualLeaveUsed || 0);

    return Math.floor(currentBalance); // Return whole days.
}


/**
 * Calculates the end-of-service gratuity for an employee based on Kuwait Labor Law.
 * THIS IS A SIMPLIFIED CALCULATION. CONSULT A LEGAL PROFESSIONAL FOR ACCURATE FIGURES.
 */
export function calculateGratuity(employee: Partial<Employee>, terminationDate: Date): { gratuity: number, leaveBalancePayout: number, total: number, serviceDuration: any } {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate || !employee.basicSalary) {
        return { gratuity: 0, leaveBalancePayout: 0, total: 0, serviceDuration: {} };
    }

    const serviceInDays = differenceInCalendarDays(terminationDate, hireDate);
    const serviceInYears = serviceInDays / 365.25;
    
    let gratuity = 0;
    
    if (employee.contractType === 'permanent' && employee.terminationReason === 'resignation') {
        // Rules for resignation under permanent contract
        if (serviceInYears >= 3 && serviceInYears < 5) {
            gratuity = (15 * serviceInDays / 365.25) * (employee.basicSalary / 26) / 2; // Half gratuity
        } else if (serviceInYears >= 5 && serviceInYears < 10) {
            gratuity = (15 * serviceInDays / 365.25) * (employee.basicSalary / 26) * (2/3); // Two-thirds
        } else if (serviceInYears >= 10) {
            gratuity = (15 * serviceInDays / 365.25) * (employee.basicSalary / 26); // Full gratuity
        }
    } else { // Termination by company or fixed-term contract completion
        if (serviceInYears <= 5) {
            gratuity = (15 * serviceInDays / 365.25) * (employee.basicSalary / 26);
        } else {
            const firstFiveYearsGratuity = (15 * 5) * (employee.basicSalary / 26);
            const remainingDays = serviceInDays - (5 * 365.25);
            const remainingYearsGratuity = (22.5 * remainingDays / 365.25) * (employee.basicSalary / 26);
            gratuity = firstFiveYearsGratuity + remainingYearsGratuity;
        }
    }

    const leaveBalance = employee.annualLeaveBalance || 0;
    const dailyWage = employee.basicSalary / 26;
    const leaveBalancePayout = leaveBalance * dailyWage;

    return {
        gratuity: isNaN(gratuity) ? 0 : gratuity,
        leaveBalancePayout: isNaN(leaveBalancePayout) ? 0 : leaveBalancePayout,
        total: isNaN(gratuity + leaveBalancePayout) ? 0 : gratuity + leaveBalancePayout,
        serviceDuration: { years: Math.floor(serviceInYears), days: Math.floor(serviceInDays % 365.25) }
    };
}

```
- src/services/notification-service.ts:
```ts
'use client';

import { collection, addDoc, serverTimestamp, query, where, getDocs, type Firestore } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';

interface NotificationData {
    userId: string;
    title: string;
    body: string;
    link: string;
}

/**
 * Creates a notification for a specific user.
 */
export async function createNotification(db: Firestore, data: NotificationData) {
    try {
        await addDoc(collection(db, 'notifications'), {
            ...data,
            isRead: false,
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
        // We don't want to throw an error here, as notification failure shouldn't block the main action.
    }
}

/**
 * Finds a user's document ID based on their employee ID.
 * @returns The user's Firestore document ID or null if not found.
 */
export async function findUserIdByEmployeeId(db: Firestore, employeeId: string): Promise<string | null> {
    if (!employeeId) return null;

    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('employeeId', '==', employeeId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].id; // Return the Firestore document ID
        }
        return null;
    } catch (error) {
        console.error("Failed to find user by employeeId:", error);
        return null;
    }
}
    
```
- src/services/payroll-processor.ts:
```ts
// This file is intentionally left blank.
// The logic has been moved to the client-side component `src/components/hr/payroll-generator.tsx`
// to ensure reliable Firebase interaction.

```
- src/services/report-generator.ts:
```ts

'use server';

import { 
    collection, getDocs, getDoc, doc, query, where, orderBy, limit, type Firestore 
} from 'firebase/firestore';
import { parseISO, isValid } from 'date-fns';
import { toFirestoreDate } from './date-converter';
import { calculateAnnualLeaveBalance } from './leave-calculator';

export type ReportType = 'EmployeeDossier' | 'EmployeeRoster';

function safeValue(val: any): any {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') {
        const date = toFirestoreDate(val);
        if (date) return date.toISOString();
        try {
            // Attempt to stringify, but fall back if it fails (e.g., circular)
            return JSON.stringify(val);
        } catch {
            return '[Complex Data]';
        }
    }
    return val;
}

function mapSafeEmployee(id: string, data: any): any {
    return {
        id: id,
        fullName: data.fullName || '',
        nameEn: data.nameEn || '',
        employeeNumber: data.employeeNumber || '',
        department: data.department || '',
        jobTitle: data.jobTitle || '',
        status: data.status || 'active',
        basicSalary: Number(data.basicSalary) || 0,
        housingAllowance: Number(data.housingAllowance) || 0,
        transportAllowance: Number(data.transportAllowance) || 0,
        
        hireDate: toFirestoreDate(data.hireDate)?.toISOString() || null,
        contractExpiry: toFirestoreDate(data.contractExpiry)?.toISOString() || null,
        residencyExpiry: toFirestoreDate(data.residencyExpiry)?.toISOString() || null,
        dob: toFirestoreDate(data.dob)?.toISOString() || null,
        
        annualLeaveUsed: Number(data.annualLeaveUsed) || 0,
        carriedLeaveDays: Number(data.carriedLeaveDays) || 0,
    };
}

async function reconstructEmployeeState(db: Firestore, employeeId: string, asOfDate: Date) {
    const [empSnap, auditLogsSnap] = await Promise.all([
        getDoc(doc(db, 'employees', employeeId)),
        getDocs(query(collection(db, `employees/${employeeId}/auditLogs`), orderBy('effectiveDate', 'desc'), limit(100)))
    ]);

    if (!empSnap.exists()) return null;

    const currentData = empSnap.data();
    
    const auditLogs = auditLogsSnap.docs.map(d => {
        const logData = d.data();
        return {
            id: d.id,
            field: logData.field || '',
            oldValue: safeValue(logData.oldValue), 
            newValue: safeValue(logData.newValue),
            effectiveDate: toFirestoreDate(logData.effectiveDate)?.toISOString() || null,
        };
    });

    let state: any = mapSafeEmployee(empSnap.id, currentData);

    for (const log of auditLogs) {
        const logDate = log.effectiveDate ? new Date(log.effectiveDate) : null;
        
        if (logDate && logDate > asOfDate) {
            const fieldName = log.field;
            if (fieldName && Object.prototype.hasOwnProperty.call(state, fieldName)) {
                state[fieldName] = log.oldValue; 
            }
        }
    }

    return { ...state, auditLogs }; 
}

export async function generateReport(db: Firestore, reportType: ReportType, options: any) {
    try {
        const asOfDate = parseISO(options.asOfDate);
        if (!isValid(asOfDate)) throw new Error("التاريخ غير صالح");

        let result: any = {};

        if (reportType === 'EmployeeDossier') {
            if (!options.employeeId) throw new Error("مطلوب تحديد الموظف");

            if (options.employeeId !== 'all') {
                const emp = await reconstructEmployeeState(db, options.employeeId, asOfDate);
                if (!emp) throw new Error("الموظف غير موجود");

                let leaveBalance = 0;
                try {
                    const tempHireDate = emp.hireDate ? new Date(emp.hireDate) : null;
                    leaveBalance = calculateAnnualLeaveBalance({ ...emp, hireDate: tempHireDate }, asOfDate);
                } catch { leaveBalance = 0; }

                result = {
                    type: 'EmployeeDossier',
                    employee: { ...emp, leaveBalance }
                };
            } else {
                const q = query(collection(db, 'employees'), where('status', '==', 'active'), limit(20));
                const snap = await getDocs(q);
                const dossiers = [];
                
                for (const d of snap.docs) {
                    try {
                        const emp = await reconstructEmployeeState(db, d.id, asOfDate);
                        if (emp) {
                             const tempHireDate = emp.hireDate ? new Date(emp.hireDate) : null;
                             const lb = calculateAnnualLeaveBalance({ ...emp, hireDate: tempHireDate }, asOfDate);
                             dossiers.push({ ...emp, leaveBalance: lb });
                        }
                    } catch (innerErr) {
                        console.error(`Error processing doc ${d.id}`, innerErr);
                    }
                }
                result = { type: 'BulkEmployeeDossiers', dossiers };
            }
        } 
        
        return result; 

    } catch (error: any) {
        console.error("REPORT ERROR:", error);
        throw new Error(error.message || "حدث خطأ غير متوقع في السيرفر");
    }
}
    
```
- .env:
```

```
- README.md:
```md
# Firebase Studio
whoami
This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

```