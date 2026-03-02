
'use client';

import { useState, useMemo } from 'react';
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
import { format, startOfYear, endOfYear } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, LineChart, FileSearch } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { DateInput } from '@/components/ui/date-input';

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
    const { branding, loading: brandingLoading } = useBranding();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<IncomeStatementData | null>(null);
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfYear(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfYear(new Date()));

    const handleGenerate = async () => {
        if (!firestore || !dateFrom || !dateTo) return;
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

            const totalRevenue = Array.from(totals.revenue.values()).reduce((sum, val) => sum + val, 0);
            const totalCogs = Array.from(totals.cogs.values()).reduce((sum, val) => sum + val, 0);
            const totalExpenses = Array.from(totals.expense.values()).reduce((sum, val) => sum + val, 0);

            setReportData({
                totalRevenue,
                totalCogs,
                grossProfit: totalRevenue - totalCogs,
                totalExpenses,
                netIncome: (totalRevenue - totalCogs) - totalExpenses,
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
                    <CardTitle className="text-xl font-black">تقرير قائمة الدخل (النتائج المثبتة)</CardTitle>
                    <CardDescription>قياس الأداء المالي والربحية للشركة. اضبط التاريخ ثم اضغط على زر التوليد لتثبيت القراءات.</CardDescription>
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
                        إنشاء التقرير
                     </Button>
                </CardContent>
            </Card>

            {brandingLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!brandingLoading && reportData ? (
                 <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent">
                    <div id="printable-area" className="printable-content">
                        {branding?.letterhead_image_url && (
                            <img src={branding.letterhead_image_url} alt="Letterhead" className="w-full h-auto"/>
                        )}
                        <div className="p-8 md:p-12">
                            <CardHeader className="p-0">
                                <div className="flex justify-between items-start pb-4">
                                    <div className="text-left flex-shrink-0">
                                        <h2 className="text-2xl font-bold text-gray-800">قائمة الدخل</h2>
                                        <p className="text-lg font-semibold text-gray-700">Income Statement</p>
                                        <p className="font-mono text-sm mt-2 text-muted-foreground">تاريخ الاستخراج: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                        <div>
                                            <h1 className="font-bold text-lg">{branding?.company_name || 'Nova ERP'}</h1>
                                            <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-6 text-sm">
                                    <p><span className="font-semibold w-24 inline-block">عن الفترة من:</span> {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(dateTo, 'dd/MM/yyyy') : ''}</p>
                                </div>
                            </CardHeader>
                            <CardContent className="px-0 pt-6 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-bold mb-2">الإيرادات</h3>
                                        {reportData.revenueAccounts.map(acc => (
                                            <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                                <span>{acc.name}</span>
                                                <span className="font-mono">{formatCurrency(acc.total)}</span>
                                            </div>
                                        ))}
                                        <Separator />
                                        <div className="flex justify-between items-center text-sm p-2 font-bold">
                                            <span>إجمالي الإيرادات</span>
                                            <span className="font-mono">{formatCurrency(reportData.totalRevenue)}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-bold mb-2">تكلفة الإيرادات (المصاريف التشغيلية)</h3>
                                        {reportData.cogsAccounts.map(acc => (
                                            <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                                <span>({acc.name})</span>
                                                <span className="font-mono text-red-600">({formatCurrency(acc.total)})</span>
                                            </div>
                                        ))}
                                        <Separator />
                                        <div className="flex justify-between items-center text-sm p-2 font-bold">
                                            <span>إجمالي تكلفة الإيرادات</span>
                                            <span className="font-mono text-red-600">({formatCurrency(reportData.totalCogs)})</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center text-md p-2 font-extrabold bg-muted/50 rounded-md">
                                        <span>مجمل الربح</span>
                                        <span className="font-mono">{formatCurrency(reportData.grossProfit)}</span>
                                    </div>

                                    <div>
                                        <h3 className="font-bold mb-2 mt-4">المصاريف الإدارية والعمومية</h3>
                                        {reportData.expenseAccounts.map(acc => (
                                            <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                                <span>({acc.name})</span>
                                                <span className="font-mono text-red-600">({formatCurrency(acc.total)})</span>
                                            </div>
                                        ))}
                                        <Separator />
                                        <div className="flex justify-between items-center text-sm p-2 font-bold">
                                            <span>إجمالي المصاريف الإدارية</span>
                                            <span className="font-mono text-red-600">({formatCurrency(reportData.totalExpenses)})</span>
                                        </div>
                                    </div>
                                    
                                    <Separator className="my-4"/>
                                    <div className="flex justify-between items-center text-xl p-4 font-extrabold bg-blue-50 rounded-lg border border-blue-200">
                                        <span>صافي {reportData.netIncome >= 0 ? 'الربح' : 'الخسارة'}</span>
                                        <span className="font-mono">{formatCurrency(reportData.netIncome)}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="p-0 pt-8 flex justify-end items-center no-print">
                                <Button onClick={handlePrint}>
                                    <Printer className="ml-2 h-4 w-4" /> طباعة / تصدير PDF
                                </Button>
                            </CardFooter>
                        </div>
                    </div>
                 </div>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-40 no-print">
                    <LineChart className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black text-muted-foreground">اضبط الفترة الزمنية واضغط على زر "إنشاء التقرير" لعرض النتائج المعتمدة.</p>
                </div>
            )}
        </div>
    );
}
