'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { 
    doc, 
    collection, 
    query, 
    getDocs, 
    writeBatch, 
    serverTimestamp, 
    updateDoc, 
    deleteDoc, 
    addDoc,
    where,
    orderBy,
    getDoc,
    runTransaction,
    limit,
    deleteField
} from 'firebase/firestore';
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
    Pencil, 
    User, 
    Calendar, 
    Workflow, 
    Eye, 
    MoreHorizontal,
    FolderLock,
    FolderOpen,
    Trash2,
    PlusCircle,
    Building2,
    Phone,
    BadgeInfo,
    History,
    ShieldCheck,
    Layers,
    ArrowRight,
    Loader2,
    FileText,
    Calculator,
    Sparkles,
    FileSignature,
    AlertCircle,
    Ban,
    RotateCcw,
    Send,
    Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import { TransactionAssignmentDialog } from '@/components/clients/transaction-assignment-dialog';
import type { Client, ClientTransaction, Employee, Quotation, Account } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath, cleanFirestoreData } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const statusTranslations: Record<string, string> = {
  new: 'جديد',
  'in-progress': 'قيد التنفيذ',
  completed: 'منتهي/مكتمل',
  submitted: 'تم التسليم',
  'on-hold': 'معلق إدارياً',
  cancelled: 'ملغي/مفسوخ',
};

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 border-blue-100',
  'in-progress': 'bg-green-50 text-green-700 border-green-100',
  completed: 'bg-purple-50 text-purple-700 border-purple-100',
  submitted: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'on-hold': 'bg-orange-50 text-orange-700 border-orange-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2 text-sm text-black">
            <div className="flex-shrink-0 pt-1 text-muted-foreground">{icon}</div>
            <div>
                <p className="font-bold text-muted-foreground">{label}</p>
                <div className="text-foreground font-black">{value}</div>
            </div>
        </div>
    );
}

/**
 * ملف العميل الموحد (Client Profile V107.0):
 * تم تثبيت كافة المراجع (Separator, transactionStatusColors) وضمان استرجاع المعاملات القديمة والجديدة.
 */
