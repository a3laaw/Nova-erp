'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Package, BarChart3, ArrowUpFromLine, Building2, FileCheck, ArrowLeftRight, Ban, ShoppingCart, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const warehouseFeatures = [
    {
        title: 'دليل الأصناف',
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
        title: 'تقارير المخزون',
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
  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
            <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
            <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">المخازن وسلسلة التوريد</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">إدارة تدفق المواد، الرقابة على المخزون، وتحميل التكاليف المباشرة على المشاريع.</CardDescription>
                            </div>
                        </div>
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <Package className="h-10 w-10 text-white" />
                        </div>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
            {warehouseFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                    <Link href={feature.href} key={feature.href} className="group block h-full">
                        <Card className="h-full border-none shadow-xl rounded-[2.5rem] hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 bg-white">
                            <CardHeader className="pb-4 p-8">
                                <div className="flex items-start justify-between">
                                     <div className={cn("flex-shrink-0 p-4 rounded-2xl transition-all shadow-inner group-hover:scale-110", feature.color)}>
                                        <Icon className="h-8 w-8" />
                                    </div>
                                    <Badge variant="outline" className="opacity-0 group-hover:opacity-100 transition-all font-black text-[10px] uppercase tracking-tighter border-primary/20 text-primary">فتح القسم</Badge>
                                </div>
                                <CardTitle className="text-2xl font-black mt-8 text-slate-900 tracking-tight">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-8 pb-8">
                                <CardDescription className="text-sm font-bold text-slate-500 leading-relaxed min-h-[48px]">{feature.description}</CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                );
            })}
        </div>
    </div>
  );
}
