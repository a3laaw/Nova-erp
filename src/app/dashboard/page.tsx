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
    ShieldAlert,
    BellRing,
    BarChart3,
    ArrowUpRight
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { useSubscription, useFirebase } from '@/firebase';
import { formatCurrency, cn } from '@/lib/utils';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { UpcomingAppointments } from '@/components/dashboard/upcoming-appointments';
import { PendingVisits } from '@/components/dashboard/pending-visits';
import { DataAnomalyAlert } from '@/components/dashboard/data-anomaly-alert';
import { TaskPrioritization } from '@/components/dashboard/task-prioritization';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { RecurringObligation } from '@/lib/types';
import { addDays } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

const StatCard = ({ title, value, icon, description, loading, colorClass }: any) => (
    <Card className="hover-lift border-white/40">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black text-[#1e1b4b]/60 uppercase tracking-widest">{title}</CardTitle>
            <div className={cn("p-2 rounded-xl bg-white/30 border border-white/40", colorClass)}>{icon}</div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-3xl font-black font-mono tracking-tighter text-[#1e1b4b]">{value}</div>}
            <p className="text-[10px] text-[#1e1b4b]/50 mt-1 font-bold">{description}</p>
        </CardContent>
    </Card>
);

export default function DashboardPage() {
  const { firestore } = useFirebase();
  const { journalEntries, projects, clients, accounts, loading } = useAnalyticalData();
  const { data: obligations } = useSubscription<RecurringObligation>(firestore, 'recurring_obligations');

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
    <div className="space-y-10 p-2 lg:p-6" dir="rtl">
        {/* Header Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center lg:text-right">
                <h1 className="text-4xl font-black flex items-center justify-center lg:justify-start gap-3 text-[#1e1b4b] tracking-tighter">
                    <LayoutGrid className="text-primary h-9 w-9" />
                    لوحة التحكم المركزية
                </h1>
                <p className="text-base font-bold text-[#1e1b4b]/60">مرحباً بك مجدداً. إليك نظرة شاملة على أداء المنشأة.</p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild variant="outline" className="h-12 px-8 rounded-2xl font-black gap-2 bg-white/40 border-white/60 text-[#1e1b4b]">
                    <Link href="/dashboard/notifications"><BellRing className="h-5 w-5" /> التنبيهات</Link>
                </Button>
                <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 shadow-2xl bg-primary text-white">
                    <Link href="/dashboard/clients/new"><PlusCircle className="h-5 w-5" /> إضافة عميل جديد</Link>
                </Button>
            </div>
        </div>

        <DataAnomalyAlert />

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <StatCard 
                title="إجمالي التدفقات" 
                value={formatCurrency(stats?.totalRevenue || 0)} 
                icon={<CircleDollarSign className="h-5 w-5" />} 
                description="إيرادات العقود المرحلة"
                loading={loading}
                colorClass="text-green-600"
            />
            <StatCard 
                title="المواقع النشطة" 
                value={stats?.activeProjectsCount || 0} 
                icon={<Briefcase className="h-5 w-5" />} 
                description="مشاريع قيد التنفيذ الميداني"
                loading={loading}
                colorClass="text-blue-600"
            />
            <StatCard 
                title="قاعدة العملاء" 
                value={stats?.totalClientsCount || 0} 
                icon={<Users className="h-5 w-5" />} 
                description="إجمالي الملفات المسجلة"
                loading={loading}
                colorClass="text-purple-600"
            />
        </div>

        <div className="grid gap-10 lg:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-8 xl:col-span-2">
                <RecentActivity />
                <UpcomingAppointments />
            </div>
            <div className="grid gap-8">
                <Card className="border-none shadow-xl bg-primary text-white rounded-[2.5rem] overflow-hidden group">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-black text-white/90">يوميات المواقع</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm font-bold text-white/70 mb-6 leading-relaxed">تابع إنجاز الفرق الميدانية وتوزيع اللوجستيات في المواقع النشطة.</p>
                        <Button asChild variant="secondary" className="w-full h-12 rounded-2xl font-black bg-white/20 hover:bg-white/30 text-white border border-white/30">
                            <Link href="/dashboard/construction/field-visits" className="gap-2">فتح العرض الهندسي <ArrowUpRight className="h-4 w-4"/></Link>
                        </Button>
                    </CardContent>
                </Card>
                <PendingVisits />
                <TaskPrioritization />
            </div>
        </div>
    </div>
  );
}
