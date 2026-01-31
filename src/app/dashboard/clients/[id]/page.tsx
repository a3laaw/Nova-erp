
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
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, ChevronDown, Trash2, MoreHorizontal, Eye, FolderLock, FolderOpen, Loader2, Printer, FileText, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import type { Client, ClientTransaction, Employee, Quotation } from '@/lib/types';
import { format } from 'date-fns';
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';
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
import { formatCurrency } from '@/lib/utils';

const clientStatusTranslations: Record<string, string> = {
  new: 'جديد',
  contracted: 'تم التعاقد',
  cancelled: 'ملغي',
  reContracted: 'معاد تعاقده',
};

const clientStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contracted: 'bg-purple-100 text-purple-800 border-purple-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
  reContracted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
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

// --- Quotations List Component ---
function ClientQuotationsList({ clientId, clientName }: { clientId: string, clientName: string }) {
  const { firestore } = useFirebase();
  const router = useRouter();

  const quotationsQuery = useMemo(() => {
    if (!firestore || !clientId) return null;
    return [where('clientId', '==', clientId)];
  }, [firestore, clientId]);

  const { data: quotations, loading, error } = useSubscription<Quotation>(firestore, quotationsQuery ? 'quotations' : null, quotationsQuery || []);
  
  const sortedQuotations = useMemo(() => {
    if (!quotations) return [];
    return [...quotations].sort((a,b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
  }, [quotations]);


  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      return format(dateValue.toDate(), 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };

  const statusTranslations: Record<Quotation['status'], string> = {
    draft: 'مسودة',
    sent: 'تم الإرسال',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    expired: 'منتهي الصلاحية'
  };

  const statusColors: Record<Quotation['status'], string> = {
      draft: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className='flex items-center gap-2'><FileText className='text-primary'/> عروض الأسعار</CardTitle>
          <CardDescription>جميع عروض الأسعار الخاصة بالعميل: {clientName}</CardDescription>
        </div>
        <Button asChild>
          <Link href={`/dashboard/accounting/quotations/new?clientId=${clientId}`}>
            <PlusCircle className="ml-2 h-4 w-4" />
            إنشاء عرض سعر
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading && <Skeleton className="h-24 w-full" />}
        {!loading && sortedQuotations.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد عروض أسعار بعد</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              قم بإنشاء عرض سعر جديد لهذا العميل ليظهر هنا.
            </p>
          </div>
        )}
        {!loading && sortedQuotations.length > 0 && (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم العرض</TableHead>
                  <TableHead>الموضوع</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedQuotations.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono">{q.quotationNumber}</TableCell>
                    <TableCell>{q.subject}</TableCell>
                    <TableCell>{formatDate(q.date)}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(q.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[q.status]}>{statusTranslations[q.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/accounting/quotations/${q.id}`)}>
                        عرض
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const fromAppointmentId = searchParams.get('fromAppointmentId');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [contractTransaction, setContractTransaction] = useState<ClientTransaction | null>(null);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());

  const [transactionToCancel, setTransactionToCancel] = useState<ClientTransaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Data Fetching ---
  const clientPath = useMemo(() => (firestore && id ? `clients/${id}` : null), [firestore, id]);
  const { data: client, loading: clientLoading, error: clientError } = useDocument<Client>(firestore, clientPath);

  const transactionsQuery = useMemo(() => {
    if (!firestore || !id) return null;
    return [orderBy('createdAt', 'desc')];
  }, [firestore, id]);

  const { data: transactions, loading: transactionsLoading, error: transactionsError } = useSubscription<ClientTransaction>(firestore, `clients/${id}/transactions`, transactionsQuery || []);
  
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
        const commentContent = `**تم إلغاء العقد**\nقام ${currentUser.fullName} بإلغاء العقد المرتبط بهذه المعاملة.`;

        const logData = { type: 'log', content: logContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
        const commentData = { type: 'comment', content: commentContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };

        batch.set(doc(historyCollectionRef), logData);
        batch.set(doc(transactionTimelineRef), logData);
        batch.set(doc(historyCollectionRef), commentData);
        batch.set(doc(transactionTimelineRef), commentData);


        // Check if this is the last contract to potentially revert client status
        const otherTransactions = transactions.filter(tx => tx.id !== transactionToCancel.id!);
        const hasOtherContracts = otherTransactions.some(tx => !!tx.contract);

        if (!hasOtherContracts && client.status === 'contracted') {
            const clientRefDoc = doc(firestore, 'clients', client.id);
            batch.update(clientRefDoc, { status: 'new' });
            
            const statusLogContent = `تغيرت حالة الملف من "تم التعاقد" إلى "جديد" بعد إلغاء آخر عقد.`;
            const statusLogData = { type: 'log', content: statusLogContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
            batch.set(doc(historyCollectionRef), statusLogData);
            batch.set(doc(transactionTimelineRef), statusLogData);
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

  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(date.getTime())) return '-';
      try {
        return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
      } catch (e) {
        return '-';
      }
  }
  
  const clientAddress = client?.address ? [
      client.address.governorate, 
      client.address.area, 
      `قطعة ${client.address.block}`, 
      `شارع ${client.address.street}`, 
      `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';
  
  const assignedEngineerName = client?.assignedEngineer ? employeesMap.get(client.assignedEngineer) : null;


  if (clientLoading) {
    return (
        <div className="space-y-6" dir="rtl">
             <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{clientError ? 'فشل تحميل بيانات العميل.' : 'لم يتم العثور على العميل.'}</p>
      </div>
    );
  }
  
  return (
    <>
    <ClientTransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)}
        clientId={id}
        clientName={(client as any).nameAr}
        fromAppointmentId={fromAppointmentId}
    />
     <ContractClausesForm 
        isOpen={!!contractTransaction} 
        onClose={() => setContractTransaction(null)}
        transaction={contractTransaction}
        clientId={id}
        clientName={(client as any).nameAr}
    />
    <div className='space-y-6' dir='rtl'>
        <Tabs defaultValue="profile" dir="rtl">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
                <TabsTrigger value="transactions">المعاملات ({transactions.length})</TabsTrigger>
                <TabsTrigger value="quotations">عروض الأسعار</TabsTrigger>
                <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>بيانات العميل</CardTitle>
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/dashboard/clients/${id}/edit`}>
                                        <Pencil className="ml-2 h-4 w-4" />
                                        تعديل
                                    </Link>
                                </Button>
                            </CardHeader>
                            <CardContent className='space-y-6'>
                                <div className="text-center space-y-2 py-4">
                                    <h2 className="text-2xl font-bold">{client.nameAr}</h2>
                                    {client.nameEn && <p className="text-muted-foreground">{client.nameEn}</p>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm border-t pt-6">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">رقم الملف:</span>
                                        <span className="font-mono">{client.fileId}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">الحالة:</span>
                                        <Badge variant="outline" className={clientStatusColors[client.status]}>
                                            {clientStatusTranslations[client.status]}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">رقم الجوال:</span>
                                        <span className="font-mono">{client.mobile}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">الرقم المدني:</span>
                                        <span className="font-mono">{client.civilId || '-'}</span>
                                    </div>
                                    <div className="sm:col-span-2 flex justify-between">
                                        <span className="font-semibold text-muted-foreground">المهندس المسؤول:</span>
                                        <span>{assignedEngineerName || <span className='text-muted-foreground'>غير محدد</span>}</span>
                                    </div>
                                    <div className="sm:col-span-2 flex justify-between">
                                        <span className="font-semibold text-muted-foreground">العنوان:</span>
                                        <span className="text-right">{clientAddress}</span>
                                    </div>
                                     <div className="flex justify-between">
                                        <span className="font-semibold text-muted-foreground">تاريخ الإنشاء:</span>
                                        <span>{formatDate(client.createdAt)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-6">
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle className='flex items-center gap-2'><Files className='text-primary'/> المعاملات الداخلية</CardTitle>
                            <CardDescription>جميع المعاملات والخدمات المقدمة للعميل.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline">
                                <Link href={`/dashboard/clients/${id}/statement`}>
                                    <Printer className="ml-2 h-4 w-4" />
                                    كشف حساب
                                </Link>
                            </Button>
                            <Button onClick={() => setIsFormOpen(true)}>
                                <PlusCircle className="ml-2 h-4 w-4" />
                                إضافة معاملة
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {transactionsLoading && <Skeleton className="h-24 w-full" />}
                        {!transactionsLoading && transactions.length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <Files className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا توجد معاملات بعد</h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    قم بإضافة معاملة جديدة لتظهر هنا.
                                </p>
                            </div>
                        )}
                        {!transactionsLoading && transactions.length > 0 && (
                            <div className="border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>رقم المعاملة</TableHead>
                                            <TableHead>نوع المعاملة</TableHead>
                                            <TableHead>المهندس المسؤول</TableHead>
                                            <TableHead>الحالة</TableHead>
                                            <TableHead>تاريخ الإنشاء</TableHead>
                                            <TableHead>الإجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-mono">{tx.transactionNumber || '-'}</TableCell>
                                                <TableCell className="font-medium">
                                                    <Link href={`/dashboard/clients/${id}/transactions/${tx.id!}`} className="hover:underline">
                                                        {tx.transactionType}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{tx.assignedEngineerId ? (employeesMap.get(tx.assignedEngineerId) || '...') : <span className='text-muted-foreground'>-</span>}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={transactionStatusColors[tx.status]}>
                                                        {transactionStatusTranslations[tx.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{formatDate(tx.createdAt)}</TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" disabled={isProcessing}><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent dir="rtl">
                                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}`)}><Eye className="ml-2 h-4 w-4"/> عرض التفاصيل</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}/edit`)}><Pencil className="ml-2 h-4 w-4"/> تعديل</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            {tx.contract ? (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => setContractTransaction(tx)}>تعديل العقد</DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => setTransactionToCancel(tx)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">إلغاء العقد</DropdownMenuItem>
                                                                </>
                                                            ) : (
                                                                <DropdownMenuItem onClick={() => setContractTransaction(tx)}>إنشاء عقد</DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => handleToggleFreeze(tx)}>
                                                                {tx.status === 'on-hold' ? <FolderOpen className="ml-2 h-4 w-4"/> : <FolderLock className="ml-2 h-4 w-4"/>}
                                                                {tx.status === 'on-hold' ? 'إلغاء التجميد' : 'تجميد'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => setTransactionToDelete(tx)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                            <Trash2 className="ml-2 h-4 w-4" /> حذف المعاملة
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="quotations" className="mt-6">
                <ClientQuotationsList clientId={id} clientName={client.nameAr} />
            </TabsContent>

            <TabsContent value="history" className="mt-6">
                 <ClientHistoryTimeline clientId={id} />
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
