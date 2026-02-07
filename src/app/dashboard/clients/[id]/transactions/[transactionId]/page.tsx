
      'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, type DocumentData, getDocs, writeBatch, serverTimestamp, deleteField, deleteDoc, updateDoc, where } from 'firebase/firestore';
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
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, ChevronDown, Trash2, MoreHorizontal, Eye, FolderLock, FolderOpen, Loader2, Printer, FileText, Calendar, Workflow, Play, Check, Pause, Users, ChevronsUpDown, CheckSquare, FileSignature, MessageSquare, Undo2, ArrowUp, ArrowDown, Save, Plus } from 'lucide-react';
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

const EMPTY_ARRAY_FOR_SUBSCRIPTION: DocumentData[] = [];

// Helper function to check if a stage can be started
const canStartStage = (stage: Partial<TransactionStage>, allStages: TransactionStage[]): { allowed: boolean, reason: string } => {
    // Parallel stages can always be started (manually) if they are within the allowed main stages
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

    // For sequential stages, check predecessors
    const predecessors = allStages.filter(s => s.nextStageIds?.includes(stage.stageId!));

    // If no predecessors, it's a starting stage
    if (predecessors.length === 0) {
        return { allowed: true, reason: '' };
    }

    // If there are predecessors, at least one must be completed
    const arePredecessorsCompleted = predecessors.every(p => p.status === 'completed');
    
    if (arePredecessorsCompleted) {
        return { allowed: true, reason: '' };
    }
    
    return { allowed: false, reason: 'يجب إكمال المراحل السابقة أولاً.' };
};


export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  const fromAppointmentId = searchParams.get('fromAppointmentId');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [contractTransaction, setContractTransaction] = useState<ClientTransaction | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());

  const [transactionToCancel, setTransactionToCancel] = useState<ClientTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [workStageTemplates, setWorkStageTemplates] = useState<WorkStage[]>([]);

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

  const { data: assignments, loading: assignmentsLoading } = useSubscription<TransactionAssignment>(firestore, 'transaction_assignments', assignmentsQuery || EMPTY_ARRAY_FOR_SUBSCRIPTION);

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
    if (!firestore || !transaction?.departmentId) return;
    const fetchTemplates = async () => {
        const stagesQuery = query(collection(firestore, `departments/${transaction.departmentId}/workStages`));
        const snapshot = await getDocs(stagesQuery);
        setWorkStageTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkStage)));
    };
    fetchTemplates();
  }, [firestore, transaction?.departmentId]);


  const handleConfirmCancelContract = async () => {
    if (!firestore || !currentUser || !client || !transactionToCancel) return;

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const transactionRef = doc(firestore, 'clients', client.id, 'transactions', transactionToCancel.id!);

        // Revert contract signing stage
        const currentStages = [...(transactionToCancel.stages || [])];
        const contractStageIndex = currentStages.findIndex(s => s.name === 'توقيع العقد');
        let stagesUpdated = false;

        if (contractStageIndex > -1 && currentStages[contractStageIndex].status === 'completed') {
            const stageToRevert = { ...currentStages[contractStageIndex] };
            stageToRevert.status = 'pending';
            stageToRevert.endDate = null;
            currentStages[contractStageIndex] = stageToRevert;
            stagesUpdated = true;
        }

        const updateData: { contract: any; stages?: any[] } = {
            contract: deleteField()
        };
        if (stagesUpdated) {
            updateData.stages = currentStages;
        }
        
        batch.update(transactionRef, updateData);

        // Log the event in both timelines
        const historyCollectionRef = collection(firestore, `clients/${client.id}/history`);
        const transactionTimelineRef = collection(firestore, `clients/${client.id}/transactions/${transactionToCancel.id}/timelineEvents`);
        
        const logContent = `قام بإلغاء عقد المعاملة: "${transactionToCancel.transactionType}".`;
        const logData = { type: 'log', content: logContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
        batch.set(doc(historyCollectionRef), logData);

        const commentContent = `**تم إلغاء العقد**\nقام ${currentUser.fullName} بإلغاء العقد المرتبط بهذه المعاملة.`;
        const commentData = { type: 'comment', content: commentContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
        batch.set(doc(transactionTimelineRef), commentData);

        // Check if this is the last contract to potentially revert client status
        const otherTransactions = (await getDocs(collection(firestore, `clients/${client.id}/transactions`))).docs.map(d => d.data() as ClientTransaction).filter(tx => tx.id !== transactionToCancel.id!);
        const hasOtherContracts = otherTransactions.some(tx => !!tx.contract);

        if (!hasOtherContracts && client.status === 'contracted') {
            const clientRefDoc = doc(firestore, 'clients', client.id);
            batch.update(clientRefDoc, { status: 'new' });
            
            const statusLogContent = `تغيرت حالة الملف من "تم التعاقد" إلى "جديد" بعد إلغاء آخر عقد.`;
            const statusLogData = { type: 'log', content: statusLogContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
            batch.set(doc(historyCollectionRef), statusLogData);
        }

        await batch.commit();
        toast({ title: 'نجاح', description: 'تم إلغاء العقد وتحديث المراحل بنجاح.' });

        // --- Notification Logic ---
        const engineerId = transactionToCancel.assignedEngineerId;
        if (engineerId && currentUser.employeeId !== engineerId) {
            const targetUserId = await findUserIdByEmployeeId(firestore, engineerId);
            if (targetUserId) {
                await createNotification(firestore, {
                    userId: targetUserId,
                    title: `تم إلغاء عقد`,
                    body: `قام ${currentUser.fullName} بإلغاء عقد معاملة "${transactionToCancel.transactionType}" للعميل ${client.nameAr}.`,
                    link: `/dashboard/clients/${client.id}/transactions/${transactionToCancel.id!}`
                });
            }
        }

    } catch (error) {
        console.error("Error cancelling contract:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إلغاء العقد.' });
    } finally {
        setIsProcessing(false);
        setTransactionToCancel(null);
    }
  };
  
  const handleDeleteTransaction = async () => {
    if (!firestore || !transactionToDelete) return;
    setIsProcessing(true);
    try {
        const transactionRef = doc(firestore, 'clients', id, 'transactions', transactionToDelete.id!);
        await deleteDoc(transactionRef);
        toast({ title: 'نجاح', description: 'تم حذف المعاملة بنجاح.' });
    } catch(error) {
        console.error("Error deleting transaction:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف المعاملة.' });
    } finally {
        setIsProcessing(false);
        setTransactionToDelete(null);
    }
  };
  
  const handleToggleFreeze = async (tx: ClientTransaction) => {
    if (!firestore || !currentUser) return;
    setIsProcessing(true);
    try {
        const newStatus = tx.status === 'on-hold' ? 'new' : 'on-hold';
        const transactionRef = doc(firestore, 'clients', id, 'transactions', tx.id!);
        
        const batch = writeBatch(firestore);
        batch.update(transactionRef, { status: newStatus });
        
        const logContent = `قام ${newStatus === 'on-hold' ? 'بتجميد' : 'بإلغاء تجميد'} المعاملة: "${tx.transactionType}".`;
        
        const logData = {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        };
        
        const historyRef = doc(collection(firestore, `clients/${id}/history`));
        const transactionTimelineRef = doc(collection(firestore, `clients/${id}/transactions/${tx.id!}/timelineEvents`));

        batch.set(historyRef, logData);
        batch.set(transactionTimelineRef, logData);
        
        await batch.commit();
        toast({ title: 'نجاح', description: `تم ${newStatus === 'on-hold' ? 'تجميد' : 'إلغاء تجميد'} المعاملة.` });
    } catch(error) {
         console.error("Error toggling transaction freeze state:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تغيير حالة المعاملة.' });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleModificationIncrement = async (stageId: string) => {
    if (!firestore || !currentUser || !transaction || !stageId || !client) return;

    const stageToUpdate = transaction.stages?.find(s => s.stageId === stageId);
    if (!stageToUpdate || stageToUpdate.status !== 'in-progress' || !stageToUpdate.enableModificationTracking) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'لا يمكن تسجيل تعديل لهذه المرحلة حاليًا.' });
        return;
    }

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    
        const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
        const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
    
        if (stageIndex === -1) throw new Error("Stage not found");
    
        const stage = currentStages[stageIndex];
        stage.modificationCount = (stage.modificationCount || 0) + 1;
        
        batch.update(transactionRef, { stages: currentStages });
    
        const safeApptDate = toFirestoreDate(transaction.createdAt); // Fallback to tx creation date
        const logContent = `قام ${currentUser.fullName} بتسجيل تعديل جديد للمرحلة: "${stage.name}" (التعديل رقم ${stage.modificationCount}).`;
        
        const logData = {
            type: 'log' as const,
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        };
    
        const timelineRef = collection(transactionRef, 'timelineEvents');
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
  
  const handleRevertStage = async (stageIdToRevert: string) => {
    if (!firestore || !currentUser || currentUser.role !== 'Admin' || !transaction) return;

    const stageTemplate = (transaction.stages || []).find(s => s.stageId === stageIdToRevert);
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
        (currentStages[stageToRevertIndex] as any).endDate = null;
        (currentStages[stageToRevertIndex] as any).startDate = null; 
        (currentStages[stageToRevertIndex] as any).expectedEndDate = null;

        // 2. Revert the next sequential stage if it was auto-started
        const allStagesInTemplate: WorkStage[] = [];
        const depts = await getDocs(collection(firestore, 'departments'));
        for(const deptDoc of depts.docs) {
            const stagesSnap = await getDocs(collection(deptDoc.ref, 'workStages'));
            stagesSnap.forEach(sDoc => allStagesInTemplate.push({id: sDoc.id, ...sDoc.data()} as WorkStage));
        }

        const revertedStageTemplate = allStagesInTemplate.find(s => s.id === stageIdToRevert);

        if (revertedStageTemplate?.nextStageIds) {
            for (const nextStageId of revertedStageTemplate.nextStageIds) {
                const nextStageIndexInProg = currentStages.findIndex(s => s.stageId === nextStageId);
                
                if (nextStageIndexInProg > -1 && currentStages[nextStageIndexInProg].status === 'in-progress') {
                    const predecessorsOfNextStage = allStagesInTemplate.filter(s => s.nextStageIds?.includes(nextStageId));
                    const otherCompletedPredecessors = predecessorsOfNextStage.some(p => {
                        const progStage = currentStages.find(s => s.stageId === p.id);
                        return progStage && progStage.stageId !== stageIdToRevert && progStage.status === 'completed';
                    });
                    
                    if (!otherCompletedPredecessors) {
                        currentStages[nextStageIndexInProg].status = 'pending';
                        (currentStages[nextStageIndexInProg] as any).startDate = null;
                        (currentStages[nextStageIndexInProg] as any).expectedEndDate = null;
                    }
                }
            }
        }
        
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
        batch.set(historyRef, { ...logData, content: `[${transaction.transactionType}] ${logContent}`});
        
        batch.update(transactionRef, { stages: currentStages });
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

    const selectedStageTemplate = (transaction.stages || []).find(s => s.stageId === stageId);
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
            (updatedProgress as any).endDate = null;
            (updatedProgress as any).expectedEndDate = null;
        }
    }
    
    if (stageProgressIndex > -1) {
        newProgressForFirestore[stageProgressIndex] = updatedProgress as TransactionStage;
    } else {
        newProgressForFirestore.push(updatedProgress as TransactionStage);
    }
    
    if (isFinallyCompleted) {
        const allStagesInTemplate: WorkStage[] = [];
        const depts = await getDocs(collection(firestore, 'departments'));
        for(const deptDoc of depts.docs) {
            const stagesSnap = await getDocs(collection(deptDoc.ref, 'workStages'));
            stagesSnap.forEach(sDoc => allStagesInTemplate.push({id: sDoc.id, ...sDoc.data()} as WorkStage));
        }
        
        if (selectedStageTemplate?.nextStageIds && selectedStageTemplate.nextStageIds.length > 0) {
            for (const nextStageId of selectedStageTemplate.nextStageIds) {
                const nextStageInTemplate = allStagesInTemplate.find(s => s.id === nextStageId);
                
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
                        (stageToStart as any).startDate = now as any;
                        
                        const templateForNextStage = allStagesInTemplate.find(ws => ws.id === stageToStart.stageId);
                        if (templateForNextStage?.trackingType === 'duration' && templateForNextStage?.expectedDurationDays) {
                            (stageToStart as any).expectedEndDate = addDays(now, templateForNextStage.expectedDurationDays) as any;
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
  
  const isLoading = transactionLoading || clientLoading || assignmentsLoading;
  
  const enrichedStages = useMemo(() => {
    const progressStages = transaction?.stages || [];
    const templateStages = workStageTemplates || [];

    const combined = templateStages.map(template => {
        const progress = progressStages.find(p => p.stageId === template.id);
        return {
            ...template,
            ...progress,
        }
    });

    return combined.sort((a,b) => (a.order ?? 99) - (b.order ?? 99));

  }, [transaction?.stages, workStageTemplates]);

  const trackableInProgressStages = useMemo(() => 
    enrichedStages.filter(s => s.status === 'in-progress' && s.enableModificationTracking === true),
  [enrichedStages]);


  const clientAddress = client?.address ? [
      client.address.governorate, 
      client.address.area, 
      `قطعة ${client.address.block}`, 
      `شارع ${client.address.street}`, 
      `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';
  
  const assignedEngineerName = transaction?.assignedEngineerId ? employeesMap.get(transaction.assignedEngineerId) : null;


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
            isOpen={!!contractTransaction}
            onClose={() => setContractTransaction(null)}
            onSaveSuccess={() => {}}
            transaction={contractTransaction}
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
                            <Button variant="outline" size="sm" onClick={() => setContractTransaction(transaction)}>
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
                        <Button variant="default" size="sm" onClick={() => setContractTransaction(transaction)}>
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
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={assignedEngineerName || <span className='text-muted-foreground'>لم يحدد</span>} />
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
                        </div>
                        <CardDescription>تتبع التقدم في كل مرحلة من مراحل المعاملة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {trackableInProgressStages.length > 0 && (
                            <Card className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-900/30">
                                <CardHeader className="pb-4">
                                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-base">
                                    تسجيل تعديلات على المراحل الحالية
                                </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                {trackableInProgressStages.map(stage => (
                                    <div key={stage.stageId} className="flex justify-between items-center p-2 bg-background rounded-md border">
                                    <p className="font-semibold">{stage.name}</p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-3 text-orange-600 border-orange-300 hover:bg-orange-100"
                                        onClick={() => handleModificationIncrement(stage.stageId!)}
                                        disabled={isProcessing}
                                    >
                                        <Plus className="ml-1 h-4 w-4" />
                                        تسجيل تعديل جديد
                                    </Button>
                                    </div>
                                ))}
                                </CardContent>
                            </Card>
                        )}
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
                                                {stage.trackingType === 'occurrence' && stage.maxOccurrences && (
                                                    <Badge variant="secondary">الإنجاز: {stage.completedCount || 0} / {stage.maxOccurrences}</Badge>
                                                )}
                                                {stage.modificationCount && stage.modificationCount > 0 && (
                                                    <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">التعديلات: {stage.modificationCount}</Badge>
                                                )}
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                {stage.status === 'pending' && (
                                                    <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId!, 'in-progress')} disabled={!canInteract || !canBeStarted.allowed} title={!canBeStarted.allowed ? canBeStarted.reason : ''}>
                                                        <Play className="ml-2 h-4 w-4" /> بدء
                                                    </Button>
                                                )}
                                                {stage.status === 'in-progress' && (
                                                    <div className="flex gap-2 items-center">
                                                        <Button size="sm" variant="outline" className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100" onClick={() => handleStageStatusChange(stage.stageId!, 'completed')} disabled={!canInteract}>
                                                            <Check className="ml-2 h-4 w-4" />
                                                            {stage.trackingType === 'occurrence' ? 'تسجيل إنجاز' : 'إكمال'}
                                                        </Button>
                                                         {stage.trackingType === 'occurrence' && stage.allowManualCompletion && (
                                                            <Button size="sm" variant="destructive" onClick={() => handleStageStatusChange(stage.stageId!, 'completed')} disabled={!canInteract} title="إنهاء المرحلة حتى لو لم تصل للحد الأقصى">
                                                                <CheckSquare className="ml-2 h-4 w-4" /> إنهاء وإكمال
                                                            </Button>
                                                         )}
                                                    </div>
                                                )}
                                                {stage.status === 'completed' && (
                                                    <div className="flex items-center gap-2">
                                                        {stage.endDate && (
                                                            <div className="text-sm text-green-600 flex items-center gap-2">
                                                                <Check className="h-4 w-4" /> مكتملة في {formatDate(stage.endDate)}
                                                            </div>
                                                        )}
                                                        {currentUser?.role === 'Admin' && (
                                                             <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleRevertStage(stage.stageId!)} disabled={isProcessing}>
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
     <AlertDialog open={!!transactionToCancel} onOpenChange={(open) => !open && setTransactionToCancel(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد إلغاء العقد</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في إلغاء عقد المعاملة "{transactionToCancel?.transactionType}"؟ سيتم حذف بيانات العقد نهائياً والتراجع عن مرحلة توقيع العقد. لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmCancelContract} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                    {isProcessing ? 'جاري الإلغاء...' : 'نعم، قم بالإلغاء'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
     <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
        <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
                <AlertDialogTitle>تأكيد حذف المعاملة</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أنت متأكد من رغبتك في حذف المعاملة "{transactionToDelete?.transactionType}"؟ سيتم حذف هذه المعاملة وجميع بياناتها المرتبطة بها (مثل التعليقات والسجلات والعقد) بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isProcessing}>تراجع</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteTransaction} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                    {isProcessing ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

    

    