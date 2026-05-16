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
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, ChevronDown, Trash2, MoreHorizontal, Eye, FolderLock, FolderOpen, Loader2, Printer, FileText, Calendar, ListChecks } from 'lucide-react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { toFirestoreDate } from '@/services/date-converter';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';

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

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode | string | number | null | undefined }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex items-start gap-2 text-sm">
            <div className="flex-shrink-0 pt-1 text-muted-foreground">{icon}</div>
            <div>
                <p className="font-semibold text-muted-foreground">{label}</p>
                <div className="text-foreground">{value}</div>
            </div>
        </div>
    );
}

const EMPTY_ARRAY_FOR_SUBSCRIPTION: DocumentData[] = [];

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

  const clientPath = useMemo(() => (firestore && id ? `clients/${id}` : null), [firestore, id]);
  const { data: client, loading: clientLoading, error: clientError } = useDocument<Client>(firestore, clientPath);

  const transactionsQuery = useMemo(() => {
    if (!firestore || !id) return null;
    return [orderBy('createdAt', 'desc')];
  }, [firestore, id]);

  const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction>(firestore, `clients/${id}/transactions`, transactionsQuery || EMPTY_ARRAY_FOR_SUBSCRIPTION);
  
  useEffect(() => {
    if (!firestore) return;
    getDocs(collection(firestore, 'employees')).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore]);


  const handleConfirmCancelContract = async () => {
    if (!firestore || !currentUser || !client || !transactionToCancel) return;

    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const transactionRef = doc(firestore, 'clients', client.id, 'transactions', transactionToCancel.id!);
        batch.update(transactionRef, { contract: deleteField() });

        const logContent = `قام بإلغاء عقد المعاملة: "${transactionToCancel.transactionType}".`;
        const logData = { type: 'log', content: logContent, userId: currentUser.id, userName: currentUser.fullName, userAvatar: currentUser.avatarUrl, createdAt: serverTimestamp() };
        batch.set(doc(collection(firestore, `clients/${client.id}/history`)), logData);

        await batch.commit();
        toast({ title: 'نجاح', description: 'تم إلغاء العقد بنجاح.' });
    } catch (error) {
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
        await updateDoc(transactionRef, { status: newStatus });
        toast({ title: 'نجاح', description: `تم ${newStatus === 'on-hold' ? 'تجميد' : 'إلغاء تجميد'} المعاملة.` });
    } finally {
        setIsProcessing(false);
    }
  };

  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = toFirestoreDate(dateValue);
      if (!date) return '-';
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


  if (clientLoading) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  if (clientError || !client) return <div className="text-center py-10 text-destructive">لم يتم العثور على العميل.</div>;
  
  return (
    <>
    <ClientTransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)}
        clientId={id}
        clientName={client.nameAr}
        fromAppointmentId={fromAppointmentId}
    />
     <ContractClausesForm 
        isOpen={!!contractTransaction} 
        onClose={() => setContractTransaction(null)}
        transaction={contractTransaction}
        clientId={id}
        clientName={client.nameAr}
    />
    <div className='space-y-6' dir='rtl'>
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-4">
                        <CardTitle className="text-2xl font-bold">{client.nameAr}</CardTitle>
                        <UniversalActionTrigger 
                            title={client.nameAr}
                            sourceModule="العملاء"
                            sourceId={client.id!}
                        />
                    </div>
                    <CardDescription>{client.nameEn}</CardDescription>
                    <div className="mt-2 flex items-center gap-4">
                        <Badge variant="secondary" className="font-mono text-sm">{client.fileId}</Badge>
                        <Badge variant="outline" className={clientStatusColors[client.status]}>
                            {clientStatusTranslations[client.status]}
                        </Badge>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-9 w-9 text-primary border-primary/50 hover:bg-primary/5 hover:text-primary" asChild>
                        <Link href={`/dashboard/appointments/new?clientId=${client.id}&engineerId=${client.assignedEngineer || ''}`}>
                            <Calendar className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/clients/${id}/edit`}>
                            <Pencil className="ml-2 h-4 w-4" /> تعديل
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-6 border-t">
                <InfoRow icon={<BadgeInfo className="h-5 w-5"/>} label="الرقم المدني" value={client.civilId} />
                <InfoRow icon={<Phone />} label="رقم الجوال" value={client.mobile} />
                <InfoRow icon={<User />} label="المهندس المسؤول" value={assignedEngineerName || <span className='text-muted-foreground'>غير محدد</span>} />
                <InfoRow icon={<Home />} label="العنوان" value={clientAddress} />
                <InfoRow icon={<Calendar />} label="تاريخ إنشاء الملف" value={formatDate(client.createdAt)} />
            </CardContent>
        </Card>

        <Tabs defaultValue="transactions" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="transactions">المعاملات ({transactions.length})</TabsTrigger>
                <TabsTrigger value="quotations">عروض الأسعار</TabsTrigger>
                <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
            </TabsList>
            <TabsContent value="transactions" className="mt-6">
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <div>
                            <CardTitle className='flex items-center gap-2'><Files className='text-primary'/> المعاملات الداخلية</CardTitle>
                            <CardDescription>جميع المعاملات والخدمات المقدمة للعميل.</CardDescription>
                        </div>
                         <div className="flex gap-2">
                            <Button onClick={() => setIsFormOpen(true)}>
                                <PlusCircle className="ml-2 h-4 w-4" /> إضافة معاملة
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {transactionsLoading && <Skeleton className="h-24 w-full" />}
                        {!transactionsLoading && transactions.length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <Files className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا توجد معاملات بعد</h3>
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
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent dir="rtl">
                                                            <DropdownMenuItem asChild><Link href={`/dashboard/clients/${id}/transactions/${tx.id}`}><Eye className="ml-2 h-4 w-4"/> عرض</Link></DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleToggleFreeze(tx)}>
                                                                {tx.status === 'on-hold' ? 'إلغاء التجميد' : 'تجميد'}
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => setTransactionToDelete(tx)} className="text-destructive">حذف</DropdownMenuItem>
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
            <TabsContent value="history" className="mt-6">
                 <ClientHistoryTimeline clientId={id} />
            </TabsContent>
        </Tabs>
    </div>
    </>
  );
}
