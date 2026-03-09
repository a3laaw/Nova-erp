'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, History, BarChart3, TrendingDown, TrendingUp, DollarSign, ShieldCheck, AlertTriangle, SearchCode } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6" dir="rtl">
        <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-purple-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                        <BarChart3 className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-black">تقارير المخزون وذكاء المشتريات</CardTitle>
                        <CardDescription className="text-base font-medium">تحليلات مفصلة عن حركة المواد، الكفالات، والأسعار المرجعية للموردين.</CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardContent className="pt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportList.map((report) => {
                    const Icon = report.icon;
                    return (
                        <Link href={report.href} key={report.href} className="group block">
                            <Card className="h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 border-transparent hover:border-primary/10 bg-slate-50/50">
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        <div className={cn("flex-shrink-0 p-3 rounded-xl shadow-sm", report.color)}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <CardTitle className="text-base font-black">{report.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="font-medium text-xs leading-relaxed">{report.description}</CardDescription>
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
