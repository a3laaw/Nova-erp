'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { Package, Truck, BarChart3, ShoppingCart, Users, FileText as RfqIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const purchasingFeatures = [
    {
        title: 'أوامر الشراء',
        description: 'إنشاء وتتبع أوامر الشراء للموردين.',
        href: '/dashboard/purchasing/purchase-orders',
        icon: ShoppingCart,
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
    },
    {
        title: 'طلبات التسعير (RFQ)',
        description: 'إرسال طلبات تسعير للموردين والمفاضلة بين العروض.',
        href: '/dashboard/purchasing/rfqs',
        icon: RfqIcon,
        color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-300'
    },
    {
        title: 'الأصناف',
        description: 'إدارة وتصنيف جميع أصناف المخزون والخدمات.',
        href: '/dashboard/warehouse/items',
        icon: Package,
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    },
    {
        title: 'التحويلات المخزنية',
        description: 'تحويل الأصناف بين المخازن المختلفة وتتبع الكميات.',
        href: '/dashboard/warehouse/transfers',
        icon: Truck,
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
    },
    {
        title: 'تقارير المخزون',
        description: 'مجموعة شاملة من التقارير لتحليل المخزون.',
        href: '/dashboard/warehouse/reports',
        icon: BarChart3,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
    },
];

export default function PurchasingDashboardPage() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>لوحة معلومات المخازن والمشتريات</CardTitle>
            <CardDescription>نظرة عامة على إدارة المخزون وعمليات الشراء.</CardDescription>
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