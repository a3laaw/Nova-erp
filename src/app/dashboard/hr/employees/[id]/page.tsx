
'use client';
import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc } from '@/firebase';
import type { Employee } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Contact,
  FileText,
  Home,
  Mail,
  Pencil,
  Phone,
  User,
  Wallet,
  Printer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const statusTranslations: Record<Employee['status'], string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدمته',
};

const statusColors: Record<Employee['status'], string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

function InfoRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number | null | undefined }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-4 text-sm">
            <div className="flex-shrink-0 text-muted-foreground">{icon}</div>
            <div className="font-semibold w-32">{label}</div>
            <div className="text-muted-foreground">{value}</div>
        </div>
    );
}


export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const docPath = useMemo(() => (id ? `employees/${id}` : undefined), [id]);
  const [snapshot, loading, error] = useDoc(docPath);

  const employee = snapshot?.data() as Employee | undefined;

  useEffect(() => {
    if (!loading && !error && snapshot && !snapshot.exists()) {
      router.push('/dashboard/hr'); // Redirect if not found
    }
  }, [snapshot, loading, error, router]);

  if (loading) {
    return (
        <Card dir="rtl">
            <CardHeader className='flex-row items-center gap-4'>
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className='space-y-2'>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-5 w-32" />
                </div>
                 <Skeleton className="h-9 w-24 mr-auto" />
            </CardHeader>
            <CardContent className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </CardContent>
        </Card>
    );
  }

  if (error || !employee) {
    return (
      <div className="text-center py-10">
        <p className="text-destructive">حدث خطأ أثناء تحميل بيانات الموظف.</p>
        <Button onClick={() => router.back()} className="mt-4">
          العودة
        </Button>
      </div>
    );
  }
  
  const formatDate = (dateValue: any): string => {
    if (!dateValue) return '-';
    try {
        const d = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
        if (isNaN(d.getTime())) return '-';
        return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(d);
    } catch (e) {
        return '-';
    }
  }

  const formatCurrency = (amount: number | null | undefined) => {
     if (amount === undefined || amount === null) return '-';
     return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'KWD', numberingSystem: 'latn' }).format(amount);
  }

  return (
    <div className='space-y-6' dir='rtl'>
        <div className='flex justify-between items-center'>
             <Button variant="outline" onClick={() => router.push('/dashboard/hr')}>
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة إلى قائمة الموظفين
            </Button>
            <div className='flex gap-2'>
                 <Button variant="outline" asChild>
                    <Link href={`/dashboard/hr/employees/${id}/report`} target="_blank">
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة تقرير الموظف
                    </Link>
                </Button>
                {employee.status !== 'terminated' && (
                     <Button asChild>
                        <Link href={`/dashboard/hr/employees/${id}/edit`}>
                            <Pencil className="ml-2 h-4 w-4" />
                            تعديل بيانات الموظف
                        </Link>
                    </Button>
                )}
            </div>
        </div>
        <Card>
            <CardHeader className='flex-row items-center gap-6'>
                <Avatar className="h-24 w-24 border">
                    <AvatarImage src={employee.profilePicture} alt={employee.fullName} />
                    <AvatarFallback className="text-3xl">
                        {employee.fullName?.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className='space-y-1'>
                    <CardTitle className='text-3xl'>{employee.fullName}</CardTitle>
                    <CardDescription className='text-md'>{employee.jobTitle}</CardDescription>
                    <Badge variant="outline" className={statusColors[employee.status]}>
                        {statusTranslations[employee.status]}
                    </Badge>
                </div>
            </CardHeader>
        </Card>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
             <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><User className='text-primary'/> المعلومات الشخصية والاتصال</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <InfoRow icon={<User />} label="الاسم بالإنجليزية" value={employee.nameEn} />
                    <InfoRow icon={<Contact />} label="الرقم المدني" value={employee.civilId} />
                    <InfoRow icon={<Calendar />} label="تاريخ الميلاد" value={formatDate(employee.dob)} />
                    <InfoRow icon={<Phone />} label="رقم الجوال" value={employee.mobile} />
                    <InfoRow icon={<Phone />} label="رقم الطوارئ" value={employee.emergencyContact} />
                    <InfoRow icon={<Mail />} label="البريد الإلكتروني" value={employee.email} />
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><Briefcase className='text-primary'/> معلومات التوظيف والعقد</CardTitle>
                </CardHeader>
                <CardContent className='space-y-4'>
                    <InfoRow icon={<Briefcase />} label="القسم" value={employee.department} />
                    <InfoRow icon={<User />} label="المنصب" value={employee.position} />
                    <InfoRow icon={<Calendar />} label="تاريخ التعيين" value={formatDate(employee.hireDate)} />
                    <InfoRow icon={<FileText />} label="نوع العقد" value={employee.contractType} />
                    {employee.contractType !== 'permanent' && <InfoRow icon={<Calendar />} label="تاريخ انتهاء العقد" value={formatDate(employee.contractExpiry)} />}
                    <InfoRow icon={<Home />} label="نوع الإقامة" value={employee.visaType} />
                    {employee.visaType !== 'kuwaiti' && <InfoRow icon={<Calendar />} label="تاريخ انتهاء الإقامة" value={formatDate(employee.residencyExpiry)} />}
                     {employee.status === 'terminated' && (
                        <>
                         <InfoRow icon={<Calendar />} label="تاريخ إنهاء الخدمة" value={formatDate(employee.terminationDate)} />
                         <InfoRow icon={<User />} label="سبب إنهاء الخدمة" value={employee.terminationReason === 'resignation' ? 'استقالة' : 'إنهاء من صاحب العمل'} />
                        </>
                     )}
                </CardContent>
            </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'><Wallet className='text-primary'/> المعلومات المالية</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
                 <InfoRow icon={<Wallet />} label="الراتب الأساسي" value={formatCurrency(employee.basicSalary)} />
                 <InfoRow icon={<Wallet />} label="بدل السكن" value={formatCurrency(employee.housingAllowance)} />
                 <InfoRow icon={<Wallet />} label="بدل النقل" value={formatCurrency(employee.transportAllowance)} />
                 <hr/>
                 <InfoRow icon={<User />} label="طريقة دفع الراتب" value={employee.salaryPaymentType} />
                 {employee.salaryPaymentType === 'transfer' && (
                    <>
                        <InfoRow icon={<User />} label="اسم البنك" value={employee.bankName} />
                        <InfoRow icon={<Wallet />} label="رقم الحساب (IBAN)" value={employee.iban} />
                    </>
                 )}
            </CardContent>
        </Card>
    </div>
  );
}
