
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
import { format, endOfYear, parseISO } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, Scale, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface BalanceSheetData {
    assets: {
        current: { name: string; balance: number }[];
        nonCurrent: { name: string; balance: number }[];
        totalCurrent: number;
        totalNonCurrent: number;
        total: number;
    };
    liabilitiesAndEquity: {
        currentLiabilities: { name: string; balance: number }[];
        nonCurrentLiabilities: { name: string; balance: number }[];
        equity: { name: string; balance: number }[];
        totalCurrentLiabilities: number;
        totalNonCurrentLiabilities: number;
        totalEquity: number;
        total: number;
    };
    isBalanced: boolean;
}

const AccountRow = ({ name, balance, className }: { name: string, balance: number, className?: string }) => (
    <div className={cn("flex justify-between py-1.5", className)}>
        <span>{name}</span>
        <span className="font-mono">{formatCurrency(balance)}</span>
    </div>
);


export default function BalanceSheetPage() {
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    
    const [asOfDate, setAsOfDate] = useState<string>('');

    useEffect(() => {
        setAsOfDate(format(endOfYear(new Date()), 'yyyy-MM-dd'));
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
        if (!firestore || !asOfDate) return;
        const fetchEntries = async () => {
            setLoading(true);
            try {
                const endDate = parseISO(asOfDate);
                endDate.setHours(23, 59, 59, 999);

                const entriesQuery = query(
                    collection(firestore, 'journalEntries'), 
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
    }, [firestore, asOfDate]);

    const balanceSheetData = useMemo((): BalanceSheetData | null => {
        if (loading || !asOfDate || accounts.length === 0) return null;

        const endDate = parseISO(asOfDate);

        const accountBalances = new Map<string, number>();

        journalEntries
            .forEach(entry => {
                entry.lines.forEach(line => {
                    const acc = accounts.find(a => a.id === line.accountId);
                    if (!acc) return;
                    
                    const currentBalance = accountBalances.get(line.accountId) || 0;
                    let balanceChange = 0;
                    
                    if (acc.type === 'asset' || acc.type === 'expense') {
                        balanceChange = (line.debit || 0) - (line.credit || 0);
                    } else { // Liability, Equity, Income
                        balanceChange = (line.credit || 0) - (line.debit || 0);
                    }
                    accountBalances.set(line.accountId, currentBalance + balanceChange);
                });
            });

        const data: BalanceSheetData = {
            assets: { current: [], nonCurrent: [], totalCurrent: 0, totalNonCurrent: 0, total: 0 },
            liabilitiesAndEquity: { currentLiabilities: [], nonCurrentLiabilities: [], equity: [], totalCurrentLiabilities: 0, totalNonCurrentLiabilities: 0, totalEquity: 0, total: 0 },
            isBalanced: false,
        };
        
        let netIncome = 0;
        
        accountBalances.forEach((balance, accountId) => {
            const acc = accounts.find(a => a.id === accountId)!;
            // Assumes all income/expense accounts contribute to the period's net income.
            // A more complex implementation might filter by date again, but this is sufficient for balance sheet.
            if (acc.type === 'income') netIncome += balance;
            if (acc.type === 'expense') netIncome -= balance;
        });
        
        accounts.forEach(acc => {
            const balance = accountBalances.get(acc.id!) || 0;
            if (balance === 0 && acc.type !== 'equity') return;

            const item = { name: acc.name, balance };
            
            if (acc.code.startsWith('11')) { data.assets.current.push(item); data.assets.totalCurrent += balance; }
            else if (acc.code.startsWith('1')) { data.assets.nonCurrent.push(item); data.assets.totalNonCurrent += balance; }
            else if (acc.code.startsWith('21')) { data.liabilitiesAndEquity.currentLiabilities.push(item); data.liabilitiesAndEquity.totalCurrentLiabilities += balance; }
            else if (acc.code.startsWith('2')) { data.liabilitiesAndEquity.nonCurrentLiabilities.push(item); data.liabilitiesAndEquity.totalNonCurrentLiabilities += balance; }
            else if (acc.code.startsWith('3')) {
                if (acc.name.includes('أرباح')) {
                     item.balance += netIncome;
                }
                data.liabilitiesAndEquity.equity.push(item); 
                data.liabilitiesAndEquity.totalEquity += item.balance;
            }
        });
        
        data.assets.total = data.assets.totalCurrent + data.assets.totalNonCurrent;
        data.liabilitiesAndEquity.total = data.liabilitiesAndEquity.totalCurrentLiabilities + data.liabilitiesAndEquity.totalNonCurrentLiabilities + data.liabilitiesAndEquity.totalEquity;

        data.isBalanced = Math.abs(data.assets.total - data.liabilitiesAndEquity.total) < 0.01;

        return data;

    }, [loading, accounts, journalEntries, asOfDate]);

    const handlePrint = () => window.print();
    const isLoading = loading || brandingLoading;

    const renderSection = (title: string, items: { name: string; balance: number }[], total: number) => (
        <div className="space-y-1">
            <h4 className="font-bold border-b pb-1 mb-2">{title}</h4>
            {items.map(item => <AccountRow key={item.name} name={item.name} balance={item.balance} />)}
            <Separator className="my-2" />
            <AccountRow name={`إجمالي ${title}`} balance={total} className="font-bold bg-muted/50 p-2 rounded-md" />
        </div>
    );
    

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                 <CardHeader>
                    <CardTitle>قائمة المركز المالي (الميزانية العمومية)</CardTitle>
                    <CardDescription>عرض الأصول والالتزامات وحقوق الملكية للشركة في لحظة زمنية معينة.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2 max-w-xs">
                        <Label htmlFor="asOfDate">حتى تاريخ</Label>
                        <Input id="asOfDate" type="date" value={asOfDate} onChange={e => setAsOfDate(e.target.value)} />
                     </div>
                </CardContent>
            </Card>

            {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!isLoading && balanceSheetData && (
                 <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <CardHeader className="p-8 md:p-12">
                        {branding?.letterhead_image_url ? (
                             <img src={branding.letterhead_image_url} alt={`${branding.company_name || ''} Letterhead`} className="w-full h-auto object-contain max-h-[150px] mb-4"/>
                        ) : (
                             <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">قائمة المركز المالي</h2>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Balance Sheet</p>
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
                            <p><span className="font-semibold w-24 inline-block">المركز المالي كما في:</span> {asOfDate ? format(parseISO(asOfDate), 'dd/MM/yyyy') : ''}</p>
                         </div>
                    </CardHeader>
                    <CardContent className="px-8 md:px-12 space-y-6">
                        {!balanceSheetData.isBalanced && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>الميزانية غير متوازنة!</AlertTitle>
                                <AlertDescription>
                                    إجمالي الأصول ({formatCurrency(balanceSheetData.assets.total)}) لا يساوي إجمالي الالتزامات وحقوق الملكية ({formatCurrency(balanceSheetData.liabilitiesAndEquity.total)}).
                                    الرجاء مراجعة القيود المحاسبية.
                                </AlertDescription>
                            </Alert>
                        )}
                        <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                            {/* Assets Column */}
                            <div className="space-y-6">
                                {renderSection("الأصول المتداولة", balanceSheetData.assets.current, balanceSheetData.assets.totalCurrent)}
                                {renderSection("الأصول غير المتداولة", balanceSheetData.assets.nonCurrent, balanceSheetData.assets.totalNonCurrent)}
                                <div className="flex justify-between items-center text-lg p-2 font-extrabold bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <span>مجموع الأصول</span>
                                    <span className="font-mono">{formatCurrency(balanceSheetData.assets.total)}</span>
                                </div>
                            </div>
                            {/* Liabilities & Equity Column */}
                            <div className="space-y-6">
                                {renderSection("الالتزامات المتداولة", balanceSheetData.liabilitiesAndEquity.currentLiabilities, balanceSheetData.liabilitiesAndEquity.totalCurrentLiabilities)}
                                {renderSection("الالتزامات غير المتداولة", balanceSheetData.liabilitiesAndEquity.nonCurrentLiabilities, balanceSheetData.liabilitiesAndEquity.totalNonCurrentLiabilities)}
                                {renderSection("حقوق الملكية", balanceSheetData.liabilitiesAndEquity.equity, balanceSheetData.liabilitiesAndEquity.totalEquity)}
                                 <div className="flex justify-between items-center text-lg p-2 font-extrabold bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <span>مجموع الالتزامات وحقوق الملكية</span>
                                    <span className="font-mono">{formatCurrency(balanceSheetData.liabilitiesAndEquity.total)}</span>
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

    