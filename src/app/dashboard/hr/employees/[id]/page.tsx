'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Edit, User, Phone, Briefcase, Calendar as CalendarIcon, Banknote, FileSignature, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { ResidencyRenewalDialog } from '@/components/hr/residency-renewal-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeAuditLog } from '@/components/hr/employee-audit-log';


function InfoRow({ label, value, icon, children }: { label: string, value: React.ReactNode, icon: React.ReactNode, children?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-muted-foreground pt-1">{icon}</div>
            <div className="flex-1">
                <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                <div className="text-base font-medium flex items-center gap-2">{value || '-'} {children}</div>
            </div>
        </div>
    );
}

export default function EmployeeProfilePage() {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();

    const [isRenewalDialogOpen, setIsRenewalDialogOpen] = useState(false);

    const employeeRef = useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'employees', id);
    }, [firestore, id]);

    const { data: employee, loading, error } = useDocument<Employee>(firestore, employeeRef ? employeeRef.path : null);

    const formatDate = (date: any) => {
        const d = toFirestoreDate(date);
        return d ? format(d, 'dd/MM/yyyy') : '-';
    }
    
    const residencyExpiryDate = useMemo(() => toFirestoreDate(employee?.residencyExpiry), [employee]);
    const canRenewResidency = useMemo(() => {
        if (!residencyExpiryDate || employee?.nationality === 'كويتي') return false;
        const daysUntilExpiry = differenceInDays(residencyExpiryDate, new Date());
        return daysUntilExpiry < 90;
    }, [residencyExpiryDate, employee?.nationality]);

    if (loading) {
        return (
            <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32 mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                    <Skeleton className="h-6 w-full" />
                </CardContent>
            </Card>
        );
    }
    
    if (error || !employee) {
        return (
            <Card className="max-w-4xl mx-auto" dir="rtl">
                <CardHeader><CardTitle>خطأ</CardTitle></CardHeader>
                <CardContent><p className="text-destructive">فشل تحميل بيانات الموظف.</p></CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Tabs defaultValue="profile" dir="rtl">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
                    <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
                </TabsList>
                <TabsContent value="profile">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl">{employee.fullName}</CardTitle>
                                    <CardDescription>{employee.jobTitle} - {employee.department}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                     <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees')}><ArrowRight className="ml-2 h-4"/> عودة</Button>
                                     <Button asChild>
                                        <Link href={`/dashboard/hr/employees/${id}/edit`}>
                                            <Edit className="ml-2 h-4"/> تعديل
                                        </Link>
                                     </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <section>
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">المعلومات الشخصية</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <InfoRow label="الرقم المدني" value={employee.civilId} icon={<User className="h-4 w-4"/>} />
                                    <InfoRow label="رقم الجوال" value={<span dir="ltr">{employee.mobile}</span>} icon={<Phone className="h-4 w-4"/>} />
                                    <InfoRow label="تاريخ الميلاد" value={formatDate(employee.dob)} icon={<CalendarIcon className="h-4 w-4"/>} />
                                    <InfoRow label="الجنسية" value={employee.nationality} icon={<User className="h-4 w-4"/>} />
                                    {employee.nationality !== 'كويتي' && (
                                        <InfoRow label="تاريخ انتهاء الإقامة" value={formatDate(employee.residencyExpiry)} icon={<CalendarIcon className="h-4 w-4"/>}>
                                            <Button
                                                variant={canRenewResidency ? "destructive" : "outline"}
                                                size="sm"
                                                className="h-7"
                                                onClick={() => setIsRenewalDialogOpen(true)}
                                                disabled={!canRenewResidency}
                                            >
                                                <RefreshCw className="ml-2 h-3 w-3"/>
                                                تجديد الإقامة
                                            </Button>
                                        </InfoRow>
                                    )}
                                </div>
                            </section>
                            <section>
                                <h3 className="font-semibold text-lg border-b pb-2 mb-4">المعلومات الوظيفية</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <InfoRow label="الرقم الوظيفي" value={employee.employeeNumber} icon={<Briefcase className="h-4 w-4"/>} />
                                    <InfoRow label="تاريخ التعيين" value={formatDate(employee.hireDate)} icon={<CalendarIcon className="h-4 w-4"/>} />
                                    <InfoRow label="نوع العقد" value={employee.contractType} icon={<FileSignature className="h-4 w-4"/>} />
                                    <InfoRow label="الراتب الأساسي" value={`${formatCurrency(employee.basicSalary)}`} icon={<Banknote className="h-4 w-4"/>} />
                                 </div>
                            </section>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="audit">
                    <EmployeeAuditLog employeeId={id} />
                </TabsContent>
            </Tabs>

            <ResidencyRenewalDialog 
                isOpen={isRenewalDialogOpen}
                onClose={() => setIsRenewalDialogOpen(false)}
                employee={employee}
            />
        </div>
    );
}
