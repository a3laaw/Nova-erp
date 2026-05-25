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
    Banknote,
    Waves,
    BookOpen,
    ListTree,
    RotateCcw,
    Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value, icon, description, colorClass, loading }: any) => (
    <Card className="overflow-hidden border-none rounded-[2rem] hover-lift bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
            <div className={cn("p-2 rounded-xl", colorClass)}>{icon}</div>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
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
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">المالية</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">متابعة الفلوس، التقارير، وأرباح المشاريع.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Landmark className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none">
                                <Link href="/dashboard/accounting/journal-entries/new"><PlusCircle className="h-5 w-5" /> تسجيل حركة</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="الرصيد المتاح" value={stats?.cashBalance || 0} icon={<Wallet className="h-5 w-5" />} description="الصناديق والبنوك" colorClass="bg-blue-100 text-blue-700" loading={loading} />
                <StatCard title="حسابات العملاء" value={stats?.totalAR || 0} icon={<ArrowDownLeft className="h-5 w-5" />} description="مبالغ مطلوب تحصيلها" colorClass="bg-orange-100 text-orange-700" loading={loading} />
                <StatCard title="صافي الأرباح" value={stats?.netProfit || 0} icon={<TrendingUp className="h-5 w-5" />} description="الدخل - المصاريف" colorClass="bg-green-100 text-green-700" loading={loading} />
                <Card className="overflow-hidden border-none rounded-[2rem] bg-[#1e1b4b] text-white shadow-xl">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white/70">حركات غير محفوظة</CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-6">
                        <div className="text-4xl font-black font-mono">{loading ? '...' : stats?.draftCount}</div>
                        <Link href="/dashboard/accounting/journal-entries" className="text-[10px] font-bold underline mt-4 flex items-center gap-1 hover:text-white/100 transition-colors">مراجعة وحفظ الآن <ArrowRight className="h-2 w-2"/></Link>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white/95 overflow-hidden">
                    <CardHeader className="border-b bg-muted/10 p-8">
                        <CardTitle className="text-lg font-black flex items-center gap-3"><FileSpreadsheet className="text-[#FF7A00] h-5 w-5"/> التقارير الرسمية</CardTitle>
                        <CardDescription>النتائج المالية النهائية والميزانية.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 p-8">
                        <QuickLink href="/dashboard/accounting/trial-balance" label="ميزان المراجعة" icon={<Scale className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/income-statement" label="الأرباح والخسائر" icon={<TrendingUp className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/balance-sheet" label="المركز المالي" icon={<Landmark className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/cash-flow" label="حركة الكاش" icon={<Waves className="h-4 w-4"/>} />
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white/95 overflow-hidden">
                    <CardHeader className="border-b bg-muted/10 p-8">
                        <CardTitle className="text-lg font-black flex items-center gap-3"><ShieldCheck className="text-[#FF7A00] h-5 w-5"/> التحصيل والعمليات</CardTitle>
                        <CardDescription>متابعة حسابات العملاء والحركات اليومية.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 p-8">
                        <QuickLink href="/dashboard/accounting/general-ledger" label="دفتر الأستاذ" icon={<ListTree className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/journal-entries" label="حركات الحسابات" icon={<BookOpen className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/reports" label="أرباح المشاريع" icon={<PieChart className="h-4 w-4"/>} />
                        <QuickLink href="/dashboard/accounting/reconciliation" label="مطابقة البنك" icon={<RotateCcw className="h-4 w-4"/>} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function QuickLink({ href, label, icon }: { href: string, label: string, icon: React.ReactNode }) {
    return (
        <Link href={href} className="p-5 border-2 border-transparent rounded-[1.8rem] bg-muted/20 hover:bg-white hover:border-primary/20 hover:shadow-md transition-all text-sm font-black flex items-center justify-between group">
            <div className="flex items-center gap-3">
                <div className="opacity-40 group-hover:opacity-100 transition-opacity text-primary">{icon}</div>
                <span className="text-slate-700 group-hover:text-primary transition-colors">{label}</span>
            </div>
            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-primary rotate-180"/>
        </Link>
    );
}
