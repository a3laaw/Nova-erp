'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, getDocs, collection, query, where, orderBy, writeBatch, serverTimestamp, Timestamp, limit, type DocumentSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import type { Appointment, Client, Employee, WorkStage, Department, ClientTransaction, TransactionStage } from '@/lib/types';
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
import { AlertCircle, ArrowRight, Calendar, User, Clock, Check, Save, Loader2, Workflow, Edit, Pencil, UserPlus, Link2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { toFirestoreDate } from '@/services/date-converter';

const getTotalPaidForProject = async (projectId: string, db: any) => {
    let total = 0;
    if (!projectId || !db) return total;
    const receiptsQuery = query(collection(db, 'cashReceipts'), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        total += doc.data().amount || 0;
    });
    return total;
};


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

    // --- Real-time Data Hooks ---
    const appointmentPath = useMemo(() => (id ? `appointments/${id}` : null), [id]);
    const { data: appointment, loading: appointmentLoading, error: appointmentError } = useDocument<Appointment>(firestore, appointmentPath);
    
    const clientPath = useMemo(() => appointment?.clientId ? `clients/${appointment.clientId}` : null, [appointment?.clientId]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

    const engineerPath = useMemo(() => appointment?.engineerId ? `employees/${appointment.engineerId}` : null, [appointment?.engineerId]);
    const { data: engineer, loading: engineerLoading } = useDocument<Employee>(firestore, engineerPath);

    const transactionPath = useMemo(() => (appointment?.clientId && appointment?.transactionId) ? `clients/${appointment.clientId}/transactions/${appointment.transactionId}` : null, [appointment?.clientId, appointment?.transactionId]);
    const { data: transaction, loading: transactionLoading } = useDocument<ClientTransaction>(firestore, transactionPath);

    const clientTransactionsPath = useMemo(() => (appointment?.clientId && !appointment?.transactionId) ? `clients/${appointment.clientId}/transactions` : null, [appointment?.clientId, appointment?.transactionId]);
    const { data: clientTransactions = [], loading: clientTransactionsLoading } = useSubscription<ClientTransaction>(firestore, clientTransactionsPath, clientTransactionsPath ? [] : undefined);
    
    // --- State for one-time fetched or derived data ---
    const [workStages, setWorkStages] = useState<WorkStage[]>([]);
    const [progressDoc, setProgressDoc] = useState<DocumentSnapshot | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedStageId, setSelectedStageId] = useState('');
    const [isEditingStage, setIsEditingStage] = useState(false);
    const [minutesContent, setMinutesContent] = useState('');
    const [isSavingMinutes, setIsSavingMinutes] = useState(false);
    const [selectedTransactionToLink, setSelectedTransactionToLink] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [isAutoLinking, setIsAutoLinking] = useState(false);

    const loading = appointmentLoading || clientLoading || engineerLoading || transactionLoading || clientTransactionsLoading;

    useEffect(() => {
        if (!appointmentLoading && !appointment && id) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'لم يتم العثور على الموعد المطلوب.' });
            router.push('/dashboard/appointments');
        }
        if (appointmentError) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل بيانات الموعد.' });
             router.push('/dashboard/appointments');
        }
    }, [appointment, appointmentLoading, appointmentError, id, router, toast]);

    // Auto-link prospective client if a real client file now exists
    useEffect(() => {
        if (!firestore || !appointment || !id || isAutoLinking || appointment.clientId || !appointment.clientMobile) {
            return;
        }

        const checkAndLinkClient = async () => {
            setIsAutoLinking(true);
            try {
                const clientQuery = query(collection(firestore, 'clients'), where('mobile', '==', appointment.clientMobile), limit(1));
                const clientSnap = await getDocs(clientQuery);

                if (!clientSnap.empty) {
                    const foundClient = clientSnap.docs[0];
                    
                    const appointmentsRef = collection(firestore, 'appointments');
                    const allProspectiveApptsQuery = query(appointmentsRef, where('clientMobile', '==', appointment.clientMobile));
                    const prospectiveApptsSnap = await getDocs(allProspectiveApptsQuery);

                    if (!prospectiveApptsSnap.empty) {
                        const batch = writeBatch(firestore);
                        prospectiveApptsSnap.forEach(apptDoc => {
                            const apptRef = doc(firestore, 'appointments', apptDoc.id);
                            batch.update(apptRef, {
                                clientId: foundClient.id,
                                clientName: deleteField(),
                                clientMobile: deleteField()
                            });
                        });
                        await batch.commit();

                        toast({
                            title: 'تم الربط التلقائي',
                            description: `تم ربط ${prospectiveApptsSnap.size} مواعيد بملف العميل "${foundClient.data().nameAr}" بناءً على تطابق رقم الهاتف.`,
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to auto-link client:", error);
            }
        };

        checkAndLinkClient();
    }, [appointment, firestore, id, toast, isAutoLinking]);

    // Fetch one-time data like work stages
    useEffect(() => {
        if (!firestore || !appointment) return;

        const fetchWorkStages = async () => {
             try {
                const deptQuery = query(collection(firestore, 'departments'), where('name', '==', 'القسم المعماري'), limit(1));
                const deptSnap = await getDocs(deptQuery);
                if (!deptSnap.empty) {
                    const archDeptId = deptSnap.docs[0].id;
                    const stagesQuery = query(collection(firestore, `departments/${archDeptId}/workStages`), orderBy('order'));
                    const stagesSnap = await getDocs(stagesQuery);
                    setWorkStages(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage)));
                }
             } catch(e) {
                console.error("Error fetching work stages:", e)
             }
        };
        fetchWorkStages();
    }, [appointment, firestore]);

    // Fetch the specific progress document for this visit
    useEffect(() => {
        if (!firestore || !appointment?.workStageProgressId) {
            setProgressDoc(null);
            return;
        }
        const fetchProgressDoc = async () => {
            const progressRef = doc(firestore, 'work_stages_progress', appointment.workStageProgressId);
            try {
                const progressSnap = await getDoc(progressRef);
                if (progressSnap.exists()) {
                    setProgressDoc(progressSnap);
                }
            } catch (error) {
                console.error("Failed to fetch progress doc:", error);
            }
        };
        fetchProgressDoc();
    }, [firestore, appointment?.workStageProgressId]);

    const workStageOptions = useMemo(() => {
        if (!workStages) return [];
        
        const roleFilteredStages = workStages.filter(stage => {
            if (currentUser?.role === 'Admin') {
                return true;
            }
            if (!stage.allowedRoles || stage.allowedRoles.length === 0) {
                return true; // Stage is public
            }
            return currentUser?.jobTitle ? stage.allowedRoles.includes(currentUser.jobTitle) : false;
        });

        if (!transaction) {
            return roleFilteredStages.map(stage => ({ value: stage.id!, label: stage.name }));
        }
        
        const completedStageIds = new Set(
            transaction.stages?.filter(s => s.status === 'completed').map(s => s.stageId)
        );

        const stageIdForThisVisit = progressDoc?.data()?.stageId;
        if (isEditingStage && stageIdForThisVisit) {
            completedStageIds.delete(stageIdForThisVisit);
        }

        return roleFilteredStages
            .filter(stage => !completedStageIds.has(stage.id!))
            .map(stage => ({ value: stage.id!, label: stage.name }));
            
    }, [workStages, transaction, currentUser, isEditingStage, progressDoc]);
    
    const handleLinkTransaction = async () => {
        if (!firestore || !currentUser || !appointment || !selectedTransactionToLink) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار معاملة لربطها.' });
            return;
        }

        setIsLinking(true);
        try {
            const batch = writeBatch(firestore);
            const apptRef = doc(firestore, 'appointments', appointment.id);
            batch.update(apptRef, { transactionId: selectedTransactionToLink });

            const selectedTx = clientTransactions.find(tx => tx.id === selectedTransactionToLink);
            const logContent = `قام ${currentUser.fullName} بربط هذا الموعد بالمعاملة: "${selectedTx?.transactionType || 'غير معروف'}".`;
            const logData = {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            };

            const timelineRef = doc(collection(firestore, `clients/${appointment.clientId}/transactions/${selectedTransactionToLink}/timelineEvents`));
            batch.set(timelineRef, logData);

            await batch.commit();
            toast({ title: 'نجاح', description: 'تم ربط الموعد بالمعاملة.' });
            
        } catch (error) {
            console.error("Error linking transaction:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل ربط المعاملة.' });
        } finally {
            setIsLinking(false);
        }
    };


    const handleUpdateStage = async () => {
        if (!firestore || !currentUser || !appointment || !selectedStageId || !appointment.transactionId || !appointment.clientId) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء اختيار مرحلة عمل. تأكد من أن هذه الزيارة مرتبطة بمعاملة وعميل.' });
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
            const historyRef = collection(firestore, 'clients', appointment.clientId, 'history');
            const timelineRef = collection(transactionRef, 'timelineEvents');
    
            const transactionSnap = await getDoc(transactionRef);
            if (!transactionSnap.exists()) {
                throw new Error("لم يتم العثور على المعاملة المرتبطة بهذا الموعد.");
            }
            const transactionData = transactionSnap.data() as ClientTransaction;
            const currentStages = [...(transactionData.stages || [])];
            let contractClauses = transactionData.contract ? [...transactionData.contract.clauses] : [];
            const now = new Date();
            
            if (isEditing && currentUser?.role === 'Admin' && appointment.workStageProgressId) {
                const progressDocRef = doc(firestore, 'work_stages_progress', appointment.workStageProgressId);
                const progressSnap = await getDoc(progressDocRef);
                if (progressSnap.exists()) {
                    const previousStageId = progressSnap.data().stageId;
                    const previousStageIndexInTemplate = workStages.findIndex(s => s.id === previousStageId);

                    if (previousStageIndexInTemplate !== -1) {
                        const previousStageIndexInProg = currentStages.findIndex(s => s.stageId === previousStageId);
                        if (previousStageIndexInProg !== -1 && currentStages[previousStageIndexInProg].status === 'completed') {
                            currentStages[previousStageIndexInProg].status = 'pending';
                            (currentStages[previousStageIndexInProg] as any).endDate = null;
                            (currentStages[previousStageIndexInProg] as any).startDate = null; 
                        }

                        const autoStartedStageTemplate = workStages[previousStageIndexInTemplate + 1];
                        if (autoStartedStageTemplate) {
                            const autoStartedStageIndexInProg = currentStages.findIndex(s => s.stageId === autoStartedStageTemplate.id);
                            if (autoStartedStageIndexInProg !== -1 && currentStages[autoStartedStageIndexInProg].status === 'in-progress') {
                                currentStages[autoStartedStageIndexInProg].status = 'pending';
                                (currentStages[autoStartedStageIndexInProg] as any).startDate = null;
                            }
                        }
                    }
                }
            }


            const completedStageIndex = currentStages.findIndex(s => s.stageId === selectedStage.id);
            if (completedStageIndex !== -1) {
                const stageToUpdate = { ...currentStages[completedStageIndex] };
                if (stageToUpdate.status !== 'completed') {
                    stageToUpdate.status = 'completed';
                    stageToUpdate.endDate = now as any;
                    if (!stageToUpdate.startDate) stageToUpdate.startDate = now as any;
                    currentStages[completedStageIndex] = stageToUpdate;
                }
            } else {
                currentStages.push({
                    stageId: selectedStage.id, name: selectedStage.name, status: 'completed', startDate: now as any, endDate: now as any, allowedRoles: selectedStage.allowedRoles,
                });
            }
            
            const completedStageOrderIndex = workStages.findIndex(s => s.id === selectedStage.id);
            const nextStageInTemplate = workStages[completedStageOrderIndex + 1];
            let shouldStartNextStage = false;

            if (nextStageInTemplate && nextStageInTemplate.stageType !== 'parallel') {
                const nextStageId = nextStageInTemplate.id!;
                
                const nextStageIndexInProg = currentStages.findIndex(s => s.stageId === nextStageId);
                if (nextStageIndexInProg > -1) {
                    const stageToStart = { ...currentStages[nextStageIndexInProg] };
                    if (stageToStart.status === 'pending') {
                        stageToStart.status = 'in-progress';
                        stageToStart.startDate = now as any;
                        currentStages[nextStageIndexInProg] = stageToStart;
                        shouldStartNextStage = true;
                    }
                } else {
                    currentStages.push({
                        stageId: nextStageId, name: nextStageInTemplate.name, status: 'in-progress', startDate: now as any, endDate: null, allowedRoles: nextStageInTemplate.allowedRoles,
                    });
                    shouldStartNextStage = true;
                }
            }

            let logContent = isEditing
                ? `قام ${currentUser.fullName} (مدير) بتعديل مرحلة الزيارة رقم ${appointment.visitCount || ''} إلى: "${selectedStage.name}".`
                : `قام ${currentUser.fullName} بإكمال مرحلة العمل "${selectedStage.name}" خلال الزيارة رقم ${appointment.visitCount || ''}.`;

            if (shouldStartNextStage && nextStageInTemplate) {
                logContent += ` وتم بدء المرحلة التالية تلقائياً: "${nextStageInTemplate.name}".`;
            }

            let commentContent = `تم إكمال مرحلة: ${selectedStage.name}.`;
            let outstandingBalance = 0;

            const completedStageNames = new Set(currentStages.filter(s => s.status === 'completed').map(s => s.name));
            
            const newContractClauses = contractClauses.map(clause => {
                if (clause.condition && completedStageNames.has(clause.condition) && clause.status === 'غير مستحقة') {
                    return { ...clause, status: 'مستحقة' as const };
                }
                return clause;
            });
            
            const totalAmountNowDue = newContractClauses
                .filter(c => c.status === 'مدفوعة' || c.status === 'مستحقة')
                .reduce((sum, c) => sum + c.amount, 0);

            const totalPaid = await getTotalPaidForProject(appointment.transactionId, firestore);
            outstandingBalance = totalAmountNowDue - totalPaid;

            if (outstandingBalance > 0) {
                const paymentNotificationText = `\n\n**[إشعار مالي]** بناءً على ذلك، أصبح هناك رصيد مستحق للدفع بقيمة **${formatCurrency(outstandingBalance)}**.`;
                commentContent += paymentNotificationText;
            }

            const logData = {
                type: 'log', content: logContent, userId: currentUser.id || 'system', userName: currentUser.fullName || 'System', userAvatar: currentUser.avatarUrl || '', createdAt: serverTimestamp(),
            };
            const commentData = {
                type: 'comment' as const, content: commentContent, userId: currentUser.id || 'system', userName: currentUser.fullName || 'System', userAvatar: currentUser.avatarUrl || '', createdAt: serverTimestamp(),
            };

            batch.set(doc(timelineRef), logData);
            batch.set(doc(historyRef), logData);
            batch.set(doc(timelineRef), commentData);
            batch.set(doc(historyRef), commentData);
    
            batch.update(transactionRef, { stages: currentStages, 'contract.clauses': newContractClauses });
    
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
            
            await batch.commit();
    
            toast({ title: 'نجاح', description: `تم ${isEditing ? 'تعديل' : 'تحديث'} مرحلة العمل إلى: ${selectedStage.name}` });
            
            const recipientsToNotify = new Set<string>();
            const link = `/dashboard/clients/${appointment.clientId}/transactions/${appointment.transactionId}`;

            if (transactionData.assignedEngineerId && transactionData.assignedEngineerId !== currentUser?.employeeId) {
                const assigneeUserId = await findUserIdByEmployeeId(firestore, transactionData.assignedEngineerId);
                if (assigneeUserId) {
                    recipientsToNotify.add(assigneeUserId);
                }
            }

            for (const recipientId of recipientsToNotify) {
                const body = `${currentUser.fullName} أنجز مرحلة "${selectedStage.name}" لمعاملة العميل ${client?.nameAr}.` + 
                             (outstandingBalance > 0 ? ` نتج عن ذلك رصيد مستحق بقيمة ${formatCurrency(outstandingBalance)}.` : '');
                
                await createNotification(firestore, {
                    userId: recipientId,
                    title: `تحديث على معاملة "${transactionData.transactionType}"`,
                    body: body,
                    link: link,
                });
            }

            if (outstandingBalance > 0) {
                const accountantsQuery = query(collection(firestore, 'users'), where('role', '==', 'Accountant'));
                const accountantsSnap = await getDocs(accountantsQuery);
                
                const accountantNotificationBody = `استحقاق دفعة بقيمة ${formatCurrency(outstandingBalance)} للعميل ${client?.nameAr} بعد إكمال مرحلة "${selectedStage.name}".`;
                
                for (const accountantDoc of accountantsSnap.docs) {
                    if (accountantDoc.id !== currentUser?.id) {
                        await createNotification(firestore, {
                            userId: accountantDoc.id,
                            title: 'إشعار استحقاق دفعة مالية',
                            body: accountantNotificationBody,
                            link: link
                        });
                    }
                }
            }
            
            setIsEditingStage(false);
    
        } catch (error) {
            console.error("Error updating work stage:", error);
            const errorMessage = error instanceof Error ? error.message : 'فشل حفظ تحديث مرحلة العمل.';
            toast({ variant: 'destructive', title: 'خطأ', description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveMinutes = async () => {
        if (!minutesContent.trim()) {
            toast({ variant: 'destructive', title: 'محتوى فارغ', description: 'الرجاء كتابة ملخص للزيارة.' });
            return;
        }
        if (!firestore || !currentUser || !appointment || !transaction || !client) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'لا يمكن حفظ الملخص حاليًا.' });
            return;
        }
    
        setIsSavingMinutes(true);
        try {
            const batch = writeBatch(firestore);
    
            const apptRef = doc(firestore, 'appointments', appointment.id);
            batch.update(apptRef, { minutesContent: minutesContent });
    
            const timelineCommentRef = doc(collection(firestore, `clients/${appointment.clientId}/transactions/${appointment.transactionId!}/timelineEvents`));
            const commentContent = `**[ملخص الزيارة رقم ${appointment.visitCount || ''}]**\n${minutesContent}`;
            const commentData = {
                type: 'comment',
                content: commentContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            };
            batch.set(timelineCommentRef, commentData);
            
            const historyLogRef = doc(collection(firestore, `clients/${appointment.clientId}/history`));
            const logContent = `أضاف ${currentUser.fullName} ملخص اجتماع للزيارة رقم ${appointment.visitCount || ''} المتعلقة بمعاملة "${transaction.transactionType}".`;
            const logData = {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
            };
            batch.set(historyLogRef, logData);
    
            await batch.commit();
    
            toast({ title: 'نجاح', description: 'تم حفظ ملخص الزيارة وإضافته لسجل المعاملة.' });
    
            if (transaction.assignedEngineerId && transaction.assignedEngineerId !== currentUser.employeeId) {
                const targetUserId = await findUserIdByEmployeeId(firestore, transaction.assignedEngineerId);
                if(targetUserId) {
                    await createNotification(firestore, {
                        userId: targetUserId,
                        title: `ملخص اجتماع جديد: ${client.nameAr}`,
                        body: `قام ${currentUser.fullName} بإضافة ملخص اجتماع جديد بخصوص معاملة "${transaction.transactionType}".`,
                        link: `/dashboard/clients/${appointment.clientId}/transactions/${appointment.transactionId!}`
                    });
                }
            }
        } catch (error) {
            console.error("Error saving meeting minutes:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ ملخص الاجتماع.' });
        } finally {
            setIsSavingMinutes(false);
        }
    };
    
    if (loading) {
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

    const safeAppointmentDate = toFirestoreDate(appointment.appointmentDate);

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
                    {appointment.clientId ? (
                        <InfoRow 
                            icon={<User />} 
                            label="العميل" 
                            value={
                                client ? (
                                    <Link href={`/dashboard/clients/${client.id}`} className="font-semibold text-primary hover:underline">{client.nameAr}</Link>
                                ) : (
                                    <Skeleton className="h-5 w-32" />
                                )
                            } 
                        />
                    ) : (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                            <div className="flex justify-between items-center">
                                <div className="space-y-1">
                                    <p className="font-semibold flex items-center gap-2">
                                        {isAutoLinking && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isAutoLinking ? "جاري البحث عن ملف للعميل..." : "عميل محتمل (غير مسجل)"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{appointment.clientName}</p>
                                    <p className="text-xs text-muted-foreground font-mono dir-ltr">{appointment.clientMobile}</p>
                                </div>
                                <Button asChild size="sm" disabled={isAutoLinking}>
                                    <Link href={`/dashboard/clients/new?nameAr=${encodeURIComponent(appointment.clientName || '')}&mobile=${encodeURIComponent(appointment.clientMobile || '')}&engineerId=${appointment.engineerId}&fromAppointmentId=${appointment.id}`}>
                                        <UserPlus className="ml-2 h-4 w-4" />
                                        إنشاء ملف عميل
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    )}

                    <InfoRow icon={<User />} label="المهندس المسؤول" value={engineer?.fullName} />
                    <InfoRow icon={<Calendar />} label="تاريخ الموعد" value={safeAppointmentDate ? format(safeAppointmentDate, "eeee, dd MMMM yyyy", { locale: ar }) : ''} />
                    <InfoRow icon={<Clock />} label="وقت الموعد" value={safeAppointmentDate ? format(safeAppointmentDate, "p", { locale: ar }) : ''} />
                </CardContent>
            </Card>

            {client && !appointment.transactionId && clientTransactions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>ربط بمعاملة</CardTitle>
                        <CardDescription>هذا الموعد غير مرتبط بأي معاملة. اختر معاملة لربطه بها.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-end gap-4">
                        <div className="grid gap-2 flex-grow">
                            <Label htmlFor="link-transaction">اختر معاملة</Label>
                            <InlineSearchList 
                                value={selectedTransactionToLink}
                                onSelect={setSelectedTransactionToLink}
                                options={clientTransactions.map(tx => ({ value: tx.id!, label: tx.transactionType }))}
                                placeholder="اختر من معاملات العميل..."
                            />
                        </div>
                        <Button onClick={handleLinkTransaction} disabled={isLinking || !selectedTransactionToLink}>
                            {isLinking ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Link2 className="ml-2 h-4 w-4"/>}
                            ربط
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>إجراءات الزيارة</CardTitle>
                </CardHeader>
                 <CardContent>
                    {!appointment.clientId ? (
                        <Alert variant="default">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>زيارة عميل محتمل</AlertTitle>
                            <AlertDescription>
                                للمتابعة، يمكنك إنشاء ملف للعميل من الأعلى. إذا لم يكن هناك إجراء آخر، يمكنك إغلاق الزيارة.
                            </AlertDescription>
                        </Alert>
                    ) : !appointment.transactionId ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>زيارة غير مرتبطة بمعاملة</AlertTitle>
                            <AlertDescription>
                                لا يمكن تحديث مرحلة العمل لأن هذه الزيارة غير مرتبطة بأي معاملة. الرجاء ربطها بمعاملة أولاً.
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
            </Card>

            {appointment.workStageUpdated && (
                <Card>
                    <CardHeader>
                        <CardTitle>ملخص الزيارة / محضر الاجتماع</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {appointment.minutesContent ? (
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap p-4 border rounded-md bg-muted/50">
                                {appointment.minutesContent}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <Textarea
                                    placeholder="اكتب هنا ملخصًا للزيارة، النقاط التي تم الاتفاق عليها، والمهام المطلوبة للمتابعة..."
                                    rows={5}
                                    value={minutesContent}
                                    onChange={(e) => setMinutesContent(e.target.value)}
                                    disabled={isSavingMinutes}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handleSaveMinutes} disabled={isSavingMinutes || !minutesContent.trim()}>
                                        {isSavingMinutes ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Save className="ml-2 h-4 w-4"/>}
                                        حفظ الملخص
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            <CardFooter className="flex flex-col items-start gap-2 border-t pt-6">
                <Button 
                    disabled={!appointment.workStageUpdated && !!appointment.clientId}
                    onClick={() => router.push('/dashboard/appointments')}
                >
                    <ArrowRight className="ml-2 h-4 w-4" />
                    إغلاق الزيارة والعودة للتقويم
                </Button>
                {!appointment.workStageUpdated && !!appointment.clientId && (
                        <Alert variant="destructive" className="w-full">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>إجراء مطلوب</AlertTitle>
                        <AlertDescription>
                            يجب تحديث مرحلة العمل أولاً قبل إغلاق الزيارة.
                        </AlertDescription>
                    </Alert>
                )}
            </CardFooter>
        </div>
    )
}
