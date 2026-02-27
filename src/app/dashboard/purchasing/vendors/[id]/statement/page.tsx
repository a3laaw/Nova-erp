
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import type { Vendor, JournalEntry, Account } from '@/lib/types';
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
import { Loader2, Printer, ArrowRight, Search, Truck } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';

interface StatementLine {
    id: string;
    date: Date;
    type: string;
    refNumber: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export default function VendorStatementPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [allTransactions, setAllTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
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
                const [vendorSnap, accountsSnap, entriesSnap] = await Promise.all([
                    getDoc(doc(firestore, 'vendors', id)),
                    getDocs(query(collection(firestore, 'chartOfAccounts'))),
                    getDocs(query(collection(firestore, 'journalEntries'))),
                ]);

                if (!vendorSnap.exists()) throw new Error('لم يتم العثور على المورد');
                const vendorData = { id: vendorSnap.id, ...vendorSnap.data() } as Vendor;
                setVendor(vendorData);

                const allAccounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const vendorAccount = allAccounts.find(acc => acc.name === vendorData.name) as Account | undefined;
                
                if (!vendorAccount) {
                    setAllTransactions([]);
                    setLoading(false);
                    return;
                }

                const transactions: any[] = [];
                entriesSnap.forEach(doc => {
                    const entry = doc.data() as JournalEntry;
                    const line = entry.lines.find(l => l.accountId === vendorAccount.id);
                    if (line && entry.status === 'posted') {
                        transactions.push({
                            id: doc.id,
                            date: toFirestoreDate(entry.date)!,
                            description: entry.narration,
                            debit: line.debit || 0,
                            credit: line.credit || 0,
                            refNumber: entry.entryNumber,
                            type: entry.entryNumber.startsWith('PV') ? 'سند صرف' : 'فاتورة مشتريات'
                        });
                    }
                });

                transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
                setAllTransactions(transactions);

            } catch (error) {
                console.error("Error generating vendor statement:", error);
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
            .reduce((balance, tx) => balance + (tx.credit || 0) - (tx.debit || 0), 0);
        
        const periodTransactions = allTransactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
        
        let runningBalance = openingBalance;
        const lines: StatementLine[] = [];
        periodTransactions.forEach(tx => {
            const matchesSearch = !searchQuery || 
                tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.refNumber?.toLowerCase().includes(searchQuery.toLowerCase());

            runningBalance += (tx.credit || 0) - (tx.debit || 0);
            
            if (matchesSearch) {
                lines.push({
                    ...tx,
                    balance: runningBalance
                });
            }
        });
        
        return { 
            openingBalance, 
            lines, 
            totalDebit: lines.reduce((sum, tx) => sum + tx.debit, 0),
            totalCredit: lines.reduce((sum, tx) => sum + tx.credit, 0),
            finalBalance: runningBalance 
        };

    }, [allTransactions, dateFrom, dateTo, searchQuery]);

    const handlePrint = () => window.print();

    if (loading || brandingLoading) {
        return <div className="p-8 max-w-4xl mx-auto space-y-8" dir="rtl"><Skeleton className="h-64 w-full rounded-2xl" /></div>;
    }

    if (!vendor) return <div className="text-center p-10">المورد غير موجود.</div>;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-6 no-print rounded-2xl border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5"/> خيارات التصفية</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="grid gap-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label>بحث في البيان</Label>
                        <Input placeholder="ابحث برقم السند أو الوصف..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                     </div>
                </CardContent>
            </Card>

            <Card id="printable-area" className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-3xl overflow-hidden print:shadow-none print:border-none">
                <div className="p-8 md:p-12">
                    {branding?.letterhead_image_url && (
                        <img src={branding.letterhead_image_url} alt="Letterhead" className="w-full h-auto mb-8" />
                    )}
                    
                    {!branding?.letterhead_image_url && (
                        <div className="flex justify-between items-start pb-8 border-b-2 mb-8">
                            <div className="text-left">
                                <h2 className="text-2xl font-black text-primary">كشف حساب مورد</h2>
                                <p className="text-sm font-bold text-muted-foreground">Supplier Statement</p>
                                <p className="text-xs mt-2">{format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Logo className="h-16 w-16" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                                    <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mb-8 p-6 bg-muted/30 rounded-2xl border flex flex-col md:flex-row justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">المورد:</p>
                            <p className="text-xl font-black">{vendor.name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2"><Truck className="h-3 w-3"/> {vendor.contactPerson}</p>
                        </div>
                        <div className="text-left md:border-r md:pr-8 border-primary/10">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">الرصيد الختامي</p>
                            <p className="text-3xl font-black text-primary font-mono">{formatCurrency(statementData.finalBalance)}</p>
                        </div>
                    </div>

                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-24">التاريخ</TableHead>
                                <TableHead className="w-32">رقم المرجع</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left w-28">مدين (دفعات)</TableHead>
                                <TableHead className="text-left w-28">دائن (مشتريات)</TableHead>
                                <TableHead className="text-left w-32 bg-primary/5 font-bold">الرصيد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-muted/20 italic">
                                <TableCell colSpan={5}>الرصيد السابق للفترة</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(statementData.openingBalance)}</TableCell>
                            </TableRow>
                            {statementData.lines.map((line) => (
                                <TableRow key={line.id}>
                                    <TableCell className="text-xs">{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-mono text-xs font-bold text-primary">{line.refNumber}</TableCell>
                                    <TableCell className="text-sm">{line.description}</TableCell>
                                    <TableCell className="text-left font-mono text-green-600">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono text-red-600">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono font-black bg-muted/5">{formatCurrency(line.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-muted/50 h-16 font-bold">
                                <TableCell colSpan={3}>إجمالي حركات الفترة</TableCell>
                                <TableCell className="text-left font-mono text-green-700">{formatCurrency(statementData.totalDebit)}</TableCell>
                                <TableCell className="text-left font-mono text-red-700">{formatCurrency(statementData.totalCredit)}</TableCell>
                                <TableCell className="text-left font-mono text-lg font-black text-primary bg-primary/5">{formatCurrency(statementData.finalBalance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>

                    <div className="mt-20 grid grid-cols-2 gap-20 text-center text-xs">
                        <div className="space-y-12">
                            <p className="font-black border-b pb-2">المحاسب</p>
                            <div className="pt-2">التوقيع والتاريخ</div>
                        </div>
                        <div className="space-y-12">
                            <p className="font-black border-b pb-2">اعتماد الإدارة</p>
                            <div className="pt-2">الختم الرسمي</div>
                        </div>
                    </div>
                </div>
                
                <CardFooter className="p-8 bg-muted/10 no-print flex justify-between items-center">
                    <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                        <ArrowRight className="h-4 w-4" /> العودة
                    </Button>
                    <Button onClick={handlePrint} className="gap-2 rounded-xl font-bold px-8">
                        <Printer className="h-4 w-4" /> طباعة الكشف
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
