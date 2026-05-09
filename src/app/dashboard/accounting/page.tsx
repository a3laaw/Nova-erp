
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalyticalData } from '@/hooks/use-analytical-data';
import { formatCurrency, cn } from '@/lib/utils';
import { 
    Wallet, 
    ArrowDownLeft, 
    TrendingUp, 
    FileText,
    PieChart,
    ArrowRight,
    PlusCircle,
    Landmark,
    ShieldCheck,
    Scale,
    FileSpreadsheet,
    Banknote
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppTheme } from '@/context/theme-context';

const StatCard = ({ title, value, icon, description, colorClass, loading, isGlass }: any) => (
    <Card className={cn(
        "overflow-hidden border-none rounded-3xl hover-lift",
        isGlass ? "glass-effect" : "bg-white shadow-sm"
    )}>
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
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    const stats = useMemo(() => {
        if (loading) return null;
        const postedEntries = journalEntries.filter(e => e.status === 'posted');
        const liquidAccountIds = accounts.filter(a => (a.code.startsWith('1101')) && a.isPayable).map(a => a.id);
        const cashBalance = postedEntries.flatMap(e => e.lines).filter(l => liquidAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);
        const arAccountIds = accounts.filter(a => a.code.startsWith('1102')).map(a => a.id);
        const totalAR = postedEntries.flatMap(e => e.lines).filter(l => arAccountIds.includes(l.accountId)).reduce((sum, l) => sum + (l.debit || 0) - (l.credit || 0), 0);
        let totalIncome = 0, totalExpense = 0;
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
            <Card className={cn("border-none rounded-[2.5rem] overflow-hidden", isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-indigo-50 shadow-sm")}>
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                <Landmark className="text-primary h-8 w-8" /> المحاسبة والرقابة المالية
                            </CardTitle>
                            <CardDescription className="text-base font-medium">إدارة السيولة، القوائم المالية، والتحليلات الربحية للمشاريع.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/accounting/journal-entries/new"><PlusCircle className="ml-2 h-4 w-4" /> قيد يدوي</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="السيولة المتاحة" value={stats?.cashBalance || 0} icon={<Wallet className="h-5 w-5" />} description="الصناديق والبنوك" colorClass="bg-blue-100 text-blue-700" loading={loading} isGlass={isGlass} />
                <StatCard title="مديونيات العملاء" value={stats?.totalAR || 0} icon={<ArrowDownLeft className="h-5 w-5" />} description="مبالغ بانتظار التحصيل" colorClass="bg-orange-100 text-orange-700" loading={loading} isGlass={isGlass} />
                <StatCard title="صافي الأرباح" value={stats?.netProfit || 0} icon={<TrendingUp className="h-5 w-5" />} description="الإيرادات - المصروفات" colorClass="bg-green-100 text-green-700" loading={loading} isGlass={isGlass} />
                <Card className={cn("overflow-hidden border-none rounded-3xl", isGlass ? "glass-effect" : "bg-primary text-primary-foreground shadow-sm")}>
                    <CardHeader className="pb-2"><CardTitle className="text-xs font-black uppercase tracking-widest">مسودات القيود</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black font-mono">{loading ? '...' : stats?.draftCount}</div>
                        <Link href="/dashboard/accounting/journal-entries" className="text-[10px] font-bold underline mt-3 flex items-center gap-1">مراجعة وترحيل <ArrowRight className="h-2 w-2"/></Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* قسم القوائم المالية الرسمي */}
                <Card className={cn("rounded-[2rem] border-none shadow-sm", isGlass ? "glass-effect" : "bg-white")}>
                    <CardHeader className="border-b bg-muted/10">
                        <CardTitle className="text-lg font-black flex items-center gap-2"><FileSpreadsheet className="text-primary h-5 w-5"/> القوائم المالية الرسمية (IFRS)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 pt-6">
                        <QuickLink href="/dashboard/accounting/income-statement" label="قائمة الدخل (P&L)" icon={<TrendingUp className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/accounting/balance-sheet" label="المركز المالي" icon={<Landmark className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/accounting/trial-balance" label="ميزان المراجعة" icon={<Scale className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/accounting/cash-flow" label="التدفقات النقدية" icon={<Banknote className="h-4 w-4"/>} isGlass={isGlass} />
                    </CardContent>
                </Card>

                {/* قسم التحليلات والرقابة */}
                <Card className={cn("rounded-[2rem] border-none shadow-sm", isGlass ? "glass-effect" : "bg-white")}>
                    <CardHeader className="border-b bg-muted/10">
                        <CardTitle className="text-lg font-black flex items-center gap-2"><ShieldCheck className="text-primary h-5 w-5"/> التحليلات والرقابة</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 pt-6">
                        <QuickLink href="/dashboard/accounting/general-ledger" label="دفتر الأستاذ العام" icon={<ListTree className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/accounting/reports" label="ربحية المشاريع" icon={<PieChart className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/accounting/reconciliation" label="التسوية البنكية" icon={<RotateCcw className="h-4 w-4"/>} isGlass={isGlass} />
                        <QuickLink href="/dashboard/hr/custody-reconciliation" label="تسوية العهد" icon={<Wallet className="h-4 w-4"/>} isGlass={isGlass} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function QuickLink({ href, label, icon, isGlass }: { href: string, label: string, icon: React.ReactNode, isGlass: boolean }) {
    return (
        <Link href={href} className={cn("p-4 border-2 border-transparent rounded-2xl hover:shadow-md transition-all text-sm font-black flex items-center justify-between group", isGlass ? "bg-white/10 hover:bg-white/20 text-[#1e1b4b]" : "bg-muted/20 hover:bg-white hover:border-primary/20 text-foreground/80")}>
            <div className="flex items-center gap-3">
                <div className="opacity-40 group-hover:opacity-100 transition-opacity">{icon}</div>
                {label}
            </div>
            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary"/>
        </Link>
    );
}
