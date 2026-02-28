
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

                const cashBalance = calculateBalance(['110101']); // 'الصندوق'
                const bankBalance = calculateBalance(['110102']); // 'البنك'

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
            <Card className="no-print border-none shadow-sm rounded-2xl overflow-hidden bg-gradient-to-l from-white to-sky-50">
                 <CardHeader>
                    <CardTitle className="text-xl font-black">التقرير المالي اليومي (تدقيق فوري)</CardTitle>
                    <CardDescription>اختر يوماً لعرض ملخص الإيرادات والمصروفات والأرصدة النقدية في تلك اللحظة.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-end gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="report-date" className="font-bold">تاريخ التقرير</Label>
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
                                <h2 className="text-xl font-bold mb-4 text-green-600 flex items-center gap-2"><ArrowDown className="h-5 w-5" /> الإيرادات (المقبوضات اليومية)</h2>
                                <div className="border-2 rounded-2xl overflow-hidden">
                                    <Table><TableHeader className="bg-muted/50"><TableRow><TableHead>رقم السند</TableHead><TableHead>العميل</TableHead><TableHead>البيان</TableHead><TableHead className="text-left">المبلغ</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.receipts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground italic">لا توجد مقبوضات مسجلة لهذا اليوم.</TableCell></TableRow> :
                                        reportData.receipts.map(r => (<TableRow key={r.id}><TableCell className="font-mono font-bold">{r.voucherNumber}</TableCell><TableCell className="font-medium">{r.clientNameAr}</TableCell><TableCell className="text-xs">{r.description}</TableCell><TableCell className="text-left font-mono font-black">{formatCurrency(r.amount)}</TableCell></TableRow>))}
                                    </TableBody>
                                    <TableFooter><TableRow className="font-black text-lg bg-green-50/50"><TableCell colSpan={3} className="text-right">إجمالي المقبوضات</TableCell><TableCell className="text-left font-mono text-green-700">{formatCurrency(reportData.summary.totalIncome)}</TableCell></TableRow></TableFooter></Table>
                                </div>
                            </section>
                            
                            <section>
                                <h2 className="text-xl font-bold mb-4 text-red-600 flex items-center gap-2"><ArrowUp className="h-5 w-5" /> المصروفات (المدفوعات اليومية)</h2>
                                <div className="border-2 rounded-2xl overflow-hidden">
                                    <Table><TableHeader className="bg-muted/50"><TableRow><TableHead>رقم السند</TableHead><TableHead>المستفيد</TableHead><TableHead>البيان</TableHead><TableHead className="text-left">المبلغ</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.payments.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground italic">لا توجد مدفوعات مسجلة لهذا اليوم.</TableCell></TableRow> :
                                        reportData.payments.map(p => (<TableRow key={p.id}><TableCell className="font-mono font-bold">{p.voucherNumber}</TableCell><TableCell className="font-medium">{p.payeeName}</TableCell><TableCell className="text-xs">{p.description}</TableCell><TableCell className="text-left font-mono font-black">{formatCurrency(p.amount)}</TableCell></TableRow>))}
                                    </TableBody>
                                    <TableFooter><TableRow className="font-black text-lg bg-red-50/50"><TableCell colSpan={3} className="text-right">إجمالي المدفوعات</TableCell><TableCell className="text-left font-mono text-red-700">{formatCurrency(reportData.summary.totalExpense)}</TableCell></TableRow></TableFooter></Table>
                                </div>
                            </section>

                            <Separator className="my-8" />
                            
                            <section className="bg-muted/30 p-8 rounded-[2.5rem] border-2">
                                <h2 className="text-2xl font-black mb-6 text-primary flex items-center gap-3"><Scale className="h-8 w-8" /> ملخص المركز النقدي اليومي</h2>
                                <div className="grid md:grid-cols-3 gap-6 text-center">
                                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground uppercase">إجمالي الداخل</p>
                                        <p className="text-2xl font-black text-green-600 font-mono">{formatCurrency(reportData.summary.totalIncome)}</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground uppercase">إجمالي الخارج</p>
                                        <p className="text-2xl font-black text-red-600 font-mono">{formatCurrency(reportData.summary.totalExpense)}</p>
                                    </div>
                                    <div className={cn("p-6 rounded-3xl border shadow-sm space-y-1", reportData.summary.netBalance >= 0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white')}>
                                        <p className="text-xs font-bold opacity-80 uppercase">صافي السيولة لليوم</p>
                                        <p className="text-2xl font-black font-mono">{formatCurrency(reportData.summary.netBalance)}</p>
                                    </div>
                                </div>
                                
                                <div className="mt-10 grid md:grid-cols-2 gap-6">
                                    <div className="bg-white/80 p-6 rounded-3xl border flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">رصيد الصندوق الإجمالي</p>
                                            <p className="text-2xl font-black font-mono">{formatCurrency(reportData.summary.cashBalance)}</p>
                                        </div>
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary font-black">KD</div>
                                    </div>
                                    <div className="bg-white/80 p-6 rounded-3xl border flex items-center justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">إجمالي أرصدة البنوك</p>
                                            <p className="text-2xl font-black font-mono">{formatCurrency(reportData.summary.bankBalance)}</p>
                                        </div>
                                        <div className="p-3 bg-primary/10 rounded-2xl text-primary font-black">KD</div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </PrintableDocument>
                    <div className="flex justify-end mt-4 no-print pb-10">
                        <Button onClick={handlePrint} className="h-12 px-10 rounded-xl font-bold gap-2 shadow-xl shadow-primary/20">
                            <Printer className="h-5 w-5" /> طباعة وتوقيع التقرير
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
