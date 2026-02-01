
      'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, getDocs, collection, writeBatch, serverTimestamp, updateDoc, query, orderBy, where } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BadgeInfo, Calendar, User, History, MessageSquare, Save, Loader2, FileText, Pencil, Printer, Workflow, Play, Check, Pause, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import type { Employee, ClientTransaction, TransactionStage, WorkStage, UserRole, Client, Department, TransactionAssignment } from '@/lib/types';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import { cn, cleanFirestoreData, formatCurrency } from '@/lib/utils';
import { format, differenceInDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { toFirestoreDate } from '@/services/date-converter';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { TransactionAssignmentDialog } from '@/components/clients/transaction-assignment-dialog';
import { Separator } from '@/components/ui/separator';

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


// Using the same translation objects from client profile page
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

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [stages, setStages] = useState<TransactionStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);


  // --- Data Fetching ---
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
  
  const assignmentsQuery = useMemo(() => {
    if (!firestore || !transactionId) return null;
    return [where('transactionId', '==', transactionId)];
  }, [firestore, transactionId]);

  const { data: assignments, loading: assignmentsLoading } = useSubscription<TransactionAssignment>(firestore, 'transaction_assignments', assignmentsQuery || []);

  useEffect(() => {
    if (!firestore) return;
    const fetchRefData = async () => {
      try {
        const [empSnap, deptSnap] = await Promise.all([
          getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
          getDocs(query(collection(firestore, 'departments'), orderBy('name'))),
        ]);

        setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
        setDepartments(deptSnap.docs.map(d => ({id: d.id, ...d.data()} as Department)));
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب بيانات الأقسام والموظفين.' });
      }
    };
    fetchRefData();
  }, [firestore, toast]);
  
  useEffect(() => {
    if (!transaction || !firestore) {
        if (!transaction) setLoadingStages(false);
        return;
    };

    const mergeAndSetStages = async () => {
        setLoadingStages(true);
        try {
            let templateStages: WorkStage[] = [];
            if (transaction.departmentId) {
                const stagesQuery = query(
                    collection(firestore, `departments/${transaction.departmentId}/workStages`),
                    orderBy('order', 'asc') // Rely on order property from reference data
                );
                const stagesSnapshot = await getDocs(stagesQuery);
                templateStages = stagesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage));
            }

            const progressData = transaction.stages || [];
            const progressMap = new Map(progressData.map(p => [p.stageId, p]));

            const mergedStages: TransactionStage[] = templateStages.map(template => {
                const progress = progressMap.get(template.id!);
                return {
                    stageId: template.id!,
                    name: template.name,
                    order: (template as any).order,
                    allowedRoles: template.allowedRoles,
                    expectedDurationDays: template.expectedDurationDays,
                    trackingType: template.trackingType,
                    maxOccurrences: template.maxOccurrences,
                    status: progress?.status || 'pending',
                    startDate: progress?.startDate || null,
                    endDate: progress?.endDate || null,
                    expectedEndDate: progress?.expectedEndDate || null,
                    notes: progress?.notes || '',
                    completedCount: progress?.completedCount || 0,
                };
            });

            setStages(mergedStages);
        } catch (e) {
            console.error("Error merging stages:", e);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل مراحل المعاملة بشكل صحيح.' });
        } finally {
            setLoadingStages(false);
        }
    };
    
    mergeAndSetStages();
    
  }, [transaction, firestore, toast]);

    

  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(date.getTime())) return '-';
      return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  const handleStageStatusChange = async (stageId: string, newStatus: TransactionStage['status']) => {
    if (!firestore || !transaction || !currentUser || !client) return;

    const originalProgress = [...(transaction.stages || [])];
    const stageTemplateInfo = stages.find(s => s.stageId === stageId);
    if (!stageTemplateInfo) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'تعريف المرحلة غير موجود.' });
        return;
    }
    
    // --- Initial Validation ---
    if (newStatus === 'in-progress') {
        const canStart = canStartStage(stageTemplateInfo, stages);
        if (!canStart.allowed) {
            toast({ variant: 'destructive', title: 'لا يمكن بدء المرحلة', description: canStart.reason });
            return;
        }
    }
    
    const stageProgressIndex = originalProgress.findIndex(s => s.stageId === stageId);
    let updatedProgress: Partial<TransactionStage>;

    if (stageProgressIndex > -1) {
        updatedProgress = { ...originalProgress[stageProgressIndex] };
    } else {
        updatedProgress = { stageId: stageId, name: stageTemplateInfo.name, allowedRoles: stageTemplateInfo.allowedRoles, trackingType: stageTemplateInfo.trackingType, };
    }
    
    const oldStatus = updatedProgress.status || 'pending';
    if(oldStatus === newStatus && stageTemplateInfo.trackingType !== 'occurrence') return; // Allow re-completing occurrence stages
    
    const now = new Date();
    
    // --- Logic for different action types ---
    let logContent = '';
    let isFinallyCompleted = false;

    if (newStatus === 'completed' && stageTemplateInfo.trackingType === 'occurrence') {
        // This is an occurrence log, not a simple status change
        const newCount = (updatedProgress.completedCount || 0) + 1;
        updatedProgress.completedCount = newCount;
        const maxOccurrences = stageTemplateInfo.maxOccurrences || 1;
        
        logContent = `قام ${currentUser.fullName} بتسجيل إنجاز للمرحلة "${updatedProgress.name}" (${newCount}/${maxOccurrences}).`;

        if (newCount >= maxOccurrences) {
            updatedProgress.status = 'completed';
            if (!updatedProgress.startDate) updatedProgress.startDate = now;
            updatedProgress.endDate = now;
            isFinallyCompleted = true;
            logContent = `قام ${currentUser.fullName} بإكمال المرحلة "${updatedProgress.name}" (وصل للحد الأقصى ${maxOccurrences} إنجازات).`;
        } else {
            updatedProgress.status = 'in-progress';
        }
    } else {
        // This is a standard status change for 'duration' or 'none' types
        logContent = `قام ${currentUser.fullName} بتغيير حالة المرحلة "${stageTemplateInfo.name}" إلى "${stageStatusTranslations[newStatus]}".`;
        updatedProgress.status = newStatus;

        if (newStatus === 'in-progress') {
            if (oldStatus === 'pending') {
                updatedProgress.startDate = now;
                if (stageTemplateInfo.trackingType === 'duration' && stageTemplateInfo.expectedDurationDays) {
                    updatedProgress.expectedEndDate = addDays(now, stageTemplateInfo.expectedDurationDays);
                }
            }
        } else if (newStatus === 'completed') {
            if (!updatedProgress.startDate) updatedProgress.startDate = now;
            updatedProgress.endDate = now;
            isFinallyCompleted = true;
        } else {
            // For 'pending', 'skipped', 'awaiting-review'
            updatedProgress.endDate = null;
            updatedProgress.expectedEndDate = null;
        }
    }
    
    // --- Update stages array ---
    let newProgressForFirestore;
    if (stageProgressIndex > -1) {
        newProgressForFirestore = [...originalProgress];
        newProgressForFirestore[stageProgressIndex] = updatedProgress as TransactionStage;
    } else {
        newProgressForFirestore = [...originalProgress, updatedProgress as TransactionStage];
    }

    // --- Side Effects (Start next stage, etc.) ---
    let nextStageInTemplate: WorkStage | undefined = undefined;
    if (isFinallyCompleted) {
        const completedStageOrderIndex = stages.findIndex(s => s.stageId === stageId);
        if (completedStageOrderIndex > -1 && (completedStageOrderIndex + 1) < stages.length) {
            nextStageInTemplate = stages[completedStageOrderIndex + 1] as WorkStage;
            if (nextStageInTemplate) {
                logContent += ` وتم بدء المرحلة التالية تلقائياً: "${nextStageInTemplate.name}".`;
                const nextStageIndexInProg = newProgressForFirestore.findIndex(s => s.stageId === nextStageInTemplate!.id);
                
                const stageToStart: Partial<TransactionStage> = nextStageIndexInProg > -1
                    ? { ...newProgressForFirestore[nextStageIndexInProg] }
                    : { 
                        stageId: nextStageInTemplate.id!, 
                        name: nextStageInTemplate.name,
                        status: 'pending',
                        allowedRoles: nextStageInTemplate.allowedRoles,
                        trackingType: nextStageInTemplate.trackingType,
                        expectedDurationDays: nextStageInTemplate.expectedDurationDays,
                        maxOccurrences: nextStageInTemplate.maxOccurrences,
                        completedCount: 0,
                        startDate: null,
                        endDate: null,
                        expectedEndDate: null,
                        notes: '',
                      };
                
                if (stageToStart.status === 'pending') {
                    stageToStart.status = 'in-progress';
                    stageToStart.startDate = now as any;
                     if (nextStageInTemplate.trackingType === 'duration' && nextStageInTemplate.expectedDurationDays) {
                        stageToStart.expectedEndDate = addDays(now, nextStageInTemplate.expectedDurationDays) as any;
                    }
                    if (nextStageIndexInProg > -1) newProgressForFirestore[nextStageIndexInProg] = stageToStart as TransactionStage;
                    else newProgressForFirestore.push(stageToStart as TransactionStage);
                }
            }
        }
    }

    // --- SMART PAYMENT DUE LOGIC ---
    let commentContent = logContent;
    if(isFinallyCompleted) {
         const contractClauses = transaction.contract?.clauses || [];
         const completedStageNames = new Set(newProgressForFirestore.filter(s => s.status === 'completed').map(s => s.name));
         const newContractClauses = contractClauses.map(clause => (clause.condition && completedStageNames.has(clause.condition) && clause.status === 'غير مستحقة') ? { ...clause, status: 'مستحقة' as const } : clause);
         const totalAmountNowDue = newContractClauses.filter(c => c.status === 'مدفوعة' || c.status === 'مستحقة').reduce((sum, c) => sum + c.amount, 0);
         const totalPaid = await getTotalPaidForProject(transactionId, firestore);
         const outstandingBalance = totalAmountNowDue - totalPaid;

         if(outstandingBalance > 0) {
             commentContent += `\n\n**[إشعار مالي]** بناءً على ذلك، أصبح هناك رصيد مستحق للدفع بقيمة **${formatCurrency(outstandingBalance)}**.`;
         }
         batch.update(transactionRefDoc, { 'contract.clauses': newContractClauses });
    }
    
    const transactionRefDoc = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    const batch = writeBatch(firestore);
    
    const timelineCollectionRef = collection(transactionRefDoc, 'timelineEvents');
    const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);

    batch.set(doc(timelineCollectionRef), { type: 'log', content: logContent, userId: currentUser.id, userName: currentUser.fullName, createdAt: serverTimestamp() });
    batch.set(doc(historyCollectionRef), { type: 'log', content: `[${transaction.transactionType}] ${logContent}`, userId: currentUser.id, userName: currentUser.fullName, createdAt: serverTimestamp() });
    if(commentContent !== logContent) {
        batch.set(doc(timelineCollectionRef), { type: 'comment', content: commentContent, userId: 'system', userName: 'النظام', createdAt: serverTimestamp() });
    }
    
    batch.update(transactionRefDoc, { stages: newProgressForFirestore });
    
    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم تحديث حالة المرحلة بنجاح.' });
    } catch (e) {
        console.error("Failed to update stage status:", e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث المرحلة.' });
    }
  };

  const canStartStage = (stage: TransactionStage, allStages: TransactionStage[]) => {
    const specialStartStages = ['توقيع العقد', 'الاستفسارات والتواصل المبدئي'];
    if (specialStartStages.includes(stage.name)) {
        return { allowed: true };
    }

    const contractStage = allStages.find(s => s.name === 'توقيع العقد');
    if (!contractStage || contractStage.status !== 'completed') {
        return { allowed: false, reason: 'يجب إكمال مرحلة "توقيع العقد" أولاً.' };
    }

    const currentIndex = allStages.findIndex(s => s.stageId === stage.stageId);
    if (currentIndex > 0) {
        let prevIndex = currentIndex - 1;
        let prevStage = allStages[prevIndex];
        
        // Skip 'discussion' stages when checking sequential dependency
        if (prevStage?.name === 'تعديلات ومناقشات' && prevIndex > 0) {
            prevStage = allStages[prevIndex - 1];
        }

        if (prevStage && prevStage.status !== 'completed') {
            return { allowed: false, reason: `الرجاء إكمال المرحلة السابقة: "${prevStage.name}".` };
        }
    }
    
    return { allowed: true };
  }

  // --- Render Logic ---
  const isLoading = transactionLoading || clientLoading || assignmentsLoading;

  if (isLoading) {
    return (
        <div className="space-y-6" dir="rtl">
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full mt-6" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (transactionError || clientError || !transaction || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{transactionError?.message || clientError?.message || 'لم يتم العثور على المعاملة أو العميل.'}</p>
      </div>
    );
  }

  return (
    <>
    {transaction && client && (
        <ContractClausesForm
            isOpen={isContractFormOpen}
            onClose={() => setIsContractFormOpen(false)}
            transaction={transaction}
            clientId={clientId}
            clientName={(client as any).nameAr}
        />
    )}
    {transaction && client && (
        <TransactionAssignmentDialog
            isOpen={isAssignmentDialogOpen}
            onClose={() => setIsAssignmentDialogOpen(false)}
            transaction={transaction}
            clientName={(client as any).nameAr}
        />
    )}
    <div className='space-y-6' dir='rtl'>
        <Card>
            <CardHeader>
                <div className='flex justify-between items-start'>
                    <div className='space-y-1'>
                        <CardTitle className='text-2xl flex items-center gap-3'>
                            {transaction.transactionType}
                            {transaction.transactionNumber && (
                                <Badge variant="secondary" className="font-mono">{transaction.transactionNumber}</Badge>
                            )}
                        </CardTitle>
                        <CardDescription>
                            معاملة خاصة بالعميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{(client as any).nameAr}</Link>
                        </CardDescription>
                    </div>
                     <div className='text-right'>
                        <Badge variant="outline" className={transactionStatusColors[transaction.status]}>
                            {transactionStatusTranslations[transaction.status]}
                        </Badge>
                     </div>
                </div>
                <div className='flex items-center gap-2 pt-4'>
                    {transaction.contract ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => setIsContractFormOpen(true)}>
                                <Pencil className="ml-2 h-4 w-4" />
                                تعديل بنود العقد
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/dashboard/clients/${clientId}/transactions/${transactionId}/contract`}>
                                    <Printer className="ml-2 h-4 w-4" />
                                    عرض وطباعة العقد
                                </Link>
                            </Button>
                        </>
                    ) : (
                        <Button variant="default" size="sm" onClick={() => setIsContractFormOpen(true)}>
                            إنشاء عقد
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className='grid md:grid-cols-2 gap-6'>
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={transaction.assignedEngineerId ? (employees.find(e => e.id === transaction.assignedEngineerId)?.fullName || '...') : <span className='text-muted-foreground'>لم يحدد</span>} />
                    <InfoRow icon={<Calendar />} label="تاريخ الإنشاء" value={formatDate(transaction.createdAt)} />
                </div>
                {transaction.description && (
                     <div className='mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md'>
                        <p className='font-semibold mb-1 text-foreground'>ملاحظات المعاملة:</p>
                        {transaction.description}
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>إدارة المعاملة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button onClick={() => setIsAssignmentDialogOpen(true)} className='w-full'>
                    <Users className="ml-2 h-4 w-4" />
                    تحويل / إسناد للأقسام
                </Button>
                <Separator />
                <div>
                    <h4 className="font-semibold mb-2">الإسنادات الحالية:</h4>
                    {assignmentsLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-6 w-full" />
                            <Skeleton className="h-6 w-2/3" />
                        </div>
                    ) : assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center p-4">لم يتم إسناد هذه المعاملة لأي قسم بعد.</p>
                    ) : (
                        <ul className="space-y-2">
                            {assignments.map(a => (
                                <li key={a.id} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/50">
                                    <span className="font-semibold">{a.departmentName}</span>
                                    <span className="text-muted-foreground">{a.engineerId ? (employees.find(e => e.id === a.engineerId)?.fullName || '...') : 'غير مسند'}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
        
         <Tabs defaultValue="stages" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stages">مراحل المعاملة</TabsTrigger>
                <TabsTrigger value="comments">التعليقات والمتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
            </TabsList>
            <TabsContent value="stages" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><Workflow className='text-primary'/> مراحل المعاملة</CardTitle>
                        <CardDescription>تتبع التقدم في كل مرحلة من مراحل المعاملة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingStages ? <Skeleton className="h-48 w-full" /> : stages.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">لا توجد مراحل محددة لهذه المعاملة.</div>
                        ) : (
                            <div className="space-y-4">
                                {stages.map((stage) => {
                                    const canInteract = currentUser?.role === 'Admin' || (stage.allowedRoles && stage.allowedRoles.includes(currentUser?.jobTitle || ''));
                                    return (
                                        <div key={stage.stageId} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className={cn("w-28 justify-center", stageStatusColors[stage.status])}>
                                                    {stageStatusTranslations[stage.status]}
                                                </Badge>
                                                <div className="font-semibold">{stage.name}</div>
                                                {stage.trackingType === 'duration' && <StageCountdown stage={stage} />}
                                                {stage.trackingType === 'occurrence' && stage.maxOccurrences && (
                                                    <Badge variant="secondary">الإنجاز: {stage.completedCount || 0} / {stage.maxOccurrences}</Badge>
                                                )}
                                                {stage.trackingType === 'none' && <Badge variant="outline" className='bg-gray-100'>حدث</Badge>}
                                                {stage.allowedRoles && stage.allowedRoles.map(role => (
                                                    <Badge key={role} variant="secondary" className="font-normal">{role}</Badge>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                {stage.status === 'pending' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId, 'in-progress')} disabled={!canInteract}>
                                                        <Play className="ml-2 h-4 w-4" /> بدء
                                                    </Button>
                                                )}
                                                {stage.status === 'in-progress' && (
                                                    <>
                                                         <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleStageStatusChange(stage.stageId, 'completed')} disabled={!canInteract}>
                                                            <Check className="ml-2 h-4 w-4" />
                                                            {stage.trackingType === 'occurrence' ? 'تسجيل إنجاز' : 'إكمال'}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleStageStatusChange(stage.stageId, 'awaiting-review')} disabled={!canInteract}>
                                                            <Pause className="ml-2 h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                                {stage.status === 'awaiting-review' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId, 'in-progress')} disabled={!canInteract}>
                                                        <Play className="ml-2 h-4 w-4" /> استئناف
                                                    </Button>
                                                )}
                                                {stage.status === 'completed' && stage.endDate && (
                                                    <div className="text-sm text-green-600 flex items-center gap-2">
                                                        <Check className="h-4 w-4" /> مكتملة في {formatDate(stage.endDate)}
                                                    </div>
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
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="comment"
                  showInput={true}
                  title="التعليقات والمتابعة"
                  icon={<MessageSquare className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="log"
                  showInput={false}
                  title="سجل التغييرات"
                  icon={<History className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
        </Tabs>

    </div>
    </>
  );
}

    

    
