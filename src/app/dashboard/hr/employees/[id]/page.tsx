
'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Edit, User, Phone, Briefcase, Calendar as CalendarIcon, Banknote, FileSignature, Globe, ShieldCheck, FileText, Landmark, FileCheck, Calculator } from 'lucide-react';
import Link from 'next/link';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { ResidencyRenewalDialog } from '@/components/hr/residency-renewal-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeAuditLog } from '@/components/hr/employee-audit-log';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// InfoRow component for consistent display
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

    const { data: employee, loading: employeeLoading, error } = useDocument<Employee>(firestore, employeeRef ? employeeRef.path : null);

    const formatDate = (date: any) => {
        const d = toFirestoreDate(date);
        return d ? format(d, 'dd/MM/yyyy') : '-';
    }
    
    const leaveData = useMemo(() => {
        if (!employee) return null;
        const balance = calculateAnnualLeaveBalance(employee, new Date());
        return {
            balance,
            isLow: balance < 5,
        }
    }, [employee]);

    const residencyExpiryDate = useMemo(() => toFirestoreDate(employee?.residencyExpiry), [employee]);
    const canRenewResidency = useMemo(() => {
        if (!residencyExpiryDate || employee?.nationality === 'كويتي') return false;
        const daysUntilExpiry = differenceInDays(residencyExpiryDate, new Date());
        return daysUntilExpiry < 90;
    }, [residencyExpiryDate, employee?.nationality]);

    if (employeeLoading) {
        return (
            <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
                <Skeleton className="h-64 w-full rounded-[2.5rem]" />
            </div>
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
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <TabsList className="grid w-full md:w-80 grid-cols-2">
                        <TabsTrigger value="profile">الملف الشخصي</TabsTrigger>
                        <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
                    </TabsList>
                    
                    <div className="flex gap-2">
                        <Button asChild variant="outline" className="bg-white shadow-sm border-amber-200 text-amber-700 hover:bg-amber-50 font-bold gap-2 rounded-xl">
                            <Link href={`/dashboard/hr/gratuity-calculator?employeeId=${employee.id}`}>
                                <Calculator className="h-4 w-4" /> تسوية نهاية الخدمة
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="bg-white shadow-sm border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-2 rounded-xl">
                            <Link href={`/dashboard/hr/employees/${id}/print-commencement`}>
                                <FileCheck className="h-4 w-4" /> طباعة إشعار المباشرة
                            </Link>
                        </Button>
                        <Button variant="ghost" onClick={() => router.push('/dashboard/hr/employees')}><ArrowRight className="ml-2 h-4"/> عودة</Button>
                        <Button asChild>
                            <Link href={`/dashboard/hr/employees/${id}/edit`}>
                                <Edit className="ml-2 h-4"/> تعديل
                            </Link>
                        </Button>
                    </div>
                </div>

                <TabsContent value="profile">
                    <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                        <CardHeader className="bg-muted/10 pb-8 border-b">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl font-black text-gray-800">{employee.fullName}</CardTitle>
                                    <CardDescription className="text-base font-bold text-primary">{employee.jobTitle} - {employee.department}</CardDescription>
                                </div>
                                <Badge variant="outline" className="font-mono text-lg font-black px-4 bg-white">{employee.employeeNumber}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-10 p-8">
                            <section>
                                <h3 className="font-black text-lg border-r-4 border-primary pr-3 mb-6">المعلومات الشخصية والوثائق</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6">
                                    <InfoRow label="الرقم المدني" value={employee.civilId} icon={<User className="h-4 w-4 text-primary"/>} />
                                    <InfoRow label="رقم الجوال" value={<span dir="ltr">{employee.mobile}</span>} icon={<Phone className="h-4 w-4 text-primary"/>} />
                                    <InfoRow label="الجنسية" value={employee.nationality} icon={<Globe className="h-4 w-4 text-primary"/>} />
                                    
                                    <InfoRow label="انتهاء الإقامة" value={formatDate(employee.residencyExpiry)} icon={<CalendarIcon className="h-4 w-4 text-primary"/>}>
                                        {canRenewResidency && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-6 text-[9px] font-black rounded-full"
                                                onClick={() => setIsRenewalDialogOpen(true)}
                                            >
                                                تجديد
                                            </Button>
                                        )}
                                    </InfoRow>

                                    {/* 🛡️ عرض الوثائق التخصصية 🛡️ */}
                                    {employee.passportExpiry && (
                                        <InfoRow label="انتهاء الجواز" value={formatDate(employee.passportExpiry)} icon={<FileText className="h-4 w-4 text-indigo-600"/>} />
                                    )}
                                    {employee.drivingLicenseExpiry && (
                                        <InfoRow label="رخصة القيادة" value={formatDate(employee.drivingLicenseExpiry)} icon={<Landmark className="h-4 w-4 text-indigo-600"/>} />
                                    )}
                                    {employee.healthCardExpiry && (
                                        <InfoRow label="كارت الصحة" value={formatDate(employee.healthCardExpiry)} icon={<ShieldCheck className="h-4 w-4 text-indigo-600"/>} />
                                    )}
                                </div>
                            </section>

                            <Separator />

                            <section>
                                <h3 className="font-black text-lg border-r-4 border-primary pr-3 mb-6">المعلومات الوظيفية والمالية</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-6">
                                    <InfoRow label="تاريخ التعيين" value={formatDate(employee.hireDate)} icon={<CalendarIcon className="h-4 w-4 text-primary"/>} />
                                    <InfoRow label="نوع العقد" value={employee.contractType} icon={<FileSignature className="h-4 w-4 text-primary"/>} />
                                    <InfoRow label="الراتب الأساسي" value={<span className="font-black text-emerald-700">{formatCurrency(employee.basicSalary)}</span>} icon={<Banknote className="h-4 w-4 text-primary"/>} />
                                 </div>
                            </section>

                             <section className="bg-primary/5 p-8 rounded-3xl border-2 border-dashed border-primary/10">
                                <h3 className="font-black text-lg text-primary mb-6 flex items-center gap-2">
                                    <Briefcase className="h-5 w-5" /> رصيد الإجازات السنوية
                                </h3>
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                                      <div className="p-4 bg-white rounded-2xl shadow-sm border">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">المرحل</p>
                                        <p className="text-2xl font-black">{employee.carriedLeaveDays || 0}</p>
                                      </div>
                                      <div className="p-4 bg-white rounded-2xl shadow-sm border">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">المكتسب</p>
                                        <p className="text-2xl font-black">{employee.annualLeaveAccrued || 0}</p>
                                      </div>
                                       <div className="p-4 bg-white rounded-2xl shadow-sm border">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">المستخدم</p>
                                        <p className="text-2xl font-black text-red-600">{employee.annualLeaveUsed || 0}</p>
                                      </div>
                                       <div className="p-4 bg-primary text-white rounded-2xl shadow-lg border-4 border-white/20">
                                        <p className="text-[10px] uppercase font-bold opacity-80">المتبقي</p>
                                        <p className="text-3xl font-black font-mono">{leaveData?.balance || 0}</p>
                                      </div>
                                 </div>
                                  <div className="flex gap-3 mt-8">
                                     <Button asChild className="rounded-xl font-bold h-11 px-6">
                                        <Link href={`/dashboard/hr/leaves/new?employeeId=${id}`}>
                                            <CalendarIcon className="ml-2 h-4 w-4" /> تقديم طلب إجازة
                                        </Link>
                                     </Button>
                                      <Button asChild variant="outline" className="rounded-xl font-bold h-11 px-6 bg-white">
                                        <Link href={`/dashboard/hr/permissions?employeeId=${id}`}>
                                            <CalendarPlus className="ml-2 h-4 w-4" /> طلب استئذان
                                        </Link>
                                     </Button>
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

import { CalendarPlus } from 'lucide-react';
