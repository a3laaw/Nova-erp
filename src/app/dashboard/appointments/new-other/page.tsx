'use client';

import { useState, useEffect, useMemo } from 'react';
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
import type { Employee, Client, Department } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';

export default function NewOtherAppointmentPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [clients, setClients] = useState<Client[]>([]);
    const [allOtherEngineers, setAllOtherEngineers] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [clientId, setClientId] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('');
    const [engineerId, setEngineerId] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');

    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const clientQuery = query(collection(firestore, 'clients'), where('isActive', '==', true));
                const engQuery = query(collection(firestore, 'employees'), where('status', '==', 'active'));
                const deptQuery = query(collection(firestore, 'departments'), orderBy('name'));

                const [clientSnap, engSnap, deptSnap] = await Promise.all([
                    getDocs(clientQuery),
                    getDocs(engQuery),
                    getDocs(deptQuery)
                ]);

                const fetchedClients = clientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
                fetchedClients.sort((a, b) => a.nameAr.localeCompare(b.nameAr));
                setClients(fetchedClients);
                
                // User wants to see only specific engineering departments
                const engineeringDeptNames = ['ميكانيك', 'واجهات', 'كهرباء', 'انشائي'];
                const fetchedDepts = deptSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Department))
                    // Filter to include only the specified engineering departments
                    .filter(dept => engineeringDeptNames.some(name => dept.name.includes(name)));
                setDepartments(fetchedDepts);


                const allEmployees = engSnap.docs.map(doc => ({ id: doc.id, ...doc.data()} as Employee));
                // Filter for engineers who are NOT in the architectural department
                const otherEngineers = allEmployees.filter(emp => 
                    !emp.department?.trim().includes('المعماري') &&
                    (emp.jobTitle?.includes('مهندس') || emp.jobTitle?.toLowerCase().includes('architect'))
                );
                setAllOtherEngineers(otherEngineers);

            } catch (error) {
                console.error("Error fetching data: ", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في جلب بيانات العملاء والمهندسين.' });
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore, toast]);
    
    const filteredEngineers = useMemo(() => {
        if (!selectedDepartment) {
            return [];
        }
        const selectedDeptName = departments.find(d => d.id === selectedDepartment)?.name;
        if (!selectedDeptName) return [];

        return allOtherEngineers.filter(eng => eng.department === selectedDeptName);
    }, [selectedDepartment, allOtherEngineers, departments]);

    const handleDepartmentChange = (deptId: string) => {
        setSelectedDepartment(deptId);
        setEngineerId('');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !currentUser || !clientId || !selectedDepartment || !engineerId || !title || !date || !time) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تعبئة جميع الحقول الإلزامية.' });
            return;
        }

        setIsSaving(true);
        try {
            const appointmentDateTime = new Date(`${date}T${time}`);

            // --- Conflict Validation ---
            const windowStart = new Date(appointmentDateTime.getTime() - 59 * 60 * 1000);
            const windowEnd = new Date(appointmentDateTime.getTime() + 59 * 60 * 1000);

            const appointmentsRef = collection(firestore, 'appointments');

            // Check for engineer conflict
            const engineerConflictQuery = query(
                appointmentsRef,
                where('engineerId', '==', engineerId),
                where('appointmentDate', '>=', Timestamp.fromDate(windowStart)),
                where('appointmentDate', '<=', Timestamp.fromDate(windowEnd))
            );
            const engineerConflictSnap = await getDocs(engineerConflictQuery);

            if (!engineerConflictSnap.empty) {
                toast({
                    variant: 'destructive',
                    title: 'تعارض في المواعيد',
                    description: 'المهندس لديه موعد آخر في نفس الوقت. الرجاء اختيار وقت مختلف.',
                });
                setIsSaving(false);
                return;
            }

            // Check for client conflict
            const clientConflictQuery = query(
                appointmentsRef,
                where('clientId', '==', clientId),
                where('appointmentDate', '>=', Timestamp.fromDate(windowStart)),
                where('appointmentDate', '<=', Timestamp.fromDate(windowEnd))
            );
            const clientConflictSnap = await getDocs(clientConflictQuery);

            if (!clientConflictSnap.empty) {
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
            };
            
            await addDoc(collection(firestore, 'appointments'), newAppointment);

            toast({ title: 'نجاح', description: 'تم إنشاء الموعد بنجاح.' });
            
            // Notification Logic
            const client = clients.find(c => c.id === clientId);
            const engineer = allOtherEngineers.find(e => e.id === engineerId);

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
                    <CardTitle>إنشاء موعد جديد (الأقسام الأخرى)</CardTitle>
                    <CardDescription>
                        جدولة موعد جديد مع عميل لأحد مهندسي الأقسام الأخرى.
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
                            <Label htmlFor="department">القسم الهندسي <span className="text-destructive">*</span></Label>
                             <Select dir="rtl" onValueChange={handleDepartmentChange} value={selectedDepartment} required disabled={loading}>
                                <SelectTrigger id="department">
                                    <SelectValue placeholder={loading ? "تحميل..." : "اختر القسم..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map(d => (
                                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="engineerId">المهندس المسؤول <span className="text-destructive">*</span></Label>
                         <Select dir="rtl" onValueChange={setEngineerId} value={engineerId} required disabled={loading || !selectedDepartment || filteredEngineers.length === 0}>
                            <SelectTrigger id="engineerId">
                                <SelectValue placeholder={
                                    !selectedDepartment 
                                    ? "اختر قسمًا أولاً" 
                                    : (filteredEngineers.length === 0 ? "لا يوجد مهندسين بهذا القسم" : "اختر المهندس...")
                                    } />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredEngineers.map(e => (
                                    <SelectItem key={e.id!} value={e.id!}>{e.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
    
