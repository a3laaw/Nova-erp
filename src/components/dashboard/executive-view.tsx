'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { 
    TrendingUp, Wallet, Activity, Users, Sparkles, 
    LayoutGrid, Building2, ShieldCheck, Target, Clock, ArrowUpRight 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { RecentActivity } from './recent-activity';
import { TaskPrioritization } from './task-prioritization';
import Link from 'next/link';

export function ExecutiveDashboard({ data, user }: any) {
    const stats = useMemo(() => {
        const posted = data.journalEntries.filter((e: any) => e.status === 'posted');
        const totalRevenue = posted.flatMap((e: any) => e.lines)
            .filter((l: any) => l.accountName?.includes('إيرادات') || l.accountId?.startsWith('4'))
            .reduce((sum: number, l: any) => sum + (l.credit || 0), 0);
        
        const activeProj = data.projects.filter((p: any) => p.status === 'قيد التنفيذ').length;
        
        return { totalRevenue, activeProj, clientsCount: data.clients.length };
    }, [data]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="إجمالي الإيرادات" value={stats.totalRevenue} icon={<Wallet className="h-5 w-5" />} colorClass="bg-green-100 text-green-700" isCurrency />
                <StatCard title="المشاريع النشطة" value={stats.activeProj} icon={<Activity className="h-5 w-5" />} colorClass="bg-blue-100 text-blue-700" />
                <StatCard title="قاعدة العملاء" value={stats.clientsCount} icon={<Users className="h-5 w-5" />} colorClass="bg-orange-100 text-[#FF7A00]" />
                <Card className="rounded-[2.5rem] bg-slate-900 text-white p-6 border-none shadow-xl flex flex-col justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">حالة الربحية</p>
                    <div className="flex items-end justify-between">
                        <span className="text-3xl font-black font-mono">18.5%</span>
                        <TrendingUp className="h-8 w-8 text-green-400" />
                    </div>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-8">
                    <RecentActivity />
                </div>
                <div className="lg:col-span-4 space-y-8">
                    <TaskPrioritization />
                    <Card className="rounded-[3rem] border-none shadow-xl bg-white p-8">
                        <CardHeader className="p-0 mb-6">
                            <CardTitle className="text-xl font-black">روابط سريعة</CardTitle>
                        </CardHeader>
                        <div className="grid gap-3">
                            <QuickLink href="/dashboard/accounting/reports" label="تقارير الربحية" icon={<TrendingUp className="h-4 w-4"/>} />
                            <QuickLink href="/dashboard/construction/projects" label="متابعة المواقع" icon={<Building2 className="h-4 w-4"/>} />
                            <QuickLink href="/dashboard/settings/branding" label="الهوية البصرية" icon={<Palette className="h-4 w-4"/>} />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function QuickLink({ href, label, icon }: any) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl hover:bg-primary hover:text-white transition-all group border border-transparent hover:shadow-lg">
            <div className="flex items-center gap-3">
                {icon}
                <span className="font-black text-xs">{label}</span>
            </div>
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>
    );
}

import { Palette } from 'lucide-react';
