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
    Undo2
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
import { SignaturePad } from '@/components/ui/signature-pad';
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

  const handleStageStatusChange = async (stageId: string, newStatus: TransactionStage['status']) => {
        if (!firestore || !currentUser || !transaction || !transactionPath) return;
        setIsProcessing(true);
        try {
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            
            const stage = currentStages[stageIndex];
            stage.status = newStatus;
            const now = new Date();
            
            if (newStatus === 'in-progress' && !stage.startDate) {
                stage.startDate = now;
                if (stage.expectedDurationDays) {
                    const expectedEnd = addWorkingDays(
                        now, 
                        stage.expectedDurationDays, 
                        branding?.work_hours?.holidays || [], 
                        publicHolidays
                    );
                    stage.expectedEndDate = expectedEnd;
                }
            }
            
            if (newStatus === 'completed') {
                stage.endDate = now;
                
                // ✨ ذكاء التبعية الموحد: البحث عن المرحلة التالية المبرمجة يدوياً أولاً ✨
                let nextStage = null;
                if (stage.nextStageId) {
                    nextStage = currentStages.find(s => s.stageId === stage.nextStageId);
                } else {
                    // Fallback to order-based progression
                    nextStage = currentStages.find(s => s.order === stage.order + 1);
                }

                if (nextStage && nextStage.status === 'pending') {
                    nextStage.status = 'in-progress';
                    nextStage.startDate = now;
                    if (nextStage.expectedDurationDays) {
                        const nextExpEnd = addWorkingDays(
                            now, 
                            nextStage.expectedDurationDays, 
                            branding?.work_hours?.holidays || [], 
                            publicHolidays
                        );
                        nextStage.expectedEndDate = nextExpEnd;
                    }
                }
            }

            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            toast({ title: 'تم التحديث', description: newStatus === 'completed' ? 'تم إنجاز المرحلة وفتح التالية آلياً.' : 'بدأ العمل في المرحلة.' });
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
            stage.status = 'in-progress';
            stage.endDate = null;
            
            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            toast({ title: 'تم التراجع', description: 'تمت إعادة المرحلة لوضع التنفيذ.' });
        } finally { setIsProcessing(false); }
  };

  if (transactionLoading || clientLoading) return <div className="p-8 max-w-5xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
  if (!transaction || !client) return <div className="text-center py-20 text-destructive">فشل تحميل بيانات المعاملة.</div>;

  return (
    <div className='space-y-6 max-w-6xl mx-auto' dir='rtl'>
        <div className="flex items-center gap-4 no-print px-4">
            <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-bold gap-2"><ArrowRight className="h-4 w-4"/> العودة لملف العميل</Button>
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
                        <CardDescription className="text-base font-bold">العميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link></CardDescription>
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
                    <TabsTrigger value="stages" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full">سير العمل (WBS)</TabsTrigger>
                    <TabsTrigger value="boq" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full">المقايسة (BOQ)</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full">سجل الأحداث</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="stages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="border-b bg-muted/5 p-8 px-10">
                        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'><Workflow className='text-primary h-6 w-6'/> مسار مراحل الإنجاز الميداني</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        {(transaction.stages || []).map((stage) => (
                            <div key={stage.stageId} className="flex flex-col sm:flex-row items-center justify-between p-6 border-2 border-transparent bg-muted/20 rounded-[2rem] hover:bg-white hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-6">
                                    <Badge variant="outline" className={cn("w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", stageStatusColors[stage.status])}>{stageStatusTranslations[stage.status]}</Badge>
                                    <div className="space-y-1">
                                        <span className="font-black text-lg text-slate-800">{stage.name}</span>
                                        {stage.status === 'in-progress' && stage.expectedEndDate && (
                                            <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Clock className="h-3 w-3" /> التسليم المتوقع: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                                    {stage.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.stageId, 'in-progress')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 border-2 px-6"><Play className="ml-2 h-4 w-4"/> بدء العمل</Button>}
                                    {stage.status === 'in-progress' && <Button size="sm" onClick={() => handleStageStatusChange(stage.stageId, 'completed')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 px-8 bg-green-600 text-white gap-2"><Check className="ml-2 h-4 w-4"/> تأكيد الإنجاز</Button>}
                                    {stage.status === 'completed' && isAdmin && <Button variant="ghost" size="icon" onClick={() => handleUndoStage(stage.stageId)} className="h-8 w-8 text-orange-400 hover:text-orange-600"><Undo2 className="h-4 w-4" /></Button>}
                                    {stage.status === 'completed' && !isAdmin && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                                </div>
                            </div>
                        ))}
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
