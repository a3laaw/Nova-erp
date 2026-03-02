
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirebase } from '@/firebase';
import { collection, query, getDocs, where, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
import { format, endOfYear } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, Scale, AlertCircle, FileSearch } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '@/components/layout/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateInput } from '@/components/ui/date-input';

interface BalanceSheetData {
    assets: {
        current: { name: string; balance: number }[];
        nonCurrent: { name: string; balance: number }[];
        totalCurrent: number;
        totalNonCurrent: number;
        total: number;
    };
    liabilitiesAndEquity: {
        currentLiabilities: { name: string; balance: number }[];
        nonCurrentLiabilities: { name: string; balance: number }[];
        equity: { name: string; balance: number }[];
        totalCurrentLiabilities: number;
        totalNonCurrentLiabilities: number;
        totalEquity: number;
        total: number;
    };
    isBalanced: boolean;
}

const AccountRow = ({ name, balance, className }: { name: string, balance: number, className?: string }) => (
    <div className={cn("flex justify-between py-1.5", className)}>
        <span>{name}</span>
        <span className="font-mono">{formatCurrency(balance)}</span>
    </div>
);

export default function BalanceSheetPage() {
    const { firestore } = useFirebase();
    const { branding, loading: brandingLoading } = useBranding();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<BalanceSheetData | null>(null);
    const [asOfDate, setAsOfDate] = useState<Date | undefined>(() => endOfYear(new Date()));

    const handleGenerate = async () => {
        if (!firestore || !asOfDate) return;
        setIsGenerating(true);
        
        try {
            const [accountsSnap, entriesSnap] = await Promise.all([
                getDocs(query(collection(firestore, 'chartOfAccounts'))),
                getDocs(query(
                    collection(firestore, 'journalEntries'), 
                    where('date', '<=', Timestamp.fromDate(asOfDate)),
                    where('status', '==', 'posted')
                ))
            ]);

            const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
            const journalEntries = entriesSnap.docs.map(doc => doc.data() as JournalEntry);

            const accountBalances = new Map<string, number>();
            let netIncome = 0;

            journalEntries.forEach(entry => {
                entry.lines.forEach(line => {
                    const acc = accounts.find(a => a.id === line.accountId);
                    if (!acc) return;
                    
                    const currentBalance = accountBalances.get(line.accountId) || 0;
                    let balanceChange = (acc.type === 'asset' || acc.type === 'expense')
                        ? (line.debit || 0) - (line.credit || 0)
                        : (line.credit || 0) - (line.debit || 0);
                    
                    accountBalances.set(line.accountId, currentBalance + balanceChange);
                    
                    if (acc.type === 'income') netIncome += balanceChange;
                    if (acc.type === 'expense') netIncome -= balanceChange;
                });
            });

            const data: BalanceSheetData = {
                assets: { current: [], nonCurrent: [], totalCurrent: 0, totalNonCurrent: 0, total: 0 },
                liabilitiesAndEquity: { currentLiabilities: [], nonCurrentLiabilities: [], equity: [], totalCurrentLiabilities: 0, totalNonCurrentLiabilities: 0, totalEquity: 0, total: 0 },
                isBalanced: false,
            };
            
            accounts.forEach(acc => {
                let balance = accountBalances.get(acc.id!) || 0;
                if (balance === 0 && acc.type !== 'equity') return;

                if (acc.name.includes('أرباح')) balance += netIncome;

                const item = { name: acc.name, balance };
                if (acc.code.startsWith('11')) { data.assets.current.push(item); data.assets.totalCurrent += balance; }
                else if (acc.code.startsWith('1')) { data.assets.nonCurrent.push(item); data.assets.totalNonCurrent += balance; }
                else if (acc.code.startsWith('21')) { data.liabilitiesAndEquity.currentLiabilities.push(item); data.liabilitiesAndEquity.totalCurrentLiabilities += balance; }
                else if (acc.code.startsWith('2')) { data.liabilitiesAndEquity.nonCurrentLiabilities.push(item); data.liabilitiesAndEquity.totalNonCurrentLiabilities += balance; }
                else if (acc.code.startsWith('3')) { data.liabilitiesAndEquity.equity.push(item); data.liabilitiesAndEquity.totalEquity += balance; }
            });
            
            data.assets.total = data.assets.totalCurrent + data.assets.totalNonCurrent;
            data.liabilitiesAndEquity.total = data.liabilitiesAndEquity.totalCurrentLiabilities + data.liabilitiesAndEquity.totalNonCurrentLiabilities + data.liabilitiesAndEquity.totalEquity;
            data.isBalanced = Math.abs(data.assets.total - data.liabilitiesAndEquity.total) < 0.01;

            setReportData(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => window.print();

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            <Card className="mb-4 no-print rounded-2xl border-none shadow-sm">
                 <CardHeader>
                    <CardTitle className="text-xl font-black">المركز المالي (نتائج ثابتة للمراجعة)</CardTitle>
                    <CardDescription>عرض الأصول والالتزامات وحقوق الملكية. يتطلب الضغط على إنشاء لتحديث القراءة.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="grid gap-2">
                        <Label className="font-bold">حتى تاريخ</Label>
                        <DateInput value={asOfDate} onChange={setAsOfDate} />
                     </div>
                     <Button onClick={handleGenerate} disabled={isGenerating} className="h-10 px-8 rounded-xl font-bold gap-2">
                        {isGenerating ? <Loader2 className="animate-spin h-4 w-4"/> : <FileSearch className="h-4 w-4" />}
                        توليد المركز المالي
                     </Button>
                </CardContent>
            </Card>

            {brandingLoading && <Card><CardContent className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></CardContent></Card>}

            {!brandingLoading && reportData ? (
                 <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none print:bg-transparent">
                    <div id="printable-area" className="p-8 md:p-12">
                        <div className="flex justify-between items-start pb-4 border-b-2 border-gray-800">
                            <div className="text-left">
                                <h2 className="text-2xl font-bold">قائمة المركز المالي</h2>
                                <p className="text-lg font-semibold">Balance Sheet</p>
                                <p className="font-mono text-sm mt-2">كما في: {asOfDate ? format(asOfDate, 'dd/MM/yyyy') : ''}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Logo className="h-16 w-16" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                                    <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                </div>
                            </div>
                        </div>
                        <CardContent className="px-0 pt-6 space-y-6">
                            {!reportData.isBalanced && (
                                <Alert variant="destructive" className="rounded-xl border-2">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertTitle>الميزانية غير متوازنة!</AlertTitle>
                                    <AlertDescription>يوجد فرق بين الأصول والالتزامات. يرجى مراجعة القيود.</AlertDescription>
                                </Alert>
                            )}
                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                                <div className="space-y-6">
                                    <h4 className="font-bold border-b pb-1">الأصول المتداولة</h4>
                                    {reportData.assets.current.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    <AccountRow name="إجمالي الأصول المتداولة" balance={reportData.assets.totalCurrent} className="font-bold bg-muted/30 p-2 rounded" />
                                    <h4 className="font-bold border-b pb-1 mt-4">الأصول غير المتداولة</h4>
                                    {reportData.assets.nonCurrent.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    <div className="flex justify-between items-center text-lg p-2 font-black bg-blue-50 border border-blue-200 rounded-lg">
                                        <span>مجموع الأصول</span>
                                        <span className="font-mono">{formatCurrency(reportData.assets.total)}</span>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h4 className="font-bold border-b pb-1">الالتزامات</h4>
                                    {reportData.liabilitiesAndEquity.currentLiabilities.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    <h4 className="font-bold border-b pb-1 mt-4">حقوق الملكية</h4>
                                    {reportData.liabilitiesAndEquity.equity.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    <div className="flex justify-between items-center text-lg p-2 font-black bg-blue-50 border border-blue-200 rounded-lg">
                                        <span>المجموع الإجمالي</span>
                                        <span className="font-mono">{formatCurrency(reportData.liabilitiesAndEquity.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-0 pt-8 flex justify-end no-print">
                            <Button onClick={handlePrint} variant="outline"><Printer className="ml-2 h-4 w-4" /> طباعة</Button>
                        </CardFooter>
                    </div>
                 </div>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-40 no-print">
                    <Scale className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black text-muted-foreground">اختر التاريخ واضغط على زر "توليد المركز المالي" لعرض البيانات المثبتة.</p>
                </div>
            )}
        </div>
    );
}
