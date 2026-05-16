'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { Account, JournalEntry, ConstructionProject } from '@/lib/types';
import { format, startOfYear, endOfYear, subMonths, eachMonthOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, LineChart as ChartIcon, FileSearch, PieChart, TrendingUp, TrendingDown, Target, Activity } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';

interface IncomeStatementData {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    netIncome: number;
    revenueAccounts: { name: string; total: number }[];
    cogsAccounts: { name: string; total: number }[];
    expenseAccounts: { name: string; total: number }[];
    trendData: any[];
}

export default function IncomeStatementPage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { toast } = useToast();
    const { branding } = useBranding();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<IncomeStatementData | null>(null);
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfYear(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfYear(new Date()));
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    
    // 🛡️ جلب البيانات عبر الخطافات السيادية
    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(
        firestore, 
        user?.currentCompanyId ? 'chartOfAccounts' : null
    );

    const { data: journalEntries, loading: entriesLoading } = useSubscription<JournalEntry>(
        firestore, 
        user?.currentCompanyId ? 'journalEntries' : null, 
        [where('status', '==', 'posted')]
    );

    const { data: projects, loading: projectsLoading } = useSubscription<ConstructionProject>(
        firestore, 
        user?.currentCompanyId ? 'projects' : null
    );

    const handleGenerate = async () => {
        if (accountsLoading || entriesLoading || !dateFrom || !dateTo) return;
        
        setIsGenerating(true);
        setTimeout(() => {
            const start = dateFrom;
            const end = endOfDay(dateTo);
            const trendStart = subMonths(new Date(), 11);

            const filteredEntries = journalEntries.filter(entry => {
                const eDate = toFirestoreDate(entry.date);
                if (!eDate || eDate < start || eDate > end) return false;
                if (selectedProjectId !== 'all' && entry.transactionId !== selectedProjectId) return false;
                return true;
            });

            const accountMaps = {
                revenue: new Map<string, string>(),
                cogs: new Map<string, string>(),
                expense: new Map<string, string>(),
            };

            accounts.forEach(acc => {
                if (!acc.id) return;
                if (acc.code.startsWith('4')) accountMaps.revenue.set(acc.id, acc.name);
                else if (acc.code.startsWith('51')) accountMaps.cogs.set(acc.id, acc.name);
                else if (acc.code.startsWith('5')) accountMaps.expense.set(acc.id, acc.name);
            });
            
            const totals = { revenue: new Map<string, number>(), cogs: new Map<string, number>(), expense: new Map<string, number>() };

            filteredEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    const type = accountMaps.revenue.has(line.accountId) ? 'revenue' : 
                                 accountMaps.cogs.has(line.accountId) ? 'cogs' : 
                                 accountMaps.expense.has(line.accountId) ? 'expense' : null;
                    if (type) {
                        const current = totals[type].get(line.accountId) || 0;
                        totals[type].set(line.accountId, current + (line.credit || 0) - (line.debit || 0));
                    }
                });
            });

            const months = eachMonthOfInterval({ start: trendStart, end: new Date() });
            const trendData = months.map(m => {
                const monthKey = format(m, 'yyyy-MM');
                let monthRev = 0, monthExp = 0;
                
                journalEntries.forEach(e => {
                    const eDate = toFirestoreDate(e.date);
                    if (eDate && format(eDate, 'yyyy-MM') === monthKey) {
                        e.lines.forEach(l => {
                            if (accountMaps.revenue.has(l.accountId)) monthRev += (l.credit || 0) - (l.debit || 0);
                            if (accountMaps.cogs.has(l.accountId) || accountMaps.expense.has(l.accountId)) monthExp += (l.debit || 0) - (l.credit || 0);
                        });
                    }
                });

                return {
                    name: format(m, 'MMM', { locale: ar }),
                    profit: monthRev - monthExp
                };
            });

            const totalRevenue = Array.from(totals.revenue.values()).reduce((s, v) => s + v, 0);
            const totalCogs = Array.from(totals.cogs.values()).reduce((s, v) => s + v, 0);
            const totalExpenses = Array.from(totals.expense.values()).reduce((s, v) => s + v, 0);
            const grossProfit = totalRevenue - totalCogs;

            setReportData({
                totalRevenue,
                totalCogs,
                grossProfit,
                totalExpenses,
                netIncome: grossProfit - totalExpenses,
                revenueAccounts: Array.from(totals.revenue.entries()).map(([id, total]) => ({ name: accountMaps.revenue.get(id)!, total })).filter(a => a.total !== 0),
                cogsAccounts: Array.from(totals.cogs.entries()).map(([id, total]) => ({ name: accountMaps.cogs.get(id)!, total })).filter(a => a.total !== 0),
                expenseAccounts: Array.from(totals.expense.entries()).map(([id, total]) => ({ name: accountMaps.expense.get(id)!, total })).filter(a => a.total !== 0),
                trendData
            });

            setIsGenerating(false);
            toast({ title: 'نجاح التوليد', description: 'تم تحديث قائمة الدخل وتحليل الاتجاهات.' });
        }, 600);
    };

    const projectOptions = useMemo(() => [
        { value: 'all', label: 'كل المنشأة (مجمع)' },
        ...projects.map(p => ({ value: p.id!, label: p.projectName }))
    ], [projects]);

    return (
        <div className="bg-gray-100 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-6 no-print rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-6 border-b">
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="text-primary h-6 w-6"/> قائمة الدخل - تحليل الربحية والاتجاهات
                    </CardTitle>
                    <CardDescription>حلل نتائج الأعمال للفترة المحددة مع رصد منحنى الأرباح السنوي.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">نطاق التحليل</Label>
                            <InlineSearchList 
                                value={selectedProjectId} 
                                onSelect={setSelectedProjectId} 
                                options={projectOptions} 
                                placeholder={projectsLoading ? "تحميل..." : "اختر المشروع..."} 
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">من تاريخ</Label>
                            <DateInput value={dateFrom} onChange={setDateFrom} className="h-11 rounded-xl" />
                        </div>
                        <div className="grid gap-2">
                            <Label className="font-bold mr-1">إلى تاريخ</Label>
                            <DateInput value={dateTo} onChange={setDateTo} className="h-11 rounded-xl" />
                        </div>
                        <Button onClick={handleGenerate} disabled={isGenerating || accountsLoading || entriesLoading} className="h-11 px-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                            {isGenerating ? <Loader2 className="animate-spin h-5 w-5"/> : <FileSearch className="h-5 w-5" />}
                            توليد القائمة
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {reportData ? (
                 <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white p-8 no-print">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <ChartIcon className="h-5 w-5 text-primary" /> منحنى الربح الشهري (آخر 12 شهر)
                            </h3>
                            <Badge className="bg-green-50 text-green-700 border-green-200">التحليل المالي الذكي</Badge>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={reportData.trendData}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#F5820D" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#F5820D" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '1rem', border: 'none', shadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(v: number) => [formatCurrency(v), 'صافي الربح']}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="#F5820D" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <div id="printable-area" className="bg-white p-8 md:p-16 rounded-[3rem] shadow-2xl print:shadow-none border">
                        <header className="flex justify-between items-start pb-8 mb-10 border-b-4 border-primary">
                            <div className="text-left space-y-1">
                                <h2 className="text-4xl font-black text-primary tracking-tighter">قائمة الدخل</h2>
                                <p className="text-xl font-bold text-gray-400 uppercase tracking-widest font-mono">Statement of Income</p>
                                <p className="text-xs text-muted-foreground mt-2">للفترة: {format(dateFrom!, 'dd/MM/yyyy')} - {format(dateTo!, 'dd/MM/yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-6">
                                <Logo className="h-24 w-24 !p-3 shadow-inner border rounded-3xl" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="text-2xl font-black text-[#1e1b4b]">{branding?.company_name || 'Nova ERP'}</h1>
                                    <p className="text-xs text-muted-foreground font-bold">{branding?.address}</p>
                                </div>
                            </div>
                        </header>

                        <section className="space-y-12">
                            <div className="space-y-6">
                                <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-green-600 pr-4">
                                    <TrendingUp className="h-6 w-6 text-green-600" /> الإيرادات التشغيلية
                                </h3>
                                <div className="space-y-2">
                                    {reportData.revenueAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between py-3 border-b border-dashed border-slate-100 px-4">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono font-black text-lg">{formatCurrency(acc.total)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between p-6 bg-green-50 rounded-3xl font-black text-green-800 border-2 border-green-200 items-center">
                                    <span className="text-lg">إجمالي الإيرادات</span>
                                    <span className="font-mono text-3xl">{formatCurrency(reportData.totalRevenue)}</span>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-orange-600 pr-4">
                                    <TrendingDown className="h-6 w-6 text-orange-600" /> تكلفة الإيرادات (COGS)
                                </h3>
                                <div className="space-y-2">
                                    {reportData.cogsAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between py-3 border-b border-dashed border-slate-100 px-4">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono font-bold text-red-600 text-lg">({formatCurrency(acc.total)})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl items-center">
                                <span className="text-2xl font-black">مجمل الربح (Gross Profit)</span>
                                <span className="font-mono text-4xl font-black text-green-400">{formatCurrency(reportData.grossProfit)}</span>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-xl font-black flex items-center gap-3 border-r-8 border-red-600 pr-4">
                                    <PieChart className="h-6 w-6 text-red-600" /> المصاريف العمومية والإدارية
                                </h3>
                                <div className="space-y-2">
                                    {reportData.expenseAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between py-3 border-b border-dashed border-slate-100 px-4">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono text-lg">({formatCurrency(acc.total)})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={cn(
                                "flex justify-between p-10 rounded-[3rem] border-8 transition-all items-center shadow-2xl",
                                reportData.netIncome >= 0 ? "bg-primary text-white border-white/20" : "bg-red-600 text-white border-white/20 shadow-red-100"
                            )}>
                                <span className="text-3xl font-black">صافي الربح للفترة</span>
                                <span className="font-mono font-black text-6xl">{formatCurrency(reportData.netIncome)}</span>
                            </div>
                        </section>

                        <footer className="pt-32 grid grid-cols-2 gap-24 text-center text-[10px] font-black uppercase text-muted-foreground">
                            <div className="space-y-20">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد القسم المالي</p>
                                <div className="pt-2 border-t border-dashed">التوقيع والمصادقة</div>
                            </div>
                            <div className="space-y-20">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد الإدارة العليا</p>
                                <div className="pt-2 border-t border-dashed">الختم الرسمي للمنشأة</div>
                            </div>
                        </footer>
                    </div>
                 </div>
            ) : (
                <div className="h-[70vh] flex flex-col items-center justify-center border-4 border-dashed rounded-[4rem] bg-muted/5 opacity-30 grayscale transition-all">
                    <div className="p-12 bg-muted rounded-full mb-8">
                        <Activity className="h-24 w-24 text-muted-foreground" />
                    </div>
                    <h3 className="text-3xl font-black text-muted-foreground">بانتظار بناء ميزان الأرباح</h3>
                    <p className="text-xl font-bold mt-2">حدد النطاق والمدة واضغط على "توليد" لبدء التحليل الاستراتيجي.</p>
                </div>
            )}
        </div>
    );
}