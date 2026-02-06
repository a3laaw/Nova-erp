'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, Timestamp, updateDoc, doc, deleteField, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';

export default function NewArchitecturalAppointmentPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
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

    const [dailySchedule, setDailySchedule] = useState<{ time: string; title: string; type: 'client' | 'engineer' }[]>([]);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
    
    // Pre-fill from URL
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
        if (!firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const clientQuery = query(collection(firestore, 'clients'), where('isActive', '==', true));
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));

                const [clientSnap, engSnap] = await Promise.all([
                    getDocs(clientQuery),
                    getDocs(engQuery)
                ]);

                const fetchedClients: Client[] = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
                setClients(fetchedClients);
                
                const allEmployees = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee));
                const architecturalEngineers = allEmployees.filter(emp => 
                    emp.department?.includes('المعماري') &&
                    (emp.jobTitle?.includes('مهندس') || emp.jobTitle?.toLowerCase().includes('architect'))
                );
                setEngineers(architecturalEngineers);

            } catch (error) {
                console.error("Error fetching data: ", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العملاء والمهندسين.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, toast]);
    
    const filteredClients = useMemo(() => {
        if (!engineerId) {
            return [];
        }
        return clients.filter(c => !c.assignedEngineer || c.assignedEngineer === engineerId);
    }, [clients, engineerId]);
    
    const clientOptions = useMemo(() => filteredClients.map(c => ({ value: c.id, label: c.nameAr, searchKey: c.fileId })), [filteredClients]);
    const engineerOptions = useMemo(() => engineers.map(e => ({ value: e.id!, label: e.fullName, searchKey: e.employeeNumber })), [engineers]);
    
    useEffect(() => {
        if (!isNewClient && clientId && filteredClients.length > 0 && !filteredClients.some(c => c.id === clientId)) {
            setClientId('');
        }
    }, [filteredClients, clientId, isNewClient]);
    
    useEffect(() => {
        const fetchSchedule = async () => {
            const checkClientId = isNewClient ? null : clientId;
            if (!date || (!checkClientId && !engineerId) || !firestore) {
                setDailySchedule([]);
                return;
            }

            setIsLoadingSchedule(true);
            
            try {
                const appointmentDate = date;

                const dayStart = new Date(appointmentDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(appointmentDate);
                dayEnd.setHours(23, 59, 59, 999);

                const appointmentsRef = collection(firestore, 'appointments');
                const q = query(appointmentsRef, where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
                const querySnapshot = await getDocs(q);

                const dailyAppointments = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));

                const bookedSlots: { time: string; title: string; type: 'client' | 'engineer' }[] = [];
                const processedApptIds = new Set<string>();

                // Filter for engineer
                if (engineerId) {
                    dailyAppointments.forEach(appt => {
                        if (appt.engineerId === engineerId) {
                             bookedSlots.push({
                                time: format(appt.appointmentDate.toDate(), 'HH:mm'),
                                title: appt.title,
                                type: 'engineer',
                            });
                            processedApptIds.add(appt.id);
                        }
                    });
                }

                // Filter for client
                if (checkClientId) {
                    dailyAppointments.forEach(appt => {
                        if (appt.clientId === checkClientId && !processedApptIds.has(appt.id)) {
                             bookedSlots.push({
                                time: format(appt.appointmentDate.toDate(), 'HH:mm'),
                                title: appt.title,
                                type: 'client',
                            });
                        }
                    });
                }

                bookedSlots.sort((a, b) => a.time.localeCompare(b.time));
                setDailySchedule(bookedSlots);
            } catch (err) {
                console.error("Error fetching daily schedule:", err);
            } finally {
                setIsLoadingSchedule(false);
            }
        };

        fetchSchedule();
    }, [date, clientId, engineerId, isNewClient, firestore]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firestore || !currentUser || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }

        if (isNewClient && (!newClientName || !newClientMobile)) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة اسم وجوال العميل الجديد.' });
            return;
        }
        
        if (!isNewClient && !clientId) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار عميل مسجل.' });
            return;
        }

        setIsSaving(true);
        try {
            const [hours, minutes] = time.split(':').map(Number);
            const appointmentDateTime = new Date(date);
            appointmentDateTime.setHours(hours, minutes, 0, 0);

            if (isNewClient) {
                const clientsRef = collection(firestore, 'clients');
                const q = query(clientsRef, where('mobile', '==', newClientMobile));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    throw new Error(`رقم الجوال هذا مسجل بالفعل للعميل: ${querySnapshot.docs[0].data().nameAr}.`);
                }
            }
            
            // --- Conflict Validation ---
            const appointmentsRef = collection(firestore, 'appointments');
            const dayStart = new Date(appointmentDateTime); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(appointmentDateTime); dayEnd.setHours(23, 59, 59, 999);
            const dayAppointmentsQuery = query(appointmentsRef, where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
            const dayAppointmentsSnap = await getDocs(dayAppointmentsQuery);
            const dayAppointments = dayAppointmentsSnap.docs.map(d => d.data());
            const windowStart = new Date(appointmentDateTime.getTime() - 59 * 60 * 1000);
            const windowEnd = new Date(appointmentDateTime.getTime() + 59 * 60 * 1000);

            const engineerHasConflict = dayAppointments.some(appt => appt.engineerId === engineerId && appt.appointmentDate.toDate() >= windowStart && appt.appointmentDate.toDate() <= windowEnd);
            if (engineerHasConflict) throw new Error('المهندس لديه موعد آخر في نفس الوقت.');

            if (!isNewClient && clientId) {
                 const clientHasConflict = dayAppointments.some(appt => appt.clientId === clientId && appt.appointmentDate.toDate() >= windowStart && appt.appointmentDate.toDate() <= windowEnd);
                 if (clientHasConflict) throw new Error('العميل لديه موعد آخر في نفس الوقت.');
            }
            
            const newAppointmentData: any = {
                engineerId: engineerId,
                title, notes,
                appointmentDate: Timestamp.fromDate(appointmentDateTime),
                createdAt: serverTimestamp(),
                type: 'architectural',
            };
            
            if(isNewClient) {
                newAppointmentData.clientName = newClientName;
                newAppointmentData.clientMobile = newClientMobile;
            } else {
                newAppointmentData.clientId = clientId;
            }

            const newApptRef = await addDoc(collection(firestore, 'appointments'), newAppointmentData);
            
            const fromAppointmentId = searchParams.get('fromAppointmentId');
            if (fromAppointmentId && !isNewClient) {
                const appointmentRef = doc(firestore, 'appointments', fromAppointmentId);
                await updateDoc(appointmentRef, { clientId: clientId, clientName: deleteField(), clientMobile: deleteField() });
            }

            if (!isNewClient && clientId) {
                const logContent = `قام ${currentUser.fullName} بحجز موعد جديد بعنوان "${title}" بتاريخ ${format(appointmentDateTime, "PPp", { locale: ar })}`;
                const logData = {
                    type: 'log' as const,
                    content: logContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                };
                await addDoc(collection(firestore, `clients/${clientId}/history`), logData);
            }

            toast({ title: 'نجاح', description: 'تم إنشاء الموعد بنجاح.' });
            
            const client = clients.find(c => c.id === clientId);
            const engineer = engineers.find(e => e.id === engineerId);

            if (engineerId && engineer) {
                const targetUserId = await findUserIdByEmployeeId(firestore, engineerId);
                if (targetUserId) {
                     await createNotification(firestore, {
                        userId: targetUserId,
                        title: `موعد جديد: ${title}`,
                        body: `تم تحديد موعد لك مع العميل ${isNewClient ? newClientName : client?.nameAr} يوم ${format(date, 'PPP', { locale: ar })} الساعة ${time}.`,
                        link: `/dashboard/appointments/${newApptRef.id}`
                    });
                }
            }
            
            router.push('/dashboard/appointments');

        } catch (error) {
            const message = error instanceof Error ? error.message : 'فشل حفظ الموعد.';
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: message });
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <Card className="max-w-2xl mx-auto" dir="rtl">
            <form onSubmit={handleSubmit}>
                <CardHeader>
                    <CardTitle>إنشاء موعد جديد (القسم المعماري)</CardTitle>
                    <CardDescription>
                        جدولة موعد جديد مع عميل لأحد مهندسي القسم المعماري.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="title">عنوان الموعد <span className="text-destructive">*</span></Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: اجتماع مناقشة المخططات الأولية" required />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="engineerId">المهندس المسؤول <span className="text-destructive">*</span></Label>
                             <InlineSearchList
                                value={engineerId}
                                onSelect={setEngineerId}
                                options={engineerOptions}
                                placeholder={loading ? "تحميل..." : "اختر المهندس..."}
                                disabled={loading}
                             />
                        </div>
                        <div className="flex items-center space-x-2 self-end mb-2">
                            <Checkbox id="isNewClient" checked={isNewClient} onCheckedChange={(checked) => setIsNewClient(checked as boolean)} />
                            <Label htmlFor="isNewClient">عميل جديد (غير مسجل)</Label>
                        </div>
                    </div>
                    
                    {isNewClient ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className="grid gap-2">
                            <Label htmlFor="clientId">العميل <span className="text-destructive">*</span></Label>
                            <InlineSearchList
                                value={clientId}
                                onSelect={setClientId}
                                options={clientOptions}
                                placeholder={loading ? "تحميل..." : !engineerId ? "اختر مهندسًا أولاً" : "اختر العميل..."}
                                disabled={loading || !engineerId}
                            />
                        </div>
                    )}


                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                            <DateInput id="date" value={date} onChange={setDate} required />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="time">الوقت <span className="text-destructive">*</span></Label>
                            <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                        </div>
                    </div>
                    {(isLoadingSchedule || dailySchedule.length > 0) && (
                        <div className="space-y-2">
                            <Label>جدول المواعيد في اليوم المحدد</Label>
                            {isLoadingSchedule ? (
                                <div className="space-y-2 rounded-md border p-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-5 w-1/2" />
                                </div>
                            ) : (
                                <div className="space-y-2 rounded-md border p-3 text-sm">
                                    {dailySchedule.map((slot, index) => (
                                        <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-muted-foreground">{slot.time}</span>
                                                <span>-</span>
                                                <span>{slot.title}</span>
                                            </div>
                                            <Badge variant="secondary">{slot.type === 'engineer' ? 'للمهندس' : 'للعميل'}</Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                     <div className="grid gap-2">
                        <Label htmlFor="notes">ملاحظات إضافية</Label>
                        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تفاصيل إضافية حول الموعد، جدول الأعمال، إلخ." />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => router.back()}>
                        <X className="ml-2 h-4 w-4" />
                        إلغاء
                    </Button>
                    <Button type="submit" disabled={isSaving || loading}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        {isSaving ? 'جاري الحفظ...' : 'حفظ الموعد'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
    