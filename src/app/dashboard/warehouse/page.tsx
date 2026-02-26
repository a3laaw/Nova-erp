
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, Truck, BarChart3, ShoppingCart, Users, FileText as RfqIcon, ArrowUpFromLine, History, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const warehouseFeatures = [
    {
        title: 'إدارة المستودعات',
        description: 'تعريف المخازن الرئيسية ومخازن المواقع التابعة للمشاريع.',
        href: '/dashboard/warehouse/warehouses',
        icon: Building2,
        color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300'
    },
    {
        title: 'إدارة الأصناف',
        description: 'إضافة وتعديل ومتابعة جميع الأصناف في المخزون.',
        href: '/dashboard/warehouse/items',
        icon: Package,
        color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
    },
    {
        title: 'صرف مواد للمشاريع',
        description: 'إذن صرف مواد ذكي مرتبط ببنود المقايسة (BOQ) وتصنيفات المواد.',
        href: '/dashboard/warehouse/material-issue',
        icon: ArrowUpFromLine,
        color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300'
    },
    {
        title: 'أرصدة افتتاحية',
        description: 'إدخال الكميات الأولية عند بدء استخدام النظام.',
        href: '/dashboard/warehouse/opening-balances',
        icon: History,
        color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300'
    },
    {
        title: 'تقارير المخزون',
        description: 'مجموعة شاملة من التقارير لتحليل المخزون.',
        href: '/dashboard/warehouse/reports',
        icon: BarChart3,
        color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300'
    },
];

export default function WarehouseDashboardPage() {
  return (
    <Card dir="rtl">
        <CardHeader>
            <CardTitle>لوحة معلومات المخازن والمشتريات</CardTitle>
            <CardDescription>إدارة المخزون، التوريدات، وصرف المواد للمشاريع (مراكز التكلفة).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {warehouseFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block [perspective:1000px]">
                        <Card className="h-full transition-all duration-300 ease-out [transform-style:preserve-3d] group-hover:shadow-2xl group-hover:[transform:rotateY(-10deg)_rotateX(2deg)]">
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
