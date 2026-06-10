'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Client, JournalEntry, Company, Account } from '@/lib/types';
import { useAuth } from '@/context/auth-context';

// UI Components & Utils
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/layout/logo';
import { useBranding } from '@/context/branding-context';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { formatCurrency, getTenantPath } from '@/lib/utils';
import { Loader2, Printer, ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';

interface StatementLine {
    id: string;
    date: Date;
    voucherType: string;
    refNumber?: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export default function ClientStatementPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { branding, loading: brandingLoading } = useBranding();

    const tenantId = currentUser?.currentCompanyId;

    // State for filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [movementType, setMovementType] = useState('all');

    useEffect(() => {
        const now = new Date();
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    }, []);

    // ✅ PATTERN: Fetching data using new real-time hooks
    const clientPath = useMemo(() => tenantId && id ? getTenantPath(`clients/${id}`, tenantId) : null, [tenantId, id]);
    const { data: client, loading: clientLoading } = useDocument<Client>(firestore, clientPath);

    const journalEntriesQuery = useMemo(() => tenantId && id ? [where('clientId', '==', id), where('status', '==', 'posted')] : null, [tenantId, id]);
    const { data: journalEntries, loading: entriesLoading } = useSubscription<JournalEntry>(firestore, 'journalEntries', journalEntriesQuery);

    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(firestore, 'chartOfAccounts', useMemo(() => [], []));

    // Find the client's account ID
    const clientAccountId = useMemo(() => {
        if (!client || !accounts) return null;
        return accounts.find(acc => acc.name === client.nameAr && acc.parentCode === '1102')?.id || null;
    }, [client, accounts]);

    // ✅ PATTERN: Process data using useMemo, reacting to data changes
    const allTransactions = useMemo(() => {
        if (!journalEntries || !clientAccountId) return [];
        
        const transactions = journalEntries.map(entry => {
            const clientLine = entry.lines.find(line => line.accountId === clientAccountId);
            if (!clientLine) return null;

            let voucherType = 'قيد يومية';
            if (entry.entryNumber?.startsWith('CRV')) voucherType = 'سند قبض';
            else if (entry.entryNumber?.startsWith('PV')) voucherType = 'سند صرف';
            else if (entry.narration?.includes('عقد')) voucherType = 'فاتورة عقد';

            return {
                id: entry.id!,
                date: entry.date.toDate(),
                description: entry.narration,
                debit: clientLine.debit,
                credit: clientLine.credit,
                refNumber: entry.entryNumber,
                voucherType: voucherType,
            };
        }).filter(Boolean);

        return transactions.sort((a, b) => a!.date.getTime() - b!.date.getTime());
    }, [journalEntries, clientAccountId]);

    const statementData = useMemo(() => {
        if (!dateFrom || !dateTo) {
            return { openingBalance: 0, lines: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
        }

        const startDate = parseISO(dateFrom);
        const endDate = parseISO(dateTo);
        endDate.setHours(23, 59, 59, 999);

        const openingBalance = allTransactions
            .filter(tx => tx!.date < startDate)
            .reduce((balance, tx) => balance + (tx!.debit || 0) - (tx!.credit || 0), 0);
        
        const periodTransactions = allTransactions.filter(tx => tx!.date >= startDate && tx!.date <= endDate);
        
        const finalBalance = periodTransactions.reduce((bal, tx) => bal + (tx!.debit || 0) - (tx!.credit || 0), openingBalance);
        
        let runningBalance = openingBalance;
        const lines: StatementLine[] = [];

        periodTransactions.forEach(tx => {
            if (!tx) return;
            runningBalance += (tx.debit || 0) - (tx.credit || 0);

            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                tx.description?.toLowerCase().includes(searchLower) ||
                tx.refNumber?.toLowerCase().includes(searchLower) ||
                tx.voucherType?.toLowerCase().includes(searchLower);

            const matchesMovement = movementType === 'all' ||
                (movementType === 'debit' && tx.debit > 0) ||
                (movementType === 'credit' && tx.credit > 0);

            if (matchesSearch && matchesMovement) {
                 lines.push({
                    id: tx.id,
                    date: tx.date,
                    voucherType: tx.voucherType,
                    refNumber: tx.refNumber,
                    description: tx.description,
                    debit: tx.debit || 0,
                    credit: tx.credit || 0,
                    balance: runningBalance,
                });
            }
        });
        
        const totalDebit = lines.reduce((sum, tx) => sum + (tx.debit || 0), 0);
        const totalCredit = lines.reduce((sum, tx) => sum + (tx.credit || 0), 0);

        return { openingBalance, lines, totalDebit, totalCredit, finalBalance };

    }, [allTransactions, dateFrom, dateTo, searchQuery, movementType]);

    const isLoading = clientLoading || entriesLoading || accountsLoading || brandingLoading;

    if (isLoading) {
        return <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
    }

    if (!client) {
        return <div className="text-center p-10">لم يتم العثور على بيانات العميل. قد لا يكون لديك الصلاحية لعرض هذا العميل.</div>
    }
    
    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            {/* Filter Section */}
            <Card className="mb-4 no-print">
                <CardHeader><CardTitle>خيارات العرض والبحث</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                     <div className="grid gap-2"><Label htmlFor="dateFrom">التاريخ من</Label><Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
                     <div className="grid gap-2"><Label htmlFor="dateTo">التاريخ إلى</Label><Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
                     <div className="grid gap-2">
                        <Label htmlFor="search">بحث</Label>
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input id="search" placeholder="ابحث في البيان، رقم السند..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10"/></div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="movementType">نوع الحركة</Label>
                        <Select value={movementType} onValueChange={setMovementType}><SelectTrigger id="movementType"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">الكل</SelectItem><SelectItem value="debit">مدين فقط (فواتير)</SelectItem><SelectItem value="credit">دائن فقط (دفعات)</SelectItem></SelectContent></Select>
                     </div>
                </CardContent>
            </Card>

            {/* Printable Area */}
            <Card 
                id="printable-area" 
                className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent bg-no-repeat bg-top bg-cover p-8 md:p-12"
                style={branding?.letterhead_image_url ? { backgroundImage: `url(${branding.letterhead_image_url})` } : {}}
            >
                {/* Header */}
                <CardHeader className="p-0">
                    <div className="flex justify-between items-start pb-4">
                        <div className="text-left flex-shrink-0">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">كشف حساب عميل</h2><p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Statement of Account</p><p className="font-mono text-sm mt-2 text-muted-foreground">التاريخ: {format(new Date(), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                            <div>
                               <h1 className="font-bold text-lg">{branding?.company_name || 'Nova ERP'}</h1><p className="text-sm text-muted-foreground">{branding?.nameEn || 'Nova ERP'}</p><p className="text-xs text-muted-foreground mt-2">{branding?.address}</p>
                            </div>
                        </div>
                    </div>
                     <div className="mt-6 text-sm">
                        <p><span className="font-semibold w-24 inline-block">العميل:</span> {client.nameAr}</p>
                        <p><span className="font-semibold w-24 inline-block">رقم الملف:</span> {client.fileNumber}</p>
                     </div>
                </CardHeader>

                {/* Table */}
                <CardContent className="px-0 pt-6">
                    <Table>
                        <TableHeader><TableRow><TableHead className="w-[100px]">التاريخ</TableHead><TableHead className="w-[120px]">نوع السند</TableHead><TableHead className="w-[120px]">رقم السند</TableHead><TableHead>البيان</TableHead><TableHead className="text-left w-[110px]">مدين</TableHead><TableHead className="text-left w-[110px]">دائن</TableHead><TableHead className="text-left w-[120px]">الرصيد</TableHead></TableRow></TableHeader>
                        <TableBody>
                            <TableRow><TableCell colSpan={6} className="font-semibold">الرصيد السابق</TableCell><TableCell className="text-left font-mono">{formatCurrency(statementData.openingBalance)}</TableCell></TableRow>
                            {statementData.lines.map((line) => (
                                <TableRow key={line.id}>
                                    <TableCell>{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{line.voucherType}</TableCell>
                                    <TableCell className="font-mono"><Link href={`/dashboard/accounting/journal-entries/${line.id}`} className="hover:underline text-primary">{line.refNumber}</Link></TableCell>
                                    <TableCell>{line.description}</TableCell>
                                    <TableCell className="text-left font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(line.balance)}</TableCell>
                                </TableRow>
                            ))}
                             {statementData.lines.length === 0 && (<TableRow><TableCell colSpan={7} className="h-24 text-center">لا توجد حركات تطابق الفلاتر المحددة.</TableCell></TableRow>)}
                        </TableBody>
                        <TableFooter>
                             <TableRow className="font-bold bg-muted/50"><TableCell colSpan={4}>إجمالي الحركات المعروضة</TableCell><TableCell className="text-left font-mono">{formatCurrency(statementData.totalDebit)}</TableCell><TableCell className="text-left font-mono">{formatCurrency(statementData.totalCredit)}</TableCell><TableCell></TableCell></TableRow>
                            <TableRow className="font-bold text-lg bg-muted"><TableCell colSpan={6}>الرصيد النهائي</TableCell><TableCell className="text-left font-mono">{formatCurrency(statementData.finalBalance)}</TableCell></TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>

                {/* Footer */}
                <CardFooter className="p-0 pt-8 flex justify-between items-center no-print">
                     <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4 w-4" />العودة</Button>
                    <Button onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة</Button>
                </CardFooter>
            </Card>
        </div>
    );
}
