'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, updateDoc, getDoc, serverTimestamp, Timestamp, writeBatch, where } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { 
    Pencil, 
    User, 
    Calendar as CalendarIcon, 
    Workflow, 
    Check, 
    History, 
    MessageSquare, 
    ArrowRight,
    Loader2,
    Target,
    Clock,
    Undo2,
    Ban,
    Lock,
    CheckCircle2,
    Play,
    Edit3,
    ArrowDownLeft,
    Sparkles,
    ChevronLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Client, ClientTransaction, TransactionStage, Holiday } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { cn, getTenantPath, cleanFirestoreData, formatCurrency } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { LinkedBoqView } from '@/components/clients/boq/linked-boq-view';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';
import { useBranding } from '@/context/branding-context';
import { addWorkingDays } from '@/services/leave-calculator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

const stageStatusColors: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-800 border-slate-200',
  'in-progress': 'bg-blue-50 text-blue-800 border-blue-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
};

const stageStatusTranslations: Record<string, string> = {
  pending: 'بانتظار البدء',
  'in-progress': 'قيد التنفيذ',
  completed: 'منجزة',
};

const statusTranslations: Record<string, string> = {
    new: 'جديد',
    'in-progress': 'قيد التنفيذ',
    completed: 'منتهي/مكتمل',
    submitted: 'تم التسليم',
    'on-hold': 'معلق إدارياً',
    cancelled: 'ملغي/مفسوخ',
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
  const [actionNote, setActionNote] = useState('');
  const [transactionPath, setTransactionPath] = useState<string | null>(null);
  
  // 🛡️ رادار الإجراءات التفاعلية (Active Action State)
  const [activeAction, setActiveAction] = useState<{ stageId: string, type: 'start' | 'modify' | 'complete' } | null>(null);

  useEffect(() => {
      if (!firestore || !tenantId || !clientId || !transactionId) return;
      const findCorrectPath = async () => {
          const flatPath = getTenantPath(`transactions/${transactionId}`, tenantId)!;
          const nestedPath = getTenantPath(`clients/${clientId}/transactions/${transactionId}`, tenantId)!;
          try {
              const flatSnap = await getDoc(doc(firestore, flatPath));
              setTransactionPath(flatSnap.exists() ? flatPath : nestedPath);
          } catch (e) { setTransactionPath(nestedPath); }
      };
      findCorrectPath();
  }, [firestore, tenantId, clientId, transactionId]);

  const { data: transaction, loading: transactionLoading } = useDocument<ClientTransaction>(firestore, transactionPath);
  const clientPath = useMemo(() => (firestore && clientId && tenantId ? getTenantPath(`clients/${clientId}`, tenantId) : null), [firestore, clientId, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);
  const { data: publicHolidays = [] } = useSubscription<Holiday>(firestore, 'holidays');

  const isLocked = transaction?.status === 'cancelled' || transaction?.status === 'on-hold';
  const isAdmin = ['Admin', 'HR', 'Developer', 'Accountant'].includes(currentUser?.role || '');

  useEffect(() => {
    if (!firestore || !tenantId) return;
    getDocs(query(collection(firestore, getTenantPath('employees', tenantId)!), where('status', '==', 'active'))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  const handleStageAction = async () => {
        if (!activeAction || !firestore || !currentUser || !transaction || !transactionPath || !tenantId || isLocked) return;
        if (!actionNote.trim()) {
            toast({ variant: 'destructive', title: 'توثيق مطلوب', description: 'يرجى كتابة محضر الأعمال قبل الاعتماد.' });
            return;
        }

        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const { stageId, type: action } = activeAction;
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            const stage = currentStages[stageIndex];
            const now = new Date();

            if (action === 'start') {
                stage.status = 'in-progress';
                stage.startDate = Timestamp.fromDate(now);
                if (stage.expectedDurationDays) {
                    stage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, stage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                }
            } else if (action === 'modify') {
                stage.currentCount = (stage.currentCount || 0) + 1;
            } else if (action === 'complete') {
                stage.status = 'completed';
                stage.endDate = Timestamp.fromDate(now);
                const nextStage = currentStages.find(s => s.order === stage.order + 1);
                if (nextStage && nextStage.status === 'pending') {
                    nextStage.status = 'in-progress';
                    nextStage.startDate = Timestamp.fromDate(now);
                    if (nextStage.expectedDurationDays) {
                        nextStage.expectedEndDate = Timestamp.fromDate(addWorkingDays(now, nextStage.expectedDurationDays, branding?.work_hours?.holidays || [], publicHolidays));
                    }
                }
            }

            batch.update(doc(firestore, transactionPath), cleanFirestoreData({ stages: currentStages, updatedAt: serverTimestamp() }));
            
            const timelineRef = doc(collection(firestore, `${transactionPath}/timelineEvents`));
            batch.set(timelineRef, {
                type: 'comment',
                content: `**[إجراء فني: ${action === 'complete' ? 'إنهاء' : action === 'start' ? 'بدء' : 'تعديل'}]** في مرحلة: ${stage.name}.\nالملاحظات: ${actionNote}`,
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                createdAt: serverTimestamp(),
                companyId: tenantId
            });

            if (action === 'complete' && transaction.contract) {
                const contract = transaction.contract;
                const clauseIndex = contract.clauses?.findIndex((c: any) => c.condition === stage.name);
                if (clauseIndex !== -1 && contract.clauses?.[clauseIndex].status === 'غير مستحقة') {
                    const updatedClauses = [...contract.clauses];
                    updatedClauses[clauseIndex].status = 'مستحقة';
                    batch.update(doc(firestore, transactionPath), { 'contract.clauses': updatedClauses });
                    
                    const appRef = doc(collection(firestore, getTenantPath('payment_applications', tenantId)!));
                    batch.set(appRef, cleanFirestoreData({
                        applicationNumber: `APP-AUTO-${now.getTime().toString().substring(7)}`,
                        date: serverTimestamp(),
                        projectId: transaction.id,
                        clientId: transaction.clientId,
                        clientName: client?.nameAr,
                        projectName: transaction.transactionType,
                        totalAmount: updatedClauses[clauseIndex].amount,
                        status: 'draft',
                        createdAt: serverTimestamp(),
                        createdBy: 'system-auto-chain',
                        companyId: tenantId
                    }));
                }
            }

            await batch.commit();
            toast({ title: '✅ تم حفظ المعلومات ومزامنة المالية' });
            setActionNote('');
            setActiveAction(null);
        } catch (e) { toast({ variant: 'destructive', title: 'خطأ' }); } finally { setIsProcessing(false); }
  };

  const handleUndoStage = async (stageId: string) => {
        if (!firestore || !currentUser || !transaction || !transactionPath || !isAdmin || isLocked) return;
        setIsProcessing(true);
        try {
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            currentStages.forEach((s, idx) => {
                if (idx >= stageIndex) {
                    s.status = (idx === stageIndex) ? 'in-progress' : 'pending';
                    s.endDate = null;
                    if (idx > stageIndex) { s.startDate = null; s.expectedEndDate = null; }
                }
            });
            await updateDoc(doc(firestore, transactionPath), { stages: currentStages, updatedAt: serverTimestamp() });
            toast({ title: '✅ تم التراجع عن الإنجاز' });
        } finally { setIsProcessing(false); }
  };

  if (transactionLoading || clientLoading || !transaction) return <div className="p-8 max-w-5xl mx-auto space-y-6"><Skeleton className="h-48 w-full rounded-[3rem]" /><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;

  return (
    <div className='space-y-6 max-w-6xl mx-auto pb-20' dir='rtl'>
        {isLocked && (
            <Alert className="rounded-[2.5rem] border-2 shadow-2xl py-8 bg-red-50 border-red-500 animate-in zoom-in-95">
                <Ban className="h-10 w-10 text-red-600" />
                <AlertTitle className="text-2xl font-black text-red-900">المسار الفني مغلق</AlertTitle>
                <AlertDescription className="text-lg font-bold text-red-700 mt-1">هذه المعاملة مجمدة أو ملغاة؛ لا يمكن التوثيق الميداني حالياً.</AlertDescription>
            </Alert>
        )}

        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right space-y-2">
                        <CardTitle className='text-3xl font-black text-[#1e1b4b] tracking-tighter'>{transaction.transactionType}</CardTitle>
                        <CardDescription className="text-base font-medium">العميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline font-bold'>{client?.nameAr || '...'}</Link></CardDescription>
                    </div>
                    <Badge variant="outline" className="px-6 py-1.5 rounded-full font-black text-sm border-2">{statusTranslations[transaction.status]}</Badge>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-white">
                <div className="flex items-center gap-4 text-sm">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary"><User className="h-5 w-5 opacity-40"/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">المهندس المسؤول</p><p className="font-black text-slate-800 text-lg">{employeesMap.get(transaction.assignedEngineerId || '') || 'غير مسند'}</p></div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <div className="p-2.5 bg-slate-50 rounded-xl text-primary"><CalendarIcon className="h-5 w-5 opacity-40"/></div>
                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ فتح المسار</p><p className="font-bold text-lg">{toFirestoreDate(transaction.createdAt) ? format(toFirestoreDate(transaction.createdAt)!, 'dd MMMM yyyy', { locale: ar }) : '-'}</p></div>
                </div>
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl" className="w-full">
            <div className="flex justify-center mb-8">
                <TabsList className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[2.5rem] border shadow-2xl h-16 w-full max-w-4xl">
                    <TabsTrigger value="stages" className="rounded-full flex-1 font-black gap-2 h-full transition-all">المراحل (WBS)</TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-full flex-1 font-black gap-2 h-full transition-all">الملاحظات</TabsTrigger>
                    <TabsTrigger value="boq" className="rounded-full flex-1 font-black gap-2 h-full transition-all">المقايسة</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-full flex-1 font-black gap-2 h-full transition-all">السجل</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="stages" className="animate-in fade-in duration-700">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="border-b bg-muted/5 p-8 px-10">
                        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'><Workflow className='text-primary h-6 w-6'/> مسار مراحل الإنجاز الفني</CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-12">
                        {(transaction.stages || []).map((stage, idx) => {
                            const isCompleted = stage.status === 'completed';
                            const isCurrent = stage.status === 'in-progress';
                            const isLockedRow = idx > 0 && transaction.stages![idx-1].status !== 'completed';
                            const isActionActive = activeAction?.stageId === stage.stageId;

                            if (isLockedRow && !isCurrent) return null;

                            return (
                                <div key={stage.stageId} className={cn(
                                    "p-10 border-2 rounded-[3.5rem] transition-all relative group",
                                    isCurrent ? "border-primary bg-primary/[0.02] shadow-2xl scale-[1.01]" : "border-slate-100 opacity-60"
                                )}>
                                    <div className="flex flex-col sm:flex-row justify-between items-center gap-8">
                                        <div className="flex items-center gap-8">
                                            <div className="relative">
                                                <Badge variant="outline" className={cn("w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", stageStatusColors[stage.status])}>
                                                    {stageStatusTranslations[stage.status]}
                                                </Badge>
                                                <div className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-white rounded-full border-2 border-primary flex items-center justify-center font-mono font-black text-[8px] text-primary shadow-sm">{idx + 1}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="font-black text-2xl text-slate-900">{stage.name}</span>
                                                {isCurrent && stage.expectedEndDate && (
                                                    <p className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5 uppercase tracking-widest">
                                                        <Clock className="h-3 w-3" /> التسليم المخطط: {format(toFirestoreDate(stage.expectedEndDate)!, 'dd/MM/yyyy')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 no-print">
                                            {isCurrent && !isActionActive && (
                                                <div className="flex gap-2 animate-in zoom-in-95">
                                                    <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'modify' })} variant="outline" className="h-12 px-6 rounded-2xl font-black text-xs gap-2 border-orange-200 text-orange-700 bg-white hover:bg-orange-50 transition-all"><Edit3 className="h-4 w-4" /> تسجيل تعديل</Button>
                                                    <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'complete' })} className="h-12 px-8 rounded-2xl font-black text-xs gap-2 bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-100"><CheckCircle2 className="h-4 w-4" /> إنهاء المرحلة</Button>
                                                </div>
                                            )}
                                            {stage.status === 'pending' && !isActionActive && !isLocked && (
                                                <Button onClick={() => setActiveAction({ stageId: stage.stageId, type: 'start' })} className="h-12 px-10 rounded-2xl font-black gap-3 shadow-xl"><Play className="h-4 w-4" /> بدء العمل الميداني</Button>
                                            )}
                                            {isCompleted && (
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-green-100 rounded-full text-green-700 shadow-inner"><CheckCircle2 className="h-7 w-7"/></div>
                                                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => handleUndoStage(stage.stageId)} className="text-orange-300 hover:text-orange-600 transition-colors"><Undo2 className="h-5 w-5"/></Button>}
                                                </div>
                                            )}
                                            {isActionActive && <Button variant="ghost" size="icon" onClick={() => setActiveAction(null)} className="h-10 w-10 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500"><X className="h-5 w-5"/></Button>}
                                        </div>
                                    </div>

                                    {isActionActive && (
                                        <div className="mt-10 pt-10 border-t-2 border-dashed border-primary/20 space-y-6 animate-in slide-in-from-top-4 duration-500">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center pr-1">
                                                    <Label className="font-black text-xs text-primary flex items-center gap-2 uppercase tracking-[0.2em]">
                                                        <MessageSquare className="h-4 w-4" /> محضر التوثيق الميداني (إلزامي لـ {activeAction.type === 'complete' ? 'الإنهاء' : 'التعديل'}) *
                                                    </Label>
                                                    <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase">Action Bubble Node</Badge>
                                                </div>
                                                <Textarea 
                                                    autoFocus
                                                    value={actionNote} 
                                                    onChange={e => setActionNote(e.target.value)} 
                                                    placeholder="اشرح بالتفصيل ما تم إنجازه أو مبررات التعديل الفني..." 
                                                    className="rounded-[2.5rem] border-none bg-white shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] p-8 font-medium text-xl leading-relaxed min-h-[160px] focus-visible:ring-2 focus-visible:ring-primary/20"
                                                />
                                            </div>
                                            
                                            <div className="flex justify-end">
                                                <Button 
                                                    onClick={handleStageAction} 
                                                    disabled={isProcessing || !actionNote.trim()} 
                                                    className={cn(
                                                        "h-14 px-20 rounded-[2rem] font-black text-xl shadow-2xl gap-4 min-w-[300px]",
                                                        activeAction.type === 'complete' ? "bg-green-600 hover:bg-green-700 shadow-green-200" : 
                                                        activeAction.type === 'start' ? "bg-primary shadow-primary/30" : "bg-orange-600 hover:bg-orange-700 shadow-orange-200"
                                                    )}
                                                >
                                                    {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <Save className="h-6 w-6" />}
                                                    تأكيد وحفظ الإجراء
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="comments"><TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="comment" showInput={!isLocked} title="الملاحظات الفنية" icon={<MessageSquare className='text-primary h-6 w-6'/>} client={client} transaction={transaction} /></TabsContent>
            <TabsContent value="boq"><Card className="rounded-[3rem] p-10">{transaction.boqId ? <LinkedBoqView boqId={transaction.boqId} /> : <p className="text-center opacity-30 italic font-black">لا يوجد جدول كميات مرتبط.</p>}</Card></TabsContent>
            <TabsContent value="history"><TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="log" showInput={false} title="سجل الأحداث" icon={<History className='text-primary h-6 w-6'/>} client={client} transaction={transaction} /></TabsContent>
        </Tabs>
    </div>
  );
}
