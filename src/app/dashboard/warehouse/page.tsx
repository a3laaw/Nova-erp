'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, BarChart3, ArrowUpFromLine, History, Building2, FileCheck, ArrowLeftRight, Ban, ShoppingCart, SearchCode, ShieldCheck, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppTheme } from '@/context/theme-context';

const warehouseFeatures = [
    {
        title: 'دليل الأصناف والخدمات',
        description: 'إدارة وتصنيف المواد المخزنية والخدمات الفنية بأسعارها المرجعية.',
        href: '/dashboard/warehouse/items',
        icon: Package,
        color: 'bg-blue-100 text-blue-600'
    },
    {
        title: 'استلام بضاعة (GRN)',
        description: 'تأكيد وصول المواد من الموردين وتحديث أرصدة المخازن آلياً.',
        href: '/dashboard/warehouse/grns',
        icon: FileCheck,
        color: 'bg-green-100 text-green-600'
    },
    {
        title: 'صرف مواد المشاريع',
        description: 'تحميل تكلفة المواد على بنود المقايسة (BOQ) في المواقع الإنشائية.',
        href: '/dashboard/warehouse/material-issue',
        icon: ArrowUpFromLine,
        color: 'bg-orange-100 text-orange-600'
    },
    {
        title: 'أوامر الشراء (POs)',
        description: 'إنشاء وتتبع أوامر الشراء الرسمية المعتمدة للموردين.',
        href: '/dashboard/purchasing/purchase-orders',
        icon: ShoppingCart,
        color: 'bg-indigo-100 text-indigo-600'
    },
    {
        title: 'التحويلات المخزنية',
        description: 'نقل المواد والعهدة بين المستودعات الرئيسية ومخازن المواقع.',
        href: '/dashboard/warehouse/transfers',
        icon: ArrowLeftRight,
        color: 'bg-cyan-100 text-cyan-600'
    },
    {
        title: 'المردودات والتسويات',
        description: 'معالجة إرجاع المواد للموردين وحالات التلف أو العجز المكتشف.',
        href: '/dashboard/warehouse/adjustments',
        icon: Ban,
        color: 'bg-red-100 text-red-600'
    },
    {
        title: 'تقارير المخزون وذكاء الشراء',
        description: 'تحليل الأرصدة، تاريخ الأسعار، والكفالات النشطة للأصناف.',
        href: '/dashboard/warehouse/reports',
        icon: BarChart3,
        color: 'bg-purple-100 text-purple-600'
    },
    {
        title: 'إدارة المستودعات',
        description: 'تعريف المخازن، عهد المقاولين، ومخازن المواقع التابعة للفروع.',
        href: '/dashboard/warehouse/warehouses',
        icon: Building2,
        color: 'bg-slate-100 text-slate-600'
    },
];

export default function WarehouseDashboardPage() {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';

  return (
    <div className="space-y-8" dir="rtl">
        <Card className={cn(
            "rounded-[2.5rem] border-none shadow-sm overflow-hidden",
            isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-blue-50 shadow-sm"
        )}>
            <CardHeader className="pb-8 px-8 border-b">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                        <Package className="h-8 w-8" />
                    </div>
                    <div>
                        <CardTitle className="text-3xl font-black">المخازن وسلسلة التوريد</CardTitle>
                        <CardDescription className="text-base font-medium">إدارة تدفق المواد، الرقابة على المخزون، وتحميل التكاليف المباشرة على المشاريع.</CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
            {warehouseFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block">
                        <Card className={cn(
                            "h-full border-none shadow-sm rounded-[2rem] hover:shadow-xl hover:-translate-y-1 transition-all duration-300",
                            isGlass ? "bg-white/10 hover:bg-white/20 text-[#1e1b4b]" : "bg-white"
                        )}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                     <div className={cn("flex-shrink-0 p-3 rounded-2xl transition-colors shadow-sm", feature.color)}>
                                        <Icon className="h-6 w-6" />
                                    </div>
                                    <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-all font-black text-[9px] uppercase tracking-tighter">فتح القسم</Badge>
                                </div>
                                <CardTitle className="text-xl font-black mt-4 text-gray-800">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-sm font-medium leading-relaxed">{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
