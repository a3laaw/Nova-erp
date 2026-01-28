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
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/layout/logo';

interface StatementLine {
    date: Date;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    refNumber?: string;
}

export default function ClientStatementPage() {
    const router = useRouter();
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const { firestore } = useFirebase();

    const [client, setClient] = useState<Client | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
    const [loading, setLoading] = useState(true);

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
                    getDocs(query(collection(firestore, 'journalEntries'), where('clientId', '==', id), orderBy('date', 'asc'))),
                    getDocs(query(collection(firestore, 'cashReceipts'), where('clientId', '==', id), orderBy('receiptDate', 'asc'))),
                ]);

                if (!clientSnap.exists()) {
                    throw new Error('لم يتم العثور على العميل');
                }
                setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
                
                if (!companySnap.empty) {
                    setCompany({ id: companySnap.docs[0].id, ...companySnap.docs[0].data() as Company });
                }

                const transactions: any[] = [];
                
                journalEntriesSnap.forEach(doc => {
                    const entry = doc.data() as JournalEntry;
                    if (entry.status === 'posted') { // Only include posted entries
                        transactions.push({
                            date: entry.date.toDate(),
                            description: entry.narration,
                            debit: entry.totalDebit,
                            credit: 0,
                            refNumber: entry.entryNumber,
                            type: 'journal'
                        });
                    }
                });

                cashReceiptsSnap.forEach(doc => {
                    const receipt = doc.data() as CashReceipt;
                    transactions.push({
                        date: receipt.receiptDate.toDate(),
                        description: `دفعة: ${receipt.description}`,
                        debit: 0,
                        credit: receipt.amount,
                        refNumber: receipt.voucherNumber,
                        type: 'receipt'
                    });
                });

                transactions.sort((a, b) => a.date - b.date);

                let runningBalance = 0;
                const lines = transactions.map(tx => {
                    runningBalance += tx.debit - tx.credit;
                    return { ...tx, balance: runningBalance };
                });

                setStatementLines(lines);

            } catch (error) {
                console.error("Error generating client statement:", error);
                const errorMessage = error instanceof Error ? error.message : 'فشل في إنشاء كشف الحساب.';
                // toast({ variant: 'destructive', title: 'خطأ', description: errorMessage });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [firestore, id]);

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
    
    const openingBalance = 0; // Assuming 0 for now. This could be fetched.
    const finalBalance = statementLines[statementLines.length - 1]?.balance || 0;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
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
                                <TableHead className="w-[120px]">التاريخ</TableHead>
                                <TableHead className="w-[120px]">المرجع</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left">مدين</TableHead>
                                <TableHead className="text-left">دائن</TableHead>
                                <TableHead className="text-left">الرصيد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow>
                                <TableCell colSpan={5} className="font-semibold">رصيد افتتاحي</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(openingBalance)}</TableCell>
                            </TableRow>
                            {statementLines.map((line, index) => (
                                <TableRow key={index}>
                                    <TableCell>{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-mono">{line.refNumber}</TableCell>
                                    <TableCell>{line.description}</TableCell>
                                    <TableCell className="text-left font-mono">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(line.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="font-bold text-lg bg-muted/50">
                                <TableCell colSpan={5}>الرصيد الختامي</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(finalBalance)}</TableCell>
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
