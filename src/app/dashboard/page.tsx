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
    Briefcase,
    Users,
    CircleDollarSign,
    TrendingUp,
    LayoutGrid,
    PlusCircle,
    BellRing,
    ArrowUpRight,
    Sparkles,
    Calendar,
    ChevronLeft
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { PendingVisits } from '@/components/dashboard/pending-visits';
import { DataAnomalyAlert } from '@/components/dashboard/data-anomaly-alert';
import { TaskPrioritization } from '@/components/dashboard/task-prioritization';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * لوحة التحكم المركزية - النمط الزجاجي السيادي المحدث.
 * تم إعادة توزيع العناصر لتطابق المخطط البصري المطلوب.
 */
export default function DashboardPage() {
  const { journalEntries, projects, clients, loading } = useAnalyticalData();

  const stats = useMemo(() => {
    if (loading) return null;
    const totalRevenue = journalEntries
        .filter(e => e.status === 'posted')
        .flatMap(e => e.lines)
        .filter(l => l.accountId && l.credit > 0 && l.accountName?.includes('إيرادات'))
        .reduce((sum, l) => sum + l.credit, 0);
    const activeProjectsCount = projects.filter(p => p.status === 'قيد التنفيذ').length;
    const totalClientsCount = clients.length;
    return { totalRevenue, activeProjectsCount, totalClientsCount };
  }, [journalEntries, projects, clients, loading]);

  return (
    <div className="space-y-8 p-2 lg:p-4" dir="rtl">
        {/* --- Header Banner --- */}
        <Card className="glass-effect border-white/40 rounded-[3rem] overflow-hidden">
            <CardContent className="p-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col gap-4 order-2 lg:order-1 items-center lg:items-start">
                        <Button asChild variant="outline" className="h-11 rounded-2xl font-black gap-2 bg-white/40 border-white/60 text-[#1e1b4b] shadow-lg">
                            <Link href="/dashboard/notifications"><BellRing className="h-4 w-4" /> سجل التنبيهات</Link>
                        </Button>
                        <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-[#7209B7] text-white shadow-2xl hover:scale-105 transition-transform border-b-4 border-black/20">
                            <Link href="/dashboard/clients/new"><PlusCircle className="h-5 w-5" /> إضافة عميل جديد</Link>
                        </Button>
                    </div>

                    <div className="text-center lg:text-right order-1 lg:order-2 space-y-2">
                        <div className="flex items-center justify-center lg:justify-end gap-4 mb-2">
                            <h1 className="text-4xl font-black text-[#1e1b4b] tracking-tighter">لوحة التحكم المركزية</h1>
                            <div className="p-2.5 bg-primary/10 rounded-2xl">
                                <LayoutGrid className="text-primary h-8 w-8" />
                            </div>
                        </div>
                        <p className="text-lg font-bold text-[#1e1b4b]/60 leading-relaxed">
                            مرحباً بك مجدداً. إليك نظرة شاملة على أداء الشركة والمشاريع القائمة.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <DataAnomalyAlert />

        <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* --- Left Column: Tasks & Pnl --- */}
            <div className="lg:col-span-4 space-y-8">
                <TaskPrioritization />
                <PendingVisits />
            </div>

            {/* --- Center Column: Main Stats --- */}
            <div className="lg:col-span-4 space-y-8">
                <div className="grid grid-cols-1 gap-6">
                    {/* Active Projects Stat */}
                    <Card className="glass-effect rounded-[2.5rem] p-8 border-white/40 shadow-xl group hover-lift">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-orange-100 rounded-2xl text-orange-600 shadow-inner group-hover:scale-110 transition-transform">
                                <Briefcase className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">المواقع النشطة</p>
                                <div className="text-4xl font-black font-mono text-[#1e1b4b] mt-1">{loading ? '...' : stats?.activeProjectsCount}</div>
                                <p className="text-[10px] text-orange-600 font-bold mt-1">مواقع تخضع للإشراف حالياً</p>
                            </div>
                        </div>
                    </Card>

                    {/* Revenue Stat */}
                    <Card className="glass-effect rounded-[2.5rem] p-8 border-white/40 shadow-xl group hover-lift">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-purple-100 rounded-2xl text-purple-600 shadow-inner group-hover:scale-110 transition-transform">
                                <CircleDollarSign className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">إجمالي التدفقات الداخلة</p>
                                <div className="text-3xl font-black font-mono text-primary mt-1">{loading ? '...' : formatCurrency(stats?.totalRevenue || 0)}</div>
                                <p className="text-[10px] text-muted-foreground font-bold mt-1">بناءً على القيود المرحلة</p>
                            </div>
                        </div>
                    </Card>

                    {/* Clients Stat */}
                    <Card className="glass-effect rounded-[2.5rem] p-8 border-white/40 shadow-xl group hover-lift">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
                                <Users className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">قاعدة بيانات العملاء</p>
                                <div className="text-4xl font-black font-mono text-[#1e1b4b] mt-1">{loading ? '...' : stats?.totalClientsCount}</div>
                                <p className="text-[10px] text-muted-foreground font-bold mt-1">إجمالي الملفات المسجلة</p>
                            </div>
                        </div>
                    </Card>

                    {/* Logistics CTA */}
                    <Card className="bg-[#7209B7] text-white rounded-[2.5rem] p-8 shadow-2xl border-none group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 blur-3xl" />
                        <div className="relative z-10 space-y-4">
                            <div className="text-center space-y-1">
                                <h4 className="text-lg font-black tracking-tight">كشف يوميات المواقع</h4>
                                <p className="text-xs font-bold text-white/70">تابع إنجاز الفرق الميدانية وتوزيع اللوجستيات.</p>
                            </div>
                            <Button asChild className="w-full h-12 rounded-2xl font-black bg-white text-[#7209B7] hover:bg-white/90 shadow-xl transition-all">
                                <Link href="/dashboard/construction/field-visits">فتح العرض الهندسي</Link>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- Right Column: Activity & Appointments --- */}
            <div className="lg:col-span-4 space-y-8">
                <UpcomingAppointments />
                <RecentActivity />
            </div>
        </div>
    </div>
  );
}