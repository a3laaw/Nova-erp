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
    where
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import type { Client, ClientTransaction, Employee, Quotation } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
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
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: any }) {
    if (!value) return null;
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
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = currentUser?.currentCompanyId;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const clientPath = useMemo(() => id && tenantId ? getTenantPath(`clients/${id}`, tenantId) : null, [id, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  const txPath = useMemo(() => id && tenantId ? getTenantPath(`clients/${id}/transactions`, tenantId) : null, [id, tenantId]);
  const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction>(firestore, txPath);

  const qQuery = useMemo(() => [where('clientId', '==', id)], [id]);
  const { data: quotations, loading: quotationsLoading } = useSubscription<Quotation>(firestore, 'quotations', qQuery);
  
  useEffect(() => {
    if (!firestore || !tenantId) return;
    const empPath = getTenantPath('employees', tenantId);
    getDocs(query(collection(firestore, empPath!))).then(snap => {
        const newMap = new Map<string, string>();
        snap.forEach(doc => newMap.set(doc.id, doc.data().fullName));
        setEmployeesMap(newMap);
    });
  }, [firestore, tenantId]);

  const handleToggleFreeze = async (tx: ClientTransaction) => {
    if (!firestore || !tenantId || !tx.id) return;
    setIsProcessing(true);
    const newStatus = tx.status === 'on-hold' ? 'new' : 'on-hold';
    try {
        const docPath = getTenantPath(`clients/${id}/transactions/${tx.id}`, tenantId);
        await updateDoc(doc(firestore, docPath!), { 
            status: newStatus,
            updatedAt: serverTimestamp() 
        });
        toast({ title: 'نجاح التحديث', description: `تم ${newStatus === 'on-hold' ? 'تجميد' : 'إعادة تفعيل'} المعاملة بنجاح.` });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في التحديث' });
    } finally { setIsProcessing(false); }
  };

  const handleConfirmDelete = async () => {
    if (!firestore || !tenantId || !transactionToDelete?.id) return;
    setIsProcessing(true);
    try {
        const docPath = getTenantPath(`clients/${id}/transactions/${transactionToDelete.id}`, tenantId);
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

        toast({ title: 'تم الحذف', description: 'تم مسح سجل المعاملة نهائياً.' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'خطأ في الحذف' });
    } finally { 
        setIsProcessing(false); 
        setTransactionToDelete(null); 
    }
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
                <InfoRow icon={<BadgeInfo className="h-5 w-5 text-primary opacity-40"/>} label="الرقم المدني" value={<span className="font-mono font-black">{client.civilId}</span>} />
                <InfoRow icon={<Phone className="h-5 w-5 text-primary opacity-40"/>} label="رقم الجوال" value={<span dir="ltr" className="font-mono font-black">{client.mobile}</span>} />
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
                                <Badge className={cn("px-4 py-1 rounded-full font-black text-[9px] uppercase border-none", 
                                    q.status === 'accepted' ? "bg-green-600 text-white" : "bg-blue-50 text-blue-700"
                                )}>
                                    {q.status === 'accepted' ? 'مقبول / عقد مبرم' : 'بانتظار القرار'}
                                </Badge>
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
                            {txs.map(tx => (
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
                                                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer">
                                                        <Eye className="h-4 w-4 text-primary"/> فتح المسار الفني
                                                    </DropdownMenuItem>
                                                    
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    
                                                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/contracts/new?clientId=${id}&transactionId=${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-indigo-700">
                                                        <FileSignature className="h-4 w-4" /> توقيع عقد مباشر
                                                    </DropdownMenuItem>
                                                    
                                                    <DropdownMenuItem onSelect={() => router.push(`/dashboard/accounting/quotations/new?clientId=${id}&transactionId=${tx.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-emerald-700">
                                                        <Calculator className="h-4 w-4" /> إصدار عرض سعر
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator className="bg-slate-100" />

                                                    <DropdownMenuItem onSelect={() => handleToggleFreeze(tx)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer">
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
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>

        <Separator className="opacity-10" />

        <ClientHistoryTimeline clientId={id} />

        {isFormOpen && <ClientTransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} clientId={id} clientName={client.nameAr} />}
        
        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المعاملة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">سيتم مسح كافة البيانات الفنية والمراحل الموثقة لـ "{transactionToDelete?.subServiceName || transactionToDelete?.transactionType}" نهائياً.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}