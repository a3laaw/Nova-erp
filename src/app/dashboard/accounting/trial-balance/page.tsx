'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { Account, JournalEntry } from '@/lib/types';
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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, Scale, Filter, AlertTriangle } from 'lucide-react';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';

interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  type: string;
  level: number;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export default function TrialBalancePage() {
    const { firestore } = useFirebase();
    const { user } = useAuth();
    const { branding } = useBranding();
    
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
    
    // Filters
    const [hideZeroBalances, setHideZeroBalances] = useState(true);
    const [typeFilter, setTypeFilter] = useState('all');
    const [levelFilter, setLevelFilter] = useState('all');

    // 🛡️ استخدام الخطافات السيادية الموحدة لضمان العبور الصحيح للمنشأة
    const { data: accounts, loading: accountsLoading } = useSubscription<Account>(
        firestore, 
        user?.currentCompanyId ? 'chartOfAccounts' : null, 
        [orderBy('code')]
    );
    
    const { data: journalEntries, loading: entriesLoading } = useSubscription<JournalEntry>(
        firestore, 
        user?.currentCompanyId ? 'journalEntries' : null, 
        [where('status', '==', 'posted')]
    );

    const loading = accountsLoading || entriesLoading;

    const trialBalanceData = useMemo(() => {
        if (loading || !dateFrom || !dateTo || accounts.length === 0) return { lines: [], totals: { openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0, closingDebit: 0, closingCredit: 0, isBalanced: true } };

        const startDate = startOfDay(dateFrom);
        const endDate = endOfDay(dateTo);

        const lines: TrialBalanceLine[] = accounts.map(account => {
            let openingBalance = 0;
            let periodDebit = 0;
            let periodCredit = 0;

            journalEntries.forEach(entry => {
                const entryDate = toFirestoreDate(entry.date);
                if (!entryDate) return;

                const relevantLine = entry.lines.find(line => line.accountId === account.id);
                if (!relevantLine) return;

                const amount = (relevantLine.debit || 0) - (relevantLine.credit || 0);

                if (entryDate < startDate) {
                    openingBalance += amount;
                } else if (entryDate <= endDate) {
                    periodDebit += (relevantLine.debit || 0);
                    periodCredit += (relevantLine.credit || 0);
                }
            });

            const closingBalance = openingBalance + periodDebit - periodCredit;

            return {
                accountId: account.id!,
                accountCode: account.code,
                accountName: account.name,
                type: account.type,
                level: account.level,
                openingDebit: openingBalance > 0 ? openingBalance : 0,
                openingCredit: openingBalance < 0 ? -openingBalance : 0,
                periodDebit,
                periodCredit,
                closingDebit: closingBalance > 0 ? closingBalance : 0,
                closingCredit: closingBalance < 0 ? -closingBalance : 0,
            };
        }).filter(line => {
             const hasMovement = line.openingDebit > 0 || line.openingCredit > 0 || line.periodDebit > 0 || line.periodCredit > 0;
             if (hideZeroBalances && !hasMovement) return false;
             if (typeFilter !== 'all' && line.type !== typeFilter) return false;
             if (levelFilter !== 'all' && line.level !== parseInt(levelFilter)) return false;
             return true;
        });
        
        const totalClosingDebit = lines.reduce((sum, l) => sum + l.closingDebit, 0);
        const totalClosingCredit = lines.reduce((sum, l) => sum + l.closingCredit, 0);

        const totals = {
            openingDebit: lines.reduce((sum, l) => sum + l.openingDebit, 0),
            openingCredit: lines.reduce((sum, l) => sum + l.openingCredit, 0),
            periodDebit: lines.reduce((sum, l) => sum + l.periodDebit, 0),
            periodCredit: lines.reduce((sum, l) => sum + l.periodCredit, 0),
            closingDebit: totalClosingDebit,
            closingCredit: totalClosingCredit,
            isBalanced: Math.abs(totalClosingDebit - totalClosingCredit) < 0.001
        };

        return { lines, totals };
    }, [loading, accounts, journalEntries, dateFrom, dateTo, hideZeroBalances, typeFilter, levelFilter]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="no-print rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-blue-50">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner"><Scale className="h-8 w-8" /></div>
                            <div>
                                <CardTitle className="text-2xl font-black text-blue-900">ميزان المراجعة المطور</CardTitle>
                                <CardDescription className="text-base font-medium">عرض أرصدة الحسابات مع فلاتر النوع والمستوى الرقابي.</CardDescription>
                            </div>
                        </div>
                        <Button onClick={() => window.print()} variant="outline" className="rounded-xl font-bold gap-2"><Printer className="h-4 w-4" /> طباعة الميزان</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end">
                        <div className="grid gap-2"><Label className="text-xs font-bold mr-1">من تاريخ</Label><DateInput value={dateFrom} onChange={setDateFrom} /></div>
                        <div className="grid gap-2"><Label className="text-xs font-bold mr-1">إلى تاريخ</Label><DateInput value={dateTo} onChange={setDateTo} /></div>
                        <div className="grid gap-2">
                            <Label className="text-xs font-bold mr-1">نوع الحساب</Label>
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="h-11 rounded-xl bg-white border-2"><SelectValue /></SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="all">كل الأنواع</SelectItem>
                                    <SelectItem value="asset">الأصول</SelectItem>
                                    <SelectItem value="liability">الالتزامات</SelectItem>
                                    <SelectItem value="income">الإيرادات</SelectItem>
                                    <SelectItem value="expense">المصروفات</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 pb-3">
                            <Checkbox id="hide-zero" checked={hideZeroBalances} onCheckedChange={(c) => setHideZeroBalances(!!c)} />
                            <Label htmlFor="hide-zero" className="font-bold cursor-pointer">إخفاء الأرصدة الصفرية</Label>
                        </div>
                        <div className="flex gap-2">
                            <Button className="flex-1 rounded-xl h-11 font-black gap-2 shadow-lg shadow-blue-100">
                                <Filter className="h-4 w-4" /> تحديث النتائج
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!trialBalanceData.totals.isBalanced && !loading && (
                <div className="bg-red-50 border-2 border-red-200 p-6 rounded-3xl animate-bounce flex items-center gap-4 shadow-xl">
                    <AlertTriangle className="h-10 w-10 text-red-600" />
                    <div>
                        <h4 className="text-xl font-black text-red-800 tracking-tighter">تنبيه حرج: ميزان المراجعة غير متوازن!</h4>
                        <p className="text-sm font-bold text-red-600">يوجد فرق مادي بين إجمالي الأرصدة المدينة والدائنة. يرجى مراجعة قيود اليومية المرحلة يدوياً.</p>
                    </div>
                </div>
            )}

            <Card className="rounded-[3rem] border-none shadow-2xl overflow-hidden bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50 h-16">
                            <TableRow className="border-none">
                                <TableHead rowSpan={2} className="px-8 font-black border-l">اسم الحساب (الكود)</TableHead>
                                <TableHead colSpan={2} className="text-center font-black border-l">الرصيد الافتتاحي</TableHead>
                                <TableHead colSpan={2} className="text-center font-black border-l">حركة الفترة</TableHead>
                                <TableHead colSpan={2} className="text-center font-black bg-primary/5 text-primary">الرصيد الختامي</TableHead>
                            </TableRow>
                            <TableRow className="bg-muted/30 h-10 text-[10px]">
                                <TableHead className="text-center border-l">مدين (+)</TableHead>
                                <TableHead className="text-center border-l">دائن (-)</TableHead>
                                <TableHead className="text-center border-l">مدين (+)</TableHead>
                                <TableHead className="text-center border-l">دائن (-)</TableHead>
                                <TableHead className="text-center border-l text-primary">مدين (+)</TableHead>
                                <TableHead className="text-center text-primary">دائن (-)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={7} className="p-8"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>)
                            ) : trialBalanceData.lines.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="h-64 text-center text-muted-foreground italic font-black">لا توجد بيانات للعرض وفق المعايير المختارة.</TableCell></TableRow>
                            ) : (
                                trialBalanceData.lines.map(line => (
                                    <TableRow key={line.accountId} className={cn("h-14 transition-colors border-b last:border-0", line.level === 0 ? "bg-muted/20 font-black" : "hover:bg-primary/[0.02]")}>
                                        <TableCell style={{ paddingRight: `${(line.level || 0) * 1.5 + 2}rem` }} className="font-bold text-slate-800">
                                            {line.accountName} <span className="font-mono text-[10px] opacity-40 mr-2">({line.accountCode})</span>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs">{line.openingDebit > 0 ? formatCurrency(line.openingDebit) : '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-xs">{line.openingCredit > 0 ? formatCurrency(line.openingCredit) : '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-xs text-blue-600">{line.periodDebit > 0 ? formatCurrency(line.periodDebit) : '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-xs text-amber-600">{line.periodCredit > 0 ? formatCurrency(line.periodCredit) : '-'}</TableCell>
                                        <TableCell className="text-center font-mono font-black bg-primary/[0.02] border-l border-primary/10 text-primary">
                                            {line.closingDebit > 0 ? formatCurrency(line.closingDebit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-mono font-black bg-primary/[0.02] text-primary">
                                            {line.closingCredit > 0 ? formatCurrency(line.closingCredit) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-primary h-24 text-white">
                            <TableRow className="border-none hover:bg-primary">
                                <TableCell className="px-12 font-black text-2xl">الإجماليات العامة للميزان:</TableCell>
                                <TableCell className="text-center font-mono text-lg opacity-80">{formatCurrency(trialBalanceData.totals.openingDebit)}</TableCell>
                                <TableCell className="text-center font-mono text-lg opacity-80">{formatCurrency(trialBalanceData.totals.openingCredit)}</TableCell>
                                <TableCell className="text-center font-mono text-lg opacity-80">{formatCurrency(trialBalanceData.totals.periodDebit)}</TableCell>
                                <TableCell className="text-center font-mono text-lg opacity-80">{formatCurrency(trialBalanceData.totals.periodCredit)}</TableCell>
                                <TableCell className="text-center font-mono text-2xl font-black bg-white/10">{formatCurrency(trialBalanceData.totals.closingDebit)}</TableCell>
                                <TableCell className="text-center font-mono text-2xl font-black bg-white/10">{formatCurrency(trialBalanceData.totals.closingCredit)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
