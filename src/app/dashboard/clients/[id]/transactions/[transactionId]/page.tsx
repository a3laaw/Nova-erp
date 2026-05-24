'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, updateDoc, getDoc, serverTimestamp, increment, Timestamp } from 'firebase/firestore';
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
    Pencil, 
    User, 
    Calendar, 
    Workflow, 
    Play, 
    Check, 
    MessageSquare, 
    History, 
    ClipboardList, 
    Sparkles, 
    CheckCircle2,
    ArrowRight,
    Info,
    AlertCircle,
    Package,
    Layers,
    FileSignature,
    Loader2,
    Target,
    RotateCcw,
    Clock,
    Plus,
    Undo2,
    IterationCcw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Client, ClientTransaction, WorkStage, TransactionStage, Holiday } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { LinkedBoqView } from '@/components/clients/boq/linked-boq-view';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';
import { Progress } from '@/components/ui/progress';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
  'on-hold': 'bg-gray-100 text-gray-800 border-gray-200',
};

const statusTranslations: Record<string, string> = {
  new: 'جديدة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  submitted: 'تم تسليمها',
  'on-hold': 'مجمدة',
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

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
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
  const { branding } = useBranding();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  const tenantId = currentUser?.currentCompanyId;

  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const transactionPath = useMemo(() => (firestore && clientId && transactionId && tenantId ? getTenantPath(`clients/${clientId}/transactions/${transactionId}`, tenantId) : null), [firestore, clientId, transactionId, tenantId]);
  const { data: transaction, loading: transactionLoading } = useDocument<ClientTransaction>(firestore, transactionPath);
  
  const clientPath = useMemo(() => (firestore && clientId && tenantId ? getTenantPath(`clients/${clientId}`, tenantId) : null), [firestore, clientId, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

  const canEdit = useMemo(() => ['Admin', 'HR', 'Developer', 'Secretary', 'Engineer'].includes(currentUser?.role || ''), [currentUser]);
  const isAdmin = useMemo(() => ['Admin', 'HR', 'Developer'].includes(currentUser?.role || ''), [currentUser]);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  /**
   * ✨ محرك المزامنة المتطور (WBS Sovereign Engine V2000.0) ✨
   * تنفيذ منطق الأزرار بناءً على النوع المختار في القوائم المرجعية.
   */
  const handleStageAction = async (stageId: string, action: 'start' | 'modify' | 'complete') => {
        if (!firestore || !currentUser || !transaction || !transactionPath) return;
        setIsProcessing(true);
        try {
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            const now = new Date();

            if (action === 'start') {
                stage.status = 'in-progress';
                stage.startDate = Timestamp.fromDate(now);
                // 🛡️ الالتزام بـ (المدة المتوقعة للإنجاز) المبرمجة 🛡️
                if (stage.expectedDurationDays) {
                    const expectedEnd = addWorkingDays(now, stage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays);
                    stage.expectedEndDate = Timestamp.fromDate(expectedEnd);
                }
            } else if (action === 'modify') {
                // 🛡️ الالتزام بـ (نوع التتبع الرقابي: Occurrence) 🛡️
                stage.currentCount = (stage.currentCount || 0) + 1;
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                
                // 🛡️ الالتزام بـ (مراحل الاستكمال التلقائية) المتشعبة 🛡️
                const nextIds = stage.nextStageIds || [];
                if (nextIds.length > 0) {
                    nextIds.forEach(nid => {
                        const target = currentStages.find(s => s.stageId === nid);
                        if (target && target.status === 'pending') {
                            target.status = 'in-progress'; 
                            target.startDate = Timestamp.fromDate(now);
                            if (target.expectedDurationDays) {
                                target.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, target.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                            }
                        }
                    });
                } else {
                    const nextStage = currentStages.find(s => s.order === stage.order + 1);
                    if (nextStage && nextStage.status === 'pending') {
                        nextStage.status = 'in-progress';
                        nextStage.startDate = Timestamp.fromDate(now);
                        if (nextStage.expectedDurationDays) {
                            nextStage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, nextStage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                        }
                    }
                }

                // تحديث الأثر المالي في العقد
                if (transaction.contract?.clauses) {
                    const updatedClauses = transaction.contract.clauses.map((clause: any) => {
                        if (clause.condition === stage.name && clause.status === 'غير مستحقة') {
                            return { ...clause, status: 'مستحقة' };
                        }
                        return clause;
                    });
                    await updateDoc(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });
                }
            }

            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            
            toast({ 
                title: 'تم التحديث', 
                description: action === 'complete' ? 'تم إنهاء المرحلة وبدء التبعات التالية آلياً.' : 
                             action === 'modify' ? 'تم تسجيل جولة تعديل بنجاح.' : 'تم تسجيل بدء العمل الفعلي.' 
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ', description: e.message });
        } finally { setIsProcessing(false); }
  };

  const handleUndoStage = async (stageId: string) => {
        if (!firestore || !currentUser || !transaction || !transactionPath || !isAdmin) return;
        setIsProcessing(true);
        try {
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            // العودة لحالة "قيد التنفيذ" وإلغاء تاريخ الانتهاء
            stage.status = 'in-progress';
            stage.endDate = null;
            
            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            toast({ title: 'تم التراجع عن الإنجاز', description: 'عادت المرحلة لوضع التنفيذ النشط.' });
        } finally { setIsProcessing(false); }
  };

  if (transactionLoading || clientLoading) return <div className="p-8 max-w-5xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
  if (!transaction || !client) return <div className="text-center py-20 text-destructive font-black opacity-30">المعاملة غير موجودة.</div>;

  return (
    <div className='space-y-6 max-w-6xl mx-auto pb-20' dir='rtl'>
        <div className="flex items-center gap-4 no-print px-4">
            <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-bold gap-2 text-slate-500 hover:bg-white">
                <ArrowRight className="h-4 w-4"/> العودة لملف العميل
            </Button>
        </div>

        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right space-y-2">
                        <div className="flex items-center gap-3">
                            <CardTitle className='text-3xl font-black text-[#1e1b4b] tracking-tighter'>{transaction.transactionType}</CardTitle>
                            <UniversalActionTrigger title={transaction.transactionType} sourceModule="المعاملات" sourceId={transaction.id!} />
                        </div>
                        {transaction.subServiceName && <Badge className="bg-primary text-white font-black px-4 h-7 rounded-full border-none shadow-md">{transaction.subServiceName}</Badge>}
                        <CardDescription className="text-base font-medium">العميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline font-bold'>{client.nameAr}</Link></CardDescription>
                    </div>
                    <Badge variant="outline" className={cn("px-6 py-1.5 rounded-full font-black text-sm border-2", transactionStatusColors[transaction.status])}>{statusTranslations[transaction.status]}</Badge>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-white">
                <InfoRow icon={<User className="h-5 w-5 text-primary opacity-40"/>} label="المهندس المسؤول" value={transaction.assignedEngineerId ? <span className="font-black text-slate-800">{employeesMap.get(transaction.assignedEngineerId)}</span> : 'غير مسند'} />
                <InfoRow icon={<Calendar className="h-5 w-5 text-primary opacity-40"/>} label="تاريخ الفتح" value={<span className="font-bold">{toFirestoreDate(transaction.createdAt) ? format(toFirestoreDate(transaction.createdAt)!, 'dd MMMM yyyy', { locale: ar }) : '-'}</span>} />
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl" className="w-full">
            <div className="flex justify-center mb-8">
                <TabsList className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[2rem] border shadow-2xl h-16 w-full max-w-3xl">
                    <TabsTrigger value="stages" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">سير العمل الموحد (WBS)</TabsTrigger>
                    <TabsTrigger value="boq" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">المقايسة (BOQ)</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">سجل الأحداث</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="stages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="border-b bg-muted/5 p-8 px-10">
                        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'>
                            <Workflow className='text-primary h-6 w-6'/> مسار مراحل الإنجاز الميداني (WBS)
                        </CardTitle>
                        <CardDescription className="text-xs font-bold">إدارة ذكية للمراحل؛ الانتهاء من مرحلة يُفعل كافة التبعات المتشعبة آلياً.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        {(transaction.stages || []).map((stage, idx) => {
                            const isDelayed = stage.status === 'in-progress' && stage.expectedEndDate && toFirestoreDate(stage.expectedEndDate)! < new Date();
                            
                            // 🛡️ الحماية الرقابية الصارمة 🛡️
                            const isPredecessorCompleted = idx === 0 || 
                                transaction.stages?.some(s => s.status === 'completed' && s.nextStageIds?.includes(stage.stageId)) || 
                                transaction.stages![idx-1].status === 'completed';
                            
                            const isBlocked = !isPredecessorCompleted && stage.status === 'pending';

                            return (
                                <div key={stage.stageId} className={cn(
                                    "flex flex-col sm:flex-row items-center justify-between p-6 border-2 border-transparent rounded-[2rem] transition-all relative overflow-hidden group",
                                    stage.status === 'in-progress' ? "bg-blue-50/40 border-blue-200 ring-2 ring-primary/5 shadow-lg" : "bg-muted/20 hover:bg-white hover:border-primary/20",
                                    stage.status === 'completed' && "bg-green-50/20 opacity-80",
                                    isBlocked && "opacity-40 grayscale pointer-events-none"
                                )}>
                                    <div className="flex items-center gap-6">
                                        <Badge variant="outline" className={cn(
                                            "w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", 
                                            stageStatusColors[stage.status]
                                        )}>
                                            {isBlocked ? 'بانتظار سابقتها' : stageStatusTranslations[stage.status]}
                                        </Badge>
                                        
                                        <div className="space-y-1">
                                            <span className="font-black text-lg text-slate-800">{stage.name}</span>
                                            <div className="flex gap-4">
                                                {stage.startDate && (
                                                    <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                        <Play className="h-2 w-2" /> البدء: {format(toFirestoreDate(stage.startDate)!, 'dd/MM/yyyy')}
                                                    </p>
                                                )}
                                                {stage.status === 'in-progress' && stage.expectedEndDate && (
                                                    <p className={cn(
                                                        "text-[10px] font-black flex items-center gap-1",
                                                        isDelayed ? "text-red-600 animate-pulse" : "text-blue-600"
                                                    )}>
                                                        {isDelayed ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                                        التسليم المتوقع: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}
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
                                        {canEdit && stage.status === 'pending' && isPredecessorCompleted && (
                                            <Button size="sm" onClick={() => handleStageAction(stage.stageId, 'start')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 px-8 bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:scale-105 transition-all">
                                                <Play className="ml-2 h-4 w-4"/> بدء العمل
                                            </Button>
                                        )}
                                        
                                        {canEdit && stage.status === 'in-progress' && (
                                            <>
                                                {(stage.trackingType === 'occurrence' || stage.trackingType === 'hybrid') && (
                                                    <Button variant="outline" size="sm" onClick={() => handleStageAction(stage.stageId, 'modify')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 px-6 border-orange-200 text-orange-700 hover:bg-orange-50 gap-2 shadow-sm">
                                                        <IterationCcw className="h-4 w-4" /> سجل تعديل ({stage.currentCount || 0})
                                                    </Button>
                                                )}
                                                <Button size="sm" onClick={() => handleStageAction(stage.stageId, 'complete')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 px-8 bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-100 transition-all">
                                                    <Check className="ml-2 h-4 w-4"/> إنهاء وإنجاز
                                                </Button>
                                            </>
                                        )}
                                        {stage.status === 'completed' && isAdmin && (
                                            <Button variant="ghost" size="icon" onClick={() => handleUndoStage(stage.stageId)} className="h-9 w-9 rounded-xl text-orange-400 hover:text-orange-600 hover:bg-orange-50" title="تراجع عن الإكمال">
                                                <Undo2 className="h-5 w-5" />
                                            </Button>
                                        )}
                                        {stage.status === 'completed' && !isAdmin && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="boq" className="animate-in fade-in duration-500">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white p-10">
                    {transaction.boqId ? <LinkedBoqView boqId={transaction.boqId} /> : (
                        <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 space-y-6">
                            <Package className="h-16 w-16 mx-auto opacity-30" />
                            <p className="text-xl font-black text-slate-400">لا يوجد جدول كميات مرتبط.</p>
                            <Button asChild className="rounded-2xl font-black px-12 h-12 shadow-xl shadow-primary/20"><Link href={`/dashboard/construction/boq/new?projectId=${transaction.id}&clientId=${clientId}`}>إنشاء مقايسة جديدة +</Link></Button>
                        </div>
                    )}
                </Card>
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="log" showInput={false} title="السجل الإجرائي التاريخي" icon={<History className='text-primary h-6 w-6'/>} client={client} transaction={transaction} />
            </TabsContent>
        </Tabs>
    </div>
  );
}
