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
import { Loader2, Printer, LineChart, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';

interface IncomeStatementData {
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    revenueAccounts: { name: string; total: number }[];
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

    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const [accountsSnap, entriesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'))),
                    getDocs(query(collection(firestore, 'journalEntries'), where('status', '==', 'posted'))),
                ]);
                setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
                setJournalEntries(entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)));
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore]);

    const incomeStatementData = useMemo((): IncomeStatementData | null => {
        if (loading || !dateFrom || !dateTo) return null;

        const startDate = parseISO(dateFrom);
        const endDate = parseISO(dateTo);
        endDate.setHours(23, 59, 59, 999);

        const incomeAccountIds = new Map(accounts.filter(a => a.type === 'income').map(a => [a.id, a.name]));
        const expenseAccountIds = new Map(accounts.filter(a => a.type === 'expense').map(a => [a.id, a.name]));

        const revenueTotals = new Map<string, number>();
        const expenseTotals = new Map<string, number>();

        journalEntries
            .filter(entry => {
                const entryDate = (entry.date as Timestamp).toDate();
                return entryDate >= startDate && entryDate <= endDate;
            })
            .forEach(entry => {
                entry.lines.forEach(line => {
                    if (incomeAccountIds.has(line.accountId)) {
                        const current = revenueTotals.get(line.accountId) || 0;
                        revenueTotals.set(line.accountId, current + (line.credit || 0) - (line.debit || 0));
                    } else if (expenseAccountIds.has(line.accountId)) {
                        const current = expenseTotals.get(line.accountId) || 0;
                        expenseTotals.set(line.accountId, current + (line.debit || 0) - (line.credit || 0));
                    }
                });
            });

        const totalRevenue = Array.from(revenueTotals.values()).reduce((sum, val) => sum + val, 0);
        const totalExpenses = Array.from(expenseTotals.values()).reduce((sum, val) => sum + val, 0);
        const netIncome = totalRevenue - totalExpenses;

        const revenueAccounts = Array.from(revenueTotals.entries())
            .map(([id, total]) => ({ name: incomeAccountIds.get(id)!, total }))
            .sort((a, b) => b.total - a.total);
            
        const expenseAccounts = Array.from(expenseTotals.entries())
            .map(([id, total]) => ({ name: expenseAccountIds.get(id)!, total }))
            .sort((a, b) => b.total - a.total);

        return { totalRevenue, totalExpenses, netIncome, revenueAccounts, expenseAccounts };

    }, [loading, accounts, journalEntries, dateFrom, dateTo]);

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
                 <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <CardHeader className="p-8 md:p-12">
                        {branding?.letterhead_image_url ? (
                             <img src={branding.letterhead_image_url} alt={`${branding.company_name || ''} Letterhead`} className="w-full h-auto object-contain max-h-[150px] mb-4"/>
                        ) : (
                             <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
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
                        )}
                         <div className="mt-6 text-sm">
                            <p><span className="font-semibold w-24 inline-block">عن الفترة من:</span> {dateFrom ? format(parseISO(dateFrom), 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(parseISO(dateTo), 'dd/MM/yyyy') : ''}</p>
                         </div>
                    </CardHeader>
                    <CardContent className="px-8 md:px-12 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                                <CardHeader><CardTitle className="text-green-700 dark:text-green-400 text-base flex items-center justify-center gap-2"><TrendingUp/> إجمالي الإيرادات</CardTitle></CardHeader>
                                <CardContent><p className="text-2xl font-bold font-mono">{formatCurrency(incomeStatementData.totalRevenue)}</p></CardContent>
                            </Card>
                            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                                <CardHeader><CardTitle className="text-red-700 dark:text-red-400 text-base flex items-center justify-center gap-2"><TrendingDown/> إجمالي المصروفات</CardTitle></CardHeader>
                                <CardContent><p className="text-2xl font-bold font-mono">{formatCurrency(incomeStatementData.totalExpenses)}</p></CardContent>
                            </Card>
                            <Card className={incomeStatementData.netIncome >= 0 ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" : "bg-destructive/10 border-destructive/50"}>
                                <CardHeader><CardTitle className={incomeStatementData.netIncome >= 0 ? "text-blue-700 dark:text-blue-400 text-base flex items-center justify-center gap-2" : "text-destructive text-base flex items-center justify-center gap-2"}><Scale/> صافي {incomeStatementData.netIncome >= 0 ? 'الربح' : 'الخسارة'}</CardTitle></CardHeader>
                                <CardContent><p className="text-2xl font-bold font-mono">{formatCurrency(incomeStatementData.netIncome)}</p></CardContent>
                            </Card>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                             <div>
                                <h3 className="font-bold mb-2">تفاصيل الإيرادات</h3>
                                <div className="border rounded-lg p-2 space-y-2">
                                    {incomeStatementData.revenueAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded">
                                            <span>{acc.name}</span>
                                            <span className="font-mono">{formatCurrency(acc.total)}</span>
                                        </div>
                                    ))}
                                    {incomeStatementData.revenueAccounts.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد إيرادات في هذه الفترة.</p>}
                                    <div className="flex justify-between items-center text-sm p-2 font-bold border-t mt-2">
                                        <span>إجمالي الإيرادات</span>
                                        <span className="font-mono">{formatCurrency(incomeStatementData.totalRevenue)}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold mb-2">تفاصيل المصروفات</h3>
                                <div className="border rounded-lg p-2 space-y-2">
                                    {incomeStatementData.expenseAccounts.map(acc => (
                                        <div key={acc.name} className="flex justify-between items-center text-sm p-2 hover:bg-muted/50 rounded">
                                            <span>{acc.name}</span>
                                            <span className="font-mono">{formatCurrency(acc.total)}</span>
                                        </div>
                                    ))}
                                    {incomeStatementData.expenseAccounts.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">لا توجد مصروفات في هذه الفترة.</p>}
                                    <div className="flex justify-between items-center text-sm p-2 font-bold border-t mt-2">
                                        <span>إجمالي المصروفات</span>
                                        <span className="font-mono">{formatCurrency(incomeStatementData.totalExpenses)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                     <CardFooter className="p-8 md:p-12 flex justify-end items-center no-print">
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