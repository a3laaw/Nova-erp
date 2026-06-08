'use client';

import React from 'react';
import { StatCard } from './stat-card';
import RecentActivity from './recent-activity';
import TaskPrioritization from './task-prioritization';
import { CashFlowProjectionChart } from '../accounting/cash-flow-projection-chart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import Link from 'next/link';
import { 
    Users, FileSignature, PieChart, BookOpen, ArrowDownLeft, 
    ArrowUpRight, MapPin, CheckCircle2, Sparkles, Zap, Activity 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SystemRoleConfig } from '@/lib/registry/system-registry';

/**
 * حاوية الداشبورد الديناميكية (Dynamic Dashboard V150.0)
 * تصميم Glassmorphism لؤلؤي مع وضوح نصوص هندسي.
 */

const iconMap: Record<string, any> = {
    Users, FileSignature, PieChart, BookOpen, ArrowDownLeft, ArrowUpRight, MapPin, CheckCircle2
};

export function UpgradedDashboardContainer({ config, analyticsData }: { config: SystemRoleConfig, analyticsData: any }) {
    
    const renderKpis = () => (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-in fade-in duration-700">
            {config.dashboard.kpiCards.map(kpi => {
                let val = 0;
                if (kpi.id === 'total_revenue' || kpi.id === 'available_cash') {
                    val = (analyticsData.journalEntries || [])
                        .filter((e: any) => e.status === 'posted')
                        .flatMap((e: any) => e.lines)
                        .filter((l: any) => l.accountId?.startsWith('1101') || l.accountId?.startsWith('4'))
                        .reduce((sum: number, l: any) => sum + (l.credit || 0) - (l.debit || 0), 0);
                } else if (kpi.id === 'active_projects') {
                    val = (analyticsData.projects || []).filter((p: any) => p.status === 'قيد التنفيذ').length;
                } else if (kpi.id === 'client_base') {
                    val = (analyticsData.clients || []).length;
                } else if (kpi.id === 'draft_entries') {
                    val = (analyticsData.journalEntries || []).filter((e: any) => e.status === 'draft').length;
                }
                
                return (
                    <StatCard 
                        key={kpi.id}
                        title={kpi.title}
                        value={val}
                        loading={analyticsData.loading}
                        {...kpi.props}
                    />
                );
            })}
        </div>
    );

    const renderQuickActions = () => (
        <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white/30 backdrop-blur-md border border-white/20">
            <CardHeader className="p-8 pb-4">
                <CardTitle className="text-xl font-black flex items-center gap-3">
                    <Zap className="text-[#FF7A00] h-6 w-6" />
                    الوصول السريع
                </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {config.dashboard.quickActions.map(action => {
                    const Icon = iconMap[action.props.icon] || Activity;
                    return (
                        <Button 
                            key={action.id} 
                            asChild 
                            variant="outline" 
                            className="h-24 flex-col rounded-3xl gap-2 bg-white/40 hover:bg-white hover:border-primary/40 transition-all duration-500 shadow-sm group border-white/60"
                        >
                            <Link href={action.props.href}>
                                <Icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                                <span className="font-black text-[11px] uppercase tracking-tighter text-black">{action.title}</span>
                            </Link>
                        </Button>
                    );
                })}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-10">
            {renderKpis()}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    {config.dashboard.charts.length > 0 && (
                        <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white/40 backdrop-blur-xl border-white/60">
                            <CardHeader className="p-10 border-b border-white/20">
                                <CardTitle className="text-2xl font-black text-black">رادار التدفق والسيولة</CardTitle>
                            </CardHeader>
                            <CardContent className="p-10">
                                <CashFlowProjectionChart />
                            </CardContent>
                        </Card>
                    )}
                    <RecentActivity />
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {renderQuickActions()}
                    <TaskPrioritization />
                    <Card className="rounded-[2.5rem] bg-[#1e1b4b] text-white p-10 border-none shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <CardTitle className="text-xl font-black mb-4">نبض المنظومة</CardTitle>
                        <Button asChild className="w-full h-14 rounded-2xl font-black text-lg gap-3 bg-white text-[#1e1b4b]">
                            <Link href="/dashboard/employee-hub">
                                <Sparkles className="h-5 w-5 text-[#FF7A00]" />
                                فتح الحائط التفاعلي
                            </Link>
                        </Button>
                    </Card>
                </div>
            </div>
        </div>
    );
}
