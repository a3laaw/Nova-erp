
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, Timestamp, limit } from 'firebase/firestore';
import type { Appointment, Client, Employee, WorkStage, Department } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode | string | number | null | undefined }) {
    return (
        <div className="flex items-start gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground pt-0.5">{icon}</div>
            <div>
                <p className="font-semibold text-muted-foreground">{label}</p>
                <div className="text-foreground text-base">{value || '-'}</div>
            </div>
        </div>
    );
}

export default function AppointmentDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    // Data states
    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [engineer, setEngineer] = useState<Employee | null>(null);
    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState('');

    // Fetch main appointment data
    const appointmentRef = useMemo(() => firestore ? doc(firestore, 'appointments', id) : null, [firestore, id]);
    const [appointmentSnap, appointmentLoading, appointmentError] = useDoc(appointmentRef);

    useEffect(() => {
        if (appointmentSnap?.exists()) {
            setAppointment({ id: appointmentSnap.id, ...appointmentSnap.data() } as Appointment);
        } else if (!appointmentLoading && !appointmentSnap?.exists()) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموعد المطلوب.' });
            router.push('/dashboard/appointments');
        }
    }, [appointmentSnap, appointmentLoading, router, toast]);

    // Fetch related data once appointment is loaded
    useEffect(() => {
        if (!appointment || !firestore) return;

        const fetchRelatedData = async () => {
            try {
                // Fetch client and engineer
                const clientRef = doc(firestore, 'clients', appointment.clientId);
                const engineerRef = doc(firestore, 'employees', appointment.engineerId);
                const [clientSnap, engineerSnap] = await Promise.all([getDoc(clientRef), getDoc(engineerRef)]);
                if (clientSnap.exists()) setClient(clientSnap.data() as Client);
                if (engineerSnap.exists()) setEngineer(engineerSnap.data() as Employee);

                // Fetch architectural department work stages
                const deptQuery = query(collection(firestore, 'departments'), where('name', '==', 'القسم المعماري'), limit(1));
                const deptSnap = await getDocs(deptQuery);
                if (!deptSnap.empty) {
                    const archDeptId = deptSnap.docs[0].id;
                    const stagesQuery = query(collection(firestore, `departments/${archDeptId}/workStages`), orderBy('name'));
                    const stagesSnap = await getDocs(stagesQuery);
                    setWorkStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage)));
                }

            } catch (error) {
                console.error("Error fetching related data:", error);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل بيانات العميل أو المهندس.' });
            } finally {
                setLoading(false);
            }
        };

        fetchRelatedData();
    }, [appointment, firestore, toast]);

    const handleUpdateStage = async () => {
        if (!firestore || !currentUser || !appointment || !selectedStageId || !appointment.transactionId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء اختيار مرحلة عمل. تأكد من أن هذه الزيارة مرتبطة بمعاملة.' });
            return;
        }

        setIsSaving(true);
        const selectedStage = workStages.find(s => s.id === selectedStageId);
        if (!selectedStage) return;
        
        try {
            const batch = writeBatch(firestore);

            // 1. Create WorkStageProgress document
            const progressRef = doc(collection(firestore, 'work_stages_progress'));
            batch.set(progressRef, {
                visitId: appointment.id,
                transactionId: appointment.transactionId,
                stageId: selectedStage.id,
                stageName: selectedStage.name,
                selectedBy: currentUser.employeeId,
                selectedAt: serverTimestamp(),
            });

            // 2. Update the appointment
            const apptRef = doc(firestore, 'appointments', appointment.id);
            batch.update(apptRef, {
                workStageUpdated: true,
                workStageProgressId: progressRef.id
            });

            await batch.commit();

            toast({ title: 'نجاح', description: `تم تحديث مرحلة العمل إلى: ${selectedStage.name}` });
            
            // Manually update local state to reflect change immediately
            setAppointment(prev => prev ? { ...prev, workStageUpdated: true, workStageProgressId: progressRef.id } : null);

        } catch (error) {
            console.error("Error updating work stage:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ تحديث مرحلة العمل.' });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (loading || appointmentLoading) {
        return (
            <Card className="max-w-2xl mx-auto" dir="rtl">
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        );
    }
    
    if (!appointment) return null;

    const workStageOptions = workStages.map(stage => ({ value: stage.id, label: stage.name }));

    return (
        <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">{appointment.title}</CardTitle>
                            <CardDescription>تفاصيل موعد القسم المعماري</CardDescription>
                        </div>
                         <Button variant="outline" size="sm" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> عودة للتقويم</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <InfoRow icon={<User />} label="العميل" value={client?.nameAr} />
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={engineer?.fullName} />
                    <InfoRow icon={<Calendar />} label="تاريخ الموعد" value={format(appointment.appointmentDate.toDate(), "eeee, dd MMMM yyyy", { locale: ar })} />
                    <InfoRow icon={<Clock />} label="وقت الموعد" value={format(appointment.appointmentDate.toDate(), "p", { locale: ar })} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>إجراءات الزيارة</CardTitle>
                </CardHeader>
                 <CardContent>
                    {!appointment.workStageUpdated ? (
                        <div className="space-y-4 p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                             <h3 className="font-semibold text-lg flex items-center gap-2"><Workflow className="text-blue-500" /> تحديث مرحلة العمل</h3>
                             <p className="text-sm text-muted-foreground">الرجاء تحديد مرحلة العمل التي وصل إليها العميل في هذه الزيارة.</p>
                            <div className="grid gap-2">
                                <Label htmlFor="work-stage">مرحلة العمل</Label>
                                <InlineSearchList 
                                    value={selectedStageId}
                                    onSelect={setSelectedStageId}
                                    options={workStageOptions}
                                    placeholder="اختر مرحلة..."
                                />
                            </div>
                            <Button onClick={handleUpdateStage} disabled={isSaving || !selectedStageId}>
                                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Check className="ml-2 h-4 w-4"/>}
                                تأكيد تحديث المرحلة
                            </Button>
                        </div>
                    ) : (
                         <Alert variant="default" className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50">
                            <Check className="h-4 w-4 !text-green-600 dark:!text-green-300" />
                            <AlertTitle>تم تحديث مرحلة العمل</AlertTitle>
                            <AlertDescription>
                                تم تسجيل مرحلة العمل لهذه الزيارة بنجاح.
                            </AlertDescription>
                        </Alert>
                    )}
                 </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 border-t pt-6">
                    <Button disabled={!appointment.workStageUpdated}>
                        إغلاق الزيارة
                    </Button>
                    {!appointment.workStageUpdated && (
                         <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            يجب تحديث مرحلة العمل أولاً قبل إغلاق الزيارة
                         </p>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
