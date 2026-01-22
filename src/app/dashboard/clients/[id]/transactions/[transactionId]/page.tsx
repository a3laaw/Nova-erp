
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc, getDocs, collection, writeBatch, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BadgeInfo, Calendar, User, History, MessageSquare, Save, Loader2, FileText, Pencil, Printer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import type { Employee, ClientTransaction } from '@/lib/types';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractClausesForm } from '@/components/clients/contract-clauses-form';


// Using the same translation objects from client profile page
const transactionStatusTranslations: Record<string, string> = {
  new: 'جديدة',
  'in-progress': 'قيد التنفيذ',
  completed: 'مكتملة',
  submitted: 'تم تسليمها',
};

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
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
  const firestore = useFirestore();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());
  const [newStatus, setNewStatus] = useState('');
  const [newEngineerId, setNewEngineerId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);


  // --- Data Fetching ---
  const transactionRef = useMemo(() => {
    if (!firestore || !clientId || !transactionId) return null;
    return doc(firestore, 'clients', clientId, 'transactions', transactionId);
  }, [firestore, clientId, transactionId]);
  
  const clientRef = useMemo(() => {
    if (!firestore || !clientId) return null;
    return doc(firestore, 'clients', clientId);
  }, [firestore, clientId]);

  const [transactionSnapshot, transactionLoading, transactionError] = useDoc(transactionRef);
  const [clientSnapshot, clientLoading, clientError] = useDoc(clientRef);
  
  useEffect(() => {
    if (!firestore) return;
    const fetchEmployees = async () => {
        try {
            const querySnapshot = await getDocs(collection(firestore, 'employees'));
            const newMap = new Map<string, string>();
            querySnapshot.forEach(doc => {
                const emp = doc.data() as Employee;
                newMap.set(doc.id, emp.fullName);
            });
            setEmployeesMap(newMap);
        } catch (error) {
            console.error("Failed to fetch employees map for transaction detail:", error);
        }
    };
    fetchEmployees();
  }, [firestore]);


  const transaction = useMemo(() => {
    if (transactionSnapshot?.exists()) {
        return { id: transactionSnapshot.id, ...transactionSnapshot.data() } as ClientTransaction;
    }
    return null;
  }, [transactionSnapshot]);
  
  useEffect(() => {
    if (transaction) {
        setNewStatus(transaction.status);
        setNewEngineerId(transaction.assignedEngineerId || '');
    }
  }, [transaction]);

  const client = useMemo(() => {
    if (clientSnapshot?.exists()) {
        return { id: clientSnapshot.id, ...clientSnapshot.data() };
    }
    return null;
  }, [clientSnapshot]);

  const formatDate = (dateValue: any): string => {
      if (!dateValue) return '-';
      const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
      if (isNaN(date.getTime())) return '-';
      return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  const handleUpdateTransaction = async () => {
    if (!firestore || !currentUser || !client || !transaction) return;

    const statusChanged = newStatus !== transaction.status;
    const engineerChanged = newEngineerId !== (transaction.assignedEngineerId || '');

    if (!statusChanged && !engineerChanged) {
        toast({ title: 'لا توجد تغييرات', description: 'لم يتم تغيير الحالة أو المهندس المسؤول.' });
        return;
    }
    
    setIsSaving(true);
    
    const batch = writeBatch(firestore);
    const transactionRef = doc(firestore, 'clients', clientId, 'transactions', transactionId);
    const timelineRef = collection(transactionRef, 'timelineEvents');
    
    const updateData: any = { updatedAt: serverTimestamp() };

    if (statusChanged) {
        updateData.status = newStatus;
        const logContent = `قام بتغيير حالة المعاملة من "${transactionStatusTranslations[transaction.status]}" إلى "${transactionStatusTranslations[newStatus]}".`;
        batch.set(doc(timelineRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });
    }

    if (engineerChanged) {
        updateData.assignedEngineerId = newEngineerId;
        const oldEngineerName = transaction.assignedEngineerId ? employeesMap.get(transaction.assignedEngineerId) || 'غير مسند' : 'غير مسند';
        const newEngineerName = newEngineerId ? employeesMap.get(newEngineerId) || 'غير مسند' : 'غير مسند';
        const logContent = `قام بتغيير المهندس المسؤول من "${oldEngineerName}" إلى "${newEngineerName}".`;
        batch.set(doc(timelineRef), {
            type: 'log',
            content: logContent,
            userId: currentUser.id,
            userName: currentUser.fullName,
            userAvatar: currentUser.avatarUrl,
            createdAt: serverTimestamp(),
        });
        
        if (transaction.transactionType === 'تصميم بلدية (سكن خاص)') {
            const clientRef = doc(firestore, 'clients', clientId);
            batch.update(clientRef, { assignedEngineer: newEngineerId || null });
        }
    }

    batch.update(transactionRef, updateData);
    
    try {
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم تحديث المعاملة بنجاح.' });
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل تحديث المعاملة.' });
    } finally {
        setIsSaving(false);
    }
};


  // --- Render Logic ---
  const isLoading = transactionLoading || clientLoading;

  if (isLoading) {
    return (
        <div className="space-y-6" dir="rtl">
            <Skeleton className="h-9 w-48" />
             <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-5 w-48" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-32 w-full mt-6" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (transactionError || clientError || !transaction || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{transactionError || clientError ? 'فشل تحميل البيانات.' : 'لم يتم العثور على المعاملة أو العميل.'}</p>
        <Button onClick={() => router.back()} className="mt-4">
          العودة
        </Button>
      </div>
    );
  }
  
  return (
    <>
    {transaction && (
        <ContractClausesForm
            isOpen={isContractFormOpen}
            onClose={() => setIsContractFormOpen(false)}
            transaction={transaction}
            clientId={clientId}
        />
    )}
    <div className='space-y-6' dir='rtl'>
        <Button variant="outline" onClick={() => router.push(`/dashboard/clients/${clientId}`)}>
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى ملف العميل: {client.nameAr}
        </Button>

        <Card>
            <CardHeader>
                <div className='flex justify-between items-start'>
                    <div className='flex items-center gap-4'>
                        <CardTitle className='text-2xl'>{transaction.transactionType}</CardTitle>
                         <Button variant="outline" size="sm" onClick={() => setIsContractFormOpen(true)}>
                            <Pencil className="ml-2 h-4 w-4" />
                            تعديل بنود العقد
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/clients/${clientId}/transactions/${transactionId}/contract`}>
                                <Printer className="ml-2 h-4 w-4" />
                                عرض وطباعة العقد
                            </Link>
                        </Button>
                    </div>
                    <Badge variant="outline" className={transactionStatusColors[transaction.status]}>
                        {transactionStatusTranslations[transaction.status]}
                    </Badge>
                </div>
                 <CardDescription>
                    معاملة خاصة بالعميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className='grid md:grid-cols-2 gap-6'>
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={transaction.assignedEngineerId ? (employeesMap.get(transaction.assignedEngineerId) || 'جاري التحميل...') : <span className='text-muted-foreground'>لم يحدد</span>} />
                    <InfoRow icon={<Calendar />} label="تاريخ الإنشاء" value={formatDate(transaction.createdAt)} />
                </div>
                {transaction.description && (
                     <div className='mt-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md'>
                        <p className='font-semibold mb-1 text-foreground'>ملاحظات المعاملة:</p>
                        {transaction.description}
                    </div>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>إدارة المعاملة</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="grid gap-2">
                    <Label htmlFor="status">تغيير الحالة</Label>
                    <Select dir="rtl" value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.keys(transactionStatusTranslations).map(key => (
                                <SelectItem key={key} value={key}>{transactionStatusTranslations[key]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {transaction.transactionType !== 'تصميم بلدية (سكن خاص)' ? (
                    <div className="grid gap-2">
                        <Label htmlFor="engineer">تغيير المهندس المسؤول</Label>
                        <Select dir="rtl" value={newEngineerId} onValueChange={setNewEngineerId}>
                            <SelectTrigger id="engineer"><SelectValue placeholder="اختر مهندسا..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassign">إزالة الإسناد</SelectItem>
                                {Array.from(employeesMap.entries()).map(([id, name]) => (
                                    <SelectItem key={id} value={id}>{name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div className="grid gap-2">
                        <Label>المهندس المسؤول</Label>
                        <Input value={employeesMap.get(newEngineerId) || 'غير مسند'} readOnly disabled />
                        <p className="text-xs text-muted-foreground">يتم التحكم في المهندس من ملف العميل لهذه المعاملة.</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button onClick={handleUpdateTransaction} disabled={isSaving}>
                    {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    حفظ التغييرات
                </Button>
            </CardFooter>
        </Card>
        
         <Tabs defaultValue="comments" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="comments">التعليقات والمتابعة</TabsTrigger>
                <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
            </TabsList>
            <TabsContent value="comments" className="mt-6">
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="comment"
                  showInput={true}
                  title="التعليقات والمتابعة"
                  icon={<MessageSquare className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                <TransactionTimeline
                  clientId={clientId}
                  transactionId={transactionId}
                  filterType="log"
                  showInput={false}
                  title="سجل التغييرات"
                  icon={<History className="text-primary" />}
                  client={client}
                  transaction={transaction}
                />
            </TabsContent>
        </Tabs>

    </div>
    </>
  );
}
