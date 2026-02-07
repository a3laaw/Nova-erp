
'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, type DocumentData, getDocs, writeBatch, serverTimestamp, deleteField, deleteDoc, updateDoc, where, getDoc, collectionGroup } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, ChevronDown, Trash2, MoreHorizontal, Eye, FolderLock, FolderOpen, Loader2, Printer, FileText, Calendar, Workflow, Play, Check, Pause, Users, CheckSquare, FileSignature, MessageSquare, Undo2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import type { Client, ClientTransaction, Employee, Quotation, TransactionStage, WorkStage, UserRole, Department, TransactionAssignment, TransactionType } from '@/lib/types';
import { format, differenceInDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { TransactionAssignmentDialog } from '@/components/clients/transaction-assignment-dialog';
import { Separator } from '@/components/ui/separator';
import {
    getDocs as getDocsFromFirestore,
    collection as collectionFromFirestore
} from 'firebase/firestore';


const getTotalPaidForProject = async (projectId: string, db: any) => {
    let total = 0;
    if (!projectId || !db) return total;
    const receiptsQuery = query(collectionFromFirestore(db, 'cashReceipts'), where('projectId', '==', projectId));
    const receiptsSnap = await getDocsFromFirestore(receiptsQuery);
    receiptsSnap.forEach(doc => {
        total += doc.data().amount || 0;
    });
    return total;
};


const transactionStatusTranslations: Record<string, string> = {
  new: 'جديدة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  submitted: 'تم تسليمها',
  'on-hold': 'مجمدة',
};

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
  'on-hold': 'bg-gray-100 text-gray-800 border-gray-200',
};

const stageStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  skipped: 'bg-yellow-100 text-yellow-800',
  'awaiting-review': 'bg-orange-100 text-orange-800',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'معلقة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  skipped: 'تم تخطيها',
  'awaiting-review': 'بانتظار المراجعة',
};


function StageCountdown({ stage }: { stage: TransactionStage }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  if (stage.status !== 'in-progress' || !stage.expectedEndDate) {
    return null;
  }

  const endDate = toFirestoreDate(stage.expectedEndDate);
  if (!endDate) return null;

  const daysRemaining = differenceInDays(endDate, now);

  if (daysRemaining < 0) {
    return <Badge variant="destructive">متأخرة {Math.abs(daysRemaining)} أيام</Badge>
  } else if (daysRemaining === 0) {
    return <Badge variant="destructive" className="bg-orange-500 border-orange-600 text-white">اليوم الأخير</Badge>
  } else {
    return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">{`متبقٍ ${daysRemaining + 1} أيام`}</Badge>
  }
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode | string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground pt-1">{icon}</div>
            <div className="font-semibold w-32">{label}</div>
            <div className="text-muted-foreground break-words">{value}</div>
        </div>
    );
}

const EMPTY_ARRAY_FOR_SUBSCRIPTION: DocumentData[] = [];

// Helper function to check if a stage can be started
const canStartStage = (stage: Partial<TransactionStage>, allStages: TransactionStage[]): { allowed: boolean, reason: string } => {
    if (stage.stageType === 'parallel') {
        if (!stage.allowedDuringStages || stage.allowedDuringStages.length === 0) {
            return { allowed: true, reason: '' };
        }
        const isDuringAllowedStage = allStages.some(s => 
            stage.allowedDuringStages!.includes(s.stageId) && s.status === 'in-progress'
        );
        if (isDuringAllowedStage) {
            return { allowed: true, reason: '' };
        }
        return { allowed: false, reason: 'لا يمكن بدء هذه المرحلة الخدمية الآن.' };
    }

    const predecessors = allStages.filter(s => s.nextStageIds?.includes(stage.stageId!));

    if (predecessors.length === 0) {
        return { allowed: true, reason: '' };
    }

    const arePredecessorsCompleted = predecessors.every(p => p.status === 'completed');
    
    if (arePredecessorsCompleted) {
        return { allowed: true, reason: '' };
    }
    
    return { allowed: false, reason: 'يجب إكمال المراحل السابقة أولاً.' };
};


export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [workStageTemplates, setWorkStageTemplates] = useState<WorkStage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionToCancel, setTransactionToCancel] = useState<ClientTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);

  const transactionRef = useMemo(() => {
    if (!firestore || !clientId || !transactionId) return null;
    return doc(firestore, 'clients', clientId, 'transactions', transactionId);
  }, [firestore, clientId, transactionId]);
  
  const clientRef = useMemo(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'clients', clientId);
  }, [firestore, clientId]);

  const { data: transaction, loading: transactionLoading, error: transactionError } = useDocument<ClientTransaction>(firestore, transactionRef ? transactionRef.path : null);
  const { data: client, loading: clientLoading, error: clientError } = useDocument<Client>(firestore, clientRef ? clientRef.path : null);

  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        const q = query(collection(firestore, 'employees'));
        const querySnapshot = await getDocs(q);
        const newMap = new Map<string, string>();
        querySnapshot.forEach(doc => {
            const emp = doc.data() as Employee;
            newMap.set(doc.id, emp.fullName);
        });
        setEmployeesMap(newMap);
    };
    fetchEmployees();
  }, [firestore]);
  
  useEffect(() => {
    if (!firestore || !transaction?.transactionTypeId) {
        setWorkStageTemplates([]);
        return;
    }
    
    const fetchTemplates = async () => {
        try {
            const transTypeRef = doc(firestore, 'transactionTypes', transaction.transactionTypeId!);
            const transTypeSnap = await getDoc(transTypeRef);
            if (!transTypeSnap.exists()) {
                setWorkStageTemplates([]);
                return;
            }

            const transTypeData = transTypeSnap.data() as TransactionType;
            const departmentIds = transTypeData.departmentIds || [];
            
            if (departmentIds.length === 0) {
                setWorkStageTemplates([]);
                return;
            }

            const stagePromises = departmentIds.map(deptId => 
                getDocs(query(collection(firestore, `departments/${deptId}/workStages`), orderBy('order')))
            );
            
            const stageSnapshots = await Promise.all(stagePromises);
            
            const allStages = new Map<string, WorkStage>();
            stageSnapshots.forEach(snapshot => {
                snapshot.docs.forEach(doc => {
                    if (!allStages.has(doc.id)) {
                        allStages.set(doc.id, { id: doc.id, ...doc.data() } as WorkStage);
                    }
                });
            });

            setWorkStageTemplates(Array.from(allStages.values()));
        } catch (error) {
            console.error("Error fetching work stage templates:", error);
            toast({ variant: "destructive", title: "خطأ", description: "فشل في تحميل قوالب مراحل العمل." });
        }
    };

    fetchTemplates();
  }, [firestore, transaction?.transactionTypeId, toast]);

  const handleModificationIncrement = async (stageId: string) => {
    if (!firestore || !currentUser || !transaction || !stageId || !client) return;

    const stageToUpdate = transaction.stages?.find(s => s.stageId === stageId);
    if (!stageToUpdate || stageToUpdate.status !== 'in-progress') {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن تسجيل تعديل لهذه المرحلة حاليًا.' });
        return;
    }
    
    const stageTemplate = workStageTemplates.find(t => t.id === stageId);
    if (!stageTemplate || !stageTemplate.enableModificationTracking) {
        toast({ variant: 'destructive', title: 'غير مسموح', description: 'خاصية تتبع التعديلات غير مفعلة لهذه المرحلة.' });
        return;
    }

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const transactionRefDoc = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    
        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
        const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
    
        if (stageIndex === -1) throw new Error("Stage not found");
    
        const stage = currentStages[stageIndex];
        stage.modificationCount = (stage.modificationCount || 0) + 1;
        
        batch.update(transactionRefDoc, { stages: currentStages });
    
        const safeApptDate = toFirestoreDate(transaction.createdAt); // Fallback to transaction creation date
        const logContent = `قام ${currentUser.fullName} بتسجيل تعديل جديد للمرحلة: "${stage.name}" (التعديل رقم ${stage.modificationCount}).`;
        
        const logData = {
            type: 'log' as const,
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        };
    
        const timelineRef = collection(transactionRefDoc, 'timelineEvents');
        batch.set(doc(timelineRef), logData);
        
        const historyRef = doc(collection(firestore, `clients/${clientId}/history`));
        batch.set(historyRef, { ...logData, content: `[${transaction.transactionType}] ${logContent}`});
        
        await batch.commit();
    
        toast({ title: 'نجاح', description: 'تم تسجيل التعديل بنجاح.' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'فشل تسجيل التعديل.';
        toast({ variant: 'destructive', title: 'خطأ', description: message });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleStageStatusChange = async (stageId: string, newStatus: TransactionStage['status']) => {
        if (!firestore || !currentUser || !transaction) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transactionId);

            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            const stageTemplate = workStageTemplates.find(t => t.id === stageId);
            const originalStatus = stage.status;
            stage.status = newStatus;
            
            const now = new Date();
            if (newStatus === 'in-progress' && !stage.startDate) stage.startDate = now;
            if (newStatus === 'completed') stage.endDate = now;
            
            // Auto-start next sequential stage
            if (newStatus === 'completed' && stageTemplate?.nextStageIds) {
                for (const nextStageId of stageTemplate.nextStageIds) {
                    const nextStageIndex = currentStages.findIndex(s => s.stageId === nextStageId);
                    if (nextStageIndex !== -1 && currentStages[nextStageIndex].status === 'pending') {
                         const nextStage = currentStages[nextStageIndex];
                         const canStart = canStartStage(nextStage, currentStages);
                         if (canStart.allowed) {
                            nextStage.status = 'in-progress';
                            nextStage.startDate = now;
                         }
                    }
                }
            }
            batch.update(transactionRef, { stages: currentStages });
            await batch.commit();
            toast({ title: 'نجاح', description: `تم تحديث حالة المرحلة إلى ${stageStatusTranslations[newStatus]}.` });
        } catch (error) {
            console.error("Error updating stage status:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث حالة المرحلة.' });
        } finally {
            setIsProcessing(false);
        }
  };

   const handleRevertStage = async (stageIdToRevert: string) => {
    if (!firestore || !currentUser || !transaction) return;

    setIsProcessing(true);
    const batch = writeBatch(firestore);
    const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transactionId);

    try {
        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
        const stageIndex = currentStages.findIndex(s => s.stageId === stageIdToRevert);

        if (stageIndex === -1 || currentStages[stageIndex].status !== 'completed') {
            throw new Error('لا يمكن التراجع عن مرحلة غير مكتملة.');
        }

        const stageToRevert = currentStages[stageIndex];
        const revertedStageName = stageToRevert.name;

        stageToRevert.status = 'in-progress';
        stageToRevert.endDate = null;

        const stageTemplate = workStageTemplates.find(t => t.id === stageIdToRevert);

        if (stageTemplate?.nextStageIds) {
            for (const nextStageId of stageTemplate.nextStageIds) {
                const nextStageIndex = currentStages.findIndex(s => s.stageId === nextStageId);
                if (nextStageIndex !== -1) {
                    const nextStage = currentStages[nextStageIndex];
                    if (nextStage.status === 'in-progress') {
                        const template = workStageTemplates.find(t => t.id === nextStageId);
                        if (template?.stageType === 'sequential') {
                             nextStage.status = 'pending';
                             nextStage.startDate = null;
                        }
                    }
                }
            }
        }
        
        const contract = transaction.contract;
        if (contract?.clauses) {
            const completedStageNames = new Set(currentStages.filter(s => s.status === 'completed').map(s => s.name));
            const updatedClauses = contract.clauses.map(clause => {
                if (clause.condition === revertedStageName && clause.status === 'مستحقة') {
                    return { ...clause, status: 'غير مستحقة' as const };
                }
                if (clause.condition && !completedStageNames.has(clause.condition) && clause.status === 'مستحقة') {
                    return { ...clause, status: 'غير مستحقة' as const };
                }
                return clause;
            });
            batch.update(transactionRef, { 'contract.clauses': updatedClauses });
        }


        batch.update(transactionRef, { stages: currentStages });

        const logContent = `قام ${currentUser.fullName} بالتراجع عن إكمال المرحلة: "${revertedStageName}".`;
        const logData = {
            type: 'log' as const,
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp()
        };
        const timelineRef = doc(collection(transactionRef, 'timelineEvents'));
        batch.set(timelineRef, logData);
        
        const historyRef = doc(collection(firestore, `clients/${clientId}/history`));
        batch.set(historyRef, { ...logData, content: `[${transaction.transactionType}] ${logContent}`});
        
        await batch.commit();

        toast({ title: 'نجاح', description: `تم التراجع عن إكمال مرحلة "${revertedStageName}".` });

    } catch (error) {
        console.error("Error reverting stage:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: (error as Error).message || 'فشل التراجع عن المرحلة.' });
    } finally {
        setIsProcessing(false);
    }
};

  const enrichedStages = useMemo(() => {
    if (!transaction || !workStageTemplates) return [];
    
    const progressStages = transaction.stages || [];
    
    const combined = workStageTemplates.map(template => {
        const progress = progressStages.find(p => p.stageId === template.id);
        return {
            ...template,
            ...progress,
            status: progress?.status || 'pending', 
        } as TransactionStage & WorkStage;
    });

    return combined.sort((a,b) => (a.order ?? 99) - (b.order ?? 99));
  }, [transaction, workStageTemplates]);

  const trackableInProgressStages = useMemo(() => 
    enrichedStages.filter(s => s.status === 'in-progress' && s.enableModificationTracking === true),
  [enrichedStages]);

  const assignedEngineerName = transaction?.assignedEngineerId ? employeesMap.get(transaction.assignedEngineerId) : null;
  
  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = toFirestoreDate(dateValue);
      if (!date) return '-';
      try {
        return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
      } catch (e) {
        return '-';
      }
  }

  const isLoading = transactionLoading || clientLoading || employeesMap.size === 0;

  if (isLoading) {
    return <div className="space-y-6" dir="rtl"><Card><CardHeader><Skeleton className="h-8 w-64" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card></div>;
  }
  if (transactionError || clientError || !transaction || !client) {
    return <div className="text-center py-10 text-destructive">فشل تحميل بيانات المعاملة.</div>;
  }

  return (
    <>
    <div className='space-y-6' dir='rtl'>
        <Card>
            <CardHeader>
                <div className='flex justify-between items-start'>
                    <div className='space-y-1'>
                        <CardTitle className='text-2xl flex items-center gap-3'>
                            {transaction.transactionType}
                            {transaction.transactionNumber && <Badge variant="secondary" className="font-mono">{transaction.transactionNumber}</Badge>}
                        </CardTitle>
                        <CardDescription>
                            معاملة خاصة بالعميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link>
                        </CardDescription>
                    </div>
                     <div className='text-right'>
                        <Badge variant="outline" className={transactionStatusColors[transaction.status]}>
                            {transactionStatusTranslations[transaction.status]}
                        </Badge>
                     </div>
                </div>
            </CardHeader>
            <CardContent>
                <InfoRow icon={<User />} label="المهندس المسؤول" value={assignedEngineerName || <span className='text-muted-foreground'>لم يحدد</span>} />
                <InfoRow icon={<Calendar />} label="تاريخ الإنشاء" value={formatDate(transaction.createdAt)} />
                {transaction.description && (
                     <div className='mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md'>
                        <p className='font-semibold mb-1 text-foreground'>ملاحظات المعاملة:</p>
                        {transaction.description}
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stages">مراحل المعاملة</TabsTrigger>
                <TabsTrigger value="comments">التعليقات والمتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="stages" className="mt-6">
                {trackableInProgressStages.length > 0 && (
                    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/30 mb-6">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-base">
                                تسجيل تعديلات على المراحل الحالية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {trackableInProgressStages.map(stage => (
                                <div key={stage.stageId} className="flex justify-between items-center p-2 bg-background rounded-md border">
                                    <p className="font-semibold">{stage.name}</p>
                                    <Button size="sm" variant="outline" className="h-8 px-3 text-orange-600 border-orange-300 hover:bg-orange-100" onClick={() => handleModificationIncrement(stage.stageId!)} disabled={isProcessing}>
                                        <Plus className="ml-1 h-4 w-4" />
                                        تسجيل تعديل جديد
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><Workflow className='text-primary'/> سير العمل</CardTitle>
                        <CardDescription>تتبع التقدم في كل مرحلة من مراحل المعاملة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-48 w-full" /> : !enrichedStages || enrichedStages.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">لا توجد مراحل محددة لهذه المعاملة.</div>
                        ) : (
                            <div className="space-y-4">
                                {enrichedStages.map((stage) => {
                                    const canInteract = currentUser?.role === 'Admin' || (stage.allowedRoles && stage.allowedRoles.includes(currentUser?.jobTitle || ''));
                                    const canBeStarted = canStartStage(stage, transaction.stages as TransactionStage[]);

                                    return (
                                        <div key={stage.stageId} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={cn("w-28 justify-center", stageStatusColors[stage.status!])}>
                                                    {stageStatusTranslations[stage.status!]}
                                                </Badge>
                                                <div className="font-semibold">{stage.name}</div>
                                                {stage.trackingType === 'duration' && <StageCountdown stage={stage as TransactionStage} />}
                                                {stage.trackingType === 'occurrence' && stage.maxOccurrences && <Badge variant="secondary">الإنجاز: {stage.completedCount || 0} / {stage.maxOccurrences}</Badge>}
                                                {stage.modificationCount && stage.modificationCount > 0 && <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">التعديلات: {stage.modificationCount}</Badge>}
                                                {stage.allowedRoles && stage.allowedRoles.map(role => (
                                                    <Badge key={role} variant="secondary" className="font-normal">{role}</Badge>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                {stage.status === 'pending' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId!, 'in-progress')} disabled={!canInteract || !canBeStarted.allowed} title={!canBeStarted.allowed ? canBeStarted.reason : ''}>
                                                        <Play className="ml-2 h-4 w-4" /> بدء
                                                    </Button>
                                                )}
                                                {stage.status === 'in-progress' && (
                                                    <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleStageStatusChange(stage.stageId!, 'completed')} disabled={!canInteract}>
                                                        <Check className="ml-2 h-4 w-4" />
                                                        {'إكمال'}
                                                    </Button>
                                                )}
                                                {stage.status === 'completed' && currentUser?.role === 'Admin' && (
                                                     <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleRevertStage(stage.stageId!)} disabled={isProcessing}>
                                                        <Undo2 className="ml-1 h-4 w-4" /> تراجع
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="comments" className="mt-6">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="comment" showInput={true} title="التعليقات والمتابعة" icon={<MessageSquare className="text-primary" />} client={client} transaction={transaction}/>
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="log" showInput={false} title="سجل الأحداث" icon={<History className='text-primary'/>} client={client} transaction={transaction}/>
            </TabsContent>
        </Tabs>
    </div>
    </>
  );
}
