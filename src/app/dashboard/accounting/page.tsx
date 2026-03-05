'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    Wallet, 
    ArrowDownLeft, 
    ArrowUpRight, 
    Scale, 
    TrendingUp, 
    FileText,
    PieChart,
    ArrowRight,
    PlusCircle,
    Banknote
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value, icon, description, colorClass, loading }: any) => (
    <Card className="overflow-hidden border-none shadow-sm rounded-3xl bg-white hover-lift">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
            <div className={cn("p-2 rounded-xl", colorClass)}>{icon}</div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-3xl font-black font-mono tracking-tighter">{formatCurrency(value)}</div>}
            <p className="text-[10px] text-muted-foreground mt-1 font-bold">{description}</p>
        </CardContent>
    </Card>
);

export default function AccountingDashboardPage() {
    const { journalEntries, accounts, loading } = useAnalyticalData();

    const stats = useMemo(() => {
        if (loading) return null;
        
        const postedEntries = journalEntries.filter(e => e.status === 'posted');
        
        const liquidAccountIds = accounts.filter(a => a.code.startsWith('1101') && a.isPayable).map(a => a.id);
        const cashBalance = postedEntries.flatMap(e => e.lines).filter(l => liquidAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);

        const arAccountIds = accounts.filter(a => a.code.startsWith('1102')).map(a => a.id);
        const totalAR = postedEntries.flatMap(e => e.lines).filter(l => arAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);

        let totalIncome = 0;
        let totalExpense = 0;
        postedEntries.flatMap(e => e.lines).forEach(l => {
            const acc = accounts.find(a => a.id === l.accountId);
            if (acc?.type === 'income') totalIncome += (l.credit || 0) - (l.debit || 0);
            if (acc?.type === 'expense') totalExpense += (l.debit || 0) - (l.credit || 0);
        });

        const draftCount = journalEntries.filter(e => e.status === 'draft').length;

        return { cashBalance, totalAR, totalIncome, totalExpense, netProfit: totalIncome - totalExpense, draftCount };
    }, [journalEntries, accounts, loading]);

    return (
        <div className="space-y-8" dir="rtl">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                <Banknote className="text-primary h-8 w-8" />
                                الرقابة المالية والمحاسبية
                            </CardTitle>
                            <CardDescription className="text-base font-medium">إدارة السيولة، مديونيات العملاء، والمؤشرات المالية الحية للشركة.</CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2 border-primary text-primary hover:bg-primary/5">
                                <Link href="/dashboard/accounting/reports/daily-summary">التقرير اليومي</Link>
                            </Button>
                            <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/accounting/journal-entries/new">
                                    <PlusCircle className="ml-2 h-4 w-4" /> قيد جديد
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="السيولة المتاحة" 
                    value={stats?.cashBalance || 0} 
                    icon={<Wallet className="h-5 w-5" />} 
                    description="إجمالي أرصدة الصناديق والبنوك"
                    colorClass="bg-blue-100 text-blue-700"
                    loading={loading}
                />
                <StatCard 
                    title="مديونيات العملاء" 
                    value={stats?.totalAR || 0} 
                    icon={<ArrowDownLeft className="h-5 w-5" />} 
                    description="مبالغ بانتظار التحصيل"
                    colorClass="bg-orange-100 text-orange-700"
                    loading={loading}
                />
                <StatCard 
                    title="صافي الأرباح" 
                    value={stats?.netProfit || 0} 
                    icon={<TrendingUp className="h-5 w-5" />} 
                    description="الفرق بين الإيرادات والمصروفات"
                    colorClass="bg-green-100 text-green-700"
                    loading={loading}
                />
                <Card className="overflow-hidden border-none shadow-sm bg-primary text-primary-foreground rounded-3xl hover-lift">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black opacity-80 uppercase tracking-widest text-white">قيود قيد المراجعة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black font-mono text-white">{loading ? '...' : stats?.draftCount}</div>
                        <Link href="/dashboard/accounting/journal-entries" className="text-[10px] font-bold underline mt-3 flex items-center gap-1 text-white/90">
                            مراجعة وترحيل القيود <ArrowRight className="h-2 w-2"/>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <Card className="rounded-[2rem] border-none shadow-sm bg-white">
                    <CardHeader className="border-b bg-muted/10">
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <PieChart className="text-primary h-5 w-5"/> التقارير الختامية (IFRS)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 pt-6">
                        <QuickLink href="/dashboard/accounting/income-statement" label="قائمة الدخل" />
                        <QuickLink href="/dashboard/accounting/balance-sheet" label="المركز المالي" />
                        <QuickLink href="/dashboard/accounting/trial-balance" label="ميزان المراجعة" />
                        <QuickLink href="/dashboard/accounting/general-ledger" label="دفتر الأستاذ" />
                        <QuickLink href="/dashboard/accounting/client-statements" label="كشوفات العملاء" />
                        <QuickLink href="/dashboard/accounting/vendor-statements" label="حسابات الموردين" />
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-sm bg-white">
                    <CardHeader className="border-b bg-muted/10">
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <Scale className="text-primary h-5 w-5"/> أدوات التدقيق والرقابة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        <div className="p-5 bg-muted/30 rounded-2xl border-2 border-dashed flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-black">التسوية البنكية الذكية</p>
                                <p className="text-[10px] text-muted-foreground font-bold">مطابقة كشوف الحساب مع القيود</p>
                            </div>
                            <Button asChild size="sm" variant="secondary" className="rounded-xl font-bold">
                                <Link href="/dashboard/accounting/reconciliation">بدء التسوية</Link>
                            </Button>
                        </div>
                        <div className="p-5 bg-red-50/50 dark:bg-red-950/10 rounded-2xl border border-red-100 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-black text-red-700">فحص الخلل المالي</p>
                                <p className="text-[10px] text-red-600/70 font-bold">نظام الرقابة اللحظية نشط</p>
                            </div>
                            <Badge variant="outline" className="bg-white text-red-600 border-red-200 font-black">نشط</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function QuickLink({ href, label }: { href: string, label: string }) {
    return (
        <Link href={href} className="p-4 border-2 border-transparent bg-muted/20 rounded-2xl hover:bg-white hover:border-primary/20 hover:shadow-md transition-all text-sm font-black flex items-center justify-between group text-foreground/80">
            {label}
            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary"/>
        </Link>
    );
}
