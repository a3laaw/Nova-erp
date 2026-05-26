
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
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, Timestamp, updateDoc, doc, deleteField, writeBatch, limit } from 'firebase/firestore';
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
import { getTenantPath, cleanFirestoreData } from '@/lib/utils';

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
                const clientPath = getTenantPath('clients', tenantId);
                const empPath = getTenantPath('employees', tenantId);

                const clientQuery = query(collection(firestore, clientPath!), where('isActive', '==', true));
                const engQuery = query(collection(firestore, empPath!), where('status', '==', 'active'));

                const [clientSnap, engSnap] = await Promise.all([
                    getDocs(clientQuery),
                    getDocs(engQuery)
                ]);

                const fetchedClients: Client[] = clientSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Client))
                    .filter(c => c && c.nameAr);
                fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
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
            if (!date || (!checkClientId && !engineerId) || !firestore || !tenantId) {
                setDailySchedule([]);
                return;
            }

            setIsLoadingSchedule(true);
            
            try {
                const apptsPath = getTenantPath('appointments', tenantId);
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const appointmentsRef = collection(firestore, apptsPath!);
                const q = query(appointmentsRef, where('appointmentDate', '>=', dayStart), where('appointmentDate', '<=', dayEnd));
                const querySnapshot = await getDocs(q);

                const dailyAppointments = querySnapshot.docs.map(d => ({id: d.id, ...d.data()}));

                const bookedSlots: { time: string; title: string; type: 'client' | 'engineer' }[] = [];
                const processedApptIds = new Set<string>();

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
            } finally {
                setIsLoadingSchedule(false);
            }
        };

        fetchSchedule();
    }, [date, clientId, engineerId, isNewClient, firestore, tenantId]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firestore || !currentUser || !tenantId || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const apptsPath = getTenantPath('appointments', tenantId);
            const [hours, minutes] = time.split(':').map(Number);
            const appointmentDateTime = new Date(date);
            appointmentDateTime.setHours(hours, minutes, 0, 0);
            
            const newAppointmentData: any = {
                engineerId: engineerId,
                title, notes,
                appointmentDate: Timestamp.fromDate(appointmentDateTime),
                createdAt: serverTimestamp(),
                createdBy: currentUser.id,
                type: 'architectural',
                status: 'scheduled',
                companyId: tenantId
            };
            
            if(isNewClient) {
                newAppointmentData.clientName = newClientName;
                newAppointmentData.clientMobile = newClientMobile;
            } else {
                newAppointmentData.clientId = clientId;
            }

            const newApptRef = doc(collection(firestore, apptsPath!));
            batch.set(newApptRef, cleanFirestoreData(newAppointmentData));
            
            await batch.commit();

            // 🚀 إرسال إشعار فوري للمهندس 🚀
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

        } catch (error) {
            toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
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
                                placeholder={!engineerId ? "اختر مهندسًا أولاً" : "اختر العميل..."}
                                disabled={!engineerId}
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
                            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="h-11 rounded-xl" />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label className="font-bold">ملاحظات إضافية</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-2xl" />
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/10 p-8 border-t flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => router.back()} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button type="submit" disabled={isSaving} className="h-12 px-12 rounded-xl font-black text-lg shadow-xl shadow-primary/30">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : 'تأكيد الحجز'}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
