'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc, getDocs, collection } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, BadgeInfo, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { TransactionTimeline } from '@/components/clients/transaction-timeline';
import type { Employee } from '@/lib/types';


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
  
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;
  const transactionId = Array.isArray(params.transactionId) ? params.transactionId[0] : params.transactionId;
  
  const [employeesMap, setEmployeesMap] = useState<Map<string, string>>(new Map());

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
        return { id: transactionSnapshot.id, ...transactionSnapshot.data() };
    }
    return null;
  }, [transactionSnapshot]);
  
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
    <div className='space-y-6' dir='rtl'>
        <Button variant="outline" onClick={() => router.push(`/dashboard/clients/${clientId}`)}>
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى ملف العميل: {client.nameAr}
        </Button>

        <Card>
            <CardHeader>
                <div className='flex justify-between items-start'>
                    <div>
                        <CardTitle className='text-2xl'>{transaction.transactionType}</CardTitle>
                        <CardDescription>
                            معاملة خاصة بالعميل: <Link href={`/dashboard/clients/${clientId}`} className='text-primary hover:underline'>{client.nameAr}</Link>
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className={transactionStatusColors[transaction.status]}>
                        {transactionStatusTranslations[transaction.status]}
                    </Badge>
                </div>
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
        
        <TransactionTimeline clientId={clientId} transactionId={transactionId} />

    </div>
  );
}
