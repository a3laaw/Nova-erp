
'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
    Briefcase,
    Users,
    CircleDollarSign,
    TrendingUp,
    LayoutGrid
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

  // حساب الإحصائيات الحقيقية من محرك البيانات
  const stats = useMemo(() => {
    if (loading) return null;

    // 1. حساب إجمالي الإيرادات (من حسابات الفئة 4 - المرحلة)
    const totalRevenue = journalEntries
        .filter(e => e.status === 'posted')
        .flatMap(e => e.lines)
        .filter(l => l.accountId && l.credit > 0 && l.accountName?.includes('إيرادات')) // تبسيط للـ MVP
        .reduce((sum, l) => sum + l.credit, 0);

    // 2. عدد المشاريع النشطة فعلياً
    const activeProjectsCount = projects.filter(p => p.status === 'قيد التنفيذ').length;

    // 3. إجمالي العملاء المسجلين
    const totalClientsCount = clients.length;

    return {
        totalRevenue,
        activeProjectsCount,
        totalClientsCount
    };
  }, [journalEntries, projects, clients, loading]);

  return (
    <div className="space-y-6" dir="rtl">
        {/* نظام تنبيهات الخلل وسلامة البيانات */}
        <DataAnomalyAlert />

        <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-4 md:grid-cols-2 xl:col-span-3">
                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-blue-50/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            إجمالي التدفقات الداخلة
                        </CardTitle>
                        <CircleDollarSign className="h-5 w-5 text-primary opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-32" /> : (
                            <div className="text-3xl font-black font-mono text-primary">
                                {formatCurrency(stats?.totalRevenue || 0)}
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">
                            بناءً على القيود المرحلة في النظام
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-gradient-to-br from-white to-orange-50/50">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            المواقع النشطة (قيد التنفيذ)
                        </CardTitle>
                        <Briefcase className="h-5 w-5 text-orange-600 opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : (
                            <div className="text-3xl font-black font-mono text-orange-700">
                                {stats?.activeProjectsCount}
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">
                            مواقع تخضع للإشراف واللوجستيات حالياً
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">قاعدة بيانات العملاء</CardTitle>
                        <Users className="h-5 w-5 text-muted-foreground opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : (
                            <div className="text-3xl font-black font-mono">
                                {stats?.totalClientsCount}
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">
                            إجمالي الملفات المسجلة في النظام
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold opacity-80">كشف يوميات المواقع</CardTitle>
                        <LayoutGrid className="h-5 w-5 opacity-50" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-bold leading-relaxed mb-4">
                            تابع إنجاز الفرق الميدانية وتوزيع اللوجستيات.
                        </div>
                        <Button asChild variant="secondary" className="w-full font-black rounded-xl">
                            <Link href="/dashboard/construction/field-visits">فتح العرض الهندسي</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-4">
                <PendingVisits />
                <TaskPrioritization />
            </div>

            <div className="grid gap-4 xl:col-span-2">
                <RecentActivity />
            </div>
            
            <div className="grid gap-4 xl:col-span-3">
                <UpcomingAppointments />
            </div>
        </div>
    </div>
  );
}
