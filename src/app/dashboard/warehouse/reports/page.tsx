'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, History, BarChart3, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

const reportList = [
    { title: 'أرصدة الأصناف', description: 'عرض الكميات الحالية لكل صنف في المخازن.', href: '/dashboard/warehouse/reports/balances', icon: Package, color: 'bg-blue-100 text-blue-600' },
    { title: 'بطاقة الصنف (حركة الصنف)', description: 'تتبع تاريخ كل صنف من شراء وبيع ومرتجع.', href: '/dashboard/warehouse/reports/item-movement', icon: History, color: 'bg-purple-100 text-purple-600' },
    { title: 'تقرير تكلفة الأصناف', description: 'عرض أسعار الشراء والبيع لكل صنف.', href: '/dashboard/warehouse/reports/item-cost', icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { title: 'الأصناف الراكدة', description: 'الأصناف التي لم تحدث عليها أي حركة لفترة طويلة.', href: '/dashboard/warehouse/reports/stagnant-items', icon: TrendingDown, color: 'bg-yellow-100 text-yellow-600' },
    { title: 'الأصناف الأكثر مبيعاً', description: 'عرض الأصناف الأكثر مبيعاً خلال فترة محددة.', href: '/dashboard/warehouse/reports/best-sellers', icon: TrendingUp, color: 'bg-teal-100 text-teal-600' },
];

export default function InventoryReportsPage() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>تقارير المخزون</CardTitle>
            <CardDescription>اختر التقرير المطلوب لعرض تحليلات مفصلة عن المخزون.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reportList.map((report) => {
                const Icon = report.icon;
                return (
                    <Link href={report.href} key={report.href} className="group block">
                        <Card className="h-full hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className={cn("flex-shrink-0 p-3 rounded-lg", report.color)}>
                                        <Icon className="h-6 w-6" />
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
