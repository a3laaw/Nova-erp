'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDoc } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, Timestamp, limit } from 'firebase/firestore';
import type { Appointment, Client, Employee, WorkStage, Department, ClientTransaction } from '@/lib/types';
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
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Edit, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

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
    const [transaction, setTransaction] = useState<ClientTransaction | null>(null);
    
    // UI states
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isEditingStage, setIsEditingStage] = useState(false);

    // Fetch main appointment data
    const appointmentRef = useMemo(() => firestore && id ? doc(firestore, 'appointments', id) : null, [firestore, id]);
    
    // Hooks are now called unconditionally at the top level
    const [appointmentSnap, appointmentLoading, appointmentError] = useDoc(appointmentRef);

    const workStageOptions = useMemo(() => {
        if (!workStages || !currentUser) return [];

        // Filter stages based on the current user's role and job title
        const roleFilteredStages = workStages.filter(stage => {
            // Admin can see all stages
            if (currentUser.role === 'Admin') {
                return true;
            }
            // If allowedRoles is not defined or empty, assume it's a general stage visible to all
            if (!stage.allowedRoles || stage.allowedRoles.length === 0) {
                return true;
            }
            // If allowedRoles is defined, the user's jobTitle must be included
            return currentUser.jobTitle ? stage.allowedRoles.includes(currentUser.jobTitle) : false;
        });

        // If transaction data isn't loaded yet, show the role-filtered list to avoid flickering
        if (!transaction) {
            return roleFilteredStages.map(stage => ({ value: stage.id!, label: stage.name }));
        }

        // Exclude stages that are already completed
        const completedStageIds = new Set(
            transaction.stages?.filter(s => s.status === 'completed').map(s => s.stageId)
        );

        return roleFilteredStages
            .filter(stage => !completedStageIds.has(stage.id!))
            .map(stage => ({ value: stage.id!, label: stage.name }));
            
    }, [workStages, transaction, currentUser]);


    useEffect(() => {
        if (!id && !appointmentLoading) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'معرف الموعد غير موجود.' });
            router.push('/dashboard/appointments');
            return;
        }
        if (appointmentSnap?.exists()) {
            setAppointment({ id: appointmentSnap.id, ...appointmentSnap.data() } as Appointment);
        } else if (id && !appointmentLoading && !appointmentSnap?.exists()) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموعد المطلوب.' });
            router.push('/dashboard/appointments');
        }
    }, [appointmentSnap, appointmentLoading, id, router, toast]);

    // Fetch related data once appointment is loaded
    useEffect(() => {
        if (!appointment || !firestore) return;

        const fetchRelatedData = async () => {
            try {
                // Fetch client and engineer
                const clientRef = doc(firestore, 'clients', appointment.clientId);
                const engineerRef = doc(firestore, 'employees', appointment.engineerId);
                const [clientSnap, engineerSnap] = await Promise.all([getDoc(clientRef), getDoc(engineerRef)]);
                if (clientSnap.exists()) setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                if (engineerSnap.exists()) setEngineer(engineerSnap.data() as Employee);

                // Fetch the transaction to get stage progress
                if (appointment.transactionId) {
                    const transactionRef = doc(firestore, 'clients', appointment.clientId, 'transactions', appointment.transactionId);
                    const transactionSnap = await getDoc(transactionRef);
                    if (transactionSnap.exists()) {
                        setTransaction(transactionSnap.data() as ClientTransaction);
                    }
                }

                // Fetch architectural department work stages
                const deptQuery = query(collection(firestore, 'departments'), where('name', '==', 'القسم المعماري'), limit(1));
                const deptSnap = await getDocs(deptQuery);
                if (!deptSnap.empty) {
                    const archDeptId = deptSnap.docs[0].id;
                    const stagesQuery = query(collection(firestore, `departments/${archDeptId}/workStages`), orderBy('order'));
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
        if (!selectedStage) {
            setIsSaving(false);
            toast({ variant: 'destructive', title: 'خطأ', description: 'المرحلة المختارة غير صالحة.' });
            return;
        }
        
        const isEditing = !!appointment.workStageUpdated;

        try {
            const batch = writeBatch(firestore);
            const transactionRef = doc(firestore, 'clients', appointment.clientId, 'transactions', appointment.transactionId);
    
            const transactionSnap = await getDoc(transactionRef);
            if (!transactionSnap.exists()) {
                throw new Error("لم يتم العثور على المعاملة المرتبطة بهذا الموعد.");
            }
            const transactionData = transactionSnap.data() as ClientTransaction;
            const currentStages = [...(transactionData.stages || [])];
            const now = new Date();
            let logContent = '';

            // --- ROLLBACK LOGIC (if editing as Admin) ---
            if (isEditing && currentUser?.role === 'Admin' && appointment.workStageProgressId) {
                const progressDocRef = doc(firestore, 'work_stages_progress', appointment.workStageProgressId);
                const progressSnap = await getDoc(progressDocRef);
                if (progressSnap.exists()) {
                    const previousStageId = progressSnap.data().stageId;
                    const previousStageIndexInTemplate = workStages.findIndex(s => s.id === previousStageId);

                    if (previousStageIndexInTemplate !== -1) {
                        // Revert previously completed stage
                        const previousStageIndexInProg = currentStages.findIndex(s => s.stageId === previousStageId);
                        if (previousStageIndexInProg !== -1 && currentStages[previousStageIndexInProg].status === 'completed') {
                            currentStages[previousStageIndexInProg].status = 'pending';
                            currentStages[previousStageIndexInProg].endDate = null;
                            currentStages[previousStageIndexInProg].startDate = null; 
                        }

                        // Revert auto-started stage after it
                        const autoStartedStageTemplate = workStages[previousStageIndexInTemplate + 1];
                        if (autoStartedStageTemplate) {
                            const autoStartedStageIndexInProg = currentStages.findIndex(s => s.stageId === autoStartedStageTemplate.id);
                            if (autoStartedStageIndexInProg !== -1 && currentStages[autoStartedStageIndexInProg].status === 'in-progress') {
                                currentStages[autoStartedStageIndexInProg].status = 'pending';
                                currentStages[autoStartedStageIndexInProg].startDate = null;
                            }
                        }
                    }
                }
            }


            // --- FORWARD LOGIC (for new selection) ---
            const completedStageIndex = currentStages.findIndex(s => s.stageId === selectedStage.id);
            if (completedStageIndex !== -1) {
                const stageToUpdate = { ...currentStages[completedStageIndex] };
                if (stageToUpdate.status !== 'completed') {
                    stageToUpdate.status = 'completed';
                    stageToUpdate.endDate = now;
                    if (!stageToUpdate.startDate) stageToUpdate.startDate = now;
                    currentStages[completedStageIndex] = stageToUpdate;
                }
            } else {
                currentStages.push({
                    stageId: selectedStage.id, name: selectedStage.name, status: 'completed', startDate: now, endDate: now, allowedRoles: selectedStage.allowedRoles,
                });
            }
            
            logContent = isEditing
                ? `قام ${currentUser.fullName} (مدير) بتعديل مرحلة الزيارة رقم ${appointment.visitCount || ''} إلى: "${selectedStage.name}".`
                : `قام ${currentUser.fullName} بإكمال مرحلة العمل "${selectedStage.name}" خلال الزيارة رقم ${appointment.visitCount || ''}.`;


            const completedStageOrderIndex = workStages.findIndex(s => s.id === selectedStage.id);
            const nextStageInTemplate = workStages[completedStageOrderIndex + 1];

            if (nextStageInTemplate) {
                const nextStageId = nextStageInTemplate.id!;
                const isDiscussionStage = nextStageInTemplate.name === 'تعديلات ومناقشات';

                if (!isDiscussionStage) {
                    const nextStageIndexInProg = currentStages.findIndex(s => s.stageId === nextStageId);
                    if (nextStageIndexInProg !== -1) {
                        const stageToStart = { ...currentStages[nextStageIndexInProg] };
                        if (stageToStart.status === 'pending') {
                            stageToStart.status = 'in-progress';
                            stageToStart.startDate = now;
                            currentStages[nextStageIndexInProg] = stageToStart;
                            logContent += ` وتم بدء المرحلة التالية تلقائياً: "${nextStageInTemplate.name}".`;
                        }
                    } else {
                        currentStages.push({
                            stageId: nextStageId, name: nextStageInTemplate.name, status: 'in-progress', startDate: now, endDate: null, allowedRoles: nextStageInTemplate.allowedRoles,
                        });
                        logContent += ` وتم بدء المرحلة التالية تلقائياً: "${nextStageInTemplate.name}".`;
                    }
                }
            }
    
            batch.update(transactionRef, { stages: currentStages });
    
            if (isEditing && currentUser?.role === 'Admin' && appointment.workStageProgressId) {
                const progressRef = doc(firestore, 'work_stages_progress', appointment.workStageProgressId);
                batch.update(progressRef, {
                    stageId: selectedStage.id, stageName: selectedStage.name, selectedBy: currentUser.employeeId, selectedAt: serverTimestamp(),
                });
            } else {
                const progressRef = doc(collection(firestore, 'work_stages_progress'));
                batch.set(progressRef, {
                    visitId: appointment.id, transactionId: appointment.transactionId, stageId: selectedStage.id, stageName: selectedStage.name, selectedBy: currentUser.employeeId, selectedAt: serverTimestamp(),
                });
                const apptRef = doc(firestore, 'appointments', appointment.id);
                batch.update(apptRef, { workStageUpdated: true, workStageProgressId: progressRef.id });
            }
            
            const timelineRef = doc(collection(transactionRef, 'timelineEvents'));
            batch.set(timelineRef, {
                type: 'log', content: logContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp(),
            });
    
            await batch.commit();
    
            toast({ title: 'نجاح', description: `تم ${isEditing ? 'تعديل' : 'تحديث'} مرحلة العمل إلى: ${selectedStage.name}` });
            
            setAppointment(prev => prev ? { ...prev, workStageUpdated: true } : null);
            setIsEditingStage(false);
    
        } catch (error) {
            console.error("Error updating work stage:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل حفظ تحديث مرحلة العمل.';
            toast({ variant: 'destructive', title: 'خطأ', description: errorMessage });
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
                    <InfoRow icon={<User />} label="العميل" value={client ? <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-primary hover:underline">{client.nameAr}</Link> : null} />
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
                    {!appointment.transactionId ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>زيارة غير مرتبطة بمعاملة</AlertTitle>
                            <AlertDescription>
                                لا يمكن تحديث مرحلة العمل لأن هذه الزيارة غير مرتبطة بأي معاملة. الرجاء تعديل الموعد وربطه بمعاملة أولاً.
                            </AlertDescription>
                        </Alert>
                    ) : !appointment.workStageUpdated || (isEditingStage && currentUser?.role === 'Admin') ? (
                        <div className="space-y-4 p-4 border border-blue-200 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                             <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Workflow className="text-blue-500" /> 
                                {isEditingStage ? 'تعديل مرحلة العمل' : 'تحديث مرحلة العمل'}
                             </h3>
                             <p className="text-sm text-muted-foreground">
                                {isEditingStage 
                                    ? 'اختر المرحلة الصحيحة. سيتم التراجع عن الإجراءات التلقائية السابقة.' 
                                    : 'الرجاء تحديد مرحلة العمل التي وصل إليها العميل في هذه الزيارة.'
                                }
                             </p>
                            <div className="grid gap-2">
                                <Label htmlFor="work-stage">مرحلة العمل</Label>
                                <InlineSearchList 
                                    value={selectedStageId}
                                    onSelect={setSelectedStageId}
                                    options={workStageOptions}
                                    placeholder={workStageOptions.length === 0 ? "لا توجد مراحل متاحة لك" : "اختر مرحلة..."}
                                    disabled={workStageOptions.length === 0}
                                />
                                {workStageOptions.length === 0 && !loading && currentUser?.role !== 'Admin' && (
                                    <p className='text-xs text-muted-foreground'>لا توجد مراحل عمل متاحة لدورك الوظيفي حالياً أو تم إكمال جميع المراحل.</p>
                                )}
                            </div>
                            <Button onClick={handleUpdateStage} disabled={isSaving || !selectedStageId}>
                                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Check className="ml-2 h-4 w-4"/>}
                                {isEditingStage ? 'حفظ التعديل' : 'تأكيد تحديث المرحلة'}
                            </Button>
                        </div>
                    ) : (
                         <Alert variant="default" className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50">
                            <Check className="h-4 w-4 !text-green-600 dark:!text-green-300" />
                            <AlertTitle>تم تحديث مرحلة العمل</AlertTitle>
                            <AlertDescription asChild>
                                <div className="flex justify-between items-center w-full">
                                    <span>تم تسجيل مرحلة العمل لهذه الزيارة بنجاح.</span>
                                    {currentUser?.role === 'Admin' && (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-800 hover:text-green-900 dark:text-green-300 dark:hover:text-green-200 -mr-2" onClick={() => setIsEditingStage(true)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                 </CardContent>
                <CardFooter className="flex flex-col items-start gap-2 border-t pt-6">
                    <Button 
                        disabled={!appointment.workStageUpdated}
                        onClick={() => router.push('/dashboard/appointments')}
                    >
                        <ArrowRight className="ml-2 h-4 w-4" />
                        إغلاق الزيارة
                    </Button>
                    {!appointment.workStageUpdated && appointment.transactionId && (
                         <Alert variant="destructive" className="w-full">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>إجراء مطلوب</AlertTitle>
                            <AlertDescription>
                                يجب تحديث مرحلة العمل أولاً قبل إغلاق الزيارة.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardFooter>
            </Card>
        </div>
    )
}
