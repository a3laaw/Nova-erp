'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, writeBatch, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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
    Home,
    BadgeInfo,
    History,
    ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import type { Client, ClientTransaction, Employee } from '@/lib/types';
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
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const tenantId = currentUser?.currentCompanyId;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [transactionToDelete, setTransactionToDelete] = useState<ClientTransaction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🛡️ رادار المسارات المعتمدة
  const clientPath = useMemo(() => getTenantPath(`clients/${id}`, tenantId), [id, tenantId]);
  const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

  const txPath = useMemo(() => getTenantPath(`clients/${id}/transactions`, tenantId), [id, tenantId]);
  const { data: transactions, loading: transactionsLoading } = useSubscription<ClientTransaction>(firestore, txPath);
  
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
    try {
        await updateDoc(doc(firestore, getTenantPath(`clients/${id}/transactions/${tx.id}`, tenantId)!), { status: newStatus });
        toast({ title: 'نجاح التحديث' });
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

  if (clientLoading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-[2.5rem]" /></div>;
  if (!client) return <div className="text-center py-20 font-black opacity-30">الملف غير موجود.</div>;

  return (
    <div className='space-y-8 max-w-6xl mx-auto' dir='rtl'>
        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-8 px-10 border-b">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-right">
                        <CardTitle className="text-3xl font-black text-[#1e1b4b] tracking-tighter">{client.nameAr}</CardTitle>
                        <p className="text-slate-500 font-bold mt-1">{client.nameEn}</p>
                    </div>
                    <div className="flex gap-3">
                        <Button asChild variant="outline" className="h-11 px-8 rounded-2xl border-2 font-black gap-2">
                            <Link href={`/dashboard/clients/${id}/edit`}><Pencil className="h-4 w-4" /> تعديل الملف</Link>
                        </Button>
                        <Button onClick={() => setIsFormOpen(true)} className="h-11 px-8 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20 bg-primary text-white border-none">
                            <PlusCircle className="h-5 w-5" /> إضافة معاملة
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

        <div className="space-y-12">
            <h3 className="text-2xl font-black text-[#1e1b4b] border-r-8 border-primary pr-4 flex items-center gap-3">
                <Workflow className="h-7 w-7 text-primary" /> مصفوفة الخدمات المعتمدة
            </h3>
            
            {groupedTransactions.length === 0 ? (
                <div className="p-20 text-center border-4 border-dashed rounded-[3.5rem] opacity-30">
                    <PlusCircle className="mx-auto h-20 w-20 text-muted-foreground mb-4" />
                    <p className="text-2xl font-black">لا توجد معاملات مسجلة بعد.</p>
                </div>
            ) : (
                groupedTransactions.map(([typeName, txs]) => (
                    <section key={typeName} className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center gap-3 px-4">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5"/></div>
                            <h4 className="text-xl font-black text-slate-800">{typeName}</h4>
                        </div>
                        
                        <div className="grid gap-4">
                            {txs.map(tx => (
                                <Card key={tx.id} className="rounded-3xl border-2 border-transparent bg-white shadow-md hover:border-primary/20 transition-all group overflow-hidden">
                                    <div className="flex flex-col sm:flex-row items-center justify-between p-6 gap-6">
                                        <div className="flex items-center gap-6">
                                            <Badge variant="outline" className="font-mono font-black text-primary text-xs h-8 px-4 border-primary/20 bg-primary/5">{tx.transactionNumber}</Badge>
                                            <div>
                                                <p className="font-black text-lg text-slate-900 leading-tight">{tx.subServiceName || 'خدمة أساسية'}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground mt-1 flex items-center gap-1"><User className="h-3 w-3"/> المسؤول: {tx.assignedEngineerId ? employeesMap.get(tx.assignedEngineerId) : 'غير مسند'}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[10px] border-2 shadow-sm", transactionStatusColors[tx.status])}>
                                                {statusTranslations[tx.status]}
                                            </Badge>
                                            <div className="flex gap-2">
                                                <Button asChild variant="outline" className="rounded-xl h-10 px-6 font-black gap-2 border-2"><Link href={`/dashboard/clients/${id}/transactions/${tx.id}`}><Eye className="h-4 w-4"/> عرض ومتابعة</Link></Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent dir="rtl" className="rounded-xl p-2 shadow-2xl border-none">
                                                        <DropdownMenuItem onClick={() => handleToggleFreeze(tx)} className="rounded-lg py-3 font-bold gap-3">
                                                            {tx.status === 'on-hold' ? <FolderOpen className="h-4 w-4 text-green-600"/> : <FolderLock className="h-4 w-4 text-orange-600"/>}
                                                            {tx.status === 'on-hold' ? 'إلغاء التجميد' : 'تجميد المعاملة'}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => setTransactionToDelete(tx)} className="text-red-600 font-black rounded-lg py-3 gap-3"><Trash2 className="h-4 w-4" /> حذف نهائي</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>

        <ClientHistoryTimeline clientId={id} />

        {isFormOpen && <ClientTransactionForm isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} clientId={id} clientName={client.nameAr} />}
        
        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد حذف المعاملة؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">سيتم مسح كافة البيانات الفنية والمرفقات الخاصة بـ "{transactionToDelete?.transactionType}" نهائياً.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { if(transactionToDelete?.id) { setIsProcessing(true); deleteDoc(doc(firestore!, getTenantPath(`clients/${id}/transactions/${transactionToDelete.id}`, tenantId)!)).then(() => toast({title: 'تم الحذف'})).finally(() => {setIsProcessing(false); setTransactionToDelete(null);}); } }} disabled={isProcessing} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}