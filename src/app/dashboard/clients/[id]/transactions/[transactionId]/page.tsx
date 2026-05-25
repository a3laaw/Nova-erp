'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, updateDoc, getDoc, serverTimestamp, Timestamp, addDoc, where, writeBatch, limit } from 'firebase/firestore';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    Pencil, 
    User, 
    Calendar, 
    Workflow, 
    Play, 
    Check, 
    History, 
    MessageSquare, 
    CheckCircle2,
    ArrowRight,
    AlertCircle,
    Package,
    Layers,
    Loader2,
    Target,
    Clock,
    IterationCcw,
    Undo2,
    MessageCircleIcon,
    Save,
    Banknote,
    Coins,
    Lock,
    Ban
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Client, ClientTransaction, TransactionStage, Holiday } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { LinkedBoqView } from '@/components/clients/boq/linked-boq-view';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';
import { Progress } from '@/components/ui/progress';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
  'on-hold': 'bg-gray-100 text-gray-800 border-gray-200',
  'cancelled': 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
  new: 'جديدة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  submitted: 'تم تسليمها',
  'on-hold': 'مجمدة إدارياً',
  'cancelled': 'ملغاة / عقد مفسوخ',
};

const stageStatusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'معلقة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
};

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  const tenantId = currentUser?.currentCompanyId;

  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const [actionDialog, setActionDialog] = useState<{
      isOpen: boolean;
      stageId: string;
      stageName: string;
      actionType: 'start' | 'modify' | 'complete';
  }>({ isOpen: false, stageId: '', stageName: '', actionType: 'modify' });
  
  const [actionNote, setActionNote] = useState('');

  const transactionPath = useMemo(() => (firestore && clientId && transactionId && tenantId ? getTenantPath(`clients/${clientId}/transactions/${transactionId}`, tenantId) : null), [firestore, clientId, transactionId, tenantId]);
  const { data: transaction, loading: transactionLoading } = useDocument<ClientTransaction>(firestore, transactionPath);
  
  const clientPath = useMemo(() => (firestore && clientId && tenantId ? getTenantPath(`clients/${clientId}`, tenantId) : null), [firestore, clientId, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

  // 🛡️ درع القفل السيادي 🛡️
  const isLocked = useMemo(() => {
    return transaction?.status === 'cancelled' || transaction?.status === 'on-hold';
  }, [transaction?.status]);

  const isAdmin = useMemo(() => ['Admin', 'HR', 'Developer', 'Accountant'].includes(currentUser?.role || ''), [currentUser]);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  const openActionDialog = (stageId: string, stageName: string, type: 'start' | 'modify' | 'complete') => {
      if (isLocked) return;
      if (type === 'start') {
          handleStageAction(stageId, 'start', 'بدء العمل الفني المخطط.');
          return;
      }
      setActionNote('');
      setActionDialog({ isOpen: true, stageId, stageName, actionType: type });
  };

  const calculateFinancialClaim = async (stageName: string) => {
    if (!firestore || !tenantId || !transaction?.contract?.clauses) return null;

    try {
        const receiptsPath = getTenantPath('cashReceipts', tenantId);
        const receiptsSnap = await getDocs(query(collection(firestore, receiptsPath!), where('projectId', '==', transactionId)));
        const totalReceived = receiptsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

        const clauses = transaction.contract.clauses;
        let totalRequiredUntilNow = 0;
        let foundCurrent = false;
        let currentClauseAmount = 0;

        for (const clause of clauses) {
            totalRequiredUntilNow += clause.amount;
            if (clause.condition === stageName) {
                foundCurrent = true;
                currentClauseAmount = clause.amount;
                break;
            }
        }

        if (foundCurrent) {
            const totalDebt = totalRequiredUntilNow - totalReceived;
            if (totalDebt > 0) {
                const prevOwed = totalDebt - currentClauseAmount;
                return { totalDebt, currentClauseAmount, prevOwed };
            }
        }
        return null;
    } catch (e) {
        console.error("Financial Claim Calculation Failed:", e);
        return null;
    }
  };

  const handleStageAction = async (stageId: string, action: 'start' | 'modify' | 'complete', note: string) => {
        if (!firestore || !currentUser || !transaction || !transactionPath || !tenantId || !client || isLocked) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            const now = new Date();

            let logContent = '';
            let commentContent = '';

            if (action === 'start') {
                stage.status = 'in-progress';
                stage.startDate = Timestamp.fromDate(now);
                const days = stage.expectedDurationDays || 7; 
                const expectedEnd = addWorkingDays(now, days, branding?.work_hours?.holidays || [], publicHolidays);
                stage.expectedEndDate = Timestamp.fromDate(expectedEnd);
                logContent = `بدأ المهندس ${currentUser.fullName} العمل فعلياً في مرحلة: **${stage.name}**.`;
                
            } else if (action === 'modify') {
                stage.currentCount = (stage.currentCount || 0) + 1;
                logContent = `سجل المهندس ${currentUser.fullName} تعديلاً رقم **${stage.currentCount}** في مرحلة: **${stage.name}**.`;
                commentContent = `**[مبررات تعديل فني]**\nقام المهندس ${currentUser.fullName} بإجراء تعديل في مرحلة **${stage.name}**.\n\n**السبب المذكور:**\n${note}`;
                
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                logContent = `تم إنجاز وإغلاق مرحلة: **${stage.name}** بواسطة المهندس ${currentUser.fullName}.`;
                commentContent = `**[إشعار إنجاز مرحلة]**\nأكد المهندس ${currentUser.fullName} إتمام العمل في مرحلة **${stage.name}**.\n\n**ملاحظات الإغلاق:**\n${note}`;
                
                const claim = await calculateFinancialClaim(stage.name);
                if (claim) {
                    let claimMsg = `\n\n**[مطالبة مالية آلية]**\nنظراً لإنجاز مرحلة **${stage.name}**، استحقت دفعة بقيمة **${formatCurrency(claim.currentClauseAmount)}**.`;
                    if (claim.prevOwed > 0) {
                        claimMsg += `\nيوجد متبقي سابق غير محصل من العقد بقيمة **${formatCurrency(claim.prevOwed)}**.`;
                    }
                    claimMsg += `\n**إجمالي المطلوب تحصيله الآن: ${formatCurrency(claim.totalDebt)}**`;
                    
                    commentContent += claimMsg;

                    const appCounterPath = getTenantPath('counters/paymentApplications', tenantId);
                    const appCounterDoc = await getDoc(doc(firestore, appCounterPath!));
                    const currentYear = new Date().getFullYear();
                    const appNextNumber = ((appCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                    const appNumber = `APP-AUTO-${currentYear}-${String(appNextNumber).padStart(4, '0')}`;
                    
                    const appsPath = getTenantPath('payment_applications', tenantId);
                    const newAppRef = doc(collection(firestore, appsPath!));
                    
                    batch.set(newAppRef, {
                        applicationNumber: appNumber,
                        date: serverTimestamp(),
                        projectId: transactionId,
                        clientId: clientId,
                        clientName: client.nameAr,
                        projectName: transaction.transactionType,
                        items: [{
                            boqItemId: stage.stageId,
                            description: `إنجاز مرحلة فنية: ${stage.name}`,
                            unit: 'مرحلة',
                            unitPrice: claim.totalDebt,
                            previousQuantity: 0,
                            currentQuantity: 1,
                            totalAmount: claim.totalDebt
                        }],
                        totalAmount: claim.totalDebt,
                        status: 'approved',
                        companyId: tenantId,
                        createdAt: serverTimestamp(),
                        createdBy: currentUser.id
                    });
                    
                    batch.set(doc(firestore, appCounterPath!), { counts: { [currentYear]: appNextNumber } }, { merge: true });
                }

                const nextIds = stage.nextStageIds || [];
                if (nextIds.length > 0) {
                    nextIds.forEach(nid => {
                        const target = currentStages.find(s => s.stageId === nid);
                        if (target && target.status === 'pending') {
                            target.status = 'in-progress'; 
                            target.startDate = Timestamp.fromDate(now);
                            const tDays = target.expectedDurationDays || 7;
                            target.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, tDays, branding?.work_hours?.holidays || [], publicHolidays));
                        }
                    });
                }
            }

            let updatedClauses = transaction.contract?.clauses || null;
            if (action === 'complete' && updatedClauses) {
                updatedClauses = updatedClauses.map((c: any) => 
                    c.condition === stage.name ? { ...c, status: 'مستحقة' } : c
                );
            }

            batch.update(doc(firestore, transactionPath), cleanFirestoreData({ 
                stages: currentStages, 
                updatedAt: serverTimestamp(),
                status: 'in-progress',
                ...(updatedClauses && { 'contract.clauses': updatedClauses })
            }));
            
            const logPath = `${transactionPath}/timelineEvents`;
            
            batch.set(doc(collection(firestore, logPath)), {
                type: 'log',
                content: logContent,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            if (commentContent) {
                batch.set(doc(collection(firestore, logPath)), {
                    type: 'comment',
                    content: commentContent,
                    userId: currentUser.id,
                    userName: currentUser.fullName,
                    userAvatar: currentUser.avatarUrl,
                    createdAt: serverTimestamp(),
                    companyId: tenantId
                });
            }

            await batch.commit();
            toast({ title: 'تم توثيق الإجراء', description: 'تم ترحيل البيانات وتحديث الموقف المالي آلياً.' });
            setActionDialog({ ...actionDialog, isOpen: false });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: e.message });
        } finally { setIsProcessing(false); }
  };

  const handleUndoStage = async (stageId: string) => {
        if (!firestore || !currentUser || !transaction || !transactionPath || !isAdmin || !tenantId || isLocked) return;
        setIsProcessing(true);
        try {
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            stage.status = 'in-progress';
            stage.endDate = null;
            
            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            
            await addDoc(collection(firestore, `${transactionPath}/timelineEvents`), {
                type: 'log',
                content: `قام ${currentUser.fullName} بالتراجع عن إغلاق مرحلة: **${stage.name}**. عادت المرحلة قيد التنفيذ.`,
                userId: currentUser.id,
                userName: currentUser.fullName,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            toast({ title: 'تم التراجع', description: 'عادت المرحلة لوضع التنفيذ لضمان سلامة السجل.' });
        } finally { setIsProcessing(false); }
  };

  if (transactionLoading || clientLoading) return <div className="p-8 max-w-5xl mx-auto" dir="rtl"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
  if (!transaction || !client) return <div className="text-center py-20 text-destructive font-black opacity-30">المعاملة غير موجودة.</div>;

  return (
    <div className='space-y-6 max-w-6xl mx-auto pb-20' dir='rtl'>
        {/* 🛡️ بنر القفل السيادي 🛡️ */}
        {isLocked && (
            <Alert className={cn(
                "rounded-[2rem] border-2 shadow-2xl py-6 animate-in slide-in-from-top-4 duration-700",
                transaction.status === 'cancelled' ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-500"
            )}>
                {transaction.status === 'cancelled' ? <Ban className="h-8 w-8 text-red-600" /> : <Lock className="h-8 w-8 text-amber-600" />}
                <AlertTitle className={cn("text-2xl font-black mb-1", transaction.status === 'cancelled' ? "text-red-900" : "text-amber-900")}>
                    {transaction.status === 'cancelled' ? 'المسار الفني ملغى نهائياً' : 'المعاملة مجمدة إدارياً'}
                </AlertTitle>
                <AlertDescription className={cn("text-lg font-bold", transaction.status === 'cancelled' ? "text-red-700" : "text-amber-700")}>
                    {transaction.status === 'cancelled' 
                        ? 'تم فسخ العقد وإلغاء المعاملة؛ لا يمكن إضافة تعليقات أو تعديل المراحل الفنية.' 
                        : 'هذه المعاملة مجمدة حالياً بقرار إداري؛ سيتم استعادة كافة الخصائص بمجرد إلغاء التجميد من ملف العميل.'}
                </AlertDescription>
            </Alert>
        )}

        <Card className={cn("rounded-[3rem] border-none shadow-xl overflow-hidden bg-white", isLocked && "opacity-80 grayscale-[0.3]")}>
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right space-y-2">
                        <div className="flex items-center gap-3">
                            <CardTitle className='text-3xl font-black text-[#1e1b4b] tracking-tighter'>{transaction.transactionType}</CardTitle>
                            {!isLocked && <UniversalActionTrigger title={transaction.transactionType} sourceModule="المعاملات" sourceId={transaction.id!} />}
                        </div>
                        {transaction.subServiceName && <Badge className="bg-primary text-white font-black px-4 h-7 rounded-full border-none shadow-md">{transaction.subServiceName}</Badge>}
                        <CardDescription className="text-base font-medium">العميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline font-bold'>{client.nameAr}</Link></CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("px-6 py-1.5 rounded-full font-black text-sm border-2", transactionStatusColors[transaction.status])}>{statusTranslations[transaction.status]}</Badge>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-white">
                <div className="flex items-center gap-4 text-sm">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary"><User className="h-5 w-5 opacity-40"/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">المهندس المسؤول</p><p className="font-black text-slate-800">{transaction.assignedEngineerId ? (employeesMap.get(transaction.assignedEngineerId) || '...') : 'غير مسند'}</p></div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary"><Calendar className="h-5 w-5 opacity-40"/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase">تاريخ فتح المسار</p><p className="font-bold">{toFirestoreDate(transaction.createdAt) ? format(toFirestoreDate(transaction.createdAt)!, 'dd MMMM yyyy', { locale: ar }) : '-'}</p></div>
                </div>
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl" className="w-full">
            <div className="flex justify-center mb-8">
                <TabsList className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[2.5rem] border shadow-2xl h-16 w-full max-w-4xl">
                    <TabsTrigger value="stages" className="rounded-full flex-1 font-black gap-2 h-full transition-all">
                        <Workflow className="h-4 w-4" /> سير العمل (WBS)
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-full flex-1 font-black gap-2 h-full transition-all">
                        <MessageSquare className="h-4 w-4" /> الملاحظات والتعليقات
                    </TabsTrigger>
                    <TabsTrigger value="boq" className="rounded-full flex-1 font-black gap-2 h-full transition-all">
                        <Layers className="h-4 w-4" /> المقايسة (BOQ)
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-full flex-1 font-black gap-2 h-full transition-all">
                        <History className="h-4 w-4" /> سجل الأحداث
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="stages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className={cn("rounded-[3rem] border-none shadow-xl overflow-hidden bg-white", isLocked && "pointer-events-none")}>
                    <CardHeader className="border-b bg-muted/5 p-8 px-10">
                        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'>
                            <Workflow className='text-primary h-6 w-6'/> مسار مراحل الإنجاز الميداني
                        </CardTitle>
                        <CardDescription className="text-xs font-bold">التزام حرفي بقواعد (نوع التتبع، المدة، والتشعب) المحددة في إعدادات المنظومة.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        {(transaction.stages || []).map((stage, idx) => {
                            const expectedDate = toFirestoreDate(stage.expectedEndDate);
                            const isDelayed = stage.status === 'in-progress' && expectedDate && expectedDate < new Date();
                            
                            const isPredecessorCompleted = idx === 0 || 
                                transaction.stages?.some(s => s.status === 'completed' && s.nextStageIds?.includes(stage.stageId)) || 
                                (idx > 0 && transaction.stages![idx-1].status === 'completed');
                            
                            const isBlocked = !isPredecessorCompleted && stage.status === 'pending';

                            return (
                                <div key={stage.stageId} className={cn(
                                    "flex flex-col sm:flex-row items-center justify-between p-6 border-2 border-transparent rounded-[2.5rem] transition-all relative overflow-hidden group",
                                    stage.status === 'in-progress' ? "bg-blue-50/40 border-blue-200 ring-2 ring-primary/5 shadow-lg" : "bg-muted/20 hover:bg-white hover:border-primary/20",
                                    stage.status === 'completed' && "bg-green-50/20 opacity-80",
                                    isBlocked && "opacity-40 grayscale pointer-events-none"
                                )}>
                                    <div className="flex items-center gap-6">
                                        <Badge variant="outline" className={cn(
                                            "w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2 shadow-sm", 
                                            stageStatusColors[stage.status]
                                        )}>
                                            {isBlocked ? 'بانتظار سابقتها' : stageStatusTranslations[stage.status]}
                                        </Badge>
                                        
                                        <div className="space-y-1">
                                            <span className="font-black text-lg text-slate-800">{stage.name}</span>
                                            <div className="flex gap-4">
                                                {stage.status === 'in-progress' && expectedDate && (
                                                    <p className={cn(
                                                        "text-[10px] font-black flex items-center gap-1",
                                                        isDelayed ? "text-red-600 animate-pulse" : "text-blue-600"
                                                    )}>
                                                        {isDelayed ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        التسليم المخطط: {format(expectedDate, 'dd/MM/yyyy')}
                                                    </p>
                                                )}
                                                {stage.status === 'completed' && stage.endDate && (
                                                    <p className="text-[10px] font-black text-green-600 flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> تم الإنجاز: {format(toFirestoreDate(stage.endDate)!, 'dd/MM/yyyy')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mt-4 sm:mt-0 no-print">
                                        {!isLocked && (
                                            <>
                                                {stage.status === 'pending' && isPredecessorCompleted && (
                                                    <Button size="sm" onClick={() => openActionDialog(stage.stageId, stage.name, 'start')} disabled={isProcessing} className="rounded-2xl font-black text-xs h-11 px-8 bg-orange-600 hover:bg-orange-700 text-white shadow-xl shadow-orange-100">
                                                        <Play className="ml-2 h-4 w-4"/> بدء العمل
                                                    </Button>
                                                )}
                                                
                                                {stage.status === 'in-progress' && (
                                                    <>
                                                        {(stage.trackingType === 'occurrence' || stage.trackingType === 'hybrid') && (
                                                            <Button variant="outline" size="sm" onClick={() => openActionDialog(stage.stageId, stage.name, 'modify')} disabled={isProcessing} className="rounded-2xl font-black text-xs h-11 px-6 border-orange-200 text-orange-700 hover:bg-orange-50 gap-2">
                                                                <IterationCcw className="h-4 w-4" /> سجل تعديل ({stage.currentCount || 0})
                                                            </Button>
                                                        )}
                                                        <Button size="sm" onClick={() => openActionDialog(stage.stageId, stage.name, 'complete')} disabled={isProcessing} className="rounded-2xl font-black text-xs h-11 px-8 bg-green-600 hover:bg-green-700 text-white gap-2 shadow-xl shadow-green-100">
                                                            <Check className="ml-2 h-4 w-4"/> إنجاز وإغلاق
                                                        </Button>
                                                    </>
                                                )}
                                                {stage.status === 'completed' && isAdmin && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleUndoStage(stage.stageId)} className="h-9 w-9 rounded-xl text-orange-400 hover:text-orange-600" title="تراجع">
                                                        <Undo2 className="h-5 w-5" />
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="comments" className="animate-in fade-in duration-500">
                <TransactionTimeline 
                    clientId={clientId} 
                    transactionId={transactionId} 
                    filterType="comment" 
                    showInput={!isLocked} 
                    title="الملاحظات والتعليقات الفنية" 
                    icon={<MessageSquare className='text-primary h-6 w-6'/>} 
                    client={client} 
                    transaction={transaction} 
                />
            </TabsContent>

            <TabsContent value="boq" className="animate-in fade-in duration-500">
                <Card className={cn("rounded-[3rem] border-none shadow-xl overflow-hidden bg-white p-10", isLocked && "opacity-80")}>
                    {transaction.boqId ? <LinkedBoqView boqId={transaction.boqId} /> : (
                        <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 space-y-6">
                            <Package className="h-16 w-16 mx-auto opacity-30" />
                            <p className="text-xl font-black text-slate-400">لا يوجد جدول كميات مرتبط.</p>
                            {!isLocked && <Button asChild className="rounded-2xl font-black px-12 h-12 shadow-xl shadow-primary/20"><Link href={`/dashboard/construction/boq/new?projectId=${transaction.id}&clientId=${clientId}`}>إنشاء مقايسة جديدة +</Link></Button>}
                        </div>
                    )}
                </Card>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
                <TransactionTimeline 
                    clientId={clientId} 
                    transactionId={transactionId} 
                    filterType="log" 
                    showInput={false} 
                    title="السجل الإجرائي التاريخي" 
                    icon={<History className='text-primary h-6 w-6'/>} 
                    client={client} 
                    transaction={transaction} 
                />
            </TabsContent>
        </Tabs>

        <Dialog open={actionDialog.isOpen} onOpenChange={(v) => setActionDialog({ ...actionDialog, isOpen: v })}>
            <DialogContent dir="rtl" className="max-w-lg rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white">
                <DialogHeader className={cn(
                    "p-8 border-b text-white",
                    actionDialog.actionType === 'modify' ? "bg-orange-500" : "bg-green-600"
                )}>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md border border-white/20">
                            {actionDialog.actionType === 'modify' ? <IterationCcw className="h-8 w-8 text-white" /> : <CheckCircle2 className="h-8 w-8 text-white" />}
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-black text-white">
                                {actionDialog.actionType === 'modify' ? 'توثيق تعديل فني' : 'تأكيد إنجاز المرحلة'}
                            </DialogTitle>
                            <DialogDescription className="text-white/80 font-bold">المرحلة: {actionDialog.stageName}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                
                <div className="p-8 space-y-6">
                    <div className="grid gap-3">
                        <Label className="font-black text-slate-700 flex items-center gap-2">
                            <MessageCircleIcon className="h-4 w-4 text-primary" /> مبررات الإجراء والملاحظات *
                        </Label>
                        <Textarea 
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder={actionDialog.actionType === 'modify' ? "اشرح سبب التعديل المطلوب (مثلاً: رغبة المالك في تغيير اللون)..." : "صف نتائج العمل المنجز في هذه المرحلة..."}
                            className="rounded-2xl border-2 p-4 text-base font-medium min-h-[140px] focus-visible:ring-primary/20"
                            autoFocus
                        />
                    </div>
                    <div className="p-4 bg-muted/20 rounded-xl border-2 border-dashed border-primary/10 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-primary opacity-40" />
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed">سيتم نشر هذه الملاحظات آلياً في "تبويب التعليقات" وتوليد مطالبة مالية إذا كانت المرحلة مرتبطة بدفعة.</p>
                    </div>
                </div>

                <DialogFooter className="p-8 bg-slate-50 border-t flex gap-4">
                    <Button variant="ghost" onClick={() => setActionDialog({ ...actionDialog, isOpen: false })} disabled={isProcessing} className="rounded-xl font-bold h-12 px-8">إلغاء</Button>
                    <Button 
                        onClick={() => handleStageAction(actionDialog.stageId, actionDialog.actionType, actionNote)} 
                        disabled={isProcessing || !actionNote.trim()} 
                        className={cn(
                            "flex-1 h-12 rounded-xl font-black text-lg shadow-xl gap-2",
                            actionDialog.actionType === 'modify' ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"
                        )}
                    >
                        {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="h-5 w-5" />}
                        اعتماد ونشر الإجراء
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
