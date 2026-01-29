'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, Timestamp, where } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, Scale } from 'lucide-react';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';

interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export default function TrialBalancePage() {
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        const now = new Date();
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    }, []);

    // Fetch accounts once
    useEffect(() => {
        if (!firestore) return;
        const fetchAccountsData = async () => {
            try {
                const accountsSnap = await getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code')));
                setAccounts(accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
            } catch (error) {
                console.error("Error fetching accounts:", error);
            }
        };
        fetchAccountsData();
    }, [firestore]);

    // Fetch entries when date changes
    useEffect(() => {
        if (!firestore || !dateTo) return;
        const fetchEntries = async () => {
            setLoading(true);
            try {
                const endDate = parseISO(dateTo);
                endDate.setHours(23, 59, 59, 999);

                const entriesQuery = query(
                    collection(firestore, 'journalEntries'),
                    where('status', '==', 'posted'),
                    where('date', '<=', Timestamp.fromDate(endDate))
                );
                const entriesSnap = await getDocs(entriesQuery);
                setJournalEntries(entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry)));
            } catch (error) {
                console.error("Error fetching journal entries:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEntries();
    }, [firestore, dateTo]);
    
    const trialBalanceData = useMemo(() => {
        if (loading || !dateFrom || !dateTo || accounts.length === 0) return { lines: [], totals: {} };

        const startDate = parseISO(dateFrom);
        startDate.setHours(0, 0, 0, 0);
        const endDate = parseISO(dateTo);
        endDate.setHours(23, 59, 59, 999);


        const lines: TrialBalanceLine[] = accounts.map(account => {
            let openingBalance = 0;
            let periodDebit = 0;
            let periodCredit = 0;

            journalEntries.forEach(entry => {
                const entryDate = (entry.date as Timestamp).toDate();
                const relevantLine = entry.lines.find(line => line.accountId === account.id);
                if (!relevantLine) return;

                const amount = (relevantLine.debit || 0) - (relevantLine.credit || 0);

                if (entryDate < startDate) {
                    openingBalance += amount;
                } else if (entryDate >= startDate && entryDate <= endDate) {
                    periodDebit += relevantLine.debit || 0;
                    periodCredit += relevantLine.credit || 0;
                }
            });

            const closingBalance = openingBalance + periodDebit - periodCredit;

            return {
                accountId: account.id!,
                accountCode: account.code,
                accountName: account.name,
                openingDebit: openingBalance > 0 ? openingBalance : 0,
                openingCredit: openingBalance < 0 ? -openingBalance : 0,
                periodDebit,
                periodCredit,
                closingDebit: closingBalance > 0 ? closingBalance : 0,
                closingCredit: closingBalance < 0 ? -closingBalance : 0,
            };
        }).filter(line => 
             line.openingDebit > 0 || line.openingCredit > 0 || line.periodDebit > 0 || line.periodCredit > 0
        );
        
        const totals = {
            openingDebit: lines.reduce((sum, l) => sum + l.openingDebit, 0),
            openingCredit: lines.reduce((sum, l) => sum + l.openingCredit, 0),
            periodDebit: lines.reduce((sum, l) => sum + l.periodDebit, 0),
            periodCredit: lines.reduce((sum, l) => sum + l.periodCredit, 0),
            closingDebit: lines.reduce((sum, l) => sum + l.closingDebit, 0),
            closingCredit: lines.reduce((sum, l) => sum + l.closingCredit, 0),
        };

        return { lines, totals };
    }, [loading, accounts, journalEntries, dateFrom, dateTo]);

    const handlePrint = () => {
        window.print();
    };
    
    const isLoading = loading || brandingLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                 <CardHeader>
                    <CardTitle>ميزان المراجعة</CardTitle>
                    <CardDescription>عرض أرصدة الحسابات المدينة والدائنة خلال فترة محددة.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="dateFrom">التاريخ من</Label>
                        <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">التاريخ إلى</Label>
                        <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                     </div>
                </CardContent>
            </Card>
            
            {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!isLoading && (
                 <Card id="printable-area" className="max-w-6xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <CardHeader className="p-8 md:p-12">
                        {branding?.letterhead_image_url ? (
                            <img src={branding.letterhead_image_url} alt={`${branding.company_name || ''} Letterhead`} className="w-full h-auto object-contain max-h-[150px] mb-4"/>
                        ) : (
                             <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">ميزان المراجعة</h2>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Trial Balance</p>
                                    <p className="font-mono text-sm mt-2 text-muted-foreground">التاريخ: {format(new Date(), 'dd/MM/yyyy')}</p>
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
                            <p><span className="font-semibold w-24 inline-block">الفترة من:</span> {dateFrom ? format(parseISO(dateFrom), 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(parseISO(dateTo), 'dd/MM/yyyy') : ''}</p>
                         </div>
                    </CardHeader>
                    <CardContent className="px-8 md:px-12">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead rowSpan={2} className="align-bottom">الحساب</TableHead>
                                    <TableHead colSpan={2} className="text-center">الرصيد الافتتاحي</TableHead>
                                    <TableHead colSpan={2} className="text-center">حركة الفترة</TableHead>
                                    <TableHead colSpan={2} className="text-center">الرصيد الختامي</TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead className="text-center">مدين</TableHead>
                                    <TableHead className="text-center">دائن</TableHead>
                                    <TableHead className="text-center">مدين</TableHead>
                                    <TableHead className="text-center">دائن</TableHead>
                                    <TableHead className="text-center">مدين</TableHead>
                                    <TableHead className="text-center">دائن</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {trialBalanceData.lines.map((line) => (
                                    <TableRow key={line.accountId}>
                                        <TableCell className="font-medium">{line.accountName} ({line.accountCode})</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.openingDebit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.openingCredit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.periodDebit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.periodCredit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.closingDebit)}</TableCell>
                                        <TableCell className="text-center font-mono">{formatCurrency(line.closingCredit)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold bg-muted text-lg">
                                    <TableCell>الإجمالي</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.openingDebit)}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.openingCredit)}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.periodDebit)}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.periodCredit)}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.closingDebit)}</TableCell>
                                    <TableCell className="text-center font-mono">{formatCurrency(trialBalanceData.totals.closingCredit)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
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