export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = currentUser?.currentCompanyId;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignmentTx, setAssignmentTx] = useState<ClientTransaction | null>(null);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);
  const [transactionToCancel, setTransactionToCancel] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const clientPath = useMemo(() => id && tenantId ? getTenantPath(`clients/${id}`, tenantId) : null, [id, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  const isPrivileged = useMemo(() => 
    ['Admin', 'Accountant', 'HR', 'Secretary', 'Developer'].includes(currentUser?.role || '')
  , [currentUser?.role]);

  // 🛡️ رادار استعادة البيانات: الاستماع للمسارين (المتداخل والمسطح) 🛡️
  const { data: nestedTransactions, loading: nestedLoading } = useSubscription<ClientTransaction>(
      firestore, 
      `clients/${id}/transactions`,
      [] 
  );

  const flatTxQuery = useMemo(() => {
    const base = [where('clientId', '==', id)];
    if (!isPrivileged && currentUser?.employeeId) {
        base.push(where('assignedEngineerId', '==', currentUser.employeeId));
    }
    return base;
  }, [id, isPrivileged, currentUser?.employeeId]);

  const { data: flatTransactions, loading: flatLoading } = useSubscription<ClientTransaction>(
      firestore, 
      'transactions', 
      flatTxQuery
  );

  const transactions = useMemo(() => {
    const all = [...nestedTransactions, ...flatTransactions];
    const seen = new Set();
    return all.filter(tx => {
        if (seen.has(tx.id)) return false;
        seen.add(tx.id);
        return true;
    }).sort((a, b) => (toFirestoreDate(b.createdAt)?.getTime() || 0) - (toFirestoreDate(a.createdAt)?.getTime() || 0));
  }, [nestedTransactions, flatTransactions]);

  const qQuery = useMemo(() => [where('clientId', '==', id)], [id]);
  const { data: quotations, loading: quotationsLoading } = useSubscription<Quotation>(firestore, 'quotations', qQuery);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!), where('status', '==', 'active'))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  const handleConfirmDeleteQuotation = async () => {
    if (!quotationToDelete || !firestore || !tenantId) return;
    setIsProcessing(true);
    try {
        const qPath = getTenantPath(`quotations/${quotationToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, qPath!));
        
        const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
        await addDoc(collection(firestore, historyPath!), {
            type: 'log',
            content: `قام ${currentUser?.fullName} بحذف عرض السعر رقم "${quotationToDelete.quotationNumber}" نهائياً.`,
            createdAt: serverTimestamp(),
            userId: currentUser?.id,
            userName: currentUser?.fullName,
            userAvatar: currentUser?.avatarUrl,
            companyId: tenantId
        });

        toast({ title: '✅ تم حذف عرض السعر' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ في الحفظ' });
    } finally {
        setIsProcessing(false);
        setQuotationToDelete(null);
    }
  };

  const handleConfirmCancelContract = async () => {
    if (!firestore || !tenantId || !transactionToCancel?.id || !id || !currentUser) return;
    setIsProcessing(true);
    
    let finalTxPath = getTenantPath(`transactions/${transactionToCancel.id}`, tenantId)!;

    try {
        const checkRef = doc(firestore, finalTxPath);
        const snap = await getDoc(checkRef);
        if (!snap.exists()) {
            finalTxPath = getTenantPath(`clients/${id}/transactions/${transactionToCancel.id}`, tenantId)!;
        }

        await runTransaction(firestore, async (transaction_fs) => {
            const currentYear = new Date().getFullYear();
            
            const receiptsPath = getTenantPath('cashReceipts', tenantId);
            const receiptsSnap = await getDocs(query(collection(firestore, receiptsPath!), where('projectId', '==', transactionToCancel.id)));
            const totalCollected = receiptsSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
            
            const originalTotal = transactionToCancel.contract?.totalAmount || 0;
            const amountToReverse = Math.max(0, originalTotal - totalCollected);

            const coaPath = getTenantPath('chartOfAccounts', tenantId)!;
            const revenueAccSnap = await getDocs(query(collection(firestore, coaPath), where('code', '==', '4101'), limit(1)));
            const clientAccSnap = await getDocs(query(collection(firestore, coaPath), where('name', '==', client?.nameAr), where('parentCode', '==', '1102'), limit(1)));

            if (amountToReverse > 0 && !revenueAccSnap.empty && !clientAccSnap.empty) {
                const revenueAccountId = revenueAccSnap.docs[0].id;
                const clientAccountId = clientAccSnap.docs[0].id;

                const jeCounterRef = doc(firestore, getTenantPath('counters/journalEntries', tenantId)!);
                const jeCounterDoc = await transaction_fs.get(jeCounterRef);
                const nextJeNum = ((jeCounterDoc.data()?.counts || {})[currentYear] || 0) + 1;
                
                const newJeRef = doc(collection(firestore, getTenantPath('journalEntries', tenantId)!));

                transaction_fs.set(newJeRef, {
                    entryNumber: `JV-REV-${currentYear}-${String(nextJeNum).padStart(4, '0')}`,
                    date: serverTimestamp(),
                    narration: `[قيد عكسي - فسخ عقد] إغلاق متبقي مديونية معاملة #${transactionToCancel.transactionNumber} لـ ${client?.nameAr}`,
                    totalDebit: amountToReverse,
                    totalCredit: amountToReverse,
                    status: 'posted',
                    lines: [
                        { accountId: revenueAccountId, accountName: 'إيرادات عقود (إغلاق)', debit: amountToReverse, credit: 0, auto_profit_center: transactionToCancel.id },
                        { accountId: clientAccountId, accountName: client?.nameAr, debit: 0, credit: amountToReverse, auto_profit_center: transactionToCancel.id }
                    ],
                    clientId: id,
                    transactionId: transactionToCancel.id,
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id,
                    companyId: tenantId
                });

                transaction_fs.update(jeCounterRef, { [`counts.${currentYear}`]: nextJeNum });
            }

            const txRef = doc(firestore, finalTxPath);
            transaction_fs.update(txRef, {
                status: 'cancelled',
                'contract.status': 'cancelled',
                'contract.cancellationDate': serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
            const historyRef = doc(collection(firestore, historyPath!));
            transaction_fs.set(historyRef, {
                type: 'log',
                content: `تم فسخ العقد المالي للمعاملة #${transactionToCancel.transactionNumber} وإغلاق مديونية المتبقي بقيمة ${formatCurrency(amountToReverse)} آلياً.`,
                createdAt: serverTimestamp(),
                userId: currentUser.id,
                userName: currentUser.fullName,
                userAvatar: currentUser.avatarUrl,
                companyId: tenantId
            });
        });

        toast({ title: '✅ تم حفظ المعلومات', description: 'تم توليد القيد العكسي وتصفير مديونية المتبقي بنجاح.' });
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: finalTxPath,
            operation: 'write'
        }));
    } finally { 
        setIsProcessing(false); 
        setTransactionToCancel(null); 
    }
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!firestore || !tenantId || !transactionToDelete?.id || !id) return;
    setIsProcessing(true);
    let docPath = getTenantPath(`transactions/${transactionToDelete.id}`, tenantId);
    try {
        const checkRef = doc(firestore, docPath!);
        const snap = await getDoc(checkRef);
        if (!snap.exists()) {
            docPath = getTenantPath(`clients/${id}/transactions/${transactionToDelete.id}`, tenantId);
        }

        await deleteDoc(doc(firestore, docPath!));
        
        const historyPath = getTenantPath(`clients/${id}/history`, tenantId);
        await addDoc(collection(firestore, historyPath!), {
            type: 'log',
            content: `قام ${currentUser?.fullName} بحذف المعاملة "${transactionToDelete.subServiceName || transactionToDelete.transactionType}" نهائياً.`,
            createdAt: serverTimestamp(),
            userId: currentUser?.id,
            userName: currentUser?.fullName,
            userAvatar: currentUser?.avatarUrl,
            companyId: tenantId
        });

        toast({ title: '✅ تم حذف المعاملة' });
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docPath!,
            operation: 'delete'
        }));
    } finally { 
        setIsProcessing(false); 
        setTransactionToDelete(null); 
    }
  };

  const handleToggleFreeze = async (tx: ClientTransaction) => {
    if (!firestore || !tenantId || !tx.id || !id) return;
    setIsProcessing(true);
    const newStatus = tx.status === 'on-hold' ? 'new' : 'on-hold';
    
    let finalPath = getTenantPath(`transactions/${tx.id}`, tenantId)!;
    try {
        const checkRef = doc(firestore, finalPath);
        const snap = await getDoc(checkRef);
        if (!snap.exists()) {
            finalPath = getTenantPath(`clients/${id}/transactions/${tx.id}`, tenantId)!;
        }

        await updateDoc(doc(firestore, finalPath), { 
            status: newStatus,
            updatedAt: serverTimestamp() 
        });
        toast({ title: '✅ تم حفظ المعلومات', description: `تم ${newStatus === 'on-hold' ? 'تجميد' : 'إعادة تفعيل'} المعاملة بنجاح.` });
    } catch (e: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: finalPath,
            operation: 'update',
            requestResourceData: { status: newStatus }
        }));
    } finally { setIsProcessing(false); }
  };

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, ClientTransaction[]>();
    transactions.forEach(tx => {
        const key = tx.transactionType || 'خدمات متنوعة';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tx);
    });
    return Array.from(groups.entries());
  }, [transactions]);

  if (clientLoading) return <div className="p-8 max-w-6xl mx-auto"><Skeleton className="h-96 w-full rounded-[3rem]" /></div>;
  if (!client) return <div className="text-center py-20 font-black opacity-30">الملف غير متاح.</div>;

  return (
    <div className='space-y-10 max-w-6xl mx-auto pb-20' dir='rtl'>
        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right">
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{client.nameAr}</CardTitle>
                        <p className="text-slate-500 font-bold mt-1 uppercase tracking-widest text-xs opacity-60">{client.nameEn}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button asChild variant="outline" className="h-11 px-8 rounded-2xl border-2 font-black gap-2">
                            <Link href={`/dashboard/clients/${id}/edit`}><Pencil className="h-4 w-4" /> تعديل الملف</Link>
                        </Button>
                        <Button onClick={() => setIsFormOpen(true)} className="h-11 px-8 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20 bg-primary text-white border-none">
                            <PlusCircle className="h-5 w-5" /> فتح معاملة جديدة
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 p-10 bg-white">
                <InfoRow icon={<BadgeInfo className="h-5 w-5 text-primary opacity-40"/>} label="الرقم المدني" value={<span className="font-mono font-black text-black">{client.civilId}</span>} />
                <InfoRow icon={<Phone className="h-5 w-5 text-primary opacity-40"/>} label="رقم الجوال" value={<span dir="ltr" className="font-mono font-black text-black">{client.mobile}</span>} />
                <div className="text-left"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الملف الموحد</p><p className="text-xl font-black font-mono text-primary">{client.fileId}</p></div>
            </CardContent>
        </Card>

        <Separator className="opacity-10" />

        <div className="space-y-6">
            <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-indigo-600 pr-4 flex items-center gap-3">
                <Calculator className="h-7 w-7 text-indigo-600" /> المقترحات المالية (عروض الأسعار)
            </h3>
            {quotationsLoading ? <Skeleton className="h-32 w-full rounded-[2rem]"/> : quotations.length === 0 ? (
                <div className="p-10 text-center border-2 border-dashed rounded-3xl opacity-20">لا توجد عروض أسعار مسجلة.</div>
            ) : (
                <div className="grid gap-4">
                    {quotations.map(q => (
                        <Card key={q.id} className="rounded-3xl border-2 border-transparent bg-white shadow-sm hover:border-indigo-200 transition-all group overflow-hidden">
                            <div className="flex items-center justify-between p-5 px-8">
                                <div className="flex items-center gap-6">
                                    <Badge variant="outline" className="font-mono font-black text-indigo-600 border-indigo-100 bg-indigo-50 px-4 h-8">
                                        {q.quotationNumber}
                                    </Badge>
                                    <div className="text-right">
                                        <Link href={`/dashboard/accounting/quotations/${q.id}`} className="font-black text-lg text-slate-900 hover:text-indigo-600 hover:underline transition-colors">
                                            {q.subject}
                                        </Link>
                                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5">القيمة الإجمالية: {formatCurrency(q.totalAmount)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Badge className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase border-none", 
                                        q.status === 'accepted' ? "bg-green-600 text-white" : "bg-blue-50 text-blue-700"
                                    )}>
                                        {q.status === 'accepted' ? 'مقبول / عقد مبرم' : 'بانتظار القرار'}
                                    </Badge>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <MoreHorizontal className="h-5 w-5"/>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none bg-white">
                                            <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase tracking-widest">إجراءات العرض</DropdownMenuLabel>
                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/accounting/quotations/${q.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-black">
                                                <Eye className="h-4 w-4 text-primary"/> عرض التفاصيل
                                            </DropdownMenuItem>
                                            {q.status !== 'accepted' && (
                                                <DropdownMenuItem onSelect={() => router.push(`/dashboard/accounting/quotations/${q.id}/edit`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-black">
                                                    <Pencil className="h-4 w-4 text-primary"/> تعديل البيانات
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onSelect={() => setQuotationToDelete(q)} className="text-red-600 font-black rounded-lg py-3 gap-3 cursor-pointer focus:bg-red-50">
                                                <Trash2 className="ml-2 h-4 w-4" /> حذف العرض
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>

        <Separator className="opacity-10" />

        <div className="space-y-12">
            <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-primary pr-4 flex items-center gap-3">
                <Workflow className="h-7 w-7 text-primary" /> هيكل الخدمات والمعاملات الميدانية
            </h3>
            
            {groupedTransactions.length === 0 ? (
                <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] opacity-20 bg-white/40">
                    <PlusCircle className="mx-auto h-20 w-20 text-muted-foreground mb-4" />
                    <p className="text-2xl font-black">لا توجد معاملات مسجلة لهذا الملف.</p>
                </div>
            ) : (
                groupedTransactions.map(([typeName, txs]) => (
                    <section key={typeName} className="space-y-4 animate-in fade-in duration-700">
                        <div className="flex items-center gap-3 px-8 py-2.5 bg-slate-900 text-white w-fit rounded-full shadow-lg">
                            <Building2 className="h-5 w-5 text-[#FF7A00]"/>
                            <h4 className="text-sm font-black tracking-tight uppercase">{typeName}</h4>
                        </div>
                        
                        <div className="grid gap-4">
                            {txs.map(tx => {
                                const hasSignedContract = !!tx.contract;
                                return (
                                <Card key={tx.id} className="rounded-[2rem] border-2 border-transparent bg-white shadow-md hover:border-primary/20 transition-all group overflow-hidden">
                                    <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-6 px-10">
                                        <div className="flex items-center gap-6">
                                            <Badge variant="outline" className="font-mono font-black text-primary text-xs h-8 px-4 border-primary/20 bg-primary/5">{tx.transactionNumber}</Badge>
                                            <div className="text-right">
                                                <div className="flex items-center gap-2">
                                                    <Link 
                                                        href={`/dashboard/clients/${id}/transactions/${tx.id}`}
                                                        className="font-black text-xl text-slate-900 leading-tight hover:text-primary hover:underline transition-colors"
                                                    >
                                                        {tx.subServiceName || 'خدمة تأسيسية'}
                                                    </Link>
                                                    <Badge className={cn("px-4 py-0.5 rounded-full font-black text-[9px] border-none shadow-sm", transactionStatusColors[tx.status])}>
                                                        {statusTranslations[tx.status]}
                                                    </Badge>
                                                </div>
                                                <p className="text-[10px] font-bold text-muted-foreground mt-1.5 flex items-center gap-1.5">
                                                    <User className="h-3.5 w-3.5 text-primary opacity-40"/> المهندس المختص: {tx.assignedEngineerId ? employeesMap.get(tx.assignedEngineerId) : 'غير مسند'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border bg-slate-50 transition-opacity">
                                                        <MoreHorizontal className="h-5 w-5"/>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none bg-white">
                                                    <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase tracking-widest">إجراءات المعاملة</DropdownMenuLabel>
                                                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-black">
                                                        <Eye className="h-4 w-4 text-primary"/> فتح المسار الفني
                                                    </DropdownMenuItem>

                                                    {isPrivileged && (
                                                        <DropdownMenuItem onSelect={() => setAssignmentTx(tx)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-indigo-600 bg-indigo-50/30">
                                                            <Send className="h-4 w-4" /> تحويل لموظف / مهندس
                                                        </DropdownMenuItem>
                                                    )}
                                                    
                                                    {hasSignedContract && (
                                                        <DropdownMenuItem onSelect={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}/contract`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-indigo-700">
                                                            <FileText className="h-4 w-4" /> عرض العقد المبرم
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    
                                                    {!hasSignedContract ? (
                                                        <>
                                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/contracts/new?clientId=${id}&transactionId=${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-indigo-700">
                                                                <FileSignature className="h-4 w-4" /> توقيع عقد مباشر
                                                            </DropdownMenuItem>
                                                            
                                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/accounting/quotations/new?clientId=${id}&transactionId=${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-emerald-700">
                                                                <Calculator className="h-4 w-4" /> إصدار عرض سعر
                                                            </DropdownMenuItem>
                                                        </>
                                                    ) : (
                                                        <DropdownMenuItem onSelect={() => setTransactionToCancel(tx)} className="rounded-lg font-black gap-3 cursor-pointer text-orange-600 focus:bg-orange-50">
                                                            <Ban className="h-4 w-4" /> فسخ وإلغاء العقد المالي
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator className="bg-slate-100" />

                                                    <DropdownMenuItem onSelect={() => handleToggleFreeze(tx)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-black">
                                                        {tx.status === 'on-hold' ? <FolderOpen className="h-4 w-4 text-green-600"/> : <FolderLock className="h-4 w-4 text-orange-600"/>}
                                                        {tx.status === 'on-hold' ? 'إعادة تفعيل' : 'تجميد المعاملة'}
                                                    </DropdownMenuItem>
                                                    
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    
                                                    <DropdownMenuItem onSelect={() => setTransactionToDelete(tx)} className="text-red-600 font-black rounded-lg py-3 gap-3 cursor-pointer focus:bg-red-50">
                                                        <Trash2 className="h-4 w-4" /> حذف نهائي
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </Card>
                            )})}
                        </div>
                    </section>
                ))
            )}
        </div>

        <Separator className="opacity-10" />

        <ClientHistoryTimeline clientId={id} />

        {isFormOpen && <ClientTransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} clientId={id} clientName={client.nameAr} />}
        
        {assignmentTx && (
            <TransactionAssignmentDialog 
                isOpen={!!assignmentTx} 
                onClose={() => setAssignmentTx(null)} 
                transaction={assignmentTx} 
                clientName={client.nameAr} 
            />
        )}
        
        {/* Cancel Contract Confirmation */}
        <AlertDialog open={!!transactionToCancel} onOpenChange={() => setTransactionToCancel(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-orange-100 rounded-3xl w-fit mb-4"><Ban className="h-10 w-10 text-orange-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-orange-800 tracking-tighter">تأكيد فسخ العقد والترصيد العكسي؟</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        <p>أنت على وشك إلغاء التعاقد المالي للمعاملة رقم <strong>{transactionToCancel?.transactionNumber}</strong>.</p>
                        <Alert className="bg-blue-50 border-blue-200">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                            <AlertTitle className="text-blue-900 font-black">الإجراء المحاسبي الآلي:</AlertTitle>
                            <AlertDescription className="text-blue-800">
                                سيقوم النظام آلياً بتوليد <strong>قيد عكسي</strong> لإغلاق مديونية العميل المتبقية وإلغاء استحقاق الإيرادات.
                            </AlertDescription>
                        </Alert>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmCancelContract} disabled={isProcessing} className="bg-orange-600 hover:bg-orange-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-orange-100">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، فسخ وتسوية'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Transaction Delete Confirmation */}
        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المعاملة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">سيتم مسح كافة البيانات الفنية والمراحل الموثقة لـ "{transactionToDelete?.subServiceName || transactionToDelete?.transactionType}" نهائياً.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDeleteTransaction} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {/* Quotation Delete Confirmation */}
        <AlertDialog open={!!quotationToDelete} onOpenChange={() => setQuotationToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف عرض السعر؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        هل أنت متأكد من رغبتك في حذف عرض السعر رقم "{quotationToDelete?.quotationNumber}"؟ 
                        سيتم مسح هذا السجل من تاريخ العميل نهائياً.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDeleteQuotation} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200 min-w-[180px]"
                    >
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : 'نعم، حذف العرض'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}