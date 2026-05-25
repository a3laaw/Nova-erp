'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { 
    TrendingUp, Wallet, Activity, Users, Sparkles, 
    Building2, ArrowUpRight, Palette, ListChecks, CheckCircle2, Clock
} from 'lucide-react';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { RecentActivity } from './recent-activity';
import { TaskPrioritization } from './task-prioritization';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { where, orderBy, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { Button } from '@/components/ui/button'; // 🛡️ التطهير: إضافة الاستيراد المفقود 🛡️
import { useAuth } from '@/context/auth-context';

/**
 * لوحة تحكم الإدارة (Executive View V72.0):
 * تم إصلاح خطأ الـ Button وتثبيت رادار المهام الشخصية المجدولة.
 */
export function ExecutiveDashboard({ data, user }: any) {
    const { firestore } = useFirebase();
    const tenantId = user?.currentCompanyId;

    // جلب المهام الشخصية النشطة للمستخدم (V68)
    const taskPath = useMemo(() => tenantId ? getTenantPath('userProductivity', tenantId) : null, [tenantId]);
    const taskQuery = useMemo(() => [
        where('userId', '==', user?.id),
        where('entryType', '==', 'task'),
        where('status', '==', 'pending'),
        limit(5)
    ], [user?.id]);

    const { data: myTasks, loading: tasksLoading } = useSubscription<any>(firestore, taskPath, taskQuery);

    const stats = useMemo(() => {
        const posted = (data.journalEntries || []).filter((e: any) => e.status === 'posted');
        const totalRevenue = posted.flatMap((e: any) => e.lines)
            .filter((l: any) => l.accountName?.includes('إيرادات') || l.accountId?.startsWith('4'))
            .reduce((sum: number, l: any) => sum + (l.credit || 0), 0);
        
        const activeProj = (data.projects || []).filter((p: any) => p.status === 'قيد التنفيذ').length;
        
        return { 
            totalRevenue, 
            activeProj, 
            clientsCount: (data.clients || []).length 
        };
    }, [data]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            {/* صف البطاقات الرئيسي */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="إجمالي الإيرادات" 
                    value={stats.totalRevenue} 
                    icon={<Wallet className="h-5 w-5" />} 
                    colorClass="bg-green-100 text-green-700" 
                    isCurrency={true} 
                />
                <StatCard 
                    title="المشاريع النشطة" 
                    value={stats.activeProj} 
                    icon={<Activity className="h-5 w-5" />} 
                    colorClass="bg-blue-100 text-blue-700" 
                    isCurrency={false}
                />
                <StatCard 
                    title="قاعدة العملاء" 
                    value={stats.clientsCount} 
                    icon={<Users className="h-5 w-5" />} 
                    colorClass="bg-orange-100 text-[#FF7A00]" 
                    isCurrency={false}
                />
                <Card className="rounded-[2.5rem] bg-slate-900 text-white p-6 border-none shadow-xl flex flex-col justify-between group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-white/10 transition-all duration-700" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 relative z-10">الحائط التفاعلي</p>
                    <div className="flex items-end justify-between relative z-10">
                        <Link href="/dashboard/employee-hub" className="text-sm font-black underline underline-offset-4 decoration-primary hover:text-primary transition-colors">فتح نبض الإنجاز</Link>
                        <Sparkles className="h-8 w-8 text-orange-400 animate-pulse" />
                    </div>
                </Card>
            </div>

            {/* صف النشاط والمهام */}
            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-8">
                    <RecentActivity />
                </div >
                
                <div className="lg:col-span-4 space-y-8">
                    {/* ✨ قسم المهام الشخصية الجديد (The Personal Productivity Radar) ✨ */}
                    <Card className="rounded-[3rem] border-none shadow-xl bg-white overflow-hidden border-white/60">
                        <CardHeader className="bg-primary/5 border-b pb-6 p-8">
                            <CardTitle className="text-xl font-black flex items-center gap-3">
                                <ListChecks className="text-primary h-6 w-6" />
                                مهامي الشخصية
                            </CardTitle>
                            <CardDescription>المهام التي قمت بجدولتها يدوياً للمتابعة.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-4">
                            {tasksLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full rounded-2xl"/><Skeleton className="h-16 w-full rounded-2xl"/></div> : 
                             myTasks.length === 0 ? (
                                <div className="p-10 text-center opacity-30 italic font-bold text-black">لا توجد مهام مجدولة اليوم.</div>
                             ) : (
                                [...myTasks].sort((a,b) => (toFirestoreDate(b.createdAt)?.getTime() || 0) - (toFirestoreDate(a.createdAt)?.getTime() || 0)).map(task => (
                                    <div key={task.id} className="p-4 bg-muted/20 rounded-2xl border-2 border-transparent hover:border-primary/20 hover:bg-white transition-all group">
                                        <div className="flex justify-between items-start">
                                            <p className="font-black text-xs text-black line-clamp-2 leading-relaxed flex-1 pr-1">{task.title}</p>
                                            <Link href={task.sourceUrl || '#'} className="p-1.5 bg-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"><ArrowUpRight className="h-3 w-3 text-primary rotate-180"/></Link>
                                        </div>
                                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed">
                                            <span className="text-[9px] font-black text-slate-400 flex items-center gap-1"><Clock className="h-2.5 w-2.5"/> {toFirestoreDate(task.dueDate) ? format(toFirestoreDate(task.dueDate)!, 'dd MMM') : '-'}</span>
                                            <Button 
                                                variant="ghost" size="sm" 
                                                onClick={async () => {
                                                    const path = getTenantPath(`userProductivity/${task.id}`, tenantId);
                                                    await updateDoc(doc(firestore!, path!), { status: 'completed', completedAt: serverTimestamp() });
                                                }}
                                                className="h-7 px-3 rounded-lg bg-green-50 text-green-700 text-[10px] font-black hover:bg-green-600 hover:text-white border-none"
                                            >
                                                <CheckCircle2 className="h-3 w-3 ml-1"/> إتمام
                                            </Button>
                                        </div>
                                    </div>
                                ))
                             )}
                        </CardContent>
                        <CardFooter className="bg-muted/10 p-6 flex justify-center">
                            <Button asChild variant="link" className="font-black text-xs text-primary underline">
                                <Link href="/dashboard/productivity?tab=tasks">عرض كافة المهام الشخصية</Link>
                            </Button>
                        </CardFooter>
                    </Card>

                    <TaskPrioritization />
                </div>
            </div>
        </div>
    );
}

function QuickLink({ href, label, icon }: any) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl hover:bg-primary hover:text-white transition-all group border border-transparent hover:shadow-lg hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
                <div className="text-primary group-hover:text-white transition-colors">{icon}</div>
                <span className="font-black text-xs">{label}</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all rotate-180" />
        </Link>
    );
}
