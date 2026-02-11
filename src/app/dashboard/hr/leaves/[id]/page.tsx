// ADDED: نظام إجازات إلكتروني هجين مع طباعة نموذج ورقي للتوقيع اليدوي
// IMPROVED: زر طباعة PDF مطابق للنماذج التقليدية
'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocument, useFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { LeaveRequest, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Calendar, User, FileText, CheckCircle, XCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Badge } from '@/components/ui/badge';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';

const statusColors: Record<LeaveRequest['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};
const statusTranslations: Record<LeaveRequest['status'], string> = {
  pending: 'تحت المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
};
const leaveTypeTranslations: Record<LeaveRequest['leaveType'], string> = {
    'Annual': 'سنوية', 'Sick': 'مرضية', 'Emergency': 'طارئة', 'Unpaid': 'بدون أجر'
};


function InfoRow({ label, value, icon }: { label: string, value: string | React.ReactNode, icon: React.ReactNode }) {
    return (
        <div className="flex gap-4">
            <div className="text-muted-foreground">{icon}</div>
            <div className="font-semibold">{label}:</div>
            <div>{value}</div>
        </div>
    )
}

export default function LeaveRequestDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const leaveRequestRef = useMemo(() => firestore && id ? doc(firestore, 'leaveRequests', id) : null, [firestore, id]);
    const { data: leaveRequest, loading: leaveLoading } = useDocument<LeaveRequest>(firestore, leaveRequestRef?.path || null);
    
    const employeeRef = useMemo(() => firestore && leaveRequest?.employeeId ? doc(firestore, 'employees', leaveRequest.employeeId) : null, [firestore, leaveRequest?.employeeId]);
    const { data: employee, loading: employeeLoading } = useDocument<Employee>(firestore, employeeRef?.path || null);

    const handlePrint = () => {
        const element = document.getElementById('printable-leave-form');
        if (!element || !leaveRequest) return;
        
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const opt = {
                margin: 0.5,
                filename: `leave_request_${leaveRequest.employeeName}_${leaveRequest.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    const loading = leaveLoading || employeeLoading || brandingLoading;

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8">
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!leaveRequest || !employee) {
        return <div className="text-center p-10">تعذر تحميل تفاصيل طلب الإجازة.</div>;
    }
    
    const startDate = toFirestoreDate(leaveRequest.startDate);
    const endDate = toFirestoreDate(leaveRequest.endDate);

    return (
        <div className="space-y-6">
            <div className="no-print flex justify-end gap-2">
                 <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4 w-4"/> عودة للقائمة</Button>
                {leaveRequest.status === 'approved' && <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4"/> طباعة النموذج</Button>}
            </div>

            <div id="printable-leave-form" className="max-w-4xl mx-auto bg-white dark:bg-card p-8 rounded-lg shadow-md print:shadow-none print:border">
                <header className="flex justify-between items-start pb-4 border-b-2">
                    <div className="flex items-center gap-4">
                        <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                            <p className="text-sm text-muted-foreground">{branding?.address}</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-2xl font-bold">طلب إجازة</h2>
                        <p className="text-muted-foreground font-mono">
                            {leaveRequest.id.substring(0,8)}
                        </p>
                    </div>
                </header>

                <main className="py-6 space-y-8">
                     <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <InfoRow label="اسم الموظف" value={leaveRequest.employeeName} icon={<User className="h-4"/>}/>
                        <InfoRow label="الرقم الوظيفي" value={employee.employeeNumber || '-'} icon={<User className="h-4"/>}/>
                        <InfoRow label="القسم" value={employee.department} icon={<User className="h-4"/>}/>
                        <InfoRow label="المسمى الوظيفي" value={employee.jobTitle} icon={<User className="h-4"/>}/>
                    </div>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <InfoRow label="تاريخ تقديم الطلب" value={format(toFirestoreDate(leaveRequest.createdAt)!, 'PPP', { locale: ar })} icon={<Calendar className="h-4"/>}/>
                        <InfoRow label="نوع الإجازة" value={<Badge variant="secondary">{leaveTypeTranslations[leaveRequest.leaveType]}</Badge>} icon={<FileText className="h-4"/>} />
                        <InfoRow label="تاريخ بداية الإجازة" value={format(startDate!, 'PPP', { locale: ar })} icon={<Calendar className="h-4"/>}/>
                        <InfoRow label="تاريخ نهاية الإجازة" value={format(endDate!, 'PPP', { locale: ar })} icon={<Calendar className="h-4"/>}/>
                        <InfoRow label="المدة الكلية" value={`${leaveRequest.days} أيام`} icon={<Calendar className="h-4"/>}/>
                        <InfoRow label="أيام العمل الفعلية" value={`${leaveRequest.workingDays} أيام`} icon={<Calendar className="h-4"/>}/>
                    </div>
                    
                    <div className="space-y-2">
                        <h4 className="font-semibold">السبب</h4>
                        <p className="p-3 border rounded-md min-h-[60px] bg-muted/50">{leaveRequest.notes || 'لا يوجد'}</p>
                    </div>
                    
                     <div className="space-y-2">
                        <h4 className="font-semibold">رصيد الإجازة السنوية</h4>
                        <div className="flex justify-around items-center p-4 border rounded-lg text-center">
                            <div><p className="text-muted-foreground text-sm">الرصيد الحالي</p><p className="font-bold text-2xl">{calculateAnnualLeaveBalance(employee, new Date())}</p></div>
                             <div><p className="text-muted-foreground text-sm">الرصيد بعد الإجازة</p><p className="font-bold text-2xl text-primary">{calculateAnnualLeaveBalance(employee, new Date()) - (leaveRequest.leaveType === 'Annual' ? leaveRequest.workingDays || 0 : 0)}</p></div>
                        </div>
                    </div>
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Checkbox id="passport" checked={leaveRequest.passportReceived} disabled/>
                            <Label htmlFor="passport">تم استلام جواز السفر</Label>
                        </div>
                    </div>
                </main>
                
                 <footer className="pt-16 space-y-12">
                    <div className="grid grid-cols-3 gap-8 text-center text-sm">
                        <div><p className="font-bold">توقيع الموظف</p><div className="mt-12 border-t pt-2 text-muted-foreground">التاريخ:</div></div>
                        <div><p className="font-bold">موافقة المدير المباشر</p><div className="mt-12 border-t pt-2 text-muted-foreground">التوقيع:</div></div>
                        <div><p className="font-bold">موافقة قسم الموارد البشرية</p><div className="mt-12 border-t pt-2 text-muted-foreground">التوقيع:</div></div>
                    </div>
                     <div className="border-t pt-4 text-center">
                        <p className="font-bold">اعتماد الإدارة العليا</p>
                        <div className="mt-12 w-1/3 mx-auto border-t pt-2 text-muted-foreground">التوقيع:</div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
