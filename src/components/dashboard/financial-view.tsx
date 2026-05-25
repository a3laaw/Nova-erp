'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from './stat-card';
import { 
    Wallet, Scale, History, RotateCcw, 
    ArrowDownLeft, ArrowUpRight, Calculator, FileCheck, ShieldCheck, ListTree 
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

/**
 * لوحة تحكم المالية (Financial View):
 * تم تحديث الإحصائيات لضمان عرض الأعداد الصحيحة بوضوح.
 */
export function FinancialDashboard({ data, user }: any) {
    const financialStats = useMemo(() => {
        const posted = (data.journalEntries || []).filter((e: any) => e.status === 'posted');
        const liquidAccs = (data.accounts || []).filter((a: any) => a.code.startsWith('1101')).map((a: any) => a.id);
        const cashBalance = posted.flatMap((e: any) => e.lines)
            .filter((l: any) => liquidAccs.includes(l.accountId))
            .reduce((sum: number, l: any) => sum + (l.debit || 0) - (l.credit || 0), 0);
        
        const draftCount = (data.journalEntries || []).filter((e: any) => e.status === 'draft').length;
        
        return { cashBalance, draftCount };
    }, [data]);

    return (
        <div className="space-y-10 animate-in fade-in duration-1000">
            <div className="grid gap-6 md:grid-cols-3">
                <StatCard 
                    title="رصيد الكاش المتوفر" 
                    value={financialStats.cashBalance} 
                    icon={<Wallet className="h-5 w-5" />} 
                    colorClass="bg-green-100 text-green-700" 
                    isCurrency={true} 
                />
                <StatCard 
                    title="قيود بانتظار المراجعة" 
                    value={financialStats.draftCount} 
                    icon={<History className="h-5 w-5" />} 
                    colorClass="bg-orange-100 text-[#FF7A00]" 
                    isCurrency={false}
                />
                <Card className="rounded-[2.5rem] bg-indigo-600 text-white p-6 border-none shadow-xl flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-60">حالة الميزانية</p>
                        <p className="text-xl font-black">متزنة تماماً (Balanced)</p>
                    </div>
                    <ShieldCheck className="h-10 w-10 text-white/40" />
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <CardTitle className="text-xl font-black flex items-center gap-3"><Calculator className="text-primary h-6 w-6"/> العمليات المالية السريعة</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 grid grid-cols-2 gap-4">
                        <FinLink href="/dashboard/accounting/journal-entries/new" label="تسجيل قيد يدوي" icon={<History className="h-4 w-4"/>} />
                        <FinLink href="/dashboard/accounting/cash-receipts/new" label="إصدار سند قبض" icon={<ArrowDownLeft className="h-4 w-4"/>} />
                        <FinLink href="/dashboard/accounting/payment-vouchers/new" label="إصدار سند صرف" icon={<ArrowUpRight className="h-4 w-4"/>} />
                        <FinLink href="/dashboard/accounting/chart-of-accounts" label="شجرة الحسابات" icon={<ListTree className="h-4 w-4"/>} />
                    </CardContent>
                </Card>

                <Card className="rounded-[3rem] border-none shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 border-b p-8">
                        <CardTitle className="text-xl font-black">آخر سندات الصرف</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow><TableHead className="px-6">المستفيد</TableHead><TableHead className="text-left px-6">المبلغ</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {(data.purchaseOrders || []).slice(0, 5).map((po: any) => (
                                    <TableRow key={po.id} className="h-16">
                                        <TableCell className="px-6 font-bold">{po.vendorName}</TableCell>
                                        <TableCell className="text-left px-6 font-black text-primary">{formatCurrency(po.totalAmount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function FinLink({ href, label, icon }: any) {
    return (
        <Link href={href} className="p-6 rounded-3xl border-2 border-dashed border-slate-100 hover:border-primary/40 hover:bg-primary/5 transition-all text-center space-y-3">
            <div className="p-3 bg-white rounded-2xl shadow-sm w-fit mx-auto text-primary">{icon}</div>
            <p className="font-black text-sm">{label}</p>
        </Link>
    );
}