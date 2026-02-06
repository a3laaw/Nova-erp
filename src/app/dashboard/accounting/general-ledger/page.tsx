'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
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
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, ArrowRight, Search } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import Link from 'next/link';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';

interface StatementLine {
    date: Date;
    entryNumber: string;
    narration: string;
    debit: number;
    credit: number;
    balance: number;
    entryId: string;
}

export default function GeneralLedgerPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    
    // --- Filters ---
    const [accountId, setAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'draft'>('posted');

    useEffect(() => {
        // Set default date range on client-side to avoid hydration mismatch
        const now = new Date();
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
    }, []);

    // --- Data Fetching ---
    useEffect(() => {
        if (!firestore) {
            setLoading(false);
            return;
        };

        const fetchData = async () => {
            setLoading(true);
            try {
                const [accountsSnap, entriesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                    getDocs(query(collection(firestore, 'journalEntries'))),
                ]);

                const fetchedAccounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
                setAccounts(fetchedAccounts);
                
                const fetchedEntries = entriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
                setJournalEntries(fetchedEntries);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore]);
    
    const accountOptions = useMemo(() => 
        accounts.map(acc => ({
            value: acc.id!,
            label: `${acc.name} (${acc.code})`
        }))
    , [accounts]);

    // --- Statement Calculation ---
    const statementData = useMemo(() => {
        if (!accountId || !dateFrom || !dateTo || loading) {
            return { openingBalance: 0, lines: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
        }

        const startDate = dateFrom;
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        
        let relevantEntries = journalEntries;
        if (statusFilter !== 'all') {
            relevantEntries = relevantEntries.filter(entry => entry.status === statusFilter);
        }

        const openingBalance = relevantEntries
            .filter(entry => entry.date.toDate() < startDate)
            .flatMap(entry => entry.lines)
            .filter(line => line.accountId === accountId)
            .reduce((balance, line) => balance + (line.debit || 0) - (line.credit || 0), 0);
        
        const transactionsInPeriod = relevantEntries
            .filter(entry => {
                const entryDate = entry.date.toDate();
                return entryDate >= startDate && entryDate <= endDate;
            })
            .flatMap(entry => 
                entry.lines
                    .filter(line => line.accountId === accountId)
                    .map(line => ({
                        date: entry.date.toDate(),
                        entryNumber: entry.entryNumber,
                        narration: entry.narration,
                        debit: line.debit || 0,
                        credit: line.credit || 0,
                        entryId: entry.id!
                    }))
            )
            .sort((a,b) => a.date.getTime() - b.date.getTime());
        
        let runningBalance = openingBalance;
        const lines: StatementLine[] = transactionsInPeriod.map(tx => {
            runningBalance += tx.debit - tx.credit;
            return { ...tx, balance: runningBalance };
        });
        
        const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

        return { openingBalance, lines, totalDebit, totalCredit, finalBalance: runningBalance };

    }, [accountId, dateFrom, dateTo, statusFilter, journalEntries, loading]);


    const handlePrint = () => {
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const element = document.getElementById('printable-area');
            if (!element) return;
            const opt = {
                margin:       [0.5, 0.5, 0.5, 0.5],
                filename:     `GeneralLedger_${accountId}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    const selectedAccount = accounts.find(a => a.id === accountId);
    const isLoading = loading || brandingLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                <CardHeader>
                    <CardTitle>دفتر الأستاذ العام</CardTitle>
                    <CardDescription>عرض تفصيلي لجميع الحركات على حساب محدد.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                     <div className="grid gap-2 lg:col-span-2">
                        <Label htmlFor="account">الحساب</Label>
                        <InlineSearchList 
                            value={accountId}
                            onSelect={setAccountId}
                            options={accountOptions}
                            placeholder={loading ? 'جاري تحميل الحسابات...' : 'اختر حسابًا لعرضه...'}
                            disabled={loading}
                        />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateFrom">التاريخ من</Label>
                        <DateInput id="dateFrom" value={dateFrom} onChange={setDateFrom} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">التاريخ إلى</Label>
                        <DateInput id="dateTo" value={dateTo} onChange={setDateTo} />
                     </div>
                      <div className="grid gap-2">
                        <Label htmlFor="statusFilter">حالة القيود</Label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                            <SelectTrigger id="statusFilter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="posted">المرحّلة فقط</SelectItem>
                                <SelectItem value="draft">المسودات فقط</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                </CardContent>
            </Card>
            
            {!accountId && !isLoading && (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        الرجاء اختيار حساب لعرض دفتر الأستاذ الخاص به.
                    </CardContent>
                </Card>
            )}

            {isLoading && accountId && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {accountId && !isLoading && dateFrom && dateTo && (
                <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <CardHeader className="p-8 md:p-12">
                        {branding?.letterhead_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img 
                                src={branding.letterhead_image_url} 
                                alt={`${branding.company_name || ''} Letterhead`}
                                className="w-full h-auto object-contain max-h-[150px] mb-4"
                            />
                        ) : (
                            <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">دفتر الأستاذ العام</h2>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">General Ledger</p>
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
                            <p><span className="font-semibold w-24 inline-block">الحساب:</span> {selectedAccount?.name} ({selectedAccount?.code})</p>
                            <p><span className="font-semibold w-24 inline-block">الفترة من:</span> {format(dateFrom, 'dd/MM/yyyy')} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {format(dateTo, 'dd/MM/yyyy')}</p>
                         </div>
                    </CardHeader>
                    <CardContent className="px-8 md:px-12">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">التاريخ</TableHead>
                                    <TableHead className="w-[120px]">رقم القيد</TableHead>
                                    <TableHead>البيان</TableHead>
                                    <TableHead className="text-left w-[110px]">مدين</TableHead>
                                    <TableHead className="text-left w-[110px]">دائن</TableHead>
                                    <TableHead className="text-left w-[120px]">الرصيد</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell colSpan={6} className="font-semibold">الرصيد الافتتاحي للفترة</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(statementData.openingBalance)}</TableCell>
                                </TableRow>
                                {statementData.lines.map((line, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="font-mono hover:underline text-primary">
                                            <Link href={`/dashboard/accounting/journal-entries/${line.entryId}`}>
                                               {line.entryNumber}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{line.narration}</TableCell>
                                        <TableCell className="text-left font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                        <TableCell className="text-left font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(line.balance)}</TableCell>
                                    </TableRow>
                                ))}
                                {statementData.lines.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">لا توجد حركات في هذه الفترة.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold bg-muted/50">
                                    <TableCell colSpan={3}>إجمالي الحركات</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(statementData.totalDebit)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(statementData.totalCredit)}</TableCell>
                                    <TableCell colSpan={1}></TableCell>
                                </TableRow>
                                <TableRow className="font-bold text-lg bg-muted">
                                    <TableCell colSpan={6}>الرصيد النهائي</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(statementData.finalBalance)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                    <CardFooter className="p-8 md:p-12 flex justify-end items-center no-print">
                        <Button onClick={handlePrint} disabled={!accountId}>
                            <Printer className="ml-2 h-4 w-4" />
                            طباعة / تصدير PDF
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
    