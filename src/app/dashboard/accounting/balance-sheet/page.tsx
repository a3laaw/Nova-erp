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
import { Loader2, Printer, Scale, AlertCircle, FileSearch, Landmark, ShieldCheck, User } from 'lucide-react';
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
    <div className={cn("flex justify-between py-2 border-b border-dashed border-slate-100 last:border-0", className)}>
        <span className="font-bold text-slate-700">{name}</span>
        <span className="font-mono font-black">{formatCurrency(balance)}</span>
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
                
                // إضافة صافي الربح للأرباح المبقاة آلياً
                if (acc.name.includes('أرباح')) balance += netIncome;
                
                if (balance === 0 && acc.type !== 'equity') return;

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
            <Card className="mb-6 no-print rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-6 border-b">
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <Scale className="text-primary h-6 w-6"/> قائمة المركز المالي (الميزانية العمومية)
                    </CardTitle>
                    <CardDescription>عرض الأصول والالتزامات وحقوق الملكية في لحظة زمنية محددة.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 flex flex-col md:flex-row gap-6 items-end">
                    <div className="grid gap-2 w-64">
                        <Label className="font-black text-gray-700 pr-1">حتى تاريخ *</Label>
                        <DateInput value={asOfDate} onChange={setAsOfDate} className="h-12 rounded-2xl border-2" />
                     </div>
                     <Button onClick={handleGenerate} disabled={isGenerating} className="h-12 px-12 rounded-2xl font-black text-lg gap-3 shadow-xl shadow-primary/20">
                        {isGenerating ? <Loader2 className="animate-spin h-5 w-5"/> : <FileSearch className="h-5 w-5" />}
                        توليد المركز المالي
                     </Button>
                </CardContent>
            </Card>

            {reportData ? (
                 <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <div id="printable-area" className="bg-white dark:bg-card shadow-2xl rounded-[2.5rem] overflow-hidden p-8 sm:p-12 print:shadow-none print:border-none">
                        <header className="flex justify-between items-start border-b-4 border-primary pb-8 mb-10">
                            <div className="text-left space-y-1">
                                <h2 className="text-3xl font-black text-primary tracking-tighter">قائمة المركز المالي</h2>
                                <p className="text-lg font-bold text-gray-500 uppercase tracking-widest font-mono">Statement of Financial Position</p>
                                <p className="text-xs text-muted-foreground mt-2">كما في: {asOfDate ? format(asOfDate, 'eeee, dd MMMM yyyy', { locale: ar }) : ''}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                <div>
                                    <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                    <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                </div>
                            </div>
                        </header>

                        <CardContent className="px-0 space-y-10">
                            {!reportData.isBalanced && (
                                <Alert variant="destructive" className="rounded-3xl border-2 py-6 bg-red-50 shadow-red-100">
                                    <AlertCircle className="h-6 w-6" />
                                    <AlertTitle className="text-lg font-black">الميزانية غير متوازنة!</AlertTitle>
                                    <AlertDescription className="font-bold">يوجد فرق مادي بين إجمالي الأصول وإجمالي الالتزامات وحقوق الملكية. يرجى مراجعة كافة القيود المرحلة.</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid lg:grid-cols-2 gap-16">
                                {/* جانب الأصول */}
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black text-primary border-r-4 border-primary pr-3 text-lg flex items-center gap-2">
                                            <Landmark className="h-5 w-5" /> الأصول المتداولة
                                        </h4>
                                        {reportData.assets.current.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                        <AccountRow name="إجمالي الأصول المتداولة" balance={reportData.assets.totalCurrent} className="font-black bg-slate-50 p-3 rounded-xl border-2 border-slate-100 mt-2" />
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-black text-primary border-r-4 border-primary pr-3 text-lg flex items-center gap-2">
                                            <Building2 className="h-5 w-5" /> الأصول غير المتداولة
                                        </h4>
                                        {reportData.assets.nonCurrent.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                        <AccountRow name="إجمالي الأصول غير المتداولة" balance={reportData.assets.totalNonCurrent} className="font-black bg-slate-50 p-3 rounded-xl border-2 border-slate-100 mt-2" />
                                    </div>

                                    <div className="flex justify-between items-center text-xl p-6 font-black bg-primary text-white rounded-3xl shadow-xl shadow-primary/20">
                                        <span>إجمالي الأصول</span>
                                        <span className="font-mono text-3xl">{formatCurrency(reportData.assets.total)}</span>
                                    </div>
                                </div>

                                {/* جانب الالتزامات وحقوق الملكية */}
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black text-orange-600 border-r-4 border-orange-600 pr-3 text-lg flex items-center gap-2">
                                            <ShieldCheck className="h-5 w-5" /> الالتزامات
                                        </h4>
                                        {reportData.liabilitiesAndEquity.currentLiabilities.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                        {reportData.liabilitiesAndEquity.nonCurrentLiabilities.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-black text-indigo-600 border-r-4 border-indigo-600 pr-3 text-lg flex items-center gap-2">
                                            <User className="h-5 w-5" /> حقوق الملكية
                                        </h4>
                                        {reportData.liabilitiesAndEquity.equity.map(i => <AccountRow key={i.name} name={i.name} balance={i.balance} />)}
                                    </div>

                                    <Separator className="my-4" />

                                    <div className="flex justify-between items-center text-xl p-6 font-black bg-slate-900 text-white rounded-3xl shadow-xl">
                                        <span>إجمالي الالتزامات وحقوق الملكية</span>
                                        <span className="font-mono text-3xl">{formatCurrency(reportData.liabilitiesAndEquity.total)}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        <footer className="pt-32 grid grid-cols-2 gap-20 text-center text-[10px] font-black uppercase text-muted-foreground">
                            <div className="space-y-16">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">الإدارة المالية</p>
                                <div className="pt-2 border-t border-dashed">التدقيق والاعتماد</div>
                            </div>
                            <div className="space-y-16">
                                <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">المدير العام</p>
                                <div className="pt-2 border-t border-dashed">الختم والمصادقة</div>
                            </div>
                        </footer>
                    </div>
                    
                    <div className="flex justify-end no-print pb-20">
                        <Button onClick={handlePrint} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-primary/30">
                            <Printer className="h-6 w-6" /> طباعة الميزانية العمومية
                        </Button>
                    </div>
                 </div>
            ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
                    <div className="p-10 bg-muted rounded-full mb-6">
                        <Scale className="h-24 w-24 text-muted-foreground" />
                    </div>
                    <h3 className="text-3xl font-black text-muted-foreground">بانتظار بناء المركز المالي</h3>
                    <p className="text-lg font-bold mt-2">حدد التاريخ المستهدف واضغط على "توليد" لعرض الموقف المالي للمنشأة.</p>
                </div>
            )}
        </div>
    );
}