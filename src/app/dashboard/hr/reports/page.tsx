'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { FileBarChart, Sparkles, Users, CalendarX, Wallet, UserX, Clock, ClipboardList, Briefcase, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const reportList = [
    { title: 'الإحصائيات العامة', description: 'نظرة شاملة على أرقام القوى العاملة والانضباط العام.', href: '/dashboard/hr/reports/general-stats', icon: Activity, color: 'bg-blue-100 text-blue-600' },
    { title: 'تقرير الموظفين العام', description: 'كشف بجميع الموظفين مع فلاتر النوع، القسم والدوام.', href: '/dashboard/hr/reports/general', icon: Users, color: 'bg-indigo-100 text-indigo-600' },
    { title: 'ملف المتغيرات (Dossier)', description: 'السجل التاريخي الكامل لحركات الموظف الإدارية والمالية.', href: '/dashboard/hr/reports/employee-dossier', icon: ClipboardList, color: 'bg-slate-100 text-slate-800' },
    { title: 'ميزان أرصدة الإجازات', description: 'متابعة رصيد الـ 30 يوماً وتوقعات نفاد الأرصدة.', href: '/dashboard/hr/reports/leave-balance', icon: CalendarX, color: 'bg-orange-100 text-orange-600' },
    { title: 'تحليل تكاليف الرواتب', description: 'بيان المصروفات الشهرية والسنوية مجمعة حسب الأقسام.', href: '/dashboard/hr/reports/costs', icon: Wallet, color: 'bg-green-100 text-green-600' },
    { title: 'تقدير نهاية الخدمة', description: 'حساب مخصصات نهاية الخدمة (Indemnity) والالتزامات القائمة.', href: '/dashboard/hr/reports/gratuity', icon: Briefcase, color: 'bg-purple-100 text-purple-600' },
];

export default function HrReportsDashboard() {
  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
            <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
            <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">لوحة تقارير الموارد البشرية</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">تحليلات شاملة للحضور، التكاليف، والأرصدة لضمان كفاءة القوى العاملة.</CardDescription>
                            </div>
                        </div>
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <FileBarChart className="h-10 w-10 text-white" />
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
            <CardContent className="pt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10">
                {reportList.map((report, idx) => {
                    const Icon = report.icon;
                    return (
                        <Link href={report.href} key={idx} className="group block">
                            <Card className="h-full border-none shadow-xl rounded-[2.5rem] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 bg-white">
                                <CardHeader className="pb-4 p-8">
                                    <div className="flex items-start justify-between">
                                         <div className={cn("flex-shrink-0 p-4 rounded-2xl transition-all shadow-inner group-hover:scale-110", report.color)}>
                                            <Icon className="h-8 w-8" />
                                        </div>
                                    </div>
                                    <CardTitle className="text-2xl font-black mt-8 text-slate-900 tracking-tight group-hover:text-primary transition-colors">{report.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="px-8 pb-8">
                                    <CardDescription className="text-sm font-bold text-slate-500 leading-relaxed min-h-[48px]">{report.description}</CardDescription>
                                </CardContent>
                            </Card>
                        </Link>
                    )
                })}
            </CardContent>
        </Card>
    </div>
  );
}