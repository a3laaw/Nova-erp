
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Users, CalendarCheck, UserCheck, FileSpreadsheet, HandCoins, Calculator, Wallet, UserX, BarChart3, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

const reportList = [
    { 
        title: 'الإحصائيات العامة', 
        description: 'نظرة عامة سريعة على أهم مؤشرات أداء الموارد البشرية.', 
        href: '/dashboard/hr/reports/general-stats', 
        icon: BarChart3,
        color: 'bg-teal-100 text-teal-600'
    },
    { 
        title: 'تقرير الموظفين العام', 
        description: 'عرض بيانات الموظفين مع فلاتر متقدمة.', 
        href: '/dashboard/hr/reports/general', 
        icon: Users,
        color: 'bg-blue-100 text-blue-600'
    },
    { 
        title: 'أرصدة إجازات الموظفين', 
        description: 'عرض تفصيلي لأرصدة الإجازات السنوية.', 
        href: '/dashboard/hr/reports/leave-balance', 
        icon: CalendarCheck,
        color: 'bg-green-100 text-green-600'
    },
    { 
        title: 'الحضور والغياب الشهري', 
        description: 'ملخص الحضور والغياب للموظفين.', 
        href: '/dashboard/hr/reports/attendance', 
        icon: UserCheck,
        color: 'bg-indigo-100 text-indigo-600'
    },
    { 
        title: 'الرواتب والمستحقات الشهرية', 
        description: 'ملخص كشوف الرواتب للشهر المحدد.', 
        href: '/dashboard/hr/reports/payroll', 
        icon: FileSpreadsheet,
        color: 'bg-purple-100 text-purple-600'
    },
    { 
        title: 'حاسبة نهاية الخدمة (قانون العمل)', 
        description: 'أداة حساب دقيقة للمستحقات مع معالجة فترات الإنذار.', 
        href: '/dashboard/hr/gratuity-calculator', 
        icon: Calculator,
        color: 'bg-cyan-100 text-cyan-600'
    },
    { 
        title: 'السلف والاستقطاعات', 
        description: 'تتبع السلف المالية المقدمة للموظفين.', 
        href: '/dashboard/hr/reports/advances', 
        icon: HandCoins,
        color: 'bg-amber-100 text-amber-600'
    },
    { 
        title: 'التكاليف والمصروفات السنوية', 
        description: 'تحليل سنوي لتكاليف الرواتب والبدلات والمستحقات.', 
        href: '/dashboard/hr/reports/costs',
        icon: Wallet,
        color: 'bg-pink-100 text-pink-600'
    },
];

export default function HrReportsDashboard() {
  return (
    <div className="space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-pink-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-pink-600/10 rounded-2xl text-pink-600 shadow-inner">
                        <FileBarChart className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black">لوحة تقارير الموارد البشرية</CardTitle>
                        <CardDescription className="text-base font-medium">
                            تحليلات شاملة للحضور، التكاليف، والأرصدة لضمان كفاءة القوى العاملة.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {reportList.map((report) => {
                    const Icon = report.icon;
                    return (
                        <Link href={report.href} key={report.href} className="group block">
                            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 border-transparent hover:border-primary/10">
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <div className={cn("flex-shrink-0 p-3 rounded-xl", report.color)}>
                                            <Icon className="h-7 w-7" />
                                        </div>
                                        <CardTitle className="text-base font-black">{report.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="font-medium text-sm">{report.description}</CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </CardContent>
        </Card>
    </div>
  );
}
