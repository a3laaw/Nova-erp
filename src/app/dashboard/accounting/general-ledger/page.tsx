'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry, ConstructionProject, Department } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, Search, FileText, ArrowRight, ListTree, Info, Target, Building2 } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';

interface StatementLine {
    date: Date;
    entryNumber: string;
    narration: string;
    accountName: string; 
    debit: number;
    credit: number;
    balance: number;
    entryId: string;
    costCenterName?: string;
    departmentName?: string;
}

export default function GeneralLedgerPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [projects, setProjects] = useState<ConstructionProject[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // --- الفلاتر ---
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
    const [statusFilter, setStatusFilter] = useState<'posted' | 'all'>('posted');

    // --- نتائج الكشف المثبتة ---
    const [ledgerData, setLedgerData] = useState<{
        openingBalance: number;
        lines: StatementLine[];
        totalDebit: number;
        totalCredit: number;
        finalBalance: number;
    } | null>(null);

    // جلب البيانات المرجعية
    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            try {
                const [accountsSnap, projectsSnap, deptsSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                    getDocs(collection(firestore, 'projects')),
                    getDocs(collection(firestore, 'departments'))
                ]);
                setAccounts(accountsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
                setProjects(projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ConstructionProject)));
                setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
                setLoading(false);
            } catch (err) {
                console.error("Error fetching ledger refs:", err);
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore]);

    const accountOptions = useMemo(() => 
        accounts.map(acc => ({
            value: acc.id!,
            label: `${acc.name} (${acc.code})`,
            searchKey: acc.code
        }))
    , [accounts]);

    const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.projectName])), [projects]);
    const deptMap = useMemo(() => new Map(departments.map(d => [d.id, d.name])), [departments]);

    // محرك استخراج الكشف (The Ledger Engine)
    const handleGenerateLedger = async () => {
        if (!firestore || !selectedAccountId || !dateFrom || !dateTo) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار الحساب والفترة الزمنية.' });
            return;
        }

        setIsGenerating(true);
        try {
            const selectedAccount = accounts.find(a => a.id === selectedAccountId)!;
            
            // 1. تحديد كافة الحسابات المستهدفة (الحساب نفسه + كافة الحسابات الفرعية التابعة له)
            const targetAccountIds = new Set<string>([selectedAccountId]);
            
            const findChildren = (parentCode: string) => {
                accounts.forEach(acc => {
                    if (acc.parentCode === parentCode) {
                        targetAccountIds.add(acc.id!);
                        findChildren(acc.code); 
                    }
                });
            };
            findChildren(selectedAccount.code);

            // 2. جلب الحركات التاريخية للرصيد الافتتاحي
            const startDate = startOfDay(dateFrom);
            const endDate = endOfDay(dateTo);

            const entriesQuery = query(
                collection(firestore, 'journalEntries')
            );
            const entriesSnap = await getDocs(entriesQuery);
            const allEntries = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry));

            let openingBalance = 0;
            const transactionsInPeriod: any[] = [];

            allEntries.forEach(entry => {
                const entryDate = toFirestoreDate(entry.date);
                if (!entryDate) return;
                
                const isPosted = entry.status === 'posted';
                const matchesStatus = statusFilter === 'all' || isPosted;

                entry.lines.forEach(line => {
                    if (targetAccountIds.has(line.accountId)) {
                        const amount = (line.debit || 0) - (line.credit || 0);
                        
                        // الرصيد الافتتاحي دائماً من القيود المرحلة فقط لضمان سلامة الأرصدة التراكمية
                        if (entryDate < startDate) {
                            if (isPosted) {
                                openingBalance += amount;
                            }
                        } else if (entryDate <= endDate) {
                            // الحركات داخل الفترة تخضع لفلتر الحالة المختار
                            if (matchesStatus) {
                                transactionsInPeriod.push({
                                    date: entryDate,
                                    entryNumber: entry.entryNumber,
                                    narration: entry.narration,
                                    accountName: line.accountName,
                                    debit: line.debit || 0,
                                    credit: line.credit || 0,
                                    entryId: entry.id!,
                                    costCenterName: line.auto_profit_center ? projectMap.get(line.auto_profit_center) : null,
                                    departmentName: line.auto_dept_id ? deptMap.get(line.auto_dept_id) : null
                                });
                            }
                        }
                    }
                });
            });

            // 3. ترتيب الحركات زمنياً وحساب الرصيد المتدفق
            transactionsInPeriod.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            let runningBalance = openingBalance;
            const lines: StatementLine[] = transactionsInPeriod.map(tx => {
                runningBalance += tx.debit - tx.credit;
                return { ...tx, balance: runningBalance };
            });

            const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
            const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

            setLedgerData({
                openingBalance,
                lines,
                totalDebit,
                totalCredit,
                finalBalance: runningBalance
            });

            toast({ title: 'تم استخراج الكشف', description: `تمت معالجة ${lines.length} حركة مالية.` });

        } catch (error) {
            console.error("Ledger Generation Error:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استخراج كشف الحساب.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => window.print();

    return (
        <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
            {/* واجهة التحكم - مخفية عند الطباعة */}
            <Card className="mb-6 no-print rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 pb-6 border-b">
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <ListTree className="text-primary h-6 w-6"/>
                        محرك كشوف الحسابات وتتبع مراكز التكلفة
                    </CardTitle>
                    <CardDescription>تحليل الحركات المالية المجمعة مع إمكانية فرز التكاليف المباشرة (المشاريع) والإدارية (الأقسام).</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                        <div className="md:col-span-5 grid gap-2">
                            <Label className="font-black text-gray-700 pr-1">الحساب المستهدف (رئيسي أو فرعي) *</Label>
                            <InlineSearchList 
                                value={selectedAccountId}
                                onSelect={setSelectedAccountId}
                                options={accountOptions}
                                placeholder={loading ? "جاري جلب الشجرة..." : "اختر حساباً..."}
                                className="h-12 rounded-2xl bg-white border-2"
                            />
                        </div>
                        <div className="md:col-span-2 grid gap-2">
                            <Label className="font-bold text-xs pr-1">من تاريخ</Label>
                            <DateInput value={dateFrom} onChange={setDateFrom} className="h-12 bg-white" />
                        </div>
                        <div className="md:col-span-2 grid gap-2">
                            <Label className="font-bold text-xs pr-1">إلى تاريخ</Label>
                            <DateInput value={dateTo} onChange={setDateTo} className="h-12 bg-white" />
                        </div>
                        <div className="md:col-span-3">
                            <Button 
                                onClick={handleGenerateLedger} 
                                disabled={isGenerating || !selectedAccountId}
                                className="w-full h-12 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20"
                            >
                                {isGenerating ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-5 w-5" />}
                                استخراج كشف الحساب
                            </Button>
                        </div>
                    </div>
                    
                    <div className="mt-6 flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border-2 border-dashed">
                        <Label className="font-bold text-xs">حالة القيود المشمولة:</Label>
                        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                            <SelectTrigger className="w-48 h-9 rounded-xl bg-white border-none shadow-sm font-bold text-xs"><SelectValue/></SelectTrigger>
                            <SelectContent dir="rtl">
                                <SelectItem value="posted">المرحلة فقط (رسمي)</SelectItem>
                                <SelectItem value="all">الكل (شامل المسودات)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                            <Info className="h-3 w-3" /> ملاحظة: الكشف يدمج كافة مراكز التكلفة المرتبطة بالحساب آلياً.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* عرض الكشف المستخرج */}
            {ledgerData ? (
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <Card id="printable-area" className="bg-white dark:bg-card shadow-2xl rounded-[2.5rem] overflow-hidden print:shadow-none print:border-none border-none">
                        {/* ترويسة الطباعة */}
                        <div className="p-8 sm:p-12">
                            {branding?.letterhead_image_url ? (
                                <img src={branding.letterhead_image_url} alt="Letterhead" className="w-full h-auto mb-10" />
                            ) : (
                                <div className="flex justify-between items-start border-b-4 border-primary pb-8 mb-10">
                                    <div className="text-left space-y-1">
                                        <h2 className="text-3xl font-black text-primary tracking-tighter">كشف حساب تفصيلي</h2>
                                        <p className="text-lg font-bold text-gray-500 tracking-widest font-mono uppercase">Detailed General Ledger</p>
                                        <p className="text-xs font-bold text-muted-foreground mt-2">تاريخ الاستخراج: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                        <div>
                                            <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                            <p className="text-xs text-muted-foreground max-xs leading-relaxed">{branding?.address}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ملخص الحساب المختار */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 p-8 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">الحساب المالي:</Label>
                                        <p className="text-2xl font-black text-primary">{accounts.find(a => a.id === selectedAccountId)?.name}</p>
                                        <p className="font-mono text-sm font-bold opacity-60">رمز الحساب: {accounts.find(a => a.id === selectedAccountId)?.code}</p>
                                    </div>
                                    <div className="flex gap-6 pt-2">
                                        <div><Label className="text-[10px] font-bold text-muted-foreground">من تاريخ</Label><p className="font-bold text-sm">{dateFrom ? format(dateFrom, 'dd/MM/yyyy') : '-'}</p></div>
                                        <div><Label className="text-[10px] font-bold text-muted-foreground">إلى تاريخ</Label><p className="font-bold text-sm">{dateTo ? format(dateTo, 'dd/MM/yyyy') : '-'}</p></div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end justify-center text-left">
                                    <Label className="text-[10px] uppercase font-black text-primary mb-1">الرصيد الختامي الحالي</Label>
                                    <p className={cn("text-4xl font-black font-mono tracking-tighter", ledgerData.finalBalance >= 0 ? "text-primary" : "text-red-600")}>
                                        {formatCurrency(ledgerData.finalBalance)}
                                    </p>
                                    <Badge variant="outline" className="mt-2 bg-white font-bold">{statusFilter === 'all' ? 'رصيد تقديري (شامل المسودات)' : 'رصيد معتمد (مرحّل)'}</Badge>
                                </div>
                            </div>

                            {/* جدول الحركات */}
                            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/80">
                                        <TableRow className="h-14 border-b-2">
                                            <TableHead className="w-28 font-bold text-center border-l">التاريخ</TableHead>
                                            <TableHead className="w-32 font-bold text-center border-l">رقم القيد</TableHead>
                                            <TableHead className="px-6 font-bold text-foreground">البيان والتفاصيل</TableHead>
                                            <TableHead className="min-w-[150px] font-bold text-foreground">مركز التكلفة</TableHead>
                                            <TableHead className="w-28 text-left font-bold text-foreground">مدين</TableHead>
                                            <TableHead className="w-28 text-left font-bold text-foreground">دائن</TableHead>
                                            <TableHead className="w-32 text-left font-black text-primary bg-primary/5 px-6 border-r">الرصيد</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow className="bg-muted/40 h-14 italic">
                                            <TableCell colSpan={6} className="text-right px-10 font-bold text-gray-600">الرصيد الافتتاحي للفترة المحددة</TableCell>
                                            <TableCell className="text-left font-mono font-black px-6 border-r">{formatCurrency(ledgerData.openingBalance)}</TableCell>
                                        </TableRow>
                                        {ledgerData.lines.map((line, idx) => (
                                            <TableRow key={idx} className="h-auto hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                                <TableCell className="text-center font-bold text-[10px] opacity-60 py-4">{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="text-center font-mono font-black text-[10px] text-primary/80">
                                                    <Link href={`/dashboard/accounting/journal-entries/${line.entryId}`} className="hover:underline no-print">{line.entryNumber}</Link>
                                                    <span className="hidden print:inline">{line.entryNumber}</span>
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <p className="font-bold text-xs text-gray-800 leading-relaxed">{line.narration}</p>
                                                    <p className="text-[9px] text-muted-foreground font-medium mt-1">الحساب: {line.accountName}</p>
                                                </TableCell>
                                                <TableCell className="py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        {line.costCenterName ? (
                                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[8px] font-black w-fit gap-1">
                                                                <Target className="h-2 w-2"/> {line.costCenterName}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-[9px] text-muted-foreground italic">بدون مشروع</span>
                                                        )}
                                                        {line.departmentName ? (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[8px] font-black w-fit gap-1">
                                                                <Building2 className="h-2 w-2"/> {line.departmentName}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-[9px] text-muted-foreground italic">بدون قسم</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-black text-base text-green-600">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                                <TableCell className="text-left font-mono font-black text-base text-red-600">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                                <TableCell className="text-left font-mono font-black text-lg px-6 bg-primary/[0.02] border-r border-primary/10 group-hover:bg-primary/5 transition-colors">
                                                    {formatCurrency(line.balance)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {ledgerData.lines.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">لا توجد حركات مسجلة خلال هذه الفترة.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                    <TableFooter className="bg-muted/20">
                                        <TableRow className="h-16 font-black border-t-2">
                                            <TableCell colSpan={4} className="text-right px-10">إجمالي حركات الفترة:</TableCell>
                                            <TableCell className="text-left font-mono text-green-700">{formatCurrency(ledgerData.totalDebit)}</TableCell>
                                            <TableCell className="text-left font-mono text-red-700">{formatCurrency(ledgerData.totalCredit)}</TableCell>
                                            <TableCell className="bg-primary/5 border-r border-primary/20" />
                                        </TableRow>
                                        <TableRow className="h-24 bg-primary/5 border-t-4 border-primary/20">
                                            <TableCell colSpan={6} className="text-right px-12 font-black text-2xl text-primary">الرصيد الختامي الإجمالي:</TableCell>
                                            <TableCell className="text-left font-mono text-3xl font-black text-primary px-6 border-r border-primary/20">{formatCurrency(ledgerData.finalBalance)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>

                            {/* تذييل الطباعة والاعتمادات */}
                            <div className="hidden print:grid grid-cols-2 gap-20 mt-32 text-center text-xs font-black uppercase text-muted-foreground">
                                <div className="space-y-16">
                                    <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد المحاسب</p>
                                    <div className="pt-2 border-t border-dashed">التوقيع</div>
                                </div>
                                <div className="space-y-16">
                                    <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المدير المالي</p>
                                    <div className="pt-2 border-t border-dashed">الختم الرسمي</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                    
                    <div className="flex justify-end no-print pb-20">
                        <Button onClick={handlePrint} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-primary/30">
                            <Printer className="h-6 w-6" />
                            طباعة كشف الحساب الرسمي
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
                    <div className="p-10 bg-muted rounded-full mb-6">
                        <FileText className="h-24 w-24 text-muted-foreground" />
                    </div>
                    <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحديد الحساب</h3>
                    <p className="text-lg font-bold mt-2">اختر حساباً من الأعلى واضغط على "استخراج" لعرض الحركات المالية ومراكز تكلفتها.</p>
                </div>
            )}
        </div>
    );
}
