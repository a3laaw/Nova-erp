'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Users, CalendarCheck, UserCheck, FileSpreadsheet, HandCoins, Calculator, Wallet, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

const reportList = [
    { 
        title: 'تقرير الموظفين العام', 
        description: 'عرض بيانات الموظفين مع فلاتر متقدمة.', 
        href: '/dashboard/hr/reports/general', 
        icon: Users,
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    },
    { 
        title: 'أرصدة إجازات الموظفين', 
        description: 'عرض تفصيلي لأرصدة الإجازات السنوية.', 
        href: '/dashboard/hr/reports/leave-balance', 
        icon: CalendarCheck,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
    },
    { 
        title: 'الحضور والغياب الشهري', 
        description: 'ملخص الحضور والغياب للموظفين.', 
        href: '/dashboard/hr/reports/attendance', 
        icon: UserCheck,
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
    },
    { 
        title: 'الرواتب والمستحقات الشهرية', 
        description: 'ملخص كشوف الرواتب للشهر المحدد.', 
        href: '/dashboard/hr/reports/payroll', 
        icon: FileSpreadsheet,
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
    },
    { 
        title: 'السلف والاستقطاعات', 
        description: 'تتبع السلف المالية المقدمة للموظفين.', 
        href: '/dashboard/hr/reports/advances', 
        icon: HandCoins,
        color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300'
    },
    { 
        title: 'تقدير مكافأة نهاية الخدمة', 
        description: 'حساب تقديري لاستحقاقات الموظفين.', 
        href: '/dashboard/hr/reports/gratuity', 
        icon: Calculator,
        color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300'
    },
    { 
        title: 'تكاليف الموظفين الشهرية', 
        description: 'تحليل تكلفة الرواتب والبدلات لكل موظف.', 
        href: '/dashboard/hr/reports/costs',
        icon: Wallet,
        color: 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300'
    },
    { 
        title: 'الاستقالات والانفصال', 
        description: 'سجل تاريخي لحالات إنهاء الخدمة والاستقالات.', 
        href: '/dashboard/hr/reports/separations',
        icon: UserX,
        color: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300'
    },
];

export default function HrReportsDashboard() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>تقارير الموارد البشرية</CardTitle>
            <CardDescription>اختر التقرير الذي ترغب في عرضه من القائمة أدناه.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reportList.map((report) => {
                const Icon = report.icon;
                return (
                    <Link href={report.href} key={report.href} className="group block [perspective:1000px]">
                        <Card className="h-full transition-all duration-300 ease-out [transform-style:preserve-3d] group-hover:shadow-2xl group-hover:[transform:rotateY(-12deg)_rotateX(4deg)]">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className={cn("flex-shrink-0 p-3 rounded-lg", report.color)}>
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-base font-bold">{report.title}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{report.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </CardContent>
    </Card>
  );
}
