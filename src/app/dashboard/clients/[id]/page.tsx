'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc, type DocumentData } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Pencil, User, Phone, Mail, Home, Hash, BadgeInfo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground pt-1">{icon}</div>
            <div className="flex-1">
                <p className="font-semibold">{label}</p>
                <p className="text-muted-foreground break-words">{value}</p>
            </div>
        </div>
    );
}

const statusTranslations: Record<string, string> = {
  new: 'جديد',
  received: 'تم استلامها',
  completed: 'تم إنجازها',
  rejected: 'مرفوضة',
};

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  received: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-lime-100 text-lime-800 border-lime-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};


export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const clientRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'clients', id);
  }, [id, firestore]);
  
  const [snapshot, loading, error] = useDoc(clientRef);
  const [client, setClient] = useState<DocumentData | null>(null);

  useEffect(() => {
    if (snapshot?.exists()) {
        setClient({ id: snapshot.id, ...snapshot.data() });
    }
  }, [snapshot]);

  if (loading) {
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

  if (error || !client) {
    return (
      <div className="text-center py-10" dir="rtl">
        <p className="text-destructive">{error ? 'فشل تحميل بيانات العميل.' : 'لم يتم العثور على العميل.'}</p>
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
      return new Intl.DateTimeFormat('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  const clientAddress = client.address ? [
      client.address.governorate, 
      client.address.area, 
      `قطعة ${client.address.block}`, 
      `شارع ${client.address.street}`, 
      `منزل ${client.address.houseNumber}`
    ].filter(Boolean).join('، ') : 'غير محدد';


  return (
    <div className='space-y-6' dir='rtl'>
        <div className='flex justify-between items-center no-print'>
             <Button variant="outline" onClick={() => router.push('/dashboard/clients')}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة إلى قائمة العملاء
            </Button>
            <div className='flex gap-2'>
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
                        <Badge variant="outline" className={statusColors[client.status]}>
                            {statusTranslations[client.status]}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className='grid grid-cols-1 gap-6'>
             <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><BadgeInfo className='text-primary'/> المعلومات الأساسية</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <InfoRow icon={<Phone />} label="رقم الجوال" value={client.mobile} />
                    <InfoRow icon={<Home />} label="العنوان" value={clientAddress} />
                    <InfoRow icon={<User />} label="تاريخ إنشاء الملف" value={formatDate(client.createdAt)} />
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
