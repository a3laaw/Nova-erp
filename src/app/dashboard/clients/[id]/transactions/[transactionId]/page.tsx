
      'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, type DocumentData, getDocs, writeBatch, serverTimestamp, deleteField, deleteDoc, updateDoc, where, limit } from 'firebase/firestore';
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
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, ChevronDown, Trash2, MoreHorizontal, Eye, FolderLock, FolderOpen, Loader2, Printer, FileText, Calendar, Workflow, Play, Check, Pause, Users, ChevronsUpDown, CheckSquare, FileSignature, MessageSquare, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import type { Client, ClientTransaction, Employee, Quotation, TransactionStage, WorkStage, UserRole, Department, TransactionAssignment } from '@/lib/types';
import { format, differenceInDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';
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
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [stages, setStages] = useState<TransactionStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [isParallelStageMenuOpen, setIsParallelStageMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);


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
        const [empSnap] = await Promise.all([
          getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active'))),
        ]);

        setEmployees(empSnap.docs.map(d => ({id: d.id, ...d.data()} as Employee)));
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب بيانات الموظفين.' });
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
            const templateStages: WorkStage[] = [];
            const stageIds = new Set<string>();
            const departmentsCollection = collection(firestore, 'departments');

            const fetchStagesForDept = async (deptId: string) => {
                if (!deptId) return;
                const stagesQuery = query(collection(firestore, `departments/${deptId}/workStages`), orderBy('order', 'asc'));
                const stagesSnapshot = await getDocs(stagesQuery);
                stagesSnapshot.forEach(doc => {
                    if (!stageIds.has(doc.id)) {
                        templateStages.push({ id: doc.id, ...doc.data() } as WorkStage);
                        stageIds.add(doc.id);
                    }
                });
            };

            // 1. Fetch stages from the primary department
            if (transaction.departmentId) {
                await fetchStagesForDept(transaction.departmentId);
            }

            // 2. Fetch stages from the structural department
            const structuralDeptQuery = query(departmentsCollection, where('name', '==', 'القسم الإنشائي'), limit(1));
            const structuralDeptSnap = await getDocs(structuralDeptQuery);
            if (!structuralDeptSnap.empty) {
                const structuralDeptId = structuralDeptSnap.docs[0].id;
                await fetchStagesForDept(structuralDeptId);
            }
            
            const progressData = transaction.stages || [];
            const progressMap = new Map(progressData.map(p => [p.stageId, p]));

            const mergedStages: TransactionStage[] = templateStages.map(template => {
                const progress = progressMap.get(template.id!);
                return {
                    stageId: template.id!,
                    name: template.name,
                    order: template.order,
                    stageType: template.stageType || 'sequential',
                    allowedRoles: template.allowedRoles,
                    nextStageIds: template.nextStageIds,
                    allowedDuringStages: template.allowedDuringStages,
                    trackingType: template.trackingType,
                    expectedDurationDays: template.expectedDurationDays,
                    maxOccurrences: template.maxOccurrences,
                    allowManualCompletion: template.allowManualCompletion,
                    status: progress?.status || 'pending',
                    startDate: progress?.startDate || null,
                    endDate: progress?.endDate || null,
                    expectedEndDate: progress?.expectedEndDate || null,
                    notes: progress?.notes || '',
                    completedCount: progress?.completedCount || 0,
                };
            }).sort((a,b) => (a.order ?? 99) - (b.order ?? 99));

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

  const handleRevertStage = async (stageIdToRevert: string) => {
    if (!firestore || !currentUser || currentUser.role !== 'Admin' || !transaction) return;

    const stageTemplate = stages.find(s => s.stageId === stageIdToRevert);
    if (!stageTemplate) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'تعريف المرحلة غير موجود.' });
        return;
    }
    if (stageTemplate.status !== 'completed') {
        toast({ variant: 'default', title: 'معلومة', description: 'يمكن التراجع عن المراحل المكتملة فقط.' });
        return;
    }

    setIsProcessing(true);

    try {
        const batch = writeBatch(firestore);
        const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transactionId);

        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));

        // 1. Revert the target stage
        const stageToRevertIndex = currentStages.findIndex(s => s.stageId === stageIdToRevert);
        if (stageToRevertIndex === -1) {
            throw new Error("لم يتم العثور على المرحلة في بيانات المعاملة.");
        }
        
        currentStages[stageToRevertIndex].status = 'pending';
        currentStages[stageToRevertIndex].endDate = null;

        // 2. Revert the next sequential stage if it was auto-started
        const revertedStageTemplate = stages.find(s => s.stageId === stageIdToRevert);
        if (revertedStageTemplate?.nextStageIds) {
            for (const nextStageId of revertedStageTemplate.nextStageIds) {
                const nextStageIndexInProg = currentStages.findIndex(s => s.stageId === nextStageId);
                // If the next stage was auto-started from this one, revert it.
                if (nextStageIndexInProg > -1 && currentStages[nextStageIndexInProg].status === 'in-progress') {
                    // Check if the only predecessor was the one we are reverting
                    const predecessorsOfNextStage = stages.filter(s => s.nextStageIds?.includes(nextStageId));
                    const otherCompletedPredecessors = predecessorsOfNextStage.some(p => p.stageId !== stageIdToRevert && currentStages.find(cs => cs.stageId === p.stageId)?.status === 'completed');
                    
                    if (!otherCompletedPredecessors) {
                        currentStages[nextStageIndexInProg].status = 'pending';
                        currentStages[nextStageIndexInProg].startDate = null;
                        currentStages[nextStageIndexInProg].expectedEndDate = null;
                    }
                }
            }
        }
        
        batch.update(transactionRef, { stages: currentStages });
        
        const progressQuery = query(
            collection(firestore, 'work_stages_progress'),
            where('transactionId', '==', transaction.id),
            where('stageId', '==', stageIdToRevert)
        );
        const progressSnap = await getDocs(progressQuery);
        let logContent = `تراجع المدير ${currentUser.fullName} عن إكمال مرحلة: "${stageTemplate.name}".`;

        if (!progressSnap.empty) {
            const progressDoc = progressSnap.docs[0];
            const visitId = progressDoc.data().visitId;

            if (visitId) {
                const apptRef = doc(firestore, 'appointments', visitId);
                batch.update(apptRef, {
                    workStageUpdated: false,
                    workStageProgressId: deleteField()
                });
                batch.delete(progressDoc.ref);
                logContent += ` (تم إلغاء ربط الزيارة المتعلقة بهذا الإجراء).`;
            }
        }

        const logData = {
            type: 'log' as const,
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        };
        const commentData = {
            type: 'comment' as const,
            content: `**[إجراء إداري]**\n${logContent}`,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        };
        const timelineRef = collection(transactionRef, 'timelineEvents');
        batch.set(doc(timelineRef), logData);
        batch.set(doc(timelineRef), commentData);
        
        const historyRef = doc(collection(firestore, `clients/${clientId}/history`));
        batch.set(historyRef, { ...logData, content: `[${transaction.transactionType}] ${logContent}` });
        
        await batch.commit();
        
        toast({ title: 'نجاح', description: `تم التراجع عن مرحلة "${stageTemplate.name}" والإجراءات المرتبطة بها.`});

    } catch (error) {
        console.error("Error reverting stage:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن المرحلة.' });
    } finally {
        setIsProcessing(false);
    }
  };


  const handleStageStatusChange = async (stageId: string, newStatus: TransactionStage['status']) => {
    if (!firestore || !transaction || !currentUser || !client) return;

    const originalProgress = [...(transaction.stages || [])];
    const newProgressForFirestore = JSON.parse(JSON.stringify(originalProgress));

    const selectedStageTemplate = stages.find(s => s.stageId === stageId);
    if (!selectedStageTemplate) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'تعريف المرحلة غير موجود.' });
        return;
    }
    
    const stageProgressIndex = newProgressForFirestore.findIndex((s: TransactionStage) => s.stageId === stageId);
    let updatedProgress: Partial<TransactionStage>;

    if (stageProgressIndex > -1) {
        updatedProgress = { ...newProgressForFirestore[stageProgressIndex] };
    } else {
        updatedProgress = { stageId: stageId, name: selectedStageTemplate.name };
    }
    
    const oldStatus = updatedProgress.status || 'pending';
    if(oldStatus === newStatus && selectedStageTemplate.trackingType !== 'occurrence') return;
    
    const now = new Date();
    
    let logContent = `قام ${currentUser.fullName} بتغيير حالة المرحلة "${selectedStageTemplate.name}" إلى "${stageStatusTranslations[newStatus]}".`;
    let commentContent = `قام ${currentUser.fullName} بتحديث حالة المرحلة **"${selectedStageTemplate.name}"** إلى **"${stageStatusTranslations[newStatus]}"**.`;
    let isFinallyCompleted = false;

    if (newStatus === 'completed' && selectedStageTemplate.trackingType === 'occurrence') {
        const newCount = (updatedProgress.completedCount || 0) + 1;
        updatedProgress.completedCount = newCount;
        const maxOccurrences = selectedStageTemplate.maxOccurrences || 1;
        
        const logAndCommentText = `قام ${currentUser.fullName} بتسجيل إنجاز للمرحلة "${updatedProgress.name}" (${newCount}/${maxOccurrences}).`;
        logContent = logAndCommentText;
        commentContent = logAndCommentText;

        if (newCount >= maxOccurrences) {
            updatedProgress.status = 'completed';
            if (!updatedProgress.startDate) updatedProgress.startDate = now as any;
            updatedProgress.endDate = now as any;
            isFinallyCompleted = true;
            const finalText = `قام ${currentUser.fullName} بإكمال المرحلة "${updatedProgress.name}" (وصل للحد الأقصى ${maxOccurrences} إنجازات).`;
            logContent = finalText;
            commentContent = finalText;
        } else {
            updatedProgress.status = 'in-progress';
        }
    } else {
        updatedProgress.status = newStatus;
        if (newStatus === 'in-progress') {
            if (oldStatus === 'pending') {
                updatedProgress.startDate = now as any;
                if (selectedStageTemplate.trackingType === 'duration' && selectedStageTemplate.expectedDurationDays) {
                    updatedProgress.expectedEndDate = addDays(now, selectedStageTemplate.expectedDurationDays) as any;
                }
            }
        } else if (newStatus === 'completed') {
            if (!updatedProgress.startDate) updatedProgress.startDate = now as any;
            updatedProgress.endDate = now as any;
            isFinallyCompleted = true;
        } else {
            updatedProgress.endDate = null;
            updatedProgress.expectedEndDate = null;
        }
    }
    
    if (stageProgressIndex > -1) {
        newProgressForFirestore[stageProgressIndex] = updatedProgress as TransactionStage;
    } else {
        newProgressForFirestore.push(updatedProgress as TransactionStage);
    }
    
    if (isFinallyCompleted) {
        if (selectedStageTemplate?.nextStageIds && selectedStageTemplate.nextStageIds.length > 0) {
            for (const nextStageId of selectedStageTemplate.nextStageIds) {
                const nextStageInTemplate = stages.find(s => s.stageId === nextStageId);
                
                if (nextStageInTemplate && nextStageInTemplate.stageType !== 'parallel') {
                    const nextStageIndexInProg = newProgressForFirestore.findIndex((s: TransactionStage) => s.stageId === nextStageId);
                    
                    let stageToStart: Partial<TransactionStage>;
                    if (nextStageIndexInProg > -1) {
                        stageToStart = { ...newProgressForFirestore[nextStageIndexInProg] };
                    } else {
                        stageToStart = { stageId: nextStageInTemplate.id, name: nextStageInTemplate.name, status: 'pending' };
                    }

                    if (stageToStart.status === 'pending') {
                        stageToStart.status = 'in-progress';
                        stageToStart.startDate = now as any;
                        
                        const templateForNextStage = stages.find(ws => ws.stageId === stageToStart.stageId);
                        if (templateForNextStage?.trackingType === 'duration' && templateForNextStage?.expectedDurationDays) {
                            stageToStart.expectedEndDate = addDays(now, templateForNextStage.expectedDurationDays) as any;
                        }

                        if (nextStageIndexInProg > -1) {
                            newProgressForFirestore[nextStageIndexInProg] = stageToStart as TransactionStage;
                        } else {
                            newProgressForFirestore.push(stageToStart as TransactionStage);
                        }
                    }
                }
            }
        }
    }
    
    if(isFinallyCompleted) {
         const contractClauses = transaction.contract?.clauses || [];
         const completedStageNames = new Set(newProgressForFirestore.filter((s: TransactionStage) => s.status === 'completed').map((s: TransactionStage) => s.name));
         const newContractClauses = contractClauses.map(clause => (clause.condition && completedStageNames.has(clause.condition) && clause.status === 'غير مستحقة') ? { ...clause, status: 'مستحقة' as const } : clause);
         const totalAmountNowDue = newContractClauses.filter(c => c.status === 'مدفوعة' || c.status === 'مستحقة').reduce((sum, c) => sum + c.amount, 0);
         const totalPaid = await getTotalPaidForProject(transactionId, firestore);
         const outstandingBalance = totalAmountNowDue - totalPaid;

         if(outstandingBalance > 0) {
             commentContent += `\n\n**[إشعار مالي]** بناءً على ذلك، أصبح هناك رصيد مستحق للدفع بقيمة **${formatCurrency(outstandingBalance)}**.`;
         }
         await updateDoc(transactionRef!, { 'contract.clauses': newContractClauses });
    }
    
    const transactionRefDoc = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    const batch = writeBatch(firestore);
    
    const timelineCollectionRef = collection(transactionRefDoc, 'timelineEvents');
    const historyCollectionRef = collection(firestore, `clients/${clientId}/history`);

    const logData = {
        type: 'log' as const,
        content: logContent,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: serverTimestamp(),
    };
    const commentData = {
        type: 'comment' as const,
        content: commentContent,
        userId: currentUser.id,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatarUrl,
        createdAt: serverTimestamp(),
    };

    // Add log and comment to transaction timeline
    batch.set(doc(timelineCollectionRef), logData);
    batch.set(doc(timelineCollectionRef), commentData);

    // Add concise log to client history
    batch.set(doc(historyCollectionRef), { ...logData, content: `[${transaction.transactionType}] ${logContent}`});
    
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
    if (stage.status !== 'pending') return { allowed: false, reason: `المرحلة حالياً "${stageStatusTranslations[stage.status]}".`};
    if (stage.stageType === 'parallel') {
        if (!stage.allowedDuringStages || stage.allowedDuringStages.length === 0) {
            return { allowed: true }; // Can start anytime if not restricted
        }
        const anAllowedStageIsActive = allStages.some(s => 
            stage.allowedDuringStages?.includes(s.stageId) && s.status === 'in-progress'
        );
        return anAllowedStageIsActive 
            ? { allowed: true } 
            : { allowed: false, reason: 'يمكن بدء هذه المرحلة فقط أثناء المراحل المحددة لها.' };
    }

    const aSequentialStageIsInProgress = allStages.some(s => s.stageType !== 'parallel' && s.status === 'in-progress');
    if (aSequentialStageIsInProgress) return { allowed: false, reason: 'توجد مرحلة تسلسلية أخرى قيد التنفيذ.'};

    const predecessors = allStages.filter(s => s.nextStageIds?.includes(stage.stageId));
    if (predecessors.length === 0) {
        const isFirstSequential = allStages.filter(s => s.stageType !== 'parallel' && s.status !== 'pending').length === 0;
        return isFirstSequential ? { allowed: true } : { allowed: false, reason: 'لا توجد مرحلة سابقة لها.'};
    }
    
    const canBeTriggered = predecessors.some(p => p.status === 'completed');
    if (!canBeTriggered) {
        return { allowed: false, reason: `يجب إكمال إحدى المراحل السابقة أولاً (مثل: ${predecessors.map(p => p.name).join(' أو ')})` };
    }
    return { allowed: !aSequentialStageIsInProgress };
  };

  // --- Render Logic ---
  const isLoading = transactionLoading || clientLoading || assignmentsLoading;
  
  const sequentialStages = useMemo(() => stages.filter(s => s.stageType !== 'parallel'), [stages]);
  const parallelStages = useMemo(() => stages.filter(s => {
    if (s.status !== 'pending') return true; // Always show if in progress or completed
    const canStartResult = canStartStage(s, stages);
    return canStartResult.allowed;
  }), [stages]);

  if (isLoading || loadingStages) {
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
            onSaveSuccess={() => {}}
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
                           <FileSignature className="ml-2 h-4 w-4"/>
                            إنشاء عقد
                        </Button>
                    )}
                     <Button variant="outline" size="sm" onClick={() => setIsAssignmentDialogOpen(true)}>
                        <Users className="ml-2 h-4 w-4" />
                        تحويل / إسناد
                    </Button>
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
        
         <Tabs defaultValue="stages" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stages">مراحل المعاملة</TabsTrigger>
                <TabsTrigger value="comments">التعليقات والمتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="stages" className="mt-6">
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle className='flex items-center gap-2'><Workflow className='text-primary'/> سير العمل</CardTitle>
                             <DropdownMenu open={isParallelStageMenuOpen} onOpenChange={setIsParallelStageMenuOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline"><ChevronsUpDown className="ml-2 h-4 w-4"/>بدء مرحلة خدمية</Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                {parallelStages.filter(s => s.status === 'pending').map(stage => (
                                    <DropdownMenuItem key={stage.stageId} onClick={() => handleStageStatusChange(stage.stageId, 'in-progress')}>
                                        {stage.name}
                                    </DropdownMenuItem>
                                ))}
                                {parallelStages.filter(s => s.status === 'pending').length === 0 && (
                                    <DropdownMenuItem disabled>لا توجد مراحل خدمية متاحة</DropdownMenuItem>
                                )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <CardDescription>تتبع التقدم في كل مرحلة من مراحل المعاملة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingStages ? <Skeleton className="h-48 w-full" /> : stages.length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground">لا توجد مراحل محددة لهذه المعاملة.</div>
                        ) : (
                            <div className="space-y-4">
                                {sequentialStages.map((stage) => {
                                    const canInteract = currentUser?.role === 'Admin' || (stage.allowedRoles && stage.allowedRoles.includes(currentUser?.jobTitle || ''));
                                    const canStart = canStartStage(stage, stages);
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
                                                    <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId, 'in-progress')} disabled={!canInteract || !canStart.allowed} title={!canStart.allowed ? canStart.reason : ''}>
                                                        <Play className="ml-2 h-4 w-4" /> بدء
                                                    </Button>
                                                )}
                                                {stage.status === 'in-progress' && (
                                                    <>
                                                         <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleStageStatusChange(stage.stageId, 'completed')} disabled={!canInteract}>
                                                            <Check className="ml-2 h-4 w-4" />
                                                            {stage.trackingType === 'occurrence' ? 'تسجيل إنجاز' : 'إكمال'}
                                                        </Button>
                                                         {stage.trackingType === 'occurrence' && stage.allowManualCompletion && (
                                                            <Button size="sm" variant="destructive" onClick={() => handleStageStatusChange(stage.stageId, 'completed')} disabled={!canInteract} title="إنهاء المرحلة حتى لو لم تصل للحد الأقصى">
                                                                <CheckSquare className="ml-2 h-4 w-4" /> إنهاء وإكمال
                                                            </Button>
                                                         )}
                                                    </>
                                                )}
                                                {stage.status === 'completed' && (
                                                    <div className="flex items-center gap-2">
                                                        {stage.endDate && (
                                                            <div className="text-sm text-green-600 flex items-center gap-2">
                                                                <Check className="h-4 w-4" /> مكتملة في {formatDate(stage.endDate)}
                                                            </div>
                                                        )}
                                                        {currentUser?.role === 'Admin' && (
                                                             <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleRevertStage(stage.stageId)} disabled={isProcessing}>
                                                                <Undo2 className="ml-1 h-4 w-4" /> تراجع
                                                            </Button>
                                                        )}
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
                  title="سجل الأحداث"
                  icon={<History className='text-primary'/>}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
        </Tabs>

    </div>
    </>
  );
}
      
    
