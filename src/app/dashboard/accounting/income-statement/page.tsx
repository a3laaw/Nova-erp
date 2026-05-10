'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import type { Account, JournalEntry, ConstructionProject } from '@/lib/types';
import { format, startOfYear, endOfYear, subMonths, eachMonthOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, LineChart as ChartIcon, FileSearch, PieChart, TrendingUp, TrendingDown, Target, Building2, Activity } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { toFirestoreDate } from '@/services/date-converter';

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
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<IncomeStatementData | null>(null);
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfYear(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfYear(new Date()));
    const [selectedProjectId, setSelectedProjectId] = useState('all');
    
    const [projects, setProjects] = useState<ConstructionProject[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);

    useEffect(() => {
        if (!firestore) return;
        setIsLoadingProjects(true);
        getDocs(collection(firestore, 'projects')).then(snap => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as ConstructionProject)));
        }).finally(() => setIsLoadingProjects(false));
    }, [firestore]);

    const handleGenerate = async () => {
        if (!firestore || !dateFrom || !dateTo) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تحديد فترة زمنية صحيحة.' });
            return;
        }
        
        setIsGenerating(true);
        try {
            const start = Timestamp.fromDate(dateFrom);
            const end = Timestamp.fromDate(dateTo);

            // جلب بيانات سنة كاملة للرسم البياني
            const trendStart = Timestamp.fromDate(subMonths(new Date(), 11));

            const [accountsSnap, entriesSnap, trendSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'chartOfAccounts'))),
                getDocs(query(
                    collection(firestore, 'journalEntries'),
                    where('date', '>=', start),
                    where('date', '<=', end),
                    where('status', '==', 'posted')
                )),
                getDocs(query(
                    collection(firestore, 'journalEntries'),
                    where('date', '>=', trendStart),
                    where('status', '==', 'posted')
                ))
            ]);

            const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            const journalEntries = entriesSnap.docs.map(doc => doc.data() as JournalEntry);
            const trendEntries = trendSnap.docs.map(doc => doc.data() as JournalEntry);

            const filteredEntries = selectedProjectId === 'all' 
                ? journalEntries 
                : journalEntries.filter(e => e.transactionId === selectedProjectId);

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

            // حساب بيانات الاتجاه الربحي (Trend Analysis)
            const months = eachMonthOfInterval({ start: trendStart.toDate(), end: new Date() });
            const trendData = months.map(m => {
                const monthKey = format(m, 'yyyy-MM');
                let monthRev = 0, monthExp = 0;
                
                trendEntries.forEach(e => {
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

            setReportData({
                totalRevenue: Array.from(totals.revenue.values()).reduce((s, v) => s + v, 0),
                totalCogs: Array.from(totals.cogs.values()).reduce((s, v) => s + v, 0),
                get grossProfit() { return this.totalRevenue - this.totalCogs },
                totalExpenses: Array.from(totals.expense.values()).reduce((s, v) => s + v, 0),
                get netIncome() { return this.grossProfit - this.totalExpenses },
                revenueAccounts: Array.from(totals.revenue.entries()).map(([id, total]) => ({ name: accountMaps.revenue.get(id)!, total })).filter(a => a.total !== 0),
                cogsAccounts: Array.from(totals.cogs.entries()).map(([id, total]) => ({ name: accountMaps.cogs.get(id)!, total })).filter(a => a.total !== 0),
                expenseAccounts: Array.from(totals.expense.entries()).map(([id, total]) => ({ name: accountMaps.expense.get(id)!, total })).filter(a => a.total !== 0),
                trendData
            });

            toast({ title: 'نجاح التوليد', description: 'تم تحديث قائمة الدخل وتحليل الاتجاهات.' });

        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
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
                                placeholder={isLoadingProjects ? "تحميل..." : "اختر المشروع..."} 
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
                        <Button onClick={handleGenerate} disabled={isGenerating} className="h-11 px-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                            {isGenerating ? <Loader2 className="animate-spin h-5 w-5"/> : <FileSearch className="h-5 w-5" />}
                            توليد القائمة
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {reportData ? (
                 <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
                    
                    {/* ✨ تحليل الاتجاه الربحي (Trend Analysis) ✨ */}
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
                                            <stop offset="5%" stopColor="#7209B7" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#7209B7" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                                    <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '1rem', border: 'none', shadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(v: number) => [formatCurrency(v), 'صافي الربح']}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="#7209B7" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
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
                                {selectedProjectId !== 'all' && (
                                    <Badge className="bg-primary mt-2 px-6 py-1 rounded-full font-black text-sm">
                                        مركز ربحية: {projects.find(p => p.id === selectedProjectId)?.projectName}
                                    </Badge>
                                )}
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
                            {/* الإيرادات */}
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

                            {/* التكاليف المباشرة */}
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

                            {/* مجمل الربح */}
                            <div className="flex justify-between p-8 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl items-center border-4 border-slate-800">
                                <div className="space-y-1">
                                    <span className="text-2xl font-black">مجمل الربح (Gross Profit)</span>
                                    <p className="text-[10px] uppercase font-bold opacity-50">Operational Margin before overhead</p>
                                </div>
                                <span className="font-mono text-4xl font-black text-green-400">{formatCurrency(reportData.grossProfit)}</span>
                            </div>

                            {/* المصاريف الإدارية */}
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
                                <div className="flex justify-between p-4 bg-slate-50 rounded-2xl font-bold text-slate-600 border px-8">
                                    <span>إجمالي المصروفات التشغيلية</span>
                                    <span className="font-mono text-xl">{formatCurrency(reportData.totalExpenses)}</span>
                                </div>
                            </div>

                            {/* صافي الربح النهائي */}
                            <div className={cn(
                                "flex justify-between p-10 rounded-[3rem] border-8 transition-all items-center shadow-2xl",
                                reportData.netIncome >= 0 ? "bg-primary text-white border-white/20 shadow-primary/20" : "bg-red-600 text-white border-white/20 shadow-red-100"
                            )}>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        {reportData.netIncome >= 0 ? <CheckCircle2 className="h-8 w-8" /> : <AlertTriangle className="h-8 w-8" />}
                                        <span className="text-3xl font-black tracking-tighter">صافي {reportData.netIncome >= 0 ? 'الربح' : 'الخسارة'} للفترة</span>
                                    </div>
                                    <p className="text-xs uppercase font-bold opacity-70 pr-11">Net Income for selected projects & period</p>
                                </div>
                                <span className="font-mono font-black text-6xl tabular-nums tracking-tighter">{formatCurrency(reportData.netIncome)}</span>
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
                    
                    <div className="flex justify-end no-print pb-20">
                        <Button onClick={() => window.print()} className="h-16 px-16 rounded-[2.5rem] font-black text-xl gap-3 shadow-2xl shadow-primary/30">
                            <Printer className="h-6 w-6" /> طباعة التقرير الختامي المعتمد
                        </Button>
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
