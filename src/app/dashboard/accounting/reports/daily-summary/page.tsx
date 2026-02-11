'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { CashReceipt, PaymentVoucher, Account, JournalEntry } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateInput } from '@/components/ui/date-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Printer, ArrowUp, ArrowDown, Scale } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useBranding } from '@/context/branding-context';
import { PrintableDocument } from '@/components/layout/printable-document';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';

interface DailyReportData {
  receipts: CashReceipt[];
  payments: PaymentVoucher[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    cashBalance: number;
    bankBalance: number;
  };
}

export default function DailyFinancialReportPage() {
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [reportData, setReportData] = useState<DailyReportData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!firestore || !date) return;
        
        const fetchReportData = async () => {
            setLoading(true);
            try {
                const dayStart = new Date(date);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(date);
                dayEnd.setHours(23, 59, 59, 999);

                const [receiptsSnap, paymentsSnap, accountsSnap, entriesSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'cashReceipts'), where('receiptDate', '>=', Timestamp.fromDate(dayStart)), where('receiptDate', '<=', Timestamp.fromDate(dayEnd)))),
                    getDocs(query(collection(firestore, 'paymentVouchers'), where('paymentDate', '>=', Timestamp.fromDate(dayStart)), where('paymentDate', '<=', Timestamp.fromDate(dayEnd)))),
                    getDocs(query(collection(firestore, 'chartOfAccounts'))),
                    getDocs(query(collection(firestore, 'journalEntries'), where('status', '==', 'posted'))),
                ]);

                const receipts = receiptsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashReceipt));
                const payments = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentVoucher));
                const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
                const journalEntries = entriesSnap.docs.map(doc => doc.data() as JournalEntry);
                
                const totalIncome = receipts.reduce((sum, r) => sum + r.amount, 0);
                const totalExpense = payments.reduce((sum, p) => sum + p.amount, 0);

                const calculateBalance = (accountCodes: string[]) => {
                    const accountIds = accounts.filter(acc => accountCodes.some(code => acc.code.startsWith(code)) && acc.isPayable).map(acc => acc.id);
                    return journalEntries.flatMap(e => e.lines).filter(l => accountIds.includes(l.accountId)).reduce((bal, line) => {
                        return bal + (line.debit || 0) - (line.credit || 0);
                    }, 0);
                };

                const cashBalance = calculateBalance(['110101']); // 'النقدية في الخزينة'
                const bankBalance = calculateBalance(['110103']); // 'حسابات البنوك'

                setReportData({
                    receipts,
                    payments,
                    summary: {
                        totalIncome,
                        totalExpense,
                        netBalance: totalIncome - totalExpense,
                        cashBalance,
                        bankBalance,
                    }
                });

            } catch (error) {
                console.error("Error generating daily report:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [firestore, date]);

    const handlePrint = () => { window.print(); };

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="no-print">
                 <CardHeader>
                    <CardTitle>التقرير المالي اليومي</CardTitle>
                    <CardDescription>اختر يوماً لعرض ملخص الإيرادات والمصروفات والأرصدة.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="report-date">تاريخ التقرير</Label>
                        <DateInput id="report-date" value={date} onChange={setDate} />
                    </div>
                </CardContent>
            </Card>

            {loading || brandingLoading ? (
                 <Card>
                    <CardHeader><Skeleton className="h-8 w-48" /></CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </CardContent>
                </Card>
            ) : reportData && date && (
                 <div className="space-y-6">
                    <PrintableDocument>
                        <div className="space-y-8">
                            <section>
                                <h2 className="text-xl font-bold mb-4 text-green-600 flex items-center gap-2"><ArrowDown /> الإيرادات (المقبوضات)</h2>
                                <div className="border rounded-lg">
                                    <Table><TableHeader><TableRow><TableHead>رقم السند</TableHead><TableHead>العميل</TableHead><TableHead>البيان</TableHead><TableHead className="text-left">المبلغ</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.receipts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24">لا توجد مقبوضات لهذا اليوم.</TableCell></TableRow> :
                                        reportData.receipts.map(r => (<TableRow key={r.id}><TableCell>{r.voucherNumber}</TableCell><TableCell>{r.clientNameAr}</TableCell><TableCell>{r.description}</TableCell><TableCell className="text-left font-mono">{formatCurrency(r.amount)}</TableCell></TableRow>))}
                                    </TableBody>
                                    <TableFooter><TableRow className="font-bold text-base bg-green-50"><TableCell colSpan={3}>إجمالي الإيرادات</TableCell><TableCell className="text-left font-mono">{formatCurrency(reportData.summary.totalIncome)}</TableCell></TableRow></TableFooter></Table>
                                </div>
                            </section>
                            <section>
                                <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2"><ArrowUp /> المصروفات (المدفوعات)</h2>
                                <div className="border rounded-lg">
                                    <Table><TableHeader><TableRow><TableHead>رقم السند</TableHead><TableHead>المستفيد</TableHead><TableHead>البيان</TableHead><TableHead className="text-left">المبلغ</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.payments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24">لا توجد مدفوعات لهذا اليوم.</TableCell></TableRow> :
                                        reportData.payments.map(p => (<TableRow key={p.id}><TableCell>{p.voucherNumber}</TableCell><TableCell>{p.payeeName}</TableCell><TableCell>{p.description}</TableCell><TableCell className="text-left font-mono">{formatCurrency(p.amount)}</TableCell></TableRow>))}
                                    </TableBody>
                                    <TableFooter><TableRow className="font-bold text-base bg-red-50"><TableCell colSpan={3}>إجمالي المصروفات</TableCell><TableCell className="text-left font-mono">{formatCurrency(reportData.summary.totalExpense)}</TableCell></TableRow></TableFooter></Table>
                                </div>
                            </section>
                            <Separator className="my-8" />
                            <section>
                                <h2 className="text-xl font-bold mb-4 text-blue-600 flex items-center gap-2"><Scale /> ملخص اليوم</h2>
                                <div className="grid md:grid-cols-3 gap-4 text-center">
                                    <Card><CardHeader><CardTitle>إجمالي الإيرادات</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-green-600">{formatCurrency(reportData.summary.totalIncome)}</CardContent></Card>
                                    <Card><CardHeader><CardTitle>إجمالي المصروفات</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-red-600">{formatCurrency(reportData.summary.totalExpense)}</CardContent></Card>
                                    <Card className={reportData.summary.netBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}><CardHeader><CardTitle>صافي الحركة</CardTitle></CardHeader><CardContent className={`text-2xl font-bold ${reportData.summary.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(reportData.summary.netBalance)}</CardContent></Card>
                                </div>
                                <h3 className="font-semibold mt-8 mb-4">الأرصدة النهائية للحسابات النقدية</h3>
                                <div className="grid md:grid-cols-2 gap-4 text-center">
                                    <Card><CardHeader><CardTitle>رصيد الصندوق</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCurrency(reportData.summary.cashBalance)}</CardContent></Card>
                                    <Card><CardHeader><CardTitle>إجمالي أرصدة البنوك</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{formatCurrency(reportData.summary.bankBalance)}</CardContent></Card>
                                </div>
                            </section>
                        </div>
                    </PrintableDocument>
                    <div className="flex justify-end mt-4 no-print">
                        <Button onClick={handlePrint}><Printer className="ml-2 h-4 w-4" /> طباعة التقرير</Button>
                    </div>
                </div>
            )}
        </div>
    );
}
