
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { format, startOfYear, endOfYear, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, LineChart } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';

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
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        const now = new Date();
        setDateFrom(format(startOfYear(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfYear(now), 'yyyy-MM-dd'));
    }, []);

    // Fetch accounts once
    useEffect(() => {
        if (!firestore) return;
        const fetchAccountsData = async () => {
            try {
                const accountsSnap = await getDocs(query(collection(firestore, 'chartOfAccounts')));
                setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            } catch (error) {
                console.error("Error fetching accounts:", error);
            }
        };
        fetchAccountsData();
    }, [firestore]);

    // Fetch entries when date changes
    useEffect(() => {
        if (!firestore || !dateFrom || !dateTo) return;
        const fetchEntries = async () => {
            setLoading(true);
            try {
                const startDate = parseISO(dateFrom);
                startDate.setHours(0, 0, 0, 0);
                const endDate = parseISO(dateTo);
                endDate.setHours(23, 59, 59, 999);

                const entriesQuery = query(
                    collection(firestore, 'journalEntries'),
                    where('date', '>=', Timestamp.fromDate(startDate)),
                    where('date', '<=', Timestamp.fromDate(endDate))
                );
                const entriesSnap = await getDocs(entriesQuery);
                const postedEntries = entriesSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry))
                    .filter(entry => entry.status === 'posted');
                setJournalEntries(postedEntries);
            } catch (error) {
                console.error("Error fetching journal entries:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEntries();
    }, [firestore, dateFrom, dateTo]);

    const incomeStatementData = useMemo((): IncomeStatementData | null => {
        if (loading || accounts.length === 0) return null;

        const accountMaps = {
            revenue: new Map<string, string>(),
            cogs: new Map<string, string>(), // Cost of Goods Sold
            expense: new Map<string, string>(), // Operating Expenses
        };

        accounts.forEach(acc => {
            if (!acc.id) return;
            if (acc.code.startsWith('4')) {
                accountMaps.revenue.set(acc.id, acc.name);
            } else if (acc.code.startsWith('51')) {
                accountMaps.cogs.set(acc.id, acc.name);
            } else if (acc.code.startsWith('5')) {
                accountMaps.expense.set(acc.id, acc.name);
            }
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
        const grossProfit = totalRevenue - totalCogs;
        const totalExpenses = Array.from(totals.expense.values()).reduce((sum, val) => sum + val, 0);
        const netIncome = grossProfit - totalExpenses;

        const revenueAccounts = Array.from(totals.revenue.entries())
            .map(([id, total]) => ({ name: accountMaps.revenue.get(id)!, total }))
            .filter(acc => acc.total !== 0)
            .sort((a, b) => b.total - a.total);
            
        const cogsAccounts = Array.from(totals.cogs.entries())
            .map(([id, total]) => ({ name: accountMaps.cogs.get(id)!, total }))
            .filter(acc => acc.total !== 0)
            .sort((a, b) => b.total - a.total);
            
        const expenseAccounts = Array.from(totals.expense.entries())
            .map(([id, total]) => ({ name: accountMaps.expense.get(id)!, total }))
            .filter(acc => acc.total !== 0)
            .sort((a, b) => b.total - a.total);

        return { totalRevenue, totalCogs, grossProfit, totalExpenses, netIncome, revenueAccounts, cogsAccounts, expenseAccounts };

    }, [loading, accounts, journalEntries]);

    const handlePrint = () => window.print();
    
    const isLoading = loading || brandingLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                 <CardHeader>
                    <CardTitle>قائمة الدخل</CardTitle>
                    <CardDescription>قياس الأداء المالي والربحية للشركة خلال فترة محددة.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="dateFrom">من تاريخ</Label>
                        <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">إلى تاريخ</Label>
                        <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                     </div>
                </CardContent>
            </Card>

            {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!isLoading && incomeStatementData && (
                 <Card 
                    id="printable-area" 
                    className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent bg-no-repeat bg-top bg-cover p-8 md:p-12"
                    style={branding?.letterhead_image_url ? { backgroundImage: `url(${branding.letterhead_image_url})` } : {}}
                >
                    <CardHeader className="p-0">
                         <div className="flex justify-between items-start pb-4">
                            <div className="text-left flex-shrink-0">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">قائمة الدخل</h2>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Income Statement</p>
                                <p className="font-mono text-sm mt-2 text-muted-foreground">تاريخ التقرير: {format(new Date(), 'dd/MM/yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                               <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="font-bold text-lg">{branding?.company_name || 'Nova ERP'}</h1>
                                    <p className="text-sm text-muted-foreground">{branding?.nameEn || 'Nova ERP'}</p>
                                    <p className="text-xs text-muted-foreground mt-2">{branding?.address}</p>
                                </div>
                            </div>
                        </div>
                         <div className="mt-6 text-sm">
                            <p><span className="font-semibold w-24 inline-block">عن الفترة من:</span> {dateFrom ? format(parseISO(dateFrom), 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(parseISO(dateTo), 'dd/MM/yyyy') : ''}</p>
                         </div>
                    </CardHeader>
                    <CardContent className="px-0 pt-6 space-y-6">
                        <div className="space-y-4">
                            {/* Revenue */}
                            <div>
                                <h3 className="font-bold mb-2">الإيرادات</h3>
                                {incomeStatementData.revenueAccounts.map(acc => (
                                    <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                        <span>{acc.name}</span>
                                        <span className="font-mono">{formatCurrency(acc.total)}</span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex justify-between items-center text-sm p-2 font-bold">
                                    <span>إجمالي الإيرادات</span>
                                    <span className="font-mono">{formatCurrency(incomeStatementData.totalRevenue)}</span>
                                </div>
                            </div>

                            {/* Cost of Revenue */}
                            <div>
                                <h3 className="font-bold mb-2">تكلفة الإيرادات (المصاريف التشغيلية المباشرة)</h3>
                                {incomeStatementData.cogsAccounts.map(acc => (
                                    <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                        <span>({acc.name})</span>
                                        <span className="font-mono text-red-600">({formatCurrency(acc.total)})</span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex justify-between items-center text-sm p-2 font-bold">
                                    <span>إجمالي تكلفة الإيرادات</span>
                                    <span className="font-mono text-red-600">({formatCurrency(incomeStatementData.totalCogs)})</span>
                                </div>
                            </div>
                            
                            {/* Gross Profit */}
                            <div className="flex justify-between items-center text-md p-2 font-extrabold bg-muted/50 rounded-md">
                                <span>مجمل الربح</span>
                                <span className="font-mono">{formatCurrency(incomeStatementData.grossProfit)}</span>
                            </div>

                            {/* Operating Expenses */}
                            <div>
                                <h3 className="font-bold mb-2 mt-4">المصاريف الإدارية والعمومية</h3>
                                {incomeStatementData.expenseAccounts.map(acc => (
                                    <div key={acc.name} className="flex justify-between items-center text-sm p-2">
                                        <span>({acc.name})</span>
                                        <span className="font-mono text-red-600">({formatCurrency(acc.total)})</span>
                                    </div>
                                ))}
                                <Separator />
                                <div className="flex justify-between items-center text-sm p-2 font-bold">
                                    <span>إجمالي المصاريف الإدارية والعمومية</span>
                                    <span className="font-mono text-red-600">({formatCurrency(incomeStatementData.totalExpenses)})</span>
                                </div>
                            </div>
                            
                             {/* Net Income */}
                             <Separator className="my-4"/>
                            <div className="flex justify-between items-center text-xl p-4 font-extrabold bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                <span>صافي {incomeStatementData.netIncome >= 0 ? 'الربح' : 'الخسارة'}</span>
                                <span className="font-mono">{formatCurrency(incomeStatementData.netIncome)}</span>
                            </div>

                        </div>
                    </CardContent>
                     <CardFooter className="p-0 pt-8 flex justify-end items-center no-print">
                        <Button onClick={handlePrint}>
                            <Printer className="ml-2 h-4 w-4" />
                            طباعة / تصدير PDF
                        </Button>
                    </CardFooter>
                 </Card>
            )}
        </div>
    );
}
