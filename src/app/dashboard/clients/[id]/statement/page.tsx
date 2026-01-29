'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import type { Client, JournalEntry, CashReceipt, Company } from '@/lib/types';
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
import Link from 'next/link';

interface StatementLine {
    id: string;
    type: 'journal' | 'receipt';
    date: Date;
    voucherType: string;
    refNumber?: string;
    chequeNumber?: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export default function ClientStatementPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();

    const [client, setClient] = useState<Client | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [movementType, setMovementType] = useState('all'); // 'all', 'debit', 'credit'

    useEffect(() => {
        // Set default date range on client-side to avoid hydration mismatch
        const now = new Date();
        setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfMonth(now), 'yyyy-MM-dd'));
    }, []);

    useEffect(() => {
        if (!firestore || !id) {
            setLoading(false);
            return;
        };

        const fetchData = async () => {
            setLoading(true);
            try {
                const [clientSnap, companySnap, journalEntriesSnap, cashReceiptsSnap] = await Promise.all([
                    getDoc(doc(firestore, 'clients', id)),
                    getDocs(query(collection(firestore, 'companies'), limit(1))),
                    getDocs(query(collection(firestore, 'journalEntries'), where('clientId', '==', id))),
                    getDocs(query(collection(firestore, 'cashReceipts'), where('clientId', '==', id))),
                ]);

                if (!clientSnap.exists()) {
                    throw new Error('لم يتم العثور على العميل');
                }
                setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                
                if (!companySnap.empty) {
                    setCompany({ id: companySnap.docs[0].id, ...companySnap.docs[0].data() as Company });
                }

                const transactions: any[] = [];
                
                journalEntriesSnap.forEach(entryDoc => {
                    const entry = entryDoc.data() as JournalEntry;
                    if (entry.status === 'posted') { // Only include posted entries
                        transactions.push({
                            id: entryDoc.id,
                            date: entry.date.toDate(),
                            description: entry.narration,
                            debit: entry.totalDebit,
                            credit: 0,
                            refNumber: entry.entryNumber,
                            voucherType: 'فاتورة عقد',
                            type: 'journal'
                        });
                    }
                });

                cashReceiptsSnap.forEach(receiptDoc => {
                    const receipt = receiptDoc.data() as CashReceipt;
                    transactions.push({
                        id: receiptDoc.id,
                        date: receipt.receiptDate.toDate(),
                        description: `دفعة: ${receipt.description}`,
                        debit: 0,
                        credit: receipt.amount,
                        refNumber: receipt.voucherNumber,
                        chequeNumber: receipt.paymentMethod === 'Cheque' ? receipt.reference : undefined,
                        voucherType: 'سند قبض',
                        type: 'receipt'
                    });
                });

                transactions.sort((a, b) => a.date - b.date);
                setAllTransactions(transactions);

            } catch (error) {
                console.error("Error generating client statement:", error);
                const errorMessage = error instanceof Error ? error.message : 'فشل في إنشاء كشف الحساب.';
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, id]);

    const statementData = useMemo(() => {
        if (!dateFrom || !dateTo) {
            return { openingBalance: 0, lines: [], totalDebit: 0, totalCredit: 0, finalBalance: 0 };
        }

        const startDate = parseISO(dateFrom);
        const endDate = parseISO(dateTo);
        endDate.setHours(23, 59, 59, 999);

        const openingBalance = allTransactions
            .filter(tx => tx.date < startDate)
            .reduce((balance, tx) => balance + (tx.debit || 0) - (tx.credit || 0), 0);
        
        const allPeriodTransactions = allTransactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        
        const filteredTransactionIds = new Set(allPeriodTransactions.filter(tx => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                tx.description?.toLowerCase().includes(searchLower) ||
                tx.refNumber?.toLowerCase().includes(searchLower) ||
                tx.voucherType?.toLowerCase().includes(searchLower);

            const matchesMovement = movementType === 'all' ||
                (movementType === 'debit' && tx.debit > 0) ||
                (movementType === 'credit' && tx.credit > 0);
            
            return matchesSearch && matchesMovement;
        }).map(tx => tx.id));

        const unfilteredFinalBalance = allPeriodTransactions.reduce((bal, tx) => bal + (tx.debit || 0) - (tx.credit || 0), openingBalance);
        
        let runningBalance = openingBalance;
        const lines: StatementLine[] = [];
        allPeriodTransactions.forEach(tx => {
            runningBalance += (tx.debit || 0) - (tx.credit || 0);
            if (filteredTransactionIds.has(tx.id)) {
                 lines.push({
                    id: tx.id,
                    type: tx.type,
                    date: tx.date,
                    voucherType: tx.voucherType,
                    refNumber: tx.refNumber,
                    chequeNumber: tx.chequeNumber,
                    description: tx.description,
                    debit: tx.debit || 0,
                    credit: tx.credit || 0,
                    balance: runningBalance,
                });
            }
        });
        
        const totalDebit = lines.reduce((sum, tx) => sum + (tx.debit || 0), 0);
        const totalCredit = lines.reduce((sum, tx) => sum + (tx.credit || 0), 0);

        return { openingBalance, lines, totalDebit, totalCredit, finalBalance: unfilteredFinalBalance };

    }, [allTransactions, dateFrom, dateTo, searchQuery, movementType]);


    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!client) {
        return <div className="text-center p-10">لم يتم العثور على بيانات العميل.</div>
    }
    
    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                <CardHeader>
                    <CardTitle>خيارات العرض والبحث</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                     <div className="grid gap-2">
                        <Label htmlFor="dateFrom">التاريخ من</Label>
                        <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">التاريخ إلى</Label>
                        <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="search">بحث</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="search"
                                placeholder="ابحث في البيان، رقم السند..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="movementType">نوع الحركة</Label>
                        <Select value={movementType} onValueChange={setMovementType}>
                            <SelectTrigger id="movementType"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="debit">مدين فقط (فواتير)</SelectItem>
                                <SelectItem value="credit">دائن فقط (دفعات)</SelectItem>
                            </SelectContent>
                        </Select>
                     </div>
                </CardContent>
            </Card>

            <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
                <CardHeader className="p-8 md:p-12">
                    <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                        <div className="text-left flex-shrink-0">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">كشف حساب عميل</h2>
                            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Statement of Account</p>
                            <p className="font-mono text-sm mt-2 text-muted-foreground">التاريخ: {format(new Date(), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-4">
                           {company?.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-20 w-20 object-contain"/> : <Logo className="h-16 w-16 !p-3" />}
                            <div>
                               <h1 className="font-bold text-lg">{company?.name || 'درافت للاستشارات الهندسية'}</h1>
                               <p className="text-sm text-muted-foreground">{company?.nameEn || 'Draft Engineering Consultants'}</p>
                               <p className="text-xs text-muted-foreground mt-2">{company?.address}</p>
                            </div>
                        </div>
                    </div>
                     <div className="mt-6 text-sm">
                        <p><span className="font-semibold w-24 inline-block">العميل:</span> {client.nameAr}</p>
                        <p><span className="font-semibold w-24 inline-block">رقم الملف:</span> {client.fileId}</p>
                     </div>
                </CardHeader>
                <CardContent className="px-8 md:px-12">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">التاريخ</TableHead>
                                <TableHead className="w-[120px]">نوع السند</TableHead>
                                <TableHead className="w-[120px]">رقم السند</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left w-[110px]">مدين</TableHead>
                                <TableHead className="text-left w-[110px]">دائن</TableHead>
                                <TableHead className="text-left w-[120px]">الرصيد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={6} className="font-semibold">الرصيد السابق</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(statementData.openingBalance)}</TableCell>
                            </TableRow>
                            {statementData.lines.map((line, index) => (
                                <TableRow key={index}>
                                    <TableCell>{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell>{line.voucherType}</TableCell>
                                    <TableCell className="font-mono">
                                        {line.type === 'journal' ? (
                                            <Link href={`/dashboard/accounting/journal-entries/${line.id}`} className="hover:underline text-primary">
                                                {line.refNumber}
                                            </Link>
                                        ) : line.type === 'receipt' ? (
                                            <Link href={`/dashboard/accounting/cash-receipts/${line.id}`} className="hover:underline text-primary">
                                                {line.refNumber}
                                            </Link>
                                        ) : (
                                            line.refNumber
                                        )}
                                    </TableCell>
                                    <TableCell>{line.description}</TableCell>
                                    <TableCell className="text-left font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(line.balance)}</TableCell>
                                </TableRow>
                            ))}
                             {statementData.lines.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        لا توجد حركات تطابق الفلاتر المحددة.
                                    </TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold bg-muted/50">
                                <TableCell colSpan={4}>إجمالي الحركات المعروضة</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(statementData.totalDebit)}</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(statementData.totalCredit)}</TableCell>
                                <TableCell className="text-left font-mono font-bold text-lg">{formatCurrency(statementData.finalBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
                <CardFooter className="p-8 md:p-12 flex justify-between items-center no-print">
                     <Button variant="outline" onClick={() => router.back()}>
                        <ArrowRight className="ml-2 h-4 w-4" />
                        العودة
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
