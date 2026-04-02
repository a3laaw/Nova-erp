'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    LayoutGrid,
    PlusCircle,
    BellRing,
    Sparkles,
    Wallet,
    Users,
    Activity,
    ClipboardList,
    History
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon, description, colorClass, loading, subText }: any) => (
    <Card className="overflow-hidden border-white/30 bg-white/40 rounded-[2.5rem] hover-lift group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl shadow-inner", colorClass)}>{icon}</div>
                <CardTitle className="text-xs font-black text-slate-500 uppercase tracking-widest">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="pt-2">
            {loading ? <Skeleton className="h-10 w-32" /> : (
                <div className={cn("text-3xl font-black font-mono tracking-tighter", colorClass.includes('purple') ? 'text-[#7209B7]' : 'text-slate-900')}>
                    {typeof value === 'number' ? formatCurrency(value) : value}
                </div>
            )}
            <p className="text-[10px] text-slate-400 mt-1 font-bold">{subText || description}</p>
        </CardContent>
    </Card>
);

export default function DashboardPage() {
  const { journalEntries, projects, clients, loading } = useAnalyticalData();

  const stats = useMemo(() => {
    if (loading || !journalEntries) return null;
    
    // حساب الإيرادات من واقع القيود المرحلة فقط لضمان الصحة المالية
    const totalRevenue = journalEntries
        .filter(e => e.status === 'posted')
        .flatMap(e => e.lines)
        .filter(l => l.accountName?.includes('إيرادات') || l.accountId?.startsWith('4'))
        .reduce((sum, l) => sum + (l.credit || 0), 0);

    const activeProjectsCount = (projects || []).filter(p => p.status === 'قيد التنفيذ').length;
    const totalClientsCount = (clients || []).length;

    return { totalRevenue, activeProjectsCount, totalClientsCount };
  }, [journalEntries, projects, clients, loading]);

  return (
    <div className="space-y-8 p-2 lg:p-4" dir="rtl">
        <Card className="border-white/40 bg-white/40 rounded-[3rem] shadow-sm overflow-hidden">
            <CardContent className="p-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col gap-4 order-2 lg:order-1 items-center lg:items-start">
                        <Button asChild variant="outline" className="h-11 rounded-2xl font-black gap-2 bg-white/60 border-white/80 text-[#1e1b4b] shadow-sm">
                            <Link href="/dashboard/notifications">
                                <BellRing className="h-4 w-4" /> سجل التنبيهات
                            </Link>
                        </Button>
                        <Button asChild className="h-11 px-10 rounded-2xl font-black gap-2 bg-[#7209B7] text-white shadow-xl hover:scale-105 transition-transform border-none">
                            <Link href="/dashboard/clients/new">
                                <PlusCircle className="h-5 w-5" /> إضافة عميل جديد
                            </Link>
                        </Button>
                    </div>

                    <div className="text-center lg:text-right order-1 lg:order-2 space-y-2">
                        <div className="flex items-center justify-center lg:justify-end gap-4 mb-2">
                            <h1 className="text-4xl font-black text-[#1e1b4b] tracking-tighter">لوحة التحكم المركزية</h1>
                            <LayoutGrid className="text-indigo-600 h-10 w-10" strokeWidth={2.5} />
                        </div>
                        <p className="text-lg font-bold text-slate-500 leading-relaxed max-w-xl">
                            مرحباً بك مجدداً. إليك نظرة شاملة على أداء الشركة والمشاريع القائمة.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
                <Card className="h-full border-white/40 bg-white/40 rounded-[3rem] shadow-sm flex flex-col">
                    <CardHeader className="p-8">
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <Sparkles className="text-purple-500 h-5 w-5" /> تنبيهات الأولويات (WBS)
                        </CardTitle>
                        <CardDescription>المهام الميدانية التي تجاوزت جدولها الزمني المخطط.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-40">
                        <ClipboardList className="h-16 w-16 mb-4 text-slate-400" />
                        <p className="font-bold text-slate-500">لا توجد مهام متأخرة حالياً.</p>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-6">
                <StatCard 
                    title="المواقع النشطة" 
                    value={loading ? 0 : stats?.activeProjectsCount || 0} 
                    icon={<Activity className="h-5 w-5" />} 
                    subText="مواقع تخضع للإشراف حالياً"
                    colorClass="bg-orange-50 text-orange-600"
                    loading={loading}
                />
                <StatCard 
                    title="إجمالي الإيرادات" 
                    value={loading ? 0 : stats?.totalRevenue || 0} 
                    icon={<Wallet className="h-5 w-5" />} 
                    subText="بناءً على القيود المرحلة"
                    colorClass="bg-purple-50 text-purple-600"
                    loading={loading}
                />
                
                <Card className="col-span-1 border-white/40 bg-white/40 rounded-[2.5rem] p-6 flex flex-col items-center justify-center text-center gap-4">
                    <div className="space-y-1">
                        <p className="font-black text-sm">كشف يوميات المواقع</p>
                        <p className="text-[10px] text-slate-400 font-bold leading-tight">تابع إنجاز الفرق الميدانية.</p>
                    </div>
                    <Button asChild className="rounded-xl h-9 px-6 bg-[#7209B7] text-white font-black text-[10px]">
                        <Link href="/dashboard/construction/field-visits">فتح العرض الهندسي</Link>
                    </Button>
                </Card>

                <StatCard 
                    title="قاعدة العملاء" 
                    value={loading ? 0 : stats?.totalClientsCount || 0} 
                    icon={<Users className="h-5 w-5" />} 
                    subText="إجمالي الملفات المسجلة"
                    colorClass="bg-indigo-50 text-indigo-600"
                    loading={loading}
                />
            </div>

            <div className="lg:col-span-4">
                <Card className="h-full border-white/40 bg-white/40 rounded-[3rem] shadow-sm flex flex-col">
                    <CardHeader className="p-8 border-b border-white/10">
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <History className="text-indigo-600 h-5 w-5" /> آخر النشاطات
                        </CardTitle>
                        <CardDescription>متابعة حية للإجراءات المتخذة في النظام.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 flex-1 flex items-center justify-center opacity-30">
                        <p className="font-bold italic">جاري جلب آخر التحديثات...</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
