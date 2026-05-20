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
import { 
    ArrowRight, 
    Pencil, 
    User, 
    Phone, 
    Home, 
    BadgeInfo, 
    Files, 
    PlusCircle, 
    History, 
    Trash2, 
    MoreHorizontal, 
    Eye, 
    FolderLock, 
    FolderOpen, 
    Calendar,
    CheckCircle2,
    Play
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';
import type { Client, ClientTransaction, Employee } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { UniversalActionTrigger } from '@/components/productivity/universal-action-trigger';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = currentUser?.currentCompanyId;
  const fromAppointmentId = searchParams.get('fromAppointmentId');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [contractTransaction, setContractTransaction] = useState<ClientTransaction | null>(null);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());

  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🛡️ الاستماع للملف الشخصي للعميل في المسار المعتمد
  const clientPath = useMemo(() => getTenantPath(`clients/${id}`, tenantId), [id, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  // 🛡️ الاستماع لمعاملات العميل في المسار المعتمد
  const transactionsPath = useMemo(() => getTenantPath(`clients/${id}/transactions`, tenantId), [id, tenantId]);
  const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction>(firestore, transactionsPath);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    getDocs(query(collection(firestore, getTenantPath('employees', tenantId)!))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  const handleToggleFreeze = async (tx: ClientTransaction) => {
    if (!firestore || !tenantId || !tx.id) return;
    setIsProcessing(true);
    const newStatus = tx.status === 'on-hold' ? 'new' : 'on-hold';
    const finalTxPath = getTenantPath(`clients/${id}/transactions/${tx.id}`, tenantId);
    
    try {
        await updateDoc(doc(firestore, finalTxPath!), { status: newStatus });
        toast({ title: 'نجاح التحديث', description: `تم ${newStatus === 'on-hold' ? 'تجميد' : 'إعادة تنشيط'} المعاملة بنجاح.` });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: finalTxPath!,
            operation: 'update',
            requestResourceData: { status: newStatus }
        }));
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleDeleteTransaction = async () => {
    if (!firestore || !transactionToDelete || !tenantId) return;
    setIsProcessing(true);
    const finalTxPath = getTenantPath(`clients/${id}/transactions/${transactionToDelete.id}`, tenantId);

    try {
        await deleteDoc(doc(firestore, finalTxPath!));
        toast({ title: 'تم الحذف', description: 'تم مسح المعاملة نهائياً من سجلات العميل.' });
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: finalTxPath!,
            operation: 'delete'
        }));
    } finally {
        setIsProcessing(false);
        setTransactionToDelete(null);
    }
  };

  const formatDate = (dateValue: any): string => {
      const date = toFirestoreDate(dateValue);
      return date ? format(date, 'dd/MM/yyyy', { locale: ar }) : '-';
  }
  
  if (clientLoading) return <div className="p-8 max-w-6xl mx-auto"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
  if (!client) return <div className="text-center py-20 font-black opacity-30">لم يتم العثور على العميل المطلوب.</div>;
  
  const clientAddress = client?.address ? [
      client.address.governorate, 
      client.address.area, 
      `قطعة ${client.address.block}`, 
      `شارع ${client.address.street}`, 
      `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';

  return (
    <>
    <ClientTransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)}
        clientId={id}
        clientName={client.nameAr}
        fromAppointmentId={fromAppointmentId}
    />
    
    <div className='space-y-8 max-w-6xl mx-auto' dir='rtl'>
        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right">
                        <div className="flex items-center gap-4">
                            <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{client.nameAr}</CardTitle>
                            <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-xs border-2", clientStatusColors[client.status])}>
                                {clientStatusTranslations[client.status]}
                            </Badge>
                        </div>
                        <p className="text-slate-500 font-bold mt-1">{client.nameEn}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" size="icon" className="h-11 w-11 rounded-2xl border-2 text-primary hover:bg-primary/5" asChild>
                            <Link href={`/dashboard/appointments/new?clientId=${client.id}&engineerId=${client.assignedEngineer || ''}`}>
                                <Calendar className="h-5 w-5" />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="h-11 px-8 rounded-2xl border-2 font-black gap-2">
                            <Link href={`/dashboard/clients/${id}/edit`}>
                                <Pencil className="h-4 w-4" /> تعديل الملف
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10 bg-white">
                <InfoRow icon={<BadgeInfo className="h-5 w-5 text-primary opacity-40"/>} label="الرقم المدني" value={<span className="font-mono font-black">{client.civilId}</span>} />
                <InfoRow icon={<Phone className="h-5 w-5 text-primary opacity-40"/>} label="رقم الجوال" value={<span dir="ltr" className="font-mono font-black">{client.mobile}</span>} />
                <InfoRow icon={<User className="h-5 w-5 text-primary opacity-40"/>} label="المشرف المعتمد" value={<span className="font-black">{client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : '-'}</span>} />
                <div className="lg:col-span-2">
                    <InfoRow icon={<Home className="h-5 w-5 text-primary opacity-40"/>} label="العنوان الجغرافي" value={<span className="font-bold">{clientAddress}</span>} />
                </div>
                <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الملف الموحد</p>
                    <p className="text-xl font-black font-mono text-primary">{client.fileId}</p>
                </div>
            </CardContent>
        </Card>

        <Tabs defaultValue="transactions" dir="rtl">
            <div className="flex justify-center mb-8">
                <TabsList className="bg-white/60 backdrop-blur-xl p-1.5 rounded-[2rem] border border-white shadow-xl h-16 w-full max-w-2xl">
                    <TabsTrigger value="transactions" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">
                        <Files className='h-4 w-4'/> المعاملات المعتمدة ({transactions.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-[1.5rem] flex-1 font-black gap-2 h-full transition-all">
                        <History className='h-4 w-4'/> السجل التاريخي
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="transactions" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                    <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/5 p-8 px-10">
                        <div className="space-y-1">
                            <CardTitle className='flex items-center gap-3 text-2xl font-black text-[#1e1b4b]'>
                                <PlusCircle className='text-primary h-6 w-6'/> مصفوفة الخدمات النشطة
                            </CardTitle>
                        </div>
                         <Button onClick={() => setIsFormOpen(true)} className="h-12 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20 bg-[#7209B7] text-white border-none">
                            <PlusCircle className="h-5 w-5" /> إضافة خدمة جديدة
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {transactions.length === 0 ? (
                            <div className="p-20 text-center space-y-4 opacity-30 grayscale">
                                <Files className="mx-auto h-20 w-20 text-muted-foreground" />
                                <p className="text-2xl font-black tracking-tighter">بانتظار بدء المعاملة الأولى لهذا العميل...</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-muted/50 h-14">
                                    <TableRow className="border-none">
                                        <TableHead className="px-10 font-black text-[#7209B7]">رقم المعاملة</TableHead>
                                        <TableHead className="font-black text-[#7209B7]">نوع الخدمة / المعاملة</TableHead>
                                        <TableHead className="font-black text-[#7209B7]">المهندس المسؤول</TableHead>
                                        <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                                        <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-20 border-b last:border-0">
                                            <TableCell className="px-10 font-mono font-black text-primary text-sm">{tx.transactionNumber || '-'}</TableCell>
                                            <TableCell>
                                                <Link href={`/dashboard/clients/${id}/transactions/${tx.id!}`} className="font-black text-lg text-slate-800 hover:underline hover:text-primary transition-all">
                                                    {tx.transactionType}
                                                </Link>
                                                {tx.subServiceName && <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{tx.subServiceName}</p>}
                                            </TableCell>
                                            <TableCell className="font-bold text-xs text-slate-600">
                                                {tx.assignedEngineerId ? employeesMap.get(tx.assignedEngineerId) : <span className='opacity-30 italic'>غير مسند</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[10px] border-2 shadow-sm", transactionStatusColors[tx.status])}>
                                                    {transactionStatusTranslations[tx.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border group-hover:border-primary/20"><MoreHorizontal className="h-5 w-5" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none bg-white/95 backdrop-blur-xl">
                                                        <DropdownMenuLabel className="font-black text-[10px] text-slate-400 uppercase px-3 py-2">خيارات المعاملة</DropdownMenuLabel>
                                                        <DropdownMenuItem asChild className="rounded-xl py-3 font-bold gap-3 cursor-pointer">
                                                            <Link href={`/dashboard/clients/${id}/transactions/${tx.id}`}><Eye className="h-4 w-4 text-primary"/> عرض التفاصيل والفنيات</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleToggleFreeze(tx)} className="rounded-xl py-3 font-bold gap-3 cursor-pointer">
                                                            {tx.status === 'on-hold' ? <FolderOpen className="h-4 w-4 text-green-600"/> : <FolderLock className="h-4 w-4 text-orange-600"/>}
                                                            {tx.status === 'on-hold' ? 'إلغاء تجميد المعاملة' : 'تجميد المعاملة مؤقتاً'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-slate-100 mx-2" />
                                                        <DropdownMenuItem onClick={() => setTransactionToDelete(tx)} className="text-red-600 rounded-xl py-3 font-black gap-3 cursor-pointer focus:bg-red-50">
                                                            <Trash2 className="h-4 w-4" /> حذف نهائي
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="history" className="animate-in fade-in duration-500">
                 <ClientHistoryTimeline clientId={id} />
            </TabsContent>
        </Tabs>

        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المعاملة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        هل أنت متأكد من حذف معاملة <strong>"{transactionToDelete?.transactionType}"</strong>؟ 
                        سيؤدي هذا إلى مسح كافة المرفقات الفنية ومراحل العمل المرتبطة بها نهائياً. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTransaction} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-lg shadow-red-200">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
    </>
  );
}
