'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Loader2, AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, writeBatch, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client, Governorate } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { format, setHours, setMinutes, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';

// (The self-contained helper functions like weekDays and generateTimeSlots remain unchanged)
const weekDays = [
    { id: 'Sunday', label: 'الأحد' }, { id: 'Monday', label: 'الاثنين' }, { id: 'Tuesday', label: 'الثلاثاء' }, 
    { id: 'Wednesday', label: 'الأربعاء' }, { id: 'Thursday', label: 'الخميس' }, { id: 'Friday', label: 'الجمعة' }, { id: 'Saturday', label: 'السبت' }
];
const generateTimeSlots = (s:string|undefined, e:string|undefined, dur:number, buf:number):string[] => {
    if (!s || !e || !dur || dur <= 0) return [];
    const slots: string[] = [];
    try {
        const st = parse(s, 'HH:mm', new Date());
        const et = parse(e, 'HH:mm', new Date());
        if (!isValid(st) || !isValid(et) || st >= et) return [];
        let cur = st;
        while (cur < et) {
            const end = new Date(cur.getTime() + dur * 60000);
            if (end > et) break;
            slots.push(format(cur, 'HH:mm'));
            cur = new Date(end.getTime() + buf * 60000);
        }
    } catch (err) { console.error(err); }
    return slots;
};

export default function NewArchitecturalAppointmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding } = useBranding();
    const { toast } = useToast();
    
    // State Declarations
    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [governorates, setGovernorates] = useState<Governorate[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [clientId, setClientId] = useState('');
    const [engineerId, setEngineerId] = useState('');
    const [title, setTitle] = useState('زيارة للمكتب'); // Default title
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState<Date | undefined>();
    const [time, setTime] = useState('');
    
    const [isNewClient, setIsNewClient] = useState(true);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');
    const [newClientCity, setNewClientCity] = useState(''); // NEW: State for city

    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
    
    const tenantId = currentUser?.currentCompanyId;

    // Initial data from URL
    useEffect(() => {
        const name = searchParams.get('nameAr') || '';
        const mobile = searchParams.get('mobile') || '';
        const engId = searchParams.get('engineerId') || '';
        const cId = searchParams.get('clientId') || '';
        const leadId = searchParams.get('leadId') || '';
        
        if (leadId) {
             // This will be handled later when we have a leads list to link from
        } else if (cId) {
            setClientId(cId);
            setIsNewClient(false);
        } else {
            setIsNewClient(true);
            setNewClientName(name);
            setNewClientMobile(mobile);
        }

        if(engId) setEngineerId(engId);
    }, [searchParams]);

    // Data fetching for dropdowns
    useEffect(() => {
        if (!firestore || !tenantId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const clientPath = getTenantPath('clients', tenantId)!;
                const empPath = getTenantPath('employees', tenantId)!;
                const govPath = getTenantPath('governorates', tenantId)!; // Path for governorates

                const [clientSnap, engSnap, govSnap] = await Promise.all([
                     getDocs(query(collection(firestore, clientPath), where('isActive', '==', true))),
                     getDocs(query(collection(firestore, empPath), where('status', '==', 'active'))),
                     getDocs(query(collection(firestore, govPath), where('status', '==', 'active'))), // Fetch governorates
                ]);

                setClients(clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)).sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar')));
                setEngineers(engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee)).filter(e => e.department?.includes('المعماري')));
                setGovernorates(govSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Governorate))); // Set governorates

            } catch (error) { console.error("Error fetching data: ", error); } 
            finally { setLoading(false); }
        };
        fetchData();
    }, [firestore, tenantId]);
    
    // (Schedule fetching and availableSlots logic remain unchanged)
    useEffect(() => {
        if (engineerId && date) {
            const fetchSchedule = async () => {
                if (!firestore || !tenantId) return;
                setIsLoadingSchedule(true);
                try {
                    const apptsPath = getTenantPath('appointments', tenantId)!;
                    const q = query(collection(firestore, apptsPath), where('engineerId', '==', engineerId), where('appointmentDate', '>=', startOfDay(date)), where('appointmentDate', '<=', endOfDay(date)), where('status', '!=', 'cancelled'));
                    const querySnapshot = await getDocs(q);
                    setBookedSlots(querySnapshot.docs.map(d => format(d.data().appointmentDate.toDate(), 'HH:mm')));
                } catch (err) { console.error(err); setBookedSlots([]); } finally {
                    setIsLoadingSchedule(false);
                }
            };
            fetchSchedule();
        } else { setBookedSlots([]); }
        setTime('');
    }, [date, engineerId, firestore, tenantId]);

    const availableSlots = useMemo(() => {
        if (!date || !branding?.work_hours?.architectural) return [];
        const wh = branding.work_hours.architectural;
        const duration = wh.appointment_slot_duration || 45;
        const buffer = wh.appointment_buffer_time || 0;
        const today = weekDays[date.getDay()].id;
        if (branding.work_hours.holidays?.includes(today)) return [];
        const { morning_start_time: ms, morning_end_time: me, evening_start_time: es, evening_end_time: ee } = wh;
        return [...generateTimeSlots(ms, me, duration, buffer), ...generateTimeSlots(es, ee, duration, buffer)].filter(slot => !bookedSlots.includes(slot));
    }, [date, branding, bookedSlots]);


    // THE NEW SUBMIT HANDLER
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firestore || !currentUser || !tenantId || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }
        if (isNewClient && (!newClientName || !newClientMobile || !newClientCity)) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال اسم العميل الجديد وجواله ومدينته.' }); return; 
        }
        if (!isNewClient && !clientId) { toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار عميل مسجل.' }); return; }

        setIsSaving(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const [hours, minutes] = time.split(':').map(Number);
                const appointmentDateTime = setHours(setMinutes(date, minutes), hours);

                let leadId: string | null = null;
                let finalClientName = '';
                let finalClientMobile = '';

                // Logic for New Client: Create a lead, then create an appointment
                if (isNewClient) {
                    const leadsCounterRef = doc(firestore, getTenantPath('counters/leads', tenantId));
                    const leadsCounterDoc = await transaction.get(leadsCounterRef);
                    const newLeadNumber = (leadsCounterDoc.data()?.count || 0) + 1;
                    transaction.set(leadsCounterRef, { count: newLeadNumber });

                    const newLeadRef = doc(collection(firestore, getTenantPath('leads', tenantId)));
                    
                    transaction.set(newLeadRef, {
                        leadNumber: newLeadNumber,
                        name: newClientName,
                        mobile: newClientMobile,
                        city: newClientCity,
                        engineerId: engineerId,
                        status: 'active',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        companyId: tenantId,
                    });

                    leadId = newLeadRef.id;
                    finalClientName = newClientName;
                    finalClientMobile = newClientMobile;

                } else {
                    // Logic for existing client remains the same
                    const client = clients.find(c => c.id === clientId);
                    finalClientName = client?.nameAr || '';
                    finalClientMobile = client?.mobile || '';
                }

                // Create the appointment document
                const newAppointmentData: any = {
                    engineerId,
                    engineerName: engineers.find(e => e.id === engineerId)?.fullName,
                    title, notes,
                    appointmentDate: Timestamp.fromDate(appointmentDateTime),
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    createdByName: currentUser.fullName,
                    type: 'architectural',
                    status: 'scheduled',
                    companyId: tenantId,
                    clientName: finalClientName, // Storing name for quick display
                    clientMobile: finalClientMobile // Storing mobile for quick display
                };

                if(isNewClient && leadId) {
                    newAppointmentData.leadId = leadId;
                } else if (!isNewClient && clientId) {
                    newAppointmentData.clientId = clientId;
                }

                const newApptRef = doc(collection(firestore, getTenantPath('appointments', tenantId)));
                transaction.set(newApptRef, cleanFirestoreData(newAppointmentData));
                
                 // Create notification after transaction is defined
                 const targetUserId = await findUserIdByEmployeeId(firestore, engineerId, tenantId);
                 if (targetUserId) {
                     await createNotification(firestore, {
                         userId: targetUserId, 
                         title: '🗓️ موعد جديد مجدول لك',
                         body: `تم تحديد موعد لك مع العميل ${finalClientName} يوم ${format(date, 'PPP', { locale: ar })} الساعة ${time}.`,
                         link: `/dashboard/appointments/${newApptRef.id}`
                    }, tenantId);
                 }
            });

            toast({ title: 'نجاح', description: 'تم حجز الموعد وتسجيل العميل الجديد بنجاح.' });
            router.push('/dashboard/appointments');

        } catch (error: any) {
            console.error("Error in transaction: ", error);
            toast({ variant: 'destructive', title: 'فشل العملية', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.nameAr, searchKey: c.fileNumber })), [clients]);
    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber })), [engineers]);

    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">حجز موعد معماري جديد</CardTitle>
                    <CardDescription>جدولة زيارة المالك للمكتب مع المهندس المختص.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    {/* Unchanged fields like title, engineerId */}
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="font-black">عنوان الموعد / الغرض *</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مناقشة مخططات القسيمة..." required className="h-12 rounded-xl" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="engineerId" className="font-black">المهندس المسؤول *</Label>
                             <InlineSearchList value={engineerId} onSelect={setEngineerId} options={engineerOptions} placeholder="اختر المهندس..." disabled={loading} />
                        </div>
                        <div className="flex items-center space-x-2 self-end mb-2">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(c) => setIsNewClient(c as boolean)} />
                            <Label htmlFor="isNewClient" className="font-bold cursor-pointer">عميل جديد (غير مسجل)</Label>
                        </div>
                    </div>
                    
                    {/* THE MODIFIED NEW/EXISTING CLIENT SECTION */}
                    {isNewClient ? (
                        <div className="p-4 border border-dashed rounded-xl space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label className="font-bold text-xs">اسم العميل الجديد *</Label>
                                    <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} required className="h-11" />
                                </div>
                                <div className="grid gap-2">
                                    <Label className="font-bold text-xs">رقم الجوال *</Label>
                                    <Input value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} dir="ltr" required className="h-11" />
                                </div>
                            </div>
                             <div className="grid gap-2">
                                <Label className="font-bold text-xs">المدينة / المحافظة *</Label>
                                 <Select onValueChange={setNewClientCity} value={newClientCity} required>
                                     <SelectTrigger className="h-11 rounded-xl">
                                         <SelectValue placeholder={loading ? 'تحميل...' : 'اختر مدينة العميل...'} />
                                     </SelectTrigger>
                                     <SelectContent>
                                         {governorates.map(gov => (
                                             <SelectItem key={gov.id} value={gov.name}>{gov.name}</SelectItem>
                                         ))}
                                     </SelectContent>
                                 </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-2 animate-in fade-in">
                            <Label className="font-black">العميل المسجل *</Label>
                            <InlineSearchList value={clientId} onSelect={setClientId} options={clientOptions} placeholder={loading ? "جار تحميل العملاء..." : "اختر العميل..."} disabled={loading}/>
                        </div>
                    )}

                    {/* (Date, Time and other fields remain unchanged) */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2"><Label className="font-black">التاريخ *</Label><DateInput value={date} onChange={setDate} required /></div>
                        <div className="grid gap-2">
                            <Label className="font-black">الوقت *</Label>
                            <Select onValueChange={setTime} value={time} required disabled={!date || !engineerId || isLoadingSchedule}>
                                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={isLoadingSchedule ? 'تحميل...':'اختر الوقت'}/></SelectTrigger>
                                <SelectContent>{availableSlots.length > 0 ? availableSlots.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>) : <div className="p-4 text-center text-red-500">لا توجد أوقات.</div>}</SelectContent>
                            </Select>
                        </div>
                    </div>
                     {date && engineerId && !isLoadingSchedule && availableSlots.length === 0 && <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-5 w-5" /><p className="text-sm font-bold">جميع أوقات المهندس محجوزة.</p></div>}
                    <div className="grid gap-2"><Label className="font-bold">ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}/></div>

                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || isLoadingSchedule} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الحجز'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
