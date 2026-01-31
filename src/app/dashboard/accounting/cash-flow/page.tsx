
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { format, startOfYear, endOfYear, parseISO, subDays } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Loader2, Printer, ArrowLeftRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';

interface StatementLineProps {
    label: string;
    value: number;
    isSubtotal?: boolean;
    isTotal?: boolean;
    isSubItem?: boolean;
}

const StatementLine = ({ label, value, isSubtotal = false, isTotal = false, isSubItem = false }: StatementLineProps) => (
    <div className={`flex justify-between items-center py-2 ${isSubtotal ? 'border-t' : ''} ${isTotal ? 'font-bold text-lg bg-muted/50 p-2 rounded-md' : ''}`}>
        <span className={isSubItem ? 'pl-4 text-muted-foreground' : ''}>{label}</span>
        <span className={`font-mono ${value < 0 ? 'text-red-600' : ''}`}>
            {value < 0 ? `(${formatCurrency(Math.abs(value))})` : formatCurrency(value)}
        </span>
    </div>
);


export default function CashFlowStatementPage() {
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
    
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    useEffect(() => {
        const now = new Date();
        setDateFrom(format(startOfYear(now), 'yyyy-MM-dd'));
        setDateTo(format(endOfYear(now), 'yyyy-MM-dd'));
    }, []);

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
        if (!firestore || !dateTo) return;
        const fetchEntries = async () => {
            setLoading(true);
            try {
                const endDate = parseISO(dateTo);
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
    }, [firestore, dateTo]);


    const cashFlowData = useMemo(() => {
        if (loading || !dateFrom || !dateTo || accounts.length === 0) return null;

        const startDate = parseISO(dateFrom);
        const endDate = parseISO(dateTo);
        const prevPeriodEndDate = subDays(startDate, 1);
        
        const getAccountBalanceAsOf = (accountCodes: string[], asOfDate: Date) => {
            const accountIds = new Set(accounts.filter(acc => accountCodes.some(code => acc.code.startsWith(code))).map(acc => acc.id));
            if(accountIds.size === 0) return 0;
            
            return journalEntries
                .filter(entry => (entry.date as Timestamp).toDate() <= asOfDate)
                .flatMap(entry => entry.lines)
                .filter(line => accountIds.has(line.accountId))
                .reduce((balance, line) => {
                     const acc = accounts.find(a => a.id === line.accountId)!;
                     if(acc.type === 'asset' || acc.type === 'expense') {
                         return balance + (line.debit || 0) - (line.credit || 0);
                     }
                     return balance + (line.credit || 0) - (line.debit || 0);
                }, 0);
        };

        const getNetIncome = () => {
             return journalEntries
                .filter(entry => {
                    const entryDate = (entry.date as Timestamp).toDate();
                    return entryDate >= startDate && entryDate <= endDate;
                })
                .flatMap(entry => entry.lines)
                .reduce((netIncome, line) => {
                    const acc = accounts.find(a => a.id === line.accountId);
                    if(!acc) return netIncome;

                    if (acc.type === 'income') return netIncome + (line.credit || 0) - (line.debit || 0);
                    if (acc.type === 'expense') return netIncome - ((line.debit || 0) - (line.credit || 0));
                    return netIncome;
                }, 0);
        };
        
        const netIncome = getNetIncome();
        
        const arStart = getAccountBalanceAsOf(['1102'], prevPeriodEndDate);
        const arEnd = getAccountBalanceAsOf(['1102'], endDate);
        const changeInAR = (arEnd - arStart) * -1; // Increase in AR is a cash outflow

        const apStart = getAccountBalanceAsOf(['2101'], prevPeriodEndDate);
        const apEnd = getAccountBalanceAsOf(['2101'], endDate);
        const changeInAP = apEnd - apStart; // Increase in AP is a cash inflow
        
        const cashFromOps = netIncome + changeInAR + changeInAP;

        const cashAtStart = getAccountBalanceAsOf(['1101'], prevPeriodEndDate);
        const cashAtEnd = getAccountBalanceAsOf(['1101'], endDate);
        const netCashChange = cashAtEnd - cashAtStart;

        return {
            netIncome,
            changeInAR,
            changeInAP,
            cashFromOps,
            netCashChange,
            cashAtStart,
            cashAtEnd,
        };

    }, [loading, accounts, journalEntries, dateFrom, dateTo]);


    const handlePrint = () => window.print();
    const isLoading = loading || brandingLoading;

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print">
                 <CardHeader>
                    <CardTitle>قائمة التدفقات النقدية</CardTitle>
                    <CardDescription>عرض حركة النقد من الأنشطة التشغيلية والاستثمارية والتمويلية.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="grid gap-2">
                        <Label htmlFor="dateFrom">من تاريخ</Label>
                        <Input id="dateFrom" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                     </div>
                     <div className="grid gap-2">
                        <Label htmlFor="dateTo">إلى تاريخ</Label>
                        <Input id="dateTo" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                     </div>
                </CardContent>
            </Card>

            {isLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 text-primary" /></CardContent></Card>}

            {!isLoading && cashFlowData && (
                 <div 
                    id="printable-area" 
                    className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent"
                >
                    {branding?.letterhead_image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={branding.letterhead_image_url} 
                            alt="Letterhead"
                            className="w-full h-auto object-contain"
                        />
                    )}
                    <div className="p-8 md:p-12">
                        <CardHeader className="p-0">
                             <div className="flex justify-between items-start pb-4">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">قائمة التدفقات النقدية</h2>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Statement of Cash Flows</p>
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
                                <p><span className="font-semibold w-24 inline-block">عن الفترة من:</span> {dateFrom ? format(parseISO(dateFrom), 'dd/MM/yyyy') : ''} <span className="font-semibold w-12 inline-block text-center">إلى:</span> {dateTo ? format(parseISO(dateTo), 'dd/MM/yyyy') : ''}</p>
                             </div>
                        </CardHeader>
                        <CardContent className="px-0 pt-6 space-y-6">
                            {/* Operating Activities */}
                            <div className="space-y-2">
                                <h3 className="font-bold text-lg">التدفقات النقدية من الأنشطة التشغيلية</h3>
                                <StatementLine label="صافي الربح" value={cashFlowData.netIncome} />
                                <p className="text-sm font-semibold text-muted-foreground pt-2">تعديلات الأنشطة التشغيلية:</p>
                                <StatementLine label="التغير في الذمم المدينة" value={cashFlowData.changeInAR} isSubItem />
                                <StatementLine label="التغير في الذمم الدائنة" value={cashFlowData.changeInAP} isSubItem />
                                 <StatementLine label="صافي التدفقات النقدية من الأنشطة التشغيلية" value={cashFlowData.cashFromOps} isSubtotal />
                            </div>
                            
                            {/* Investing Activities */}
                             <div className="space-y-2">
                                <h3 className="font-bold text-lg">التدفقات النقدية من الأنشطة الاستثمارية</h3>
                                <div className="text-center text-muted-foreground p-4 border-dashed border rounded-md">
                                    لا توجد بيانات للأنشطة الاستثمارية
                                </div>
                                 <StatementLine label="صافي التدفقات النقدية من الأنشطة الاستثمارية" value={0} isSubtotal />
                            </div>

                            {/* Financing Activities */}
                             <div className="space-y-2">
                                <h3 className="font-bold text-lg">التدفقات النقدية من الأنشطة التمويلية</h3>
                                 <div className="text-center text-muted-foreground p-4 border-dashed border rounded-md">
                                    لا توجد بيانات للأنشطة التمويلية
                                </div>
                                 <StatementLine label="صافي التدفقات النقدية من الأنشطة التمويلية" value={0} isSubtotal />
                            </div>
                            
                            <Separator className="my-4"/>
                            
                            {/* Summary */}
                            <div className="space-y-2">
                                <StatementLine label="صافي التغير في النقد" value={cashFlowData.netCashChange} />
                                <StatementLine label="النقد في بداية الفترة" value={cashFlowData.cashAtStart} />
                                <StatementLine label="النقد في نهاية الفترة" value={cashFlowData.cashAtEnd} isTotal />
                            </div>
                        </CardContent>
                         <CardFooter className="p-0 pt-8 flex justify-end items-center no-print">
                            <Button onClick={handlePrint}>
                                <Printer className="ml-2 h-4 w-4" />
                                طباعة / تصدير PDF
                            </Button>
                        </CardFooter>
                    </div>
                 </div>
            )}
        </div>
    );
}
