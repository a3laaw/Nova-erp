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
    History
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

export default function DashboardPage() {
  const { firestore } = useFirebase();
  const { journalEntries, projects, clients, accounts, loading } = useAnalyticalData();
  const { data: obligations } = useSubscription<RecurringObligation>(firestore, 'recurring_obligations');

  // ✨ رادار السيولة: التحقق من القدرة على تغطية الالتزامات القادمة
  const liquidityAlert = useMemo(() => {
    if (loading || !obligations) return null;

    const bankAccountIds = accounts.filter(a => a.code.startsWith('110103')).map(a => a.id);
    const bankBalance = journalEntries
        .filter(e => e.status === 'posted')
        .flatMap(e => e.lines)
        .filter(l => bankAccountIds.includes(l.accountId))
        .reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);

    const horizon = addDays(new Date(), 2);
    const upcomingObs = obligations.filter(ob => {
        const dueDate = toFirestoreDate(ob.dueDate);
        return ob.status === 'active' && dueDate && dueDate <= horizon;
    });

    const totalUpcoming = upcomingObs.reduce((sum, ob) => sum + ob.amount, 0);
    const isShortfall = bankBalance < totalUpcoming;

    if (upcomingObs.length > 0 && isShortfall) {
        return {
            bankBalance,
            totalUpcoming,
            shortfall: totalUpcoming - bankBalance,
            count: upcomingObs.length
        };
    }
    return null;
  }, [journalEntries, accounts, obligations, loading]);

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
    <div className="space-y-10" dir="rtl">
        {/* الترويسة الرئيسية للنظام */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
            <CardHeader className="pb-8 px-8">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="space-y-1 text-center lg:text-right">
                        <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                            <LayoutGrid className="text-primary h-8 w-8" />
                            لوحة التحكم المركزية
                        </CardTitle>
                        <CardDescription className="text-base font-medium">
                            مرحباً بك مجدداً. إليك نظرة شاملة على أداء الشركة والمشاريع القائمة.
                        </CardDescription>
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2">
                            <Link href="/dashboard/notifications">
                                <History className="h-5 w-5" />
                                سجل التنبيهات
                            </Link>
                        </Button>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                            <Link href="/dashboard/clients/new">
                                <PlusCircle className="h-5 w-5" />
                                إضافة عميل جديد
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        {/* نظام التنبيه الاستباقي لعجز السيولة */}
        {liquidityAlert && (
            <Card className="border-none shadow-2xl bg-gradient-to-br from-red-600 to-red-800 text-white rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-500">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <ShieldAlert className="h-8 w-8 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black tracking-tight">تنبيه عجز سيولة وشيك!</CardTitle>
                                <CardDescription className="text-white/80 font-bold">لديك {liquidityAlert.count} التزامات مستحقة خلال 48 ساعة.</CardDescription>
                            </div>
                        </div>
                        <Badge variant="outline" className="text-white border-white/40 font-black">إدارة المخاطر</Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-4 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-right">
                    <div className="space-y-1">
                        <p className="text-xs uppercase font-bold opacity-70">رصيد البنك الحالي</p>
                        <p className="text-3xl font-black font-mono">{formatCurrency(liquidityAlert.bankBalance)}</p>
                    </div>
                    <div className="h-12 w-px bg-white/20 hidden md:block" />
                    <div className="space-y-1">
                        <p className="text-xs uppercase font-bold opacity-70">المطلوب سداده</p>
                        <p className="text-3xl font-black font-mono">{formatCurrency(liquidityAlert.totalUpcoming)}</p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-3xl border border-white/20">
                        <p className="text-xs font-bold mb-1">العجز المتوقع</p>
                        <p className="text-2xl font-black text-yellow-300 font-mono">{formatCurrency(liquidityAlert.shortfall)}</p>
                    </div>
                    <Button asChild variant="secondary" className="h-12 px-8 rounded-xl font-black text-red-700 hover:bg-white transition-all">
                        <Link href="/dashboard/accounting/recurring">تغطية العجز فوراً</Link>
                    </Button>
                </CardContent>
            </Card>
        )}

        {/* نظام تنبيهات الخلل وسلامة البيانات */}
        <DataAnomalyAlert />

        <div className="grid gap-10 lg:grid-cols-2 xl:grid-cols-3">
            <div className="grid gap-6 md:grid-cols-2 xl:col-span-3">
                <Card className="border-none shadow-sm bg-white rounded-3xl hover-lift">
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
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">بناءً على القيود المرحلة</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl hover-lift">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                            المواقع النشطة
                        </CardTitle>
                        <Briefcase className="h-5 w-5 text-orange-600 opacity-50" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-16" /> : (
                            <div className="text-3xl font-black font-mono text-orange-700">
                                {stats?.activeProjectsCount}
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">مواقع تخضع للإشراف حالياً</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl hover-lift">
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
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">إجمالي الملفات المسجلة</p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-primary text-primary-foreground rounded-3xl">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80 text-white">كشف يوميات المواقع</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm font-bold leading-relaxed mb-4 text-white/90">
                            تابع إنجاز الفرق الميدانية وتوزيع اللوجستيات.
                        </div>
                        <Button asChild variant="secondary" className="w-full font-black rounded-xl h-10">
                            <Link href="/dashboard/construction/field-visits">فتح العرض الهندسي</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid gap-6">
                <PendingVisits />
                <TaskPrioritization />
            </div>

            <div className="grid gap-6 xl:col-span-2">
                <RecentActivity />
            </div>
            
            <div className="grid gap-6 xl:col-span-3">
                <UpcomingAppointments />
            </div>
        </div>
    </div>
  );
}
