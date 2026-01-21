'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, X, Loader2 } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Employee, Client } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

export default function NewArchitecturalAppointmentPage() {
    const router = useRouter();
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
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    const [dailySchedule, setDailySchedule] = useState<{ time: string; title: string; type: 'client' | 'engineer' }[]>([]);
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);


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
    
    useEffect(() => {
        const fetchSchedule = async () => {
            if (!date || (!clientId && !engineerId) || !firestore) {
                setDailySchedule([]);
                return;
            }

            setIsLoadingSchedule(true);
            
            try {
                const appointmentDate = toFirestoreDate(date);
                if (!appointmentDate) {
                    setIsLoadingSchedule(false);
                    return;
                }

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
                if (clientId) {
                    dailyAppointments.forEach(appt => {
                        if (appt.clientId === clientId && !processedApptIds.has(appt.id)) {
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
    }, [date, clientId, engineerId, firestore]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !clientId || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }

        setIsSaving(true);
        try {
            const appointmentDateTime = new Date(`${date}T${time}`);
            
            // --- Conflict Validation ---
            const dayStart = new Date(appointmentDateTime);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(appointmentDateTime);
            dayEnd.setHours(23, 59, 59, 999);

            const appointmentsRef = collection(firestore, 'appointments');
            const dayAppointmentsQuery = query(appointmentsRef, where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
            const dayAppointmentsSnap = await getDocs(dayAppointmentsQuery);
            const dayAppointments = dayAppointmentsSnap.docs.map(d => d.data());

            const windowStart = new Date(appointmentDateTime.getTime() - 59 * 60 * 1000);
            const windowEnd = new Date(appointmentDateTime.getTime() + 59 * 60 * 1000);

            // Check for engineer conflict
            const engineerHasConflict = dayAppointments.some(appt => {
                const apptDate = appt.appointmentDate.toDate();
                return appt.engineerId === engineerId && apptDate >= windowStart && apptDate <= windowEnd;
            });

            if (engineerHasConflict) {
                toast({
                    variant: 'destructive',
                    title: 'تعارض في المواعيد',
                    description: 'المهندس لديه موعد آخر في نفس الوقت. الرجاء اختيار وقت مختلف.',
                });
                setIsSaving(false);
                return;
            }

            // Check for client conflict
            const clientHasConflict = dayAppointments.some(appt => {
                const apptDate = appt.appointmentDate.toDate();
                return appt.clientId === clientId && apptDate >= windowStart && apptDate <= windowEnd;
            });

            if (clientHasConflict) {
                toast({
                    variant: 'destructive',
                    title: 'تعارض في المواعيد',
                    description: 'العميل لديه موعد آخر في نفس الوقت. الرجاء اختيار وقت مختلف.',
                });
                setIsSaving(false);
                return;
            }
            // --- End of Conflict Validation ---

            const newAppointment = {
                clientId,
                engineerId: engineerId,
                title,
                notes,
                appointmentDate: Timestamp.fromDate(appointmentDateTime),
                createdAt: serverTimestamp(),
                type: 'architectural',
            };
            
            await addDoc(collection(firestore, 'appointments'), newAppointment);

            toast({ title: 'نجاح', description: 'تم إنشاء الموعد بنجاح.' });
            
            // Notification Logic
            const client = clients.find(c => c.id === clientId);
            const engineer = engineers.find(e => e.id === engineerId);

            if (engineerId && engineer) {
                const targetUserId = await findUserIdByEmployeeId(firestore, engineerId);
                if (targetUserId) {
                     await createNotification(firestore, {
                        userId: targetUserId,
                        title: `موعد جديد: ${title}`,
                        body: `تم تحديد موعد لك مع العميل ${client?.nameAr} يوم ${date} الساعة ${time}.`,
                        link: `/dashboard/appointments`
                    });
                }
            }
            
            router.push('/dashboard/appointments');

        } catch (error) {
            console.error("Error creating appointment:", error);
            toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'فشل حفظ الموعد.' });
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
                            <Label htmlFor="clientId">العميل <span className="text-destructive">*</span></Label>
                            <Select dir="rtl" onValueChange={setClientId} value={clientId} required disabled={loading}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? "تحميل..." : "اختر العميل..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {clients.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="engineerId">المهندس المسؤول <span className="text-destructive">*</span></Label>
                             <Select dir="rtl" onValueChange={setEngineerId} value={engineerId} required disabled={loading}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loading ? "تحميل..." : "اختر المهندس..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {engineers.map(e => (
                                        <SelectItem key={e.id!} value={e.id!}>{e.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="date">التاريخ <span className="text-destructive">*</span></Label>
                            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
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
