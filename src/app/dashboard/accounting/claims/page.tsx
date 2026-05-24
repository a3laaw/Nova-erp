'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PaymentApplication, CashReceipt } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    Coins, 
    Search, 
    ArrowDownLeft, 
    Clock, 
    AlertCircle, 
    CheckCircle2, 
    TrendingUp, 
    Filter,
    Activity,
    Landmark,
    Sparkles,
    Wallet,
    Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * شاشة المطالبات المالية والتحصيل (Claims & Collection Control Center):
 * - تجميع كافة المستخلصات المعتمدة بانتظار التحصيل.
 * - رصد أعمار الديون والتقادم الزمني.
 * - إحصائيات التدفق النقدي من واقع المطالبات.
 */
export default function FinancialClaimsPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    // 1. جلب كافة المستخلصات (المطالبات)
    const appsQuery = useMemo(() => [orderBy('date', 'desc')], []);
    const { data: apps, loading: appsLoading } = useSubscription<PaymentApplication>(firestore, 'payment_applications', appsQuery);

    // 2. جلب السندات لمطابقة التحصيل
    const { data: receipts } = useSubscription<CashReceipt>(firestore, 'cashReceipts');

    const processedClaims = useMemo(() => {
        if (!apps) return [];

        const now = new Date();
        return apps.filter(app => app.status !== 'cancelled').map(app => {
            const appDate = toFirestoreDate(app.date) || now;
            
            // مطابقة التحصيلات التي تشير إلى رقم المستخلص في البيان
            const collectedForThisApp = (receipts || [])
                .filter(r => r.projectId === app.projectId && r.description.includes(app.applicationNumber))
                .reduce((sum, r) => sum + r.amount, 0);

            const remaining = Math.max(0, app.totalAmount - collectedForThisApp);
            const agingDays = differenceInDays(now, appDate);

            return {
                ...app,
                collectedForThisApp,
                remaining,
                agingDays,
                isOverdue: agingDays > 30 && remaining > 0,
                isCritical: agingDays > 60 && remaining > 0
            };
        });
    }, [apps, receipts]);

    const filteredClaims = useMemo(() => {
        if (!searchQuery) return processedClaims;
        const lower = searchQuery.toLowerCase();
        return processedClaims.filter(c => 
            c.applicationNumber.toLowerCase().includes(lower) || 
            c.clientName.toLowerCase().includes(lower) ||
            (c.projectName && c.projectName.toLowerCase().includes(lower))
        );
    }, [processedClaims, searchQuery]);

    const stats = useMemo(() => {
        const totalOutstanding = filteredClaims.reduce((sum, c) => sum + c.remaining, 0);
        const criticalCount = filteredClaims.filter(c => c.isCritical).length;
        const pendingTotal = filteredClaims.filter(c => c.remaining > 0).length;
        return { totalOutstanding, criticalCount, pendingTotal };
    }, [filteredClaims]);

    if (appsLoading) return <div className="p-8"><Skeleton className="h-[600px] w-full rounded-[3rem]" /></div>;

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">مركز المطالبات والتحصيل المالي</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">متابعة المستخلصات المعتمدة، رصد أعمار الديون، وتوثيق التحصيل النقدي.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Coins className="h-10 w-10 text-white" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                    title="إجمالي المطالبات المعلقة" 
                    value={stats.totalOutstanding} 
                    icon={<Wallet className="h-5 w-5" />} 
                    color="text-primary bg-primary/10" 
                    description="مبالغ بانتظار التحصيل الفعلي"
                />
                <StatCard 
                    title="مطالبات حرجة (60+ يوم)" 
                    value={stats.criticalCount} 
                    icon={<AlertCircle className="h-5 w-5" />} 
                    color="text-red-600 bg-red-50" 
                    description="تتطلب متابعة قانونية فورية"
                    isCount
                />
                <StatCard 
                    title="عدد المطالبات النشطة" 
                    value={stats.pendingTotal} 
                    icon={<Activity className="h-5 w-5" />} 
                    color="text-blue-600 bg-blue-50" 
                    description="مستخلصات قيد المتابعة المالية"
                    isCount
                />
            </div>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardHeader className="bg-muted/10 border-b p-8 px-10 flex flex-row items-center justify-between">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                        <Input 
                            placeholder="بحث برقم المستخلص أو العميل..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="pl-10 h-12 rounded-2xl bg-white border-none shadow-inner font-bold" 
                        />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Filter className="h-3 w-3" />
                        فرز حسب الأقدمية
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-[#F8F9FE]">
                            <TableRow className="h-14 border-none">
                                <TableHead className="px-10 font-black text-[#7209B7]">رقم المطالبة</TableHead>
                                <TableHead className="font-black text-[#7209B7]">العميل والمشروع</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7]">قيمة المطالبة</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7] bg-green-50 text-green-700">المتبقي</TableHead>
                                <TableHead className="text-center font-black text-[#7209B7]">عمر الدين</TableHead>
                                <TableHead className="text-center font-black text-[#7209B7]">إجراء التحصيل</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClaims.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic text-xl">لا توجد مطالبات نشطة.</TableCell></TableRow>
                            ) : (
                                filteredClaims.map(claim => (
                                    <TableRow key={claim.id} className={cn("h-20 hover:bg-[#F3E8FF]/20 group transition-colors", claim.isCritical && "bg-red-50/30")}>
                                        <TableCell className="px-10 font-mono font-black text-primary">
                                            <Link href={`/dashboard/construction/payment-applications/${claim.id}`} className="hover:underline">
                                                {claim.applicationNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900">{claim.clientName}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{claim.projectName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-bold text-slate-400">{formatCurrency(claim.totalAmount)}</TableCell>
                                        <TableCell className="text-left font-mono font-black text-2xl text-green-700 bg-green-50/20 border-r border-green-100">
                                            {claim.remaining > 0 ? formatCurrency(claim.remaining) : <Badge className="bg-green-600 text-white">مسدد</Badge>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn(
                                                "font-mono font-black px-4",
                                                claim.isCritical ? "bg-red-600 text-white border-none animate-pulse" : 
                                                claim.isOverdue ? "bg-orange-100 text-orange-700 border-orange-200" : 
                                                "bg-blue-50 text-blue-700 border-blue-100"
                                            )}>
                                                {claim.agingDays} يوم
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {claim.remaining > 0 ? (
                                                <Button asChild variant="outline" className="h-10 rounded-xl font-black gap-2 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                                                    <Link href={`/dashboard/accounting/cash-receipts/new?clientId=${claim.clientId}&projectId=${claim.projectId}&amount=${claim.remaining}&description=${encodeURIComponent(`سداد مستخلص #${claim.applicationNumber}`)}`}>
                                                        <ArrowDownLeft className="h-4 w-4" /> تحصيل السداد
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <div className="p-2 bg-green-100 rounded-xl text-green-700 mx-auto w-fit shadow-inner">
                                                    <CheckCircle2 className="h-5 w-5" />
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({ title, value, icon, color, description, isCount }: any) {
    return (
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group hover:scale-[1.02] transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
                <div className={cn("p-3 rounded-2xl shadow-inner", color)}>
                    {icon}
                </div>
                <div className="h-1 w-12 bg-slate-100 rounded-full group-hover:bg-primary/20 transition-all" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
                <h4 className="text-4xl font-black font-mono tracking-tighter text-slate-900">
                    {isCount ? value : formatCurrency(value)}
                </h4>
            </div>
            <p className="text-[10px] font-bold text-slate-500 mt-2 italic">{description}</p>
        </Card>
    );
}