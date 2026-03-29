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
    ChevronLeft,
    ShieldCheck,
    Banknote
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { PendingVisits } from '@/components/dashboard/pending-visits';
import { DataAnomalyAlert } from '@/components/dashboard/data-anomaly-alert';
import { TaskPrioritization } from '@/components/dashboard/task-prioritization';
import { Skeleton } from '@/components/ui/skeleton';

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
        {/* --- Cosmic Header Banner --- */}
        <Card className="glass-effect neon-glow-purple border-white/10 rounded-[3rem] overflow-hidden">
            <CardContent className="p-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex flex-col gap-4 order-2 lg:order-1 items-center lg:items-start">
                        <Button asChild variant="outline" className="h-11 rounded-2xl font-black gap-2 bg-white/5 border-white/20 text-white shadow-lg hover:bg-white/10">
                            <Link href="/dashboard/notifications" className="flex items-center gap-2">
                                <BellRing className="h-4 w-4" /> سجل التنبيهات
                            </Link>
                        </Button>
                        <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-[#7209B7] text-white shadow-[0_0_30px_rgba(114,9,183,0.4)] hover:scale-105 transition-transform border-none">
                            <Link href="/dashboard/clients/new" className="flex items-center gap-2">
                                <PlusCircle className="h-5 w-5" /> إضافة عميل جديد
                            </Link>
                        </Button>
                    </div>

                    <div className="text-center lg:text-right order-1 lg:order-2 space-y-2">
                        <div className="flex items-center justify-center lg:justify-end gap-4 mb-2">
                            <h1 className="text-4xl font-black text-white tracking-tighter">لوحة التحكم المركزية</h1>
                            <div className="p-2.5 bg-primary/20 rounded-2xl neon-glow-blue border-none">
                                <LayoutGrid className="text-primary h-8 w-8" />
                            </div>
                        </div>
                        <p className="text-lg font-bold text-white/60 leading-relaxed max-w-xl">
                            مرحباً بك في المحرك السيادي. نراقب أداء المنشأة والمشاريع بدقة مجهرية.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <DataAnomalyAlert />

        <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* --- Left Column --- */}
            <div className="lg:col-span-4 space-y-8">
                <TaskPrioritization />
                <PendingVisits />
            </div>

            {/* --- Center Column: Neon Stats --- */}
            <div className="lg:col-span-4 space-y-8">
                <div className="grid grid-cols-1 gap-6">
                    {/* Active Projects - Blue Glow */}
                    <Card className="glass-effect neon-glow-blue rounded-[2.5rem] p-8 group hover-lift border-none">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner group-hover:scale-110 transition-transform">
                                <Briefcase className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">المواقع النشطة</p>
                                <div className="text-4xl font-black font-mono text-white mt-1">{loading ? '...' : stats?.activeProjectsCount}</div>
                                <p className="text-[10px] text-primary font-bold mt-1">مواقع تحت التنفيذ حالياً</p>
                            </div>
                        </div>
                    </Card>

                    {/* Revenue - Purple Glow */}
                    <Card className="glass-effect neon-glow-purple rounded-[2.5rem] p-8 group hover-lift border-none">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-[#7209B7]/20 rounded-2xl text-[#d8b4fe] shadow-inner group-hover:scale-110 transition-transform">
                                <CircleDollarSign className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">التدفقات النقدية</p>
                                <div className="text-3xl font-black font-mono ice-blue-text mt-1">{loading ? '...' : formatCurrency(stats?.totalRevenue || 0)}</div>
                                <p className="text-[10px] text-purple-300/60 font-bold mt-1">بناءً على القيود المرحلة</p>
                            </div>
                        </div>
                    </Card>

                    {/* Clients - Blue Glow */}
                    <Card className="glass-effect neon-glow-blue rounded-[2.5rem] p-8 group hover-lift border-none">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-inner group-hover:scale-110 transition-transform">
                                <Users className="h-6 w-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">قاعدة البيانات</p>
                                <div className="text-4xl font-black font-mono text-white mt-1">{loading ? '...' : stats?.totalClientsCount}</div>
                                <p className="text-[10px] text-primary font-bold mt-1">إجمالي الملفات السيادية</p>
                            </div>
                        </div>
                    </Card>

                    {/* Logistics CTA */}
                    <Card className="bg-gradient-to-br from-[#1e3a8a] to-[#581c87] text-white rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/10 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-16 translate-x-16 blur-3xl" />
                        <div className="relative z-10 space-y-4">
                            <div className="text-center space-y-1">
                                <h4 className="text-lg font-black tracking-tight flex items-center justify-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" /> الرقابة الميدانية
                                </h4>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Real-time Logistics Engine</p>
                            </div>
                            <Button asChild className="w-full h-12 rounded-2xl font-black bg-white text-[#1e1b4b] hover:bg-white/90 shadow-xl transition-all border-none">
                                <Link href="/dashboard/construction/field-visits" className="flex items-center justify-center gap-2">
                                    <span>فتح خريطة العمليات</span>
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>

            {/* --- Right Column --- */}
            <div className="lg:col-span-4 space-y-8">
                <UpcomingAppointments />
                <RecentActivity />
            </div>
        </div>
    </div>
  );
}
