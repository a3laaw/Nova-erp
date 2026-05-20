'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
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
    Coins, 
    FileSignature, 
    Loader2, 
    Layers, 
    Package, 
    AlertCircle, 
    CheckCircle2,
    ArrowRight,
    Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Client, ClientTransaction, WorkStage, TransactionStage } from '@/lib/types';
import { format } from 'date-fns';
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
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  const tenantId = currentUser?.currentCompanyId;

  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [workStageTemplates, setWorkStageTemplates] = useState<WorkStage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);

  const transactionPath = useMemo(() => (firestore && clientId && transactionId && tenantId ? getTenantPath(`clients/${clientId}/transactions/${transactionId}`, tenantId) : null), [firestore, clientId, transactionId, tenantId]);
  const { data: transaction, loading: transactionLoading } = useDocument<ClientTransaction>(firestore, transactionPath);
  
  const clientPath = useMemo(() => (firestore && clientId && tenantId ? getTenantPath(`clients/${clientId}`, tenantId) : null), [firestore, clientId, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);
  
  useEffect(() => {
    if (!firestore || !transaction?.transactionTypeId || !tenantId) return;
    const fetchTemplates = async () => {
        try {
            const stagesPath = getTenantPath(`transactionTypes/${transaction.transactionTypeId}/workStages`, tenantId);
            if (!stagesPath) return;
            const stagesSnap = await getDocs(query(collection(firestore, stagesPath), orderBy('order')));
            setWorkStageTemplates(stagesSnap.docs.map(d => ({ id: d.id, ...d.data() } as WorkStage)));
        } catch (e) { console.error(e); }
    };
    fetchTemplates();
  }, [firestore, transaction?.transactionTypeId, tenantId]);

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
            if (newStatus === 'in-progress' && !stage.startDate) stage.startDate = now;
            if (newStatus === 'completed') stage.endDate = now;

            await updateDoc(doc(firestore, transactionPath), { stages: currentStages });
            toast({ title: 'نجاح التحديث' });
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

  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!firestore || !transactionPath || !transaction) return;
    setIsProcessing(true);
    try {
        await updateDoc(doc(firestore, transactionPath), {
            'contract.signatureInfo': {
                clientSignature: signatureDataUrl,
                signedAt: serverTimestamp(),
            }
        });
        toast({ title: 'تم التوقيع', description: 'تم اعتماد توقيع المالك وحفظه في العقد بنجاح.' });
        setIsSignDialogOpen(false);
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ' });
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
                            <UniversalActionTrigger title={transaction.transactionType} sourceModule="المعاملات المعتمدة" sourceId={transaction.id!} />
                        </div>
                        {transaction.subServiceName && (
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary opacity-60" />
                                <Badge className="bg-primary text-white font-black px-4 h-7 rounded-full border-none shadow-md">{transaction.subServiceName}</Badge>
                            </div>
                        )}
                        <CardDescription className="text-base font-bold">العميل: {client.nameAr}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                        <Badge variant="outline" className={cn("px-6 py-1.5 rounded-full font-black text-sm border-2 shadow-sm", transactionStatusColors[transaction.status])}>
                            {statusTranslations[transaction.status]}
                        </Badge>
                        <span className="font-mono text-xs font-black opacity-30">REF: {transaction.transactionNumber}</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-white">
                <div className="space-y-4">
                    <InfoRow icon={<User className="h-5 w-5 text-primary opacity-40"/>} label="المهندس المسؤول" value={transaction.assignedEngineerId ? <span className="font-black text-slate-800">{employeesMap.get(transaction.assignedEngineerId)}</span> : <span className="text-muted-foreground italic">لم يحدد بعد</span>} />
                    <InfoRow icon={<Calendar className="h-5 w-5 text-primary opacity-40"/>} label="تاريخ الفتح الرسمي" value={<span className="font-bold">{toFirestoreDate(transaction.createdAt) ? format(toFirestoreDate(transaction.createdAt)!, 'dd MMMM yyyy', { locale: ar }) : '-'}</span>} />
                </div>
                {transaction.description && (
                    <div className="bg-muted/10 p-6 rounded-3xl border-2 border-dashed border-primary/10">
                        <Label className="text-[10px] font-black uppercase text-primary mb-2 block">ملاحظات التأسيس:</Label>
                        <p className="text-sm font-medium leading-relaxed italic text-slate-600">{transaction.description}</p>
                    </div>
                )}
            </CardContent>
        </Card>
        
        <Tabs defaultValue="stages" dir="rtl" className="w-full">
            <div className="flex justify-center mb-8">
                <TabsList className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[2rem] border border-white shadow-2xl h-16 w-full max-w-3xl">
                    <TabsTrigger value="stages" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">سير العمل الفني</TabsTrigger>
                    <TabsTrigger value="boq" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">المقايسة (BOQ)</TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">المتابعة والردود</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">سجل الأحداث</TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="stages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="border-b bg-muted/5 p-8 px-10">
                        <CardTitle className='flex items-center gap-3 text-xl font-black text-[#1e1b4b]'>
                            <Workflow className='text-primary h-6 w-6'/> حالة مراحل الإنجاز الميداني
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 space-y-6">
                        {enrichedStages.map((stage) => (
                            <div key={stage.id} className="flex flex-col sm:flex-row items-center justify-between p-6 border-2 border-transparent bg-muted/20 rounded-[2rem] hover:bg-white hover:border-primary/20 hover:shadow-md transition-all">
                                <div className="flex items-center gap-6">
                                    <Badge variant="outline" className={cn("w-32 justify-center h-8 rounded-xl font-black text-[10px] border-2", stageStatusColors[stage.status])}>
                                        {stageStatusTranslations[stage.status]}
                                    </Badge>
                                    <span className="font-black text-lg text-slate-800">{stage.name}</span>
                                </div>
                                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                                    {stage.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleStageStatusChange(stage.id!, 'in-progress')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 border-2 px-6"><Play className="ml-2 h-4 w-4"/> بدء العمل</Button>}
                                    {stage.status === 'in-progress' && <Button size="sm" onClick={() => handleStageStatusChange(stage.id!, 'completed')} disabled={isProcessing} className="rounded-xl font-black text-xs h-10 px-8 bg-green-600 text-white gap-2"><Check className="ml-2 h-4 w-4"/> تأكيد الإنجاز</Button>}
                                    {stage.status === 'completed' && <CheckCircle2 className="h-8 w-8 text-green-600" />}
                                </div>
                            </div>
                        ))}
                        {enrichedStages.length === 0 && (
                            <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] opacity-30">
                                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-xl font-black">لم يتم تحديد مراحل عمل لهذا النوع من المعاملات في القوائم المرجعية.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="boq" className="animate-in fade-in duration-500">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white p-10">
                    {transaction.boqId ? <LinkedBoqView boqId={transaction.boqId} /> : (
                        <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 space-y-6">
                            <Package className="h-16 w-16 mx-auto text-muted-foreground opacity-30" />
                            <p className="text-xl font-black text-slate-400">لا يوجد جدول كميات مرتبط حالياً.</p>
                            <Button asChild className="rounded-2xl font-black px-12 h-12 shadow-xl shadow-primary/20">
                                <Link href={`/dashboard/construction/boq/new?projectId=${transaction.id}&clientId=${clientId}`}>إنشاء مقايسة جديدة +</Link>
                            </Button>
                        </div>
                    )}
                </Card>
            </TabsContent>

            <TabsContent value="comments" className="animate-in fade-in duration-500">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="comment" showInput={true} title="ساحة المتابعة والردود" icon={<MessageSquare className="text-primary h-6 w-6" />} client={client} transaction={transaction} />
            </TabsContent>

            <TabsContent value="history" className="animate-in fade-in duration-500">
                <TransactionTimeline clientId={clientId} transactionId={transactionId} filterType="log" showInput={false} title="سجل الأحداث الإجرائية" icon={<History className='text-primary h-6 w-6'/>} client={client} transaction={transaction} />
            </TabsContent>
        </Tabs>

        <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
            <DialogContent className="max-w-lg rounded-[2.5rem] border-none shadow-2xl p-10 bg-white" dir="rtl">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black flex items-center gap-3">
                        <FileSignature className="text-primary h-7 w-7" /> توقيع المالك المعتمد
                    </DialogTitle>
                    <DialogDescription className="font-bold text-slate-500">سيتم دمج هذا التوقيع في العقد الرسمي والأرشفة الفنية.</DialogDescription>
                </DialogHeader>
                <SignaturePad onSave={handleSaveSignature} />
                <div className="mt-6 p-4 bg-muted/20 rounded-2xl border border-dashed text-xs text-muted-foreground flex gap-2">
                    <Info className="h-4 w-4 shrink-0" />
                    <p>هذا التوقيع يعتبر موافقة نهائية من المالك على بنود المعاملة والمواصفات الفنية المذكورة.</p>
                </div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

