'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, Truck, BarChart3, ShoppingCart, TrendingUp, FileText as RfqIcon, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const purchasingFeatures = [
    {
        title: 'أوامر الشراء',
        description: 'إنشاء وتتبع أوامر الشراء للموردين.',
        href: '/dashboard/purchasing/purchase-orders',
        icon: ShoppingCart,
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-teal-300'
    },
    {
        title: 'طلبات التسعير (RFQ)',
        description: 'إرسال طلبات تسعير للموردين والمفاضلة بين العروض.',
        href: '/dashboard/purchasing/rfqs',
        icon: RfqIcon,
        color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300'
    },
    {
        title: 'تاريخ أسعار الموردين',
        description: 'مراقبة تذبذب أسعار الأصناف بناءً على عروض الأسعار السابقة.',
        href: '/dashboard/purchasing/reports/price-history',
        icon: History,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
    },
    {
        title: 'الأصناف',
        description: 'إدارة وتصنيف جميع أصناف المخزون والخدمات.',
        href: '/dashboard/warehouse/items',
        icon: Package,
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    },
    {
        title: 'الموردون',
        description: 'إدارة قائمة الشركات الموردة وبيانات الاتصال.',
        href: '/dashboard/purchasing/vendors',
        icon: Users,
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
    },
    {
        title: 'تقارير المشتريات',
        description: 'تحليل المشتريات والمصاريف خلال الفترات المختلفة.',
        href: '/dashboard/warehouse/reports',
        icon: BarChart3,
        color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300'
    },
];

import { Users } from 'lucide-react';

export default function PurchasingDashboardPage() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>لوحة معلومات المخازن والمشتريات</CardTitle>
            <CardDescription>نظرة عامة على إدارة المخزون وعمليات الشراء والتحليل المالي.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {purchasingFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block [perspective:1000px]">
                        <Card className="h-full transition-all duration-300 ease-out [transform-style:preserve-3d] group-hover:shadow-2xl group-hover:-translate-y-2">
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className={cn("flex-shrink-0 p-3 rounded-lg", feature.color)}>
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <CardTitle className="text-base font-bold">{feature.title}</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </CardContent>
    </Card>
  );
}