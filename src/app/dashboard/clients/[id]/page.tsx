
'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy, type DocumentData, getDocs } from 'firebase/firestore';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Pencil, User, Phone, Home, Hash, BadgeInfo, Files, PlusCircle, History, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ClientTransactionForm } from '@/components/clients/client-transaction-form';
import type { ClientTransaction, Employee, ContractTemplate } from '@/lib/types';
import { format } from 'date-fns';
import { ClientHistoryTimeline } from '@/components/clients/client-history-timeline';

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: React.ReactNode | string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground pt-1">{icon}</div>
            <div className="flex-1">
                <p className="font-semibold">{label}</p>
                <div className="text-muted-foreground break-words">{value}</div>
            </div>
        </div>
    );
}

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
};

const transactionStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  submitted: 'bg-purple-100 text-purple-800 border-purple-200',
};


export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());

  // --- Data Fetching ---
  const clientRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'clients', id);
  }, [id, firestore]);
  
  const transactionsQuery = useMemo(() => {
    if (!firestore || !id) return null;
    return query(collection(firestore, 'clients', id, 'transactions'), orderBy('createdAt', 'desc'));
  }, [firestore, id]);

  const [clientSnapshot, clientLoading, clientError] = useDoc(clientRef);
  const [transactionsSnapshot, transactionsLoading, transactionsError] = useCollection(transactionsQuery);

  const client = useMemo(() => {
    if (clientSnapshot?.exists()) {
        return { id: clientSnapshot.id, ...clientSnapshot.data() };
    }
    return null;
  }, [clientSnapshot]);

  const transactions = useMemo(() => {
      if (!transactionsSnapshot) return [];
      return transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientTransaction));
  }, [transactionsSnapshot]);
  
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


  // --- Render Logic ---

  if (clientLoading) {
    return (
        <div className="space-y-6" dir="rtl">
            <Skeleton className="h-9 w-48" />
             <Card>
                <CardHeader className='flex-row items-center gap-4'>
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className='space-y-2'>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-5 w-32" />
                    </div>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{clientError ? 'فشل تحميل بيانات العميل.' : 'لم يتم العثور على العميل.'}</p>
        <Button onClick={() => router.push('/dashboard/clients')} className="mt-4">
          العودة إلى قائمة العملاء
        </Button>
      </div>
    );
  }
  
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

  const clientAddress = client.address ? [
      client.address.governorate, 
      client.address.area, 
      `قطعة ${client.address.block}`, 
      `شارع ${client.address.street}`, 
      `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';
  
  const assignedEngineerName = client.assignedEngineer ? employeesMap.get(client.assignedEngineer) : null;


  return (
    <>
    <ClientTransactionForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)}
        clientId={id}
        clientName={client.nameAr}
    />
    <div className='space-y-6' dir='rtl'>
        <div className='flex justify-between items-center no-print'>
             <Button variant="outline" onClick={() => router.push('/dashboard/clients')}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة إلى قائمة العملاء
            </Button>
            <div className='flex gap-2'>
                <Button
                    asChild
                    disabled={!['contracted', 'reContracted'].includes(client.status)}
                    variant="outline"
                >
                    <Link href={`/contracts/${id}`}>
                      <FileText className="ml-2 h-4 w-4" />
                      عرض العقد
                    </Link>
                </Button>
                <Button asChild>
                    <Link href={`/dashboard/clients/${id}/edit`}>
                        <Pencil className="ml-2 h-4 w-4" />
                        تعديل بيانات العميل
                    </Link>
                </Button>
            </div>
        </div>
        <Card>
            <CardHeader className='flex-row items-center gap-6'>
                 <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <User className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className='space-y-1'>
                    <CardTitle className='text-3xl'>{client.nameAr}</CardTitle>
                    <CardDescription className='text-md'>{client.nameEn}</CardDescription>
                    <div className='flex items-center gap-4 pt-1'>
                        <div className='flex items-center gap-2 text-sm text-muted-foreground font-mono'>
                            <Hash className='h-4 w-4'/>
                            <span>{client.fileId}</span>
                        </div>
                        <Badge variant="outline" className={clientStatusColors[client.status]}>
                            {clientStatusTranslations[client.status]}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Tabs defaultValue="profile" dir="rtl">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
            <TabsTrigger value="history">سجل التغييرات</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><BadgeInfo className='text-primary'/> المعلومات الأساسية</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <InfoRow icon={<User />} label="المهندس المسؤول" value={assignedEngineerName || <span className='text-muted-foreground'>غير محدد</span>} />
                    <InfoRow icon={<Phone />} label="رقم الجوال" value={client.mobile} />
                    <InfoRow icon={<Home />} label="العنوان" value={clientAddress} />
                    <InfoRow icon={<User />} label="تاريخ إنشاء الملف" value={formatDate(client.createdAt)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle className='flex items-center gap-2'><Files className='text-primary'/> المعاملات الداخلية</CardTitle>
                        <CardDescription>جميع المعاملات والخدمات المقدمة للعميل.</CardDescription>
                    </div>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="ml-2 h-4 w-4" />
                        إضافة معاملة
                    </Button>
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
                                        <TableHead>نوع المعاملة</TableHead>
                                        <TableHead>المهندس المسؤول</TableHead>
                                        <TableHead>الحالة</TableHead>
                                        <TableHead>تاريخ الإنشاء</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell 
                                                className="font-medium hover:underline cursor-pointer"
                                                onClick={() => router.push(`/dashboard/clients/${id}/transactions/${tx.id}`)}
                                            >
                                                {tx.transactionType}
                                            </TableCell>
                                            <TableCell>{tx.assignedEngineerId ? (employeesMap.get(tx.assignedEngineerId) || '...') : <span className='text-muted-foreground'>-</span>}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={transactionStatusColors[tx.status]}>
                                                    {transactionStatusTranslations[tx.status]}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDate(tx.createdAt)}</TableCell>
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
