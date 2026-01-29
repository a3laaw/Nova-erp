'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import type { Account, JournalEntry, Company } from '@/lib/types';
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
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, ArrowRight, Search } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import Link from 'next/link';

interface StatementLine {
    date: Date;
    entryNumber: string;
    narration: string;
    debit: number;
    credit: number;
    balance: number;
    entryId: string;
}

export default function AccountStatementPage() {
    const router = useRouter();
    const { firestore } = useFirebase();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [company, setCompany] = useState<Company | null>(null);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    
    // --- Filters ---
    const [accountId, setAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'draft'>('posted');

    useEffect(() => {
        // Set default date range on client-side to avoid hydration mismatch
        const now = new Date();
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
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
                const [accountsSnap, companySnap, entriesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                    getDocs(query(collection(firestore, 'companies'), limit(1))),
                    getDocs(query(collection(firestore, 'journalEntries'))),
                ]);

                const fetchedAccounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
                setAccounts(fetchedAccounts);
                
                if (!companySnap.empty) {
                    setCompany({ id: companySnap.docs[0].id, ...companySnap.docs[0].data() as Company });
                }
                
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

        const startDate = parseISO(dateFrom);
        const endDate = parseISO(dateTo);
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
                filename:     `AccountStatement_${accountId}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    const selectedAccount = accounts.find(a => a.id === accountId);

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                <CardHeader>
                    <CardTitle>كشف حساب</CardTitle>
                    <CardDescription>عرض كشف حساب تفصيلي لأي حساب في شجرة الحسابات.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                     <div className="grid gap-2 lg:col-span-2">
                        <Label htmlFor="account">الحساب</Label>
                        <InlineSearchList 
                            value={accountId}
                            onSelect={setAccountId}
                            options={accountOptions}
                            placeholder={loading ? 'جاري تحميل الحسابات...' : 'اختر حسابًا لعرض كشفه...'}
                            disabled={loading}
                        />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateFrom">التاريخ من</Label>
                        <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">التاريخ إلى</Label>
                        <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
            
            {!accountId && !loading && (
                <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                        الرجاء اختيار حساب لعرض كشف الحساب الخاص به.
                    </CardContent>
                </Card>
            )}

            {loading && accountId && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {accountId && !loading && (
                <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                    <CardHeader className="p-8 md:p-12">
                        <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                            <div className="text-left flex-shrink-0">
                                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">كشف حساب</h2>
                                <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Account Statement</p>
                                <p className="font-mono text-sm mt-2 text-muted-foreground">التاريخ: {format(new Date(), 'dd/MM/yyyy')}</p>
                            </div>
                            <div className="flex items-center gap-4">
                               {company?.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-20 w-20 object-contain"/> : <Logo className="h-16 w-16 !p-3" />}
                                <div>
                                   <h1 className="font-bold text-lg">{company?.name || 'درافت للاستشارات الهندسية'}</h1>
                                   <p className="text-sm text-muted-foreground">{company?.nameEn || 'Draft Engineering Consultants'}</p>
                                </div>
                            </div>
                        </div>
                         <div className="mt-6 text-sm">
                            <p><span className="font-semibold w-24 inline-block">الحساب:</span> {selectedAccount?.name} ({selectedAccount?.code})</p>
                            <p><span className="font-semibold w-24 inline-block">الفترة من:</span> {format(parseISO(dateFrom), 'dd/MM/yyyy')} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {format(parseISO(dateTo), 'dd/MM/yyyy')}</p>
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
                                    <TableCell colSpan={5} className="font-semibold">الرصيد الافتتاحي للفترة</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(statementData.openingBalance)}</TableCell>
                                </TableRow>
                                {statementData.lines.map((line, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="font-mono hover:underline">
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
                                    <TableCell></TableCell>
                                </TableRow>
                                <TableRow className="font-bold text-lg bg-muted">
                                    <TableCell colSpan={5}>الرصيد النهائي</TableCell>
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
