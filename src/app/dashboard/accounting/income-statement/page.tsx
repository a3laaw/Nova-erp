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
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { format, startOfYear, endOfYear, isBefore, startOfDay } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, LineChart, FileSearch, PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';

interface IncomeStatementData {
    totalRevenue: number;
    totalCogs: number;
    grossProfit: number;
    totalExpenses: number;
    netIncome: number;
    revenueAccounts: { name: string; total: number }[];
    cogsAccounts: { name: string; total: number }[];
    expenseAccounts: { name: string; total: number }[];
}

export default function IncomeStatementPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<IncomeStatementData | null>(null);
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfYear(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfYear(new Date()));

    const handleGenerate = async () => {
        if (!firestore || !dateFrom || !dateTo) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'الرجاء تحديد فترة زمنية صحيحة.' });
            return;
        }
        
        setIsGenerating(true);
        try {
            const [accountsSnap, entriesSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'chartOfAccounts'))),
                getDocs(query(
                    collection(firestore, 'journalEntries'),
                    where('date', '>=', Timestamp.fromDate(dateFrom)),
                    where('date', '<=', Timestamp.fromDate(dateTo)),
                    where('status', '==', 'posted')
                ))
            ]);

            const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            const journalEntries = entriesSnap.docs.map(doc => doc.data() as JournalEntry);

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
            
            const totals = {
                revenue: new Map<string, number>(),
                cogs: new Map<string, number>(),
                expense: new Map<string, number>(),
            };

            journalEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    if (accountMaps.revenue.has(line.accountId)) {
                        const current = totals.revenue.get(line.accountId) || 0;
                        totals.revenue.set(line.accountId, current + (line.credit || 0) - (line.debit || 0));
                    } else if (accountMaps.cogs.has(line.accountId)) {
                        const current = totals.cogs.get(line.accountId) || 0;
                        totals.cogs.set(line.accountId, current + (line.debit || 0) - (line.credit || 0));
                    } else if (accountMaps.expense.has(line.accountId)) {
                        const current = totals.expense.get(line.accountId) || 0;
                        totals.expense.set(line.accountId, current + (line.debit || 0) - (line.credit || 0));
                    }
                });
            });

            setReportData({
                totalRevenue: Array.from(totals.revenue.values()).reduce((sum, val) => sum + val, 0),
                totalCogs: Array.from(totals.cogs.values()).reduce((sum, val) => sum + val, 0),
                get grossProfit() { return this.totalRevenue - this.totalCogs },
                totalExpenses: Array.from(totals.expense.values()).reduce((sum, val) => sum + val, 0),
                get netIncome() { return this.grossProfit - this.totalExpenses },
                revenueAccounts: Array.from(totals.revenue.entries()).map(([id, total]) => ({ name: accountMaps.revenue.get(id)!, total })).filter(a => a.total !== 0),
                cogsAccounts: Array.from(totals.cogs.entries()).map(([id, total]) => ({ name: accountMaps.cogs.get(id)!, total })).filter(a => a.total !== 0),
                expenseAccounts: Array.from(totals.expense.entries()).map(([id, total]) => ({ name: accountMaps.expense.get(id)!, total })).filter(a => a.total !== 0),
            });

        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => window.print();

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print rounded-2xl border-none shadow-sm">
                 <CardHeader>
                    <CardTitle className="text-xl font-black">قائمة الدخل - الربح والخسارة (P&L)</CardTitle>
                    <CardDescription>تحليل الأداء المالي للفترة المحددة بناءً على القيود المرحلة.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="grid gap-2">
                        <Label className="font-bold">من تاريخ</Label>
                        <DateInput value={dateFrom} onChange={setDateFrom} />
                     </div>
                     <div className="grid gap-2">
                        <Label className="font-bold">إلى تاريخ</Label>
                        <DateInput value={dateTo} onChange={setDateTo} />
                     </div>
                     <Button onClick={handleGenerate} disabled={isGenerating} className="h-10 px-8 rounded-xl font-bold gap-2">
                        {isGenerating ? <Loader2 className="animate-spin h-4 w-4"/> : <FileSearch className="h-4 w-4" />}
                        إنشاء القائمة
                     </Button>
                </CardContent>
            </Card>

            {reportData ? (
                 <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <div id="printable-area" className="p-8 md:p-12">
                        <div className="flex justify-between items-start pb-6 mb-8 border-b-4 border-primary">
                            <div className="text-left space-y-1">
                                <h2 className="text-3xl font-black text-primary tracking-tighter">قائمة الدخل</h2>
                                <p className="text-lg font-bold text-gray-500 uppercase tracking-widest font-mono">Profit & Loss Statement</p>
                                <p className="text-xs text-muted-foreground mt-2">للفترة من {format(dateFrom!, 'dd/MM/yyyy')} إلى {format(dateTo!, 'dd/MM/yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                    <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                </div>
                            </div>
                        </div>

                        <CardContent className="px-0 pt-6 space-y-10">
                            {/* الإيرادات */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-black flex items-center gap-2 border-r-4 border-green-600 pr-3">
                                    <TrendingUp className="h-5 w-5 text-green-600" /> الإيرادات التشغيلية
                                </h3>
                                <div className="space-y-2">
                                    {reportData.revenueAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono font-black text-lg">{formatCurrency(acc.total)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center py-3 px-4 bg-green-50 rounded-xl">
                                        <span className="font-black text-green-800">إجمالي الإيرادات</span>
                                        <span className="font-mono font-black text-xl text-green-700">{formatCurrency(reportData.totalRevenue)}</span>
                                    </div>
                                </div>
                            </section>

                            {/* تكلفة الإيرادات */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-black flex items-center gap-2 border-r-4 border-orange-600 pr-3">
                                    <TrendingDown className="h-5 w-5 text-orange-600" /> تكلفة الإيرادات (المباشرة)
                                </h3>
                                <div className="space-y-2">
                                    {reportData.cogsAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono font-black text-lg">({formatCurrency(acc.total)})</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center py-3 px-4 bg-orange-50 rounded-xl">
                                        <span className="font-black text-orange-800">إجمالي تكلفة المبيعات</span>
                                        <span className="font-mono font-black text-xl text-orange-700">({formatCurrency(reportData.totalCogs)})</span>
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-between items-center py-4 px-6 bg-slate-900 text-white rounded-[2rem] shadow-xl">
                                <span className="text-xl font-black">مجمل الربح (Gross Profit)</span>
                                <span className="font-mono font-black text-3xl">{formatCurrency(reportData.grossProfit)}</span>
                            </div>

                            {/* المصاريف الإدارية */}
                            <section className="space-y-4">
                                <h3 className="text-lg font-black flex items-center gap-2 border-r-4 border-red-600 pr-3">
                                    <PieChart className="h-5 w-5 text-red-600" /> المصاريف الإدارية والعمومية
                                </h3>
                                <div className="space-y-2">
                                    {reportData.expenseAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between items-center py-2 border-b border-dashed">
                                            <span className="font-bold text-slate-700">{acc.name}</span>
                                            <span className="font-mono font-bold">({formatCurrency(acc.total)})</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center py-3 px-4 bg-red-50 rounded-xl">
                                        <span className="font-black text-red-800">إجمالي المصاريف العامة</span>
                                        <span className="font-mono font-black text-xl text-red-700">({formatCurrency(reportData.totalExpenses)})</span>
                                    </div>
                                </div>
                            </section>

                            <Separator className="my-10 h-1 bg-primary/20 rounded-full" />

                            <div className={cn(
                                "flex justify-between items-center p-8 rounded-[2.5rem] border-4",
                                reportData.netIncome >= 0 ? "bg-primary text-white border-white/20 shadow-primary/20" : "bg-red-600 text-white border-white/20 shadow-red-100"
                            )}>
                                <div className="space-y-1">
                                    <span className="text-2xl font-black tracking-tighter">صافي {reportData.netIncome >= 0 ? 'الربح' : 'الخسارة'} للفترة</span>
                                    <p className="text-[10px] uppercase font-bold opacity-60">Net Income for the selected period</p>
                                </div>
                                <span className="font-mono font-black text-5xl tabular-nums">{formatCurrency(reportData.netIncome)}</span>
                            </div>
                        </CardContent>

                        <footer className="pt-20 grid grid-cols-2 gap-20 text-center text-[10px] font-black uppercase text-muted-foreground">
                            <div className="space-y-16">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد المحاسب</p>
                                <div className="pt-2 border-t border-dashed">التوقيع</div>
                            </div>
                            <div className="space-y-16">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المدير المالي</p>
                                <div className="pt-2 border-t border-dashed">الختم الرسمي</div>
                            </div>
                        </footer>
                    </div>
                    <div className="no-print p-8 border-t flex justify-end">
                        <Button onClick={handlePrint} className="rounded-xl font-black gap-2 h-12 px-10 shadow-xl shadow-primary/20">
                            <Printer className="h-5 w-5" /> طباعة القائمة الرسمية
                        </Button>
                    </div>
                 </div>
            ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
                    <div className="p-10 bg-muted rounded-full mb-6">
                        <LineChart className="h-24 w-24 text-muted-foreground" />
                    </div>
                    <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحديد الفترة</h3>
                    <p className="text-lg font-bold mt-2">اختر التاريخ واضغط على زر "إنشاء القائمة" لتحليل الأداء المالي للمنظمة.</p>
                </div>
            )}
        </div>
    );
}