
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
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { format, startOfYear, endOfYear, isBefore, startOfDay } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, Users } from 'lucide-react';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';


interface EquityStatementData {
    lines: {
        name: string;
        openingBalance: number;
        netIncome: number;
        closingBalance: number;
    }[];
    totals: {
        openingBalance: number;
        netIncome: number;
        closingBalance: number;
    }
}

export default function EquityStatementPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();

    useEffect(() => {
        const now = new Date();
        setDateFrom(startOfYear(now));
        setDateTo(endOfYear(now));
    }, []);

    // الرقابة المنطقية: تصفير تاريخ النهاية إذا كان يسبق البداية
    useEffect(() => {
        if (dateFrom && dateTo && isBefore(startOfDay(dateTo), startOfDay(dateFrom))) {
            setDateTo(undefined);
            toast({
                variant: 'destructive',
                title: 'خطأ منطقي',
                description: 'التاريخ غلط، لا يجوز أن يسبق تاريخ النهاية تاريخ البداية.',
            });
        }
    }, [dateFrom, dateTo, toast]);

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
        if (!firestore || !dateTo || !dateFrom) return;
        const fetchEntries = async () => {
            setLoading(true);
            try {
                const endDate = new Date(dateTo);
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
    }, [firestore, dateTo, dateFrom]);
    
    const equityAccounts = useMemo(() => accounts.filter(acc => acc.code.startsWith('3')), [accounts]);
    
    const equityStatementData = useMemo((): EquityStatementData | null => {
        if (loading || !dateFrom || !dateTo || equityAccounts.length === 0) return null;

        const startDate = dateFrom;
        const endDate = dateTo;

        const netIncome = journalEntries
            .filter(entry => {
                const entryDate = (entry.date as Timestamp).toDate();
                return entryDate >= startDate && entryDate <= endDate;
            })
            .flatMap(entry => entry.lines)
            .reduce((income, line) => {
                const acc = accounts.find(a => a.id === line.accountId);
                if (!acc) return income;
                if (acc.type === 'income') return income + (line.credit || 0) - (line.debit || 0);
                if (acc.type === 'expense') return income - ((line.debit || 0) - (line.credit || 0));
                return income;
            }, 0);

        const lines = equityAccounts.map(account => {
            const openingBalance = journalEntries
                .filter(entry => (entry.date as Timestamp).toDate() < startDate)
                .flatMap(entry => entry.lines)
                .filter(line => line.accountId === account.id)
                .reduce((balance, line) => balance + (line.credit || 0) - (line.debit || 0), 0);

            const isRetainedEarnings = account.name.includes('أرباح');
            const incomeForThisAccount = isRetainedEarnings ? netIncome : 0;

            const closingBalance = openingBalance + incomeForThisAccount;
            
            return {
                name: account.name,
                openingBalance,
                netIncome: incomeForThisAccount,
                closingBalance,
            };
        }).filter(line => line.openingBalance !== 0 || line.closingBalance !== 0);

        const totals = {
            openingBalance: lines.reduce((sum, line) => sum + line.openingBalance, 0),
            netIncome: netIncome,
            closingBalance: lines.reduce((sum, line) => sum + line.closingBalance, 0),
        };
        
        return { lines, totals };

    }, [loading, accounts, journalEntries, dateFrom, dateTo, equityAccounts]);


    const handlePrint = () => window.print();
    const isLoading = loading || brandingLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                 <CardHeader>
                    <CardTitle>قائمة التغير في حقوق الملكية</CardTitle>
                    <CardDescription>عرض التغير في حقوق الملاك خلال فترة محددة.</CardDescription>
                </CardHeader>
                 <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="dateFrom">من تاريخ</Label>
                        <DateInput id="dateFrom" value={dateFrom} onChange={setDateFrom} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">إلى تاريخ</Label>
                        <DateInput id="dateTo" value={dateTo} onChange={setDateTo} />
                     </div>
                </CardContent>
            </Card>

            {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!isLoading && equityStatementData && (
                <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent">
                    <div id="printable-area" className="printable-content">
                        {branding?.letterhead_image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                                src={branding.letterhead_image_url} 
                                alt="Letterhead"
                                className="w-full h-auto"
                            />
                        )}
                        <div className="p-8 md:p-12">
                            <CardHeader className="p-0">
                                <div className="flex justify-between items-start pb-4">
                                    <div className="text-left flex-shrink-0">
                                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">قائمة التغيرات في حقوق الملكية</h2>
                                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Statement of Changes in Equity</p>
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
                                    <p><span className="font-semibold w-24 inline-block">عن الفترة من:</span> {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(dateTo, 'dd/MM/yyyy') : ''}</p>
                                 </div>
                            </CardHeader>
                             <CardContent className="px-0 pt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-2/5">البند</TableHead>
                                            <TableHead className="text-left">رصيد بداية الفترة</TableHead>
                                            <TableHead className="text-left">صافي ربح الفترة</TableHead>
                                            <TableHead className="text-left">رصيد نهاية الفترة</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {equityStatementData.lines.map(line => (
                                            <TableRow key={line.name}>
                                                <TableCell className="font-medium">{line.name}</TableCell>
                                                <TableCell className="text-left font-mono">{formatCurrency(line.openingBalance)}</TableCell>
                                                <TableCell className="text-left font-mono">{line.netIncome !== 0 ? formatCurrency(line.netIncome) : '-'}</TableCell>
                                                <TableCell className="text-left font-mono">{formatCurrency(line.closingBalance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow className="font-bold bg-muted text-lg">
                                            <TableCell>إجمالي حقوق الملكية</TableCell>
                                            <TableCell className="text-left font-mono">{formatCurrency(equityStatementData.totals.openingBalance)}</TableCell>
                                            <TableCell className="text-left font-mono">{formatCurrency(equityStatementData.totals.netIncome)}</TableCell>
                                            <TableCell className="text-left font-mono">{formatCurrency(equityStatementData.totals.closingBalance)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                             <CardFooter className="p-0 pt-8 flex justify-end items-center no-print">
                                <Button onClick={handlePrint}>
                                    <Printer className="ml-2 h-4 w-4" />
                                    طباعة / تصدير PDF
                                </Button>
                            </CardFooter>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
