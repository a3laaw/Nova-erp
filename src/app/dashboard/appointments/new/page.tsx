'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Loader2, AlertCircle } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useBranding } from '@/context/branding-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { format, setHours, setMinutes, startOfDay, endOfDay, parse, isValid } from 'date-fns';
import { ar } from 'date-fns/locale';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';

// SELF-CONTAINED HELPERS (SAFE)
const weekDays = [
    { id: 'Sunday', label: 'الأحد' }, 
    { id: 'Monday', label: 'الاثنين' }, 
    { id: 'Tuesday', label: 'الثلاثاء' }, 
    { id: 'Wednesday', label: 'الأربعاء' }, 
    { id: 'Thursday', label: 'الخميس' }, 
    { id: 'Friday', label: 'الجمعة' }, 
    { id: 'Saturday', label: 'السبت' }
];

const generateTimeSlots = (s: string | undefined, e: string | undefined, dur: number, buf: number): string[] => {
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
  } catch (err) {
      console.error("Error generating time slots:", err);
  }
  return slots;
};

export default function NewArchitecturalAppointmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding } = useBranding();
    const { toast } = useToast();
    
    const [clients, setClients] = useState<Client[]>([]);
    const [engineers, setEngineers] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [clientId, setClientId] = useState('');
    const [engineerId, setEngineerId] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState<Date | undefined>();
    const [time, setTime] = useState('');
    
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientMobile, setNewClientMobile] = useState('');

    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
    
    const tenantId = currentUser?.currentCompanyId;

    useEffect(() => {
        const nameFromUrl = searchParams.get('nameAr');
        const mobileFromUrl = searchParams.get('mobile');
        const engineerFromUrl = searchParams.get('engineerId');
        const clientIdFromUrl = searchParams.get('clientId');

        if (clientIdFromUrl) {
            setClientId(clientIdFromUrl);
            setIsNewClient(false);
        } else if (nameFromUrl || mobileFromUrl) {
            setIsNewClient(true);
            setNewClientName(nameFromUrl || '');
            setNewClientMobile(mobileFromUrl || '');
        }

        if(engineerFromUrl) {
            setEngineerId(engineerFromUrl);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!firestore || !tenantId) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const clientPath = getTenantPath('clients', tenantId)!;
                const empPath = getTenantPath('employees', tenantId)!;

                const clientQuery = query(collection(firestore, clientPath), where('isActive', '==', true));
                const engQuery = query(collection(firestore, empPath), where('status', '==', 'active'));

                const [clientSnap, engSnap] = await Promise.all([ getDocs(clientQuery), getDocs(engQuery) ]);

                const fetchedClients: Client[] = clientSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Client))
                    .filter(c => c && c.nameAr).sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
                setClients(fetchedClients);
                
                const allEmployees = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee));
                const architecturalEngineers = allEmployees.filter(emp => 
                    emp.department?.includes('المعماري') &&
                    (emp.jobTitle?.includes('مهندس') || emp.jobTitle?.toLowerCase().includes('architect'))
                );
                setEngineers(architecturalEngineers);

            } catch (error) {
                console.error("Error fetching data: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, tenantId]);

    const filteredClients = useMemo(() => {
        if (!engineerId) {
            return clients;
        }
        return clients.filter(c => !c.assignedEngineer || c.assignedEngineer === engineerId);
    }, [clients, engineerId]);
    
    const clientOptions = useMemo(() => filteredClients.map(c => ({ value: c.id!, label: c.nameAr, searchKey: c.fileId })), [filteredClients]);
    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber })), [engineers]);
    
     useEffect(() => {
        if (engineerId && date) {
            const fetchSchedule = async () => {
                if (!firestore || !tenantId) return;
                setIsLoadingSchedule(true);
                try {
                    const apptsPath = getTenantPath('appointments', tenantId)!;
                    const dayStart = startOfDay(date);
                    const dayEnd = endOfDay(date);

                    const appointmentsRef = collection(firestore, apptsPath);
                    const q = query(appointmentsRef, where('engineerId', '==', engineerId), where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd), where('status', '!=', 'cancelled'));
                    const querySnapshot = await getDocs(q);
                    const dailyBookedSlots = querySnapshot.docs.map(d => format(d.data().appointmentDate.toDate(), 'HH:mm'));
                    setBookedSlots(dailyBookedSlots);
                } catch (err) { console.error(err); setBookedSlots([]); } finally {
                    setIsLoadingSchedule(false);
                }
            };
            fetchSchedule();
        } else {
            setBookedSlots([]);
        }
        setTime('');
    }, [date, engineerId, firestore, tenantId]);

    const availableSlots = useMemo(() => {
        if (!date || !branding?.work_hours?.architectural) return [];
        
        const wh = branding.work_hours.architectural;
        const duration = wh.appointment_slot_duration || 45;
        const buffer = wh.appointment_buffer_time || 0;
        const today = weekDays[date.getDay()].id;

        if (branding.work_hours.holidays?.includes(today)) return [];
        
        const halfDay = branding.work_hours.half_day;
        const isHalfDay = halfDay?.day === today;
        
        let { morning_start_time: ms, morning_end_time: me, evening_start_time: es, evening_end_time: ee } = wh;
        
        if (isHalfDay) {
            if (halfDay.type === 'morning_only') { es = ''; ee = ''; }
            else if (halfDay.type === 'custom_end_time' && halfDay.end_time) {
                if (halfDay.end_time <= me) { me = halfDay.end_time; es = ''; ee = ''; }
                else { ee = halfDay.end_time < ee ? halfDay.end_time : ee; }
            }
        }

        const morning = generateTimeSlots(ms, me, duration, buffer);
        const evening = generateTimeSlots(es, ee, duration, buffer);

        return [...morning, ...evening].filter(slot => !bookedSlots.includes(slot));
    }, [date, branding, bookedSlots]);

    useEffect(() => {
        if (!isNewClient && clientId && filteredClients.length > 0 && !filteredClients.some(c => c.id === clientId)) {
            setClientId('');
        }
    }, [filteredClients, clientId, isNewClient]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firestore || !currentUser || !tenantId || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }
        if (isNewClient && (!newClientName || !newClientMobile)) { toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء إدخال اسم العميل الجديد ورقم جواله.' }); return; }
        if (!isNewClient && !clientId) { toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار عميل مسجل.' }); return; }

        setIsSaving(true);
        try {
            const [hours, minutes] = time.split(':').map(Number);
            const appointmentDateTime = setHours(setMinutes(date, minutes), hours);

            const apptsPath = getTenantPath('appointments', tenantId)!;
            const dayStart = startOfDay(date);
            const dayEnd = endOfDay(date);
            const apptsQuery = query(collection(firestore, apptsPath), where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd), where('status', '!=', 'cancelled'));
            const apptsSnapshot = await getDocs(apptsQuery);
            const allDayAppointments = apptsSnapshot.docs.map(d => d.data());

            const slotDur = branding?.work_hours?.architectural?.appointment_slot_duration || 45;
            const newApptEnd = new Date(appointmentDateTime.getTime() + slotDur * 60000);

            let conflict = null;
            for (const appt of allDayAppointments) {
                const isSameClient = isNewClient ? (appt.clientMobile === newClientMobile) : (appt.clientId === clientId);
                if (!isSameClient) continue;

                const existingApptStart = appt.appointmentDate.toDate();
                const existingApptEnd = new Date(existingApptStart.getTime() + slotDur * 60000);

                if (appointmentDateTime < existingApptEnd && newApptEnd > existingApptStart) {
                    conflict = appt;
                    break;
                }
            }

            if (conflict) {
                const conflictTime = format(conflict.appointmentDate.toDate(), 'HH:mm');
                toast({
                    variant: 'destructive',
                    title: '⛔️ تعارض في مواعيد العميل',
                    description: `هذا العميل لديه موعد آخر محجوز في هذا اليوم الساعة ${conflictTime} مع المهندس ${conflict.engineerName}.`,
                    duration: 7000,
                });
                setIsSaving(false);
                return;
            }

            const batch = writeBatch(firestore);
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
                companyId: tenantId
            };
            
            if(isNewClient) {
                newAppointmentData.clientName = newClientName;
                newAppointmentData.clientMobile = newClientMobile;
            } else {
                const client = clients.find(c => c.id === clientId);
                newAppointmentData.clientId = clientId;
                newAppointmentData.clientName = client?.nameAr;
                newAppointmentData.clientMobile = client?.mobile;
            }

            const newApptRef = doc(collection(firestore, apptsPath));
            batch.set(newApptRef, cleanFirestoreData(newAppointmentData));
            
            await batch.commit();

            const targetUserId = await findUserIdByEmployeeId(firestore, engineerId, tenantId);
            if (targetUserId) {
                await createNotification(firestore, {
                    userId: targetUserId,
                    title: '🗓️ موعد جديد مجدول لك',
                    body: `تم تحديد موعد لك مع العميل ${isNewClient ? newClientName : clients.find(c => c.id === clientId)?.nameAr} يوم ${format(date, 'PPP', { locale: ar })} الساعة ${time}.`,
                    link: `/dashboard/appointments/${newApptRef.id}`
                }, tenantId);
            }

            toast({ title: 'نجاح', description: 'تم حجز الموعد وإخطار المهندس المعني.' });
            router.push('/dashboard/appointments');

        } catch (error: any) {
            console.error("Error saving appointment: ", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto rounded-[2.5rem] border-none shadow-2xl" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader className="bg-primary/5 pb-8 border-b">
                    <CardTitle className="text-2xl font-black">حجز موعد معماري جديد</CardTitle>
                    <CardDescription>جدولة زيارة المالك للمكتب مع المهندس المختص.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="font-black">عنوان الموعد / الغرض *</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: مناقشة مخططات القسيمة..." required className="h-12 rounded-xl" />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="engineerId" className="font-black">المهندس المسؤول *</Label>
                             <InlineSearchList
                                value={engineerId}
                                onSelect={setEngineerId}
                                options={engineerOptions}
                                placeholder="اختر المهندس..."
                                disabled={loading}
                             />
                        </div>
                        <div className="flex items-center space-x-2 self-end mb-2">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(checked) => setIsNewClient(checked as boolean)} />
                            <Label htmlFor="isNewClient" className="font-bold cursor-pointer">عميل جديد (غير مسجل)</Label>
                        </div>
                    </div>
                    
                    {isNewClient ? (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs">اسم العميل *</Label>
                                <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} required className="h-11" />
                            </div>
                            <div className="grid gap-2">
                                <Label className="font-bold text-xs">رقم الجوال *</Label>
                                <Input value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} dir="ltr" required className="h-11" />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-2 animate-in fade-in">
                            <Label className="font-black">العميل المسجل *</Label>
                            <InlineSearchList
                                value={clientId}
                                onSelect={setClientId}
                                options={clientOptions}
                                placeholder={loading ? "جار تحميل العملاء..." : "اختر العميل..."}
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="font-black">التاريخ *</Label>
                            <DateInput value={date} onChange={setDate} required />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-black">الوقت *</Label>
                            <Select onValueChange={setTime} value={time} required disabled={!date || !engineerId || isLoadingSchedule}>
                                <SelectTrigger className="h-11 rounded-xl">
                                    <SelectValue placeholder={isLoadingSchedule ? 'جارٍ تحميل الأوقات...' : !engineerId ? 'اختر المهندس أولاً' : 'اختر الوقت المتاح'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {isLoadingSchedule ? (
                                        <div className="p-4 text-center">جارٍ التحميل...</div>
                                    ) : availableSlots.length > 0 ? (
                                        availableSlots.map(slot => (
                                            <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-red-500">لا توجد أوقات متاحة في هذا اليوم.</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                     {date && engineerId && !isLoadingSchedule && availableSlots.length === 0 && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                           <AlertCircle className="h-5 w-5" />
                           <p className="text-sm font-bold">جميع أوقات المهندس في هذا اليوم محجوزة أو خارج أوقات الدوام الرسمي. الرجاء اختيار يوم آخر.</p>
                        </div>
                    )}

                    <div className="grid gap-2">
                        <Label className="font-bold">ملاحظات إضافية</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-2xl" />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button type="submit" disabled={isSaving || isLoadingSchedule || (availableSlots.length === 0 && !!date && !!engineerId)} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الحجز'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
