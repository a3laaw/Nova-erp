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
    Wallet,
    Users,
    Activity,
    History,
    CheckCircle2,
    Clock,
    ListTodo,
    Sparkles
} from 'lucide-react';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { useFirebase, useSubscription } from '@/firebase';
import { useAuth } from '@/context/auth-context';
import { where, orderBy, limit } from 'firebase/firestore';
import { formatCurrency, cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { UserProductivityItem } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

/**
 * مكون بطاقة الإحصائيات: تم تحديثه ليدعم التمييز بين المبالغ المالية والأعداد المجردة.
 */
const StatCard = ({ title, value, icon, description, colorClass, loading, subText, isCurrency = true }: any) => (
    <Card className="overflow-hidden border-white/30 bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] hover-lift group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl shadow-inner", colorClass)}>{icon}</div>
                <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-10 w-32 mt-1" /> : (
                <div className={cn("text-3xl font-black font-mono tracking-tighter text-foreground")}>
                    {(typeof value === 'number' && isCurrency) ? formatCurrency(value) : value}
                </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">{subText || description}</p>
        </CardContent>
    </Card>
);

export default function DashboardPage() {
  const { journalEntries, projects, clients, loading: analyticalLoading } = useAnalyticalData();
  const { firestore } = useFirebase();
  const { user } = useAuth();

  const tasksQuery = useMemo(() => {
    if (!user?.id) return [];
    return [
      where('userId', '==', user.id),
      where('entryType', '==', 'task'),
      where('status', '==', 'pending'),
      orderBy('dueDate', 'asc'),
      limit(5)
    ];
  }, [user?.id]);

  const { data: myTasks, loading: tasksLoading } = useSubscription<UserProductivityItem>(
      firestore, 
      user?.currentCompanyId ? `companies/${user.currentCompanyId}/userProductivity` : null, 
      tasksQuery
  );

  const stats = useMemo(() => {
    if (analyticalLoading || !journalEntries) return null;
    
    const totalRevenue = journalEntries
        .filter(e => e.status === 'posted')
        .flatMap(e => e.lines)
        .filter(l => l.accountName?.includes('إيرادات') || l.accountId?.startsWith('4'))
        .reduce((sum, l) => sum + (l.credit || 0), 0);

    const activeProjectsCount = (projects || []).filter(p => p.status === 'قيد التنفيذ').length;
    const totalClientsCount = (clients || []).length;

    return { totalRevenue, activeProjectsCount, totalClientsCount };
  }, [journalEntries, projects, clients, analyticalLoading]);

  const loading = analyticalLoading;

  return (
    <div className="space-y-10" dir="rtl">
        {/* 🛡️ الهيدر الرئيسي المحدث بالهوية البرتقالية 🛡️ */}
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
            <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
            <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <CardTitle className="text-3xl font-black text-white tracking-tighter">لوحة التحكم المركزية</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                <CardDescription className="text-white/90 font-bold text-sm">مرحباً بك، {user?.fullName}. إليك ملخص المهام وحالة العمل اليوم.</CardDescription>
                            </div>
                        </div>
                        <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                            <LayoutGrid className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 no-print">
                        <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black gap-2 bg-white/20 text-white border-white/40 hover:bg-white/30 backdrop-blur-md shadow-xl">
                            <Link href="/dashboard/notifications">
                                <BellRing className="h-5 w-5" /> سجل التنبيهات
                            </Link>
                        </Button>
                        <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none transition-transform hover:scale-105">
                            <Link href="/dashboard/clients/new">
                                <PlusCircle className="h-5 w-5" /> إضافة عميل
                            </Link>
                        </Button>
                    </div>
                </div>
            </CardHeader>
        </Card>

        <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
                <Card className="h-full border-white/40 bg-white/40 dark:bg-slate-900/40 rounded-[3rem] shadow-sm flex flex-col border-2">
                    <CardHeader className="p-8 border-b border-white/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-black flex items-center gap-2 text-foreground">
                                <ListTodo className="text-primary h-5 w-5" /> مهامي القادمة
                            </CardTitle>
                            <Link href="/dashboard/productivity?tab=tasks">
                                <Button variant="ghost" size="sm" className="h-8 rounded-xl font-black text-[10px] text-primary bg-primary/5">عرض الكل</Button>
                            </Link>
                        </div>
                        <CardDescription>المهام المستخلصة من المشاريع والعملاء.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 flex-1">
                        {tasksLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-16 w-full rounded-2xl" />
                                <Skeleton className="h-16 w-full rounded-2xl" />
                            </div>
                        ) : myTasks.length === 0 ? (
                            <div className="h-48 flex flex-col items-center justify-center text-center opacity-40">
                                <CheckCircle2 className="h-12 w-12 mb-3 text-muted-foreground" />
                                <p className="font-bold text-sm">لا توجد مهام معلقة.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {myTasks.map(task => (
                                    <Link key={task.id} href={task.sourceUrl || '/dashboard/productivity'} className="block group">
                                        <div className="p-3 bg-white/60 dark:bg-slate-900/60 border border-transparent group-hover:border-primary/30 rounded-2xl transition-all">
                                            <div className="flex justify-between items-start">
                                                <p className="font-black text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">{task.title}</p>
                                                <Badge variant="outline" className="text-[8px] h-4 font-black">{task.sourceModule}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-muted-foreground">
                                                <Clock className="h-3 w-3" />
                                                <span>موعد التسليم: {toFirestoreDate(task.dueDate) ? format(toFirestoreDate(task.dueDate)!, 'dd MMMM', { locale: ar }) : '-'}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-6">
                <StatCard 
                    title="المشاريع النشطة" 
                    value={loading ? 0 : stats?.activeProjectsCount || 0} 
                    isCurrency={false}
                    icon={<Activity className="h-5 w-5" />} 
                    subText="مشاريع قيد التنفيذ حالياً"
                    colorClass="bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                    loading={loading}
                />
                <StatCard 
                    title="إجمالي الإيرادات" 
                    value={loading ? 0 : stats?.totalRevenue || 0} 
                    isCurrency={true}
                    icon={<Wallet className="h-5 w-5" />} 
                    subText="بناءً على السجلات المالية"
                    colorClass="bg-orange-100 dark:bg-primary/20 text-primary"
                    loading={loading}
                />
                
                <Card className="col-span-1 border-white/40 bg-white/40 dark:bg-slate-900/40 rounded-[2.5rem] p-6 flex flex-col items-center justify-center text-center gap-4 border-2">
                    <div className="space-y-1">
                        <p className="font-black text-sm text-foreground">يوميات المواقع</p>
                        <p className="text-[10px] text-muted-foreground font-bold leading-tight">سجل إنجاز الفرق الميدانية.</p>
                    </div>
                    <Button asChild className="rounded-xl h-9 px-6 bg-primary text-white font-black text-[10px]">
                        <Link href="/dashboard/construction/field-visits">فتح السجل الفني</Link>
                    </Button>
                </Card>

                <StatCard 
                    title="قاعدة العملاء" 
                    value={loading ? 0 : stats?.totalClientsCount || 0} 
                    isCurrency={false}
                    icon={<Users className="h-5 w-5" />} 
                    subText="إجمالي الملفات المسجلة"
                    colorClass="bg-orange-50 dark:bg-orange-900/20 text-primary"
                    loading={loading}
                />
            </div>

            <div className="lg:col-span-4">
                <Card className="h-full border-white/40 bg-white/40 dark:bg-slate-900/40 rounded-[3rem] shadow-sm flex flex-col border-2">
                    <CardHeader className="p-8 border-b border-white/10">
                        <CardTitle className="text-xl font-black flex items-center gap-2 text-foreground">
                            <History className="text-primary h-5 w-5" /> آخر التحديثات
                        </CardTitle>
                        <CardDescription>متابعة حية للإجراءات المتخذة في النظام.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 flex-1 flex flex-col items-center justify-center opacity-30 text-center">
                        <Activity className="h-12 w-12 mb-3 text-primary animate-pulse" />
                        <p className="font-bold text-sm">جاري تحديث السجل اللحظي...</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
