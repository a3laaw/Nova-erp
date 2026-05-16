'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, type DocumentData, getDocs, writeBatch, serverTimestamp, deleteField, deleteDoc, updateDoc, where, getDoc, collectionGroup, addDoc, Timestamp, limit } from 'firebase/firestore';
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
import { Pencil, User, Calendar, Workflow, Play, Check, Undo2, Plus, MessageSquare, History, ClipboardList, ExternalLink, Sparkles, Coins, FileSignature, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import type { Client, ClientTransaction, Employee, TransactionType, WorkStage, TransactionStage, Account } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { createNotification, findUserIdByEmployeeId } from '@/services/notification-service';
import { formatCurrency, cn, cleanFirestoreData } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { LinkedBoqView } from '@/components/clients/boq/linked-boq-view';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SignaturePad } from '@/components/ui/signature-pad';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';

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
  
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [workStageTemplates, setWorkStageTemplates] = useState<WorkStage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);

  const transactionRef = useMemo(() => (firestore && clientId && transactionId ? doc(firestore, 'clients', clientId, 'transactions', transactionId) : null), [firestore, clientId, transactionId]);
  const { data: transaction, loading: transactionLoading, error: transactionError } = useDocument<ClientTransaction>(firestore, transactionRef ? transactionRef.path : null);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientId ? `clients/${clientId}` : null);

  useEffect(() => {
    if (!firestore) return;
    getDocs(collection(firestore, 'employees')).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore]);
  
  useEffect(() => {
    if (!firestore || !transaction?.transactionTypeId) return;
    const fetchTemplates = async () => {
        try {
            const transTypeSnap = await getDoc(doc(firestore, 'transactionTypes', transaction.transactionTypeId!));
            if (!transTypeSnap.exists()) return;
            const departmentIds = transTypeSnap.data().departmentIds || [];
            if (departmentIds.length === 0) return;
            const stagePromises = departmentIds.map(deptId => getDocs(query(collection(firestore, `departments/${deptId}/workStages`), orderBy('order'))));
            const snapshots = await Promise.all(stagePromises);
            const allStages: WorkStage[] = [];
            snapshots.forEach(s => s.docs.forEach(d => allStages.push({ id: d.id, ...d.data() } as WorkStage)));
            setWorkStageTemplates(allStages);
        } catch (e) { console.error(e); }
    };
    fetchTemplates();
  }, [firestore, transaction?.transactionTypeId]);

  const handleStageStatusChange = async (stageId: string, newStatus: TransactionStage['status']) => {
        if (!firestore || !currentUser || !transaction || !transactionRef) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const currentStages: TransactionStage[] = JSON.parse(JSON.stringify(transaction.stages || []));
            const stageIndex = currentStages.findIndex(s => s.stageId === stageId);
            if (stageIndex === -1) throw new Error("Stage not found");
            const stage = currentStages[stageIndex];
            
            stage.status = newStatus;
            const now = new Date();
            if (newStatus === 'in-progress' && !stage.startDate) stage.startDate = now;
            if (newStatus === 'completed') stage.endDate = now;

            batch.update(transactionRef, { stages: currentStages });
            await batch.commit();
            toast({ title: 'نجاح', description: 'تم تحديث حالة المرحلة.' });
        } catch (error) { 
            console.error(error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث المرحلة.' }); 
        }
        finally { setIsProcessing(false); }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!firestore || !transactionRef || !transaction) return;
    setIsProcessing(true);
    try {
        await updateDoc(transactionRef, {
            'contract.signatureInfo': {
                clientSignature: signatureDataUrl,
                signedAt: serverTimestamp(),
                signedByIP: 'client-device'
            }
        });
        toast({ title: 'تم التوقيع', description: 'تم اعتماد توقيع المالك وحفظه في العقد بنجاح.' });
        setIsSignDialogOpen(false);
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حفظ التوقيع.' });
    } finally { setIsProcessing(false); }
  };

  const enrichedStages = useMemo(() => {
        if (!transaction || !workStageTemplates) return [];
        const progressStages = transaction.stages || [];
        return workStageTemplates.map(template => {
            const progress = progressStages.find(p => p.stageId === template.id);
            return { ...template, ...progress, status: progress?.status || 'pending' };
        }).sort((a,b) => (a.order ?? 99) - (b.order ?? 99));
  }, [transaction, workStageTemplates]);

  if (transactionLoading || clientLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (!transaction || !client) return <div className="text-center py-10 text-destructive">فشل تحميل بيانات المعاملة.</div>;

  return (
    <div className='space-y-6' dir='rtl'>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <div className="flex items-center gap-4">
                        <CardTitle className='text-2xl'>{transaction.transactionType}</CardTitle>
                        <UniversalActionTrigger 
                            title={transaction.transactionType}
                            sourceModule="المعاملات"
                            sourceId={transaction.id!}
                        />
                    </div>
                    <CardDescription>العميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link></CardDescription>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className={cn("flex items-center", transactionStatusColors[transaction.status])}>
                        {transactionStatusTranslations[transaction.status]}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <InfoRow icon={<User />} label="المهندس المسؤول" value={transaction.assignedEngineerId ? employeesMap.get(transaction.assignedEngineerId) : 'لم يحدد'} />
                <InfoRow icon={<Calendar />} label="تاريخ الإنشاء" value={toFirestoreDate(transaction.createdAt) ? format(toFirestoreDate(transaction.createdAt)!, 'PPP', { locale: ar }) : '-'} />
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="stages">سير العمل</TabsTrigger>
                <TabsTrigger value="boq">جدول الكميات (BOQ)</TabsTrigger>
                <TabsTrigger value="comments">المتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل الأحداث</TabsTrigger>
            </TabsList>
            <TabsContent value="stages" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className='flex items-center gap-2'><Workflow className='text-primary'/> مراحل العمل</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {enrichedStages.map((stage) => (
                            <div key={stage.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 group">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={cn("w-28 justify-center", stageStatusColors[stage.status])}>{stageStatusTranslations[stage.status]}</Badge>
                                    <div className="flex flex-col">
                                        <span className="font-semibold">{stage.name}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <UniversalActionTrigger 
                                        title={transaction.transactionType}
                                        subItemName={stage.name}
                                        sourceModule="مراحل العمل"
                                        sourceId={transaction.id!}
                                        sourceSubId={stage.id}
                                    />
                                    <div className="flex gap-2">
                                        {stage.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.id!, 'in-progress')} disabled={isProcessing}><Play className="ml-2 h-4 w-4"/> بدء</Button>}
                                        {stage.status === 'in-progress' && (
                                            <Button size="sm" variant="outline" className="bg-green-50 text-green-700" onClick={() => handleStageStatusChange(stage.id!, 'completed')} disabled={isProcessing}>
                                                <Check className="ml-2 h-4 w-4"/> إكمال
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="boq" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ClipboardList className="text-primary"/> جدول الكميات (BOQ)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {transaction.boqId ? (
                            <LinkedBoqView boqId={transaction.boqId} />
                        ) : (
                            <div className="p-12 text-center border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">لا يوجد جدول كميات مرتبط.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="comments" className="mt-6">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="comment" showInput={true} title="التعليقات" icon={<MessageSquare className="text-primary" />} client={client} transaction={transaction}/>
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="log" showInput={false} title="السجل التاريخي" icon={<History className='text-primary'/>} client={client} transaction={transaction}/>
            </TabsContent>
        </Tabs>

        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
            <DialogContent className="max-w-lg rounded-3xl" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <FileSignature className="text-primary" /> توقيع العقد إلكترونياً
                    </DialogTitle>
                </DialogHeader>
                <div className="py-6">
                    <SignaturePad onSave={handleSaveSignature} />
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}
