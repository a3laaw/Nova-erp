'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, History, BarChart3, TrendingDown, TrendingUp, DollarSign, ShieldCheck, AlertTriangle, SearchCode, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppTheme } from '@/context/theme-context';

const reportList = [
    { title: 'أرصدة الأصناف', description: 'عرض الكميات الحالية لكل صنف في المخازن.', href: '/dashboard/warehouse/reports/balances', icon: Package, color: 'bg-blue-100 text-blue-600' },
    { title: 'كشاف الأسعار التاريخي', description: 'البحث عن صنف وعرض أرشيف أسعاره من كافة الموردين.', href: '/dashboard/purchasing/reports/price-history', icon: SearchCode, color: 'bg-green-100 text-green-600' },
    { title: 'سجل الكفالات النشطة', description: 'متابعة كفالات الأصناف المباعة أو المصروفة للمواقع.', href: '/dashboard/warehouse/reports/warranties', icon: ShieldCheck, color: 'bg-sky-100 text-sky-600' },
    { title: 'بطاقة الصنف (حركة الصنف)', description: 'تتبع تاريخ كل صنف من شراء وبيع ومرتجع.', href: '/dashboard/warehouse/reports/item-movement', icon: History, color: 'bg-purple-100 text-purple-600' },
    { title: 'تقرير التوالف والخسائر', description: 'تحليل المواد التالفة والمفقودة وأثرها المالي.', href: '/dashboard/warehouse/reports/losses', icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
    { title: 'تقرير تكلفة الأصناف', description: 'عرض أسعار الشراء والبيع لكل صنف.', href: '/dashboard/warehouse/reports/item-cost', icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { title: 'الأصناف الراكدة', description: 'الأصناف التي لم تحدث عليها أي حركة لفترة طويلة.', href: '/dashboard/warehouse/reports/stagnant-items', icon: TrendingDown, color: 'bg-yellow-100 text-yellow-600' },
    { title: 'الأصناف الأكثر مبيعاً', description: 'عرض الأصناف الأكثر مبيعاً خلال فترة محددة.', href: '/dashboard/warehouse/reports/best-sellers', icon: TrendingUp, color: 'bg-teal-100 text-teal-600' },
];

export default function InventoryReportsPage() {
  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر الرئيسي السيادي المحدث بالهوية البرتقالية 🛡️ */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
            <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
            <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">تقارير المخزون وذكاء المشتريات</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">تحليلات مفصلة عن حركة المواد، الكفالات، والأسعار المرجعية للموردين.</CardDescription>
                            </div>
                        </div>
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <BarChart3 className="h-10 w-10 text-white" />
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