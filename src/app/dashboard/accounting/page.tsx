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
    AlertCircle,
    FileText,
    PieChart,
    ArrowRight,
    PlusCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value, icon, description, colorClass, loading }: any) => (
    <Card className="overflow-hidden border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground">{title}</CardTitle>
            <div className={cn("p-2 rounded-lg", colorClass)}>{icon}</div>
        </CardHeader>
        <CardContent>
            {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <div className="text-2xl font-black font-mono">{formatCurrency(value)}</div>}
            <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
        </CardContent>
    </Card>
);

export default function AccountingDashboardPage() {
    const { journalEntries, accounts, loading } = useAnalyticalData();

    const stats = useMemo(() => {
        if (loading) return null;
        
        const postedEntries = journalEntries.filter(e => e.status === 'posted');
        
        // Calculate Cash/Bank balances
        const liquidAccountIds = accounts.filter(a => a.code.startsWith('1101') && a.isPayable).map(a => a.id);
        const cashBalance = postedEntries.flatMap(e => e.lines).filter(l => liquidAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);

        // Calculate Receivables
        const arAccountIds = accounts.filter(a => a.code.startsWith('1102')).map(a => a.id);
        const totalAR = postedEntries.flatMap(e => e.lines).filter(l => arAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);

        // Calculate Income/Expense for current period (this simple logic covers basic P&L)
        let totalIncome = 0;
        let totalExpense = 0;
        postedEntries.flatMap(e => e.lines).forEach(l => {
            const acc = accounts.find(a => a.id === l.accountId);
            if (acc?.type === 'income') totalIncome += (l.credit || 0) - (l.debit || 0);
            if (acc?.type === 'expense') totalExpense += (l.debit || 0) - (l.credit || 0);
        });

        const draftCount = journalEntries.filter(e => e.status === 'draft').length;

        return {
            cashBalance,
            totalAR,
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            draftCount
        };
    }, [journalEntries, accounts, loading]);

    return (
        <div className="space-y-6" dir="rtl">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-foreground">الرقابة المالية والمحاسبية</h1>
                    <p className="text-muted-foreground">نظرة عامة على السيولة، المديونيات، والأداء المالي العام.</p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline" className="rounded-xl border-primary text-primary hover:bg-primary/5">
                        <Link href="/dashboard/accounting/reports/daily-summary">التقرير اليومي</Link>
                    </Button>
                    <Button asChild className="rounded-xl font-bold shadow-lg shadow-primary/20">
                        <Link href="/dashboard/accounting/journal-entries/new">
                            <PlusCircle className="ml-2 h-4 w-4" /> قيد جديد
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard 
                    title="السيولة المتاحة" 
                    value={stats?.cashBalance || 0} 
                    icon={<Wallet className="h-4 w-4" />} 
                    description="إجمالي أرصدة الصناديق والبنوك"
                    colorClass="bg-blue-100 text-blue-700"
                    loading={loading}
                />
                <StatCard 
                    title="مديونيات العملاء" 
                    value={stats?.totalAR || 0} 
                    icon={<ArrowDownLeft className="h-4 w-4" />} 
                    description="المبالغ المستحقة بانتظار التحصيل"
                    colorClass="bg-orange-100 text-orange-700"
                    loading={loading}
                />
                <StatCard 
                    title="صافي الأرباح" 
                    value={stats?.netProfit || 0} 
                    icon={<TrendingUp className="h-4 w-4" />} 
                    description="الفرق بين الإيرادات والمصروفات"
                    colorClass="bg-green-100 text-green-700"
                    loading={loading}
                />
                <Card className="overflow-hidden border-none shadow-sm bg-primary text-primary-foreground">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold opacity-80">قيود بانتظار الترحيل</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black font-mono">{loading ? '...' : stats?.draftCount}</div>
                        <Link href="/dashboard/accounting/journal-entries" className="text-[10px] underline mt-2 flex items-center gap-1">
                            مراجعة وترحيل الآن <ArrowRight className="h-2 w-2"/>
                        </Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-2xl border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <PieChart className="text-primary h-5 w-5"/> الوصول السريع للتقارير
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3">
                        <QuickLink href="/dashboard/accounting/income-statement" label="قائمة الدخل (P&L)" />
                        <QuickLink href="/dashboard/accounting/balance-sheet" label="المركز المالي" />
                        <QuickLink href="/dashboard/accounting/trial-balance" label="ميزان المراجعة" />
                        <QuickLink href="/dashboard/accounting/general-ledger" label="دفتر الأستاذ" />
                        <QuickLink href="/dashboard/accounting/client-statements" label="مديونيات العملاء" />
                        <QuickLink href="/dashboard/accounting/vendor-statements" label="حسابات الموردين" />
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-black flex items-center gap-2">
                            <Scale className="text-primary h-5 w-5"/> سلامة البيانات
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-xl border border-dashed flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-bold">آخر تسوية بنكية</p>
                                <p className="text-xs text-muted-foreground">لم يتم إجراء تسوية هذا الشهر</p>
                            </div>
                            <Button asChild size="sm" variant="secondary">
                                <Link href="/dashboard/accounting/reconciliation">بدء التسوية</Link>
                            </Button>
                        </div>
                        <div className="p-4 bg-red-50/50 dark:bg-red-950/10 rounded-xl border border-red-100 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-red-700">فحص الخلل المالي</p>
                                <p className="text-xs text-red-600/70">يتم الفحص تلقائياً في الخلفية</p>
                            </div>
                            <Badge variant="outline" className="bg-white text-red-600 border-red-200">نشط</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function QuickLink({ href, label }: { href: string, label: string }) {
    return (
        <Link href={href} className="p-3 border rounded-xl hover:bg-muted/50 transition-colors text-sm font-semibold flex items-center justify-between group">
            {label}
            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
        </Link>
    );
}