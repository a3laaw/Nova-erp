
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { PaymentApplication } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Coins, 
    Search, 
    PlusCircle, 
    Eye, 
    ArrowRight, 
    Sparkles,
    Filter,
    Activity,
    Clock
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
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

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    submitted: 'bg-blue-100 text-blue-800 border-blue-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    paid: 'bg-primary text-primary-foreground border-primary',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة مراجعة',
    submitted: 'مرسل للعميل',
    approved: 'معتمد مالياً',
    paid: 'تم التحصيل',
    cancelled: 'ملغي',
};

export default function PaymentApplicationsPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const appsQuery = useMemo(() => [orderBy('date', 'desc')], []);
    const { data: apps, loading } = useSubscription<PaymentApplication>(firestore, 'payment_applications', appsQuery);

    const filteredApps = useMemo(() => {
        if (!searchQuery) return apps;
        const lower = searchQuery.toLowerCase();
        return apps.filter(app => 
            app.applicationNumber.toLowerCase().includes(lower) || 
            app.clientName.toLowerCase().includes(lower) ||
            (app.projectName && app.projectName.toLowerCase().includes(lower))
        );
    }, [apps, searchQuery]);

    const stats = useMemo(() => {
        const total = filteredApps.reduce((sum, a) => sum + (a.totalAmount || 0), 0);
        const collected = filteredApps.filter(a => a.status === 'paid').reduce((sum, a) => sum + (a.totalAmount || 0), 0);
        return { total, collected, pending: total - collected };
    }, [filteredApps]);

    if (loading && apps.length === 0) return <div className="p-8"><Skeleton className="h-[600px] w-full rounded-[3rem]" /></div>;

    return (
        <div className="space-y-10" dir="rtl">
            {/* 🛡️ الهيدر المحدث بالهوية البرتقالية 🛡️ */}
            <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-gradient-to-r from-[#FF7A00] to-[#FFB000] text-white relative">
                <div className="absolute top-0 right-0 w-80 h-full bg-white/10 -skew-x-12 transform translate-x-32 pointer-events-none" />
                <CardHeader className="pb-10 pt-10 px-10 relative z-10">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-black text-white tracking-tighter">أرشيف المستخلصات والمطالبات</CardTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Sparkles className="h-4 w-4 text-amber-200 animate-pulse" />
                                    <CardDescription className="text-white/90 font-bold text-sm">سجل مطالبات الدفع الموجهة للعملاء بناءً على الإنجاز الفني والميداني.</CardDescription>
                                </div>
                            </div>
                            <div className="p-5 bg-white/20 rounded-[2rem] backdrop-blur-xl border border-white/40 shadow-2xl">
                                <Coins className="h-10 w-10 text-white" />
                            </div>
                        </div>
                        <Button asChild className="h-12 px-8 rounded-2xl font-black gap-2 bg-white text-[#FF7A00] shadow-xl hover:bg-slate-50 border-none transition-transform hover:scale-105">
                            <Link href="/dashboard/construction/payment-applications/new">
                                <PlusCircle className="h-5 w-5" />
                                إصدار مستخلص جديد
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">إجمالي المطالبات المعتمدة</p>
                    <h4 className="text-4xl font-black font-mono text-slate-900 tracking-tighter">{formatCurrency(stats.total)}</h4>
                </Card>
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المحصل فعلياً</p>
                    <h4 className="text-4xl font-black font-mono text-green-600 tracking-tighter">{formatCurrency(stats.collected)}</h4>
                </Card>
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">الرصيد تحت التحصيل</p>
                    <h4 className="text-4xl font-black font-mono text-primary tracking-tighter">{formatCurrency(stats.pending)}</h4>
                </Card>
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
                        ترتيب تنازلي (الأحدث أولاً)
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-[#F8F9FE]">
                            <TableRow className="h-14 border-none">
                                <TableHead className="px-10 font-black text-[#7209B7]">رقم المستخلص</TableHead>
                                <TableHead className="font-black text-[#7209B7]">المالك والمشروع</TableHead>
                                <TableHead className="font-black text-[#7209B7] text-center">تاريخ الإصدار</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7]">القيمة الإجمالية</TableHead>
                                <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
                                <TableHead className="w-[100px] text-center font-black text-[#7209B7]">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredApps.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic text-xl">لا توجد مستخلصات مسجلة.</TableCell></TableRow>
                            ) : (
                                filteredApps.map(app => (
                                    <TableRow key={app.id} className="h-20 hover:bg-[#F3E8FF]/20 group transition-colors border-b last:border-0">
                                        <TableCell className="px-10 font-mono font-black text-primary">
                                            <Link href={`/dashboard/construction/payment-applications/${app.id}`} className="hover:underline">
                                                {app.applicationNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-slate-900">{app.clientName}</span>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{app.projectName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs opacity-60 font-bold">
                                            {toFirestoreDate(app.date) ? format(toFirestoreDate(app.date)!, 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">
                                            {formatCurrency(app.totalAmount)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn("px-4 py-1 rounded-full font-black text-[9px] border-2", statusColors[app.status])}>
                                                {statusTranslations[app.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center pr-6">
                                            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-2xl border bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href={`/dashboard/construction/payment-applications/${app.id}`}>
                                                    <Eye className="h-5 w-5 text-primary" />
                                                </Link>
                                            </Button>
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
