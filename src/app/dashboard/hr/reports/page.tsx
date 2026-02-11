'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, CalendarCheck, UserCheck, FileSpreadsheet, HandCoins, ArrowLeft, Calculator } from 'lucide-react';

const reportList = [
    { title: 'تقرير الموظفين العام', description: 'عرض بيانات الموظفين مع فلاتر متقدمة.', href: '/dashboard/hr/reports/general', icon: Users },
    { title: 'أرصدة إجازات الموظفين', description: 'عرض تفصيلي لأرصدة الإجازات السنوية.', href: '/dashboard/hr/reports/leave-balance', icon: CalendarCheck },
    { title: 'الحضور والغياب الشهري', description: 'ملخص الحضور والغياب للموظفين.', href: '/dashboard/hr/reports/attendance', icon: UserCheck },
    { title: 'الرواتب والمستحقات الشهرية', description: 'ملخص كشوف الرواتب للشهر المحدد.', href: '/dashboard/hr/reports/payroll', icon: FileSpreadsheet },
    { title: 'السلف والاستقطاعات', description: 'تتبع السلف المالية المقدمة للموظفين.', href: '/dashboard/hr/reports/advances', icon: HandCoins },
    { title: 'تقدير مكافأة نهاية الخدمة', description: 'حساب تقديري لاستحقاقات الموظفين.', href: '/dashboard/hr/reports/gratuity', icon: Calculator },
];

export default function HrReportsDashboard() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>تقارير الموارد البشرية</CardTitle>
            <CardDescription>اختر التقرير الذي ترغب في عرضه من القائمة أدناه.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportList.map((report) => {
                const Icon = report.icon;
                return (
                    <Card key={report.href} className="flex flex-col justify-between">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <div className="flex-shrink-0"><Icon className="h-8 w-8 text-muted-foreground" /></div>
                                <div className="flex-1"><CardTitle className="text-lg">{report.title}</CardTitle></div>
                            </div>
                             <CardDescription className="mt-2 pt-2 border-t">{report.description}</CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button asChild className="w-full">
                                <Link href={report.href}>عرض التقرير <ArrowLeft className="mr-2 h-4 w-4" /></Link>
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}
        </CardContent>
    </Card>
  );
}
