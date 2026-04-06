'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Account, JournalEntry, ConstructionProject, Department, Employee } from '@/lib/types';
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
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn } from '@/lib/utils';
import { Loader2, Printer, Search, FileText, Target, Building2, ListTree, Info, PieChart, ArrowUpRight, ArrowDownLeft, UserCheck } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { useBranding } from '@/context/branding-context';
import { DateInput } from '@/components/ui/date-input';
import { useToast } from '@/hooks/use-toast';
import { toFirestoreDate } from '@/services/date-converter';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

interface LedgerLine {
    date: Date;
    entryNumber: string;
    narration: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
    entryId: string;
}

export default function CostCenterLedgerPage() {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { branding, loading: brandingLoading } = useBranding();

    const [centerType, setCenterType] = useState<'project' | 'department' | 'employee'>('project');
    const [selectedCenterId, setSelectedCenterId] = useState('');
    const [dateFrom, setDateFrom] = useState<Date | undefined>(() => startOfMonth(new Date()));
    const [dateTo, setDateTo] = useState<Date | undefined>(() => endOfMonth(new Date()));
    
    const [projects, setProjects] = useState<ConstructionProject[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const [reportData, setReportData] = useState<{
        lines: LedgerLine[];
        totalDebit: number;
        totalCredit: number;
        netBalance: number;
    } | null>(null);

    // جلب كافة البيانات المرجعية المطلوبة لبناء محرك البحث
    useEffect(() => {
        if (!firestore) return;
        const fetchData = async () => {
            try {
                const [accSnap, projectsSnap, deptsSnap, empSnap] = await Promise.all([
                    getDocs(query(collection(firestore, 'chartOfAccounts'), orderBy('code'))),
                    getDocs(collection(firestore, 'projects')),
                    getDocs(collection(firestore, 'departments')),
                    getDocs(query(collection(firestore, 'employees'), where('status', '==', 'active')))
                ]);
                setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
                setProjects(projectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ConstructionProject)));
                setDepartments(deptsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
                setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
                setLoading(false);
            } catch (err) {
                console.error("Error fetching ledger refs:", err);
                setLoading(false);
            }
        };
        fetchData();
    }, [firestore]);

    const centerOptions = useMemo(() => {
        if (centerType === 'project') {
            return projects.map(p => ({ value: p.id!, label: `مشروع: ${p.projectName}` }));
        } else if (centerType === 'department') {
            return departments.map(d => ({ value: d.id!, label: `قسم: ${d.name}` }));
        }
        return employees.map(e => ({ value: e.id!, label: `الموظف: ${e.fullName}` }));
    }, [centerType, projects, departments, employees]);

    const handleGenerate = async () => {
        if (!firestore || !selectedCenterId || !dateFrom || !dateTo) {
            toast({ variant: 'destructive', title: 'بيانات ناقصة', description: 'يرجى اختيار مركز التكلفة والفترة الزمنية.' });
            return;
        }

        setIsGenerating(true);
        try {
            const startDate = startOfDay(dateFrom);
            const endDate = endOfDay(dateTo);

            const entriesQuery = query(
                collection(firestore, 'journalEntries'),
                where('status', '==', 'posted')
            );
            const entriesSnap = await getDocs(entriesQuery);
            
            const lines: LedgerLine[] = [];
            let totalDebit = 0;
            let totalCredit = 0;

            entriesSnap.forEach(docSnap => {
                const entry = docSnap.data() as JournalEntry;
                const entryDate = toFirestoreDate(entry.date);
                if (!entryDate || entryDate < startDate || entryDate > endDate) return;

                entry.lines.forEach(line => {
                    let match = false;
                    if (centerType === 'project') match = line.auto_profit_center === selectedCenterId;
                    else if (centerType === 'department') match = line.auto_dept_id === selectedCenterId;
                    else if (centerType === 'employee') match = line.auto_resource_id === selectedCenterId;

                    if (match) {
                        const debit = line.debit || 0;
                        const credit = line.credit || 0;
                        lines.push({
                            date: entryDate,
                            entryNumber: entry.entryNumber,
                            narration: entry.narration,
                            accountName: line.accountName,
                            debit,
                            credit,
                            balance: 0, // Calculated after sorting
                            entryId: docSnap.id
                        });
                        totalDebit += debit;
                        totalCredit += credit;
                    }
                });
            });

            // الترتيب الزمني وحساب الرصيد المتدفق
            lines.sort((a, b) => a.date.getTime() - b.date.getTime());
            
            let runningBalance = 0;
            lines.forEach(line => {
                runningBalance += line.debit - line.credit;
                line.balance = runningBalance;
            });

            setReportData({
                lines,
                totalDebit,
                totalCredit,
                netBalance: runningBalance
            });

            toast({ title: 'تم استخراج الكشف', description: `تمت معالجة ${lines.length} حركة مالية لهذا المركز.` });

        } catch (error) {
            console.error("Ledger Generation Error:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل استخراج كشف حركة مركز التكلفة.' });
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
                        <PieChart className="text-primary h-6 w-6"/>
                        محرك كشف حركة مركز التكلفة (Cost Center Ledger)
                    </CardTitle>
                    <CardDescription>تحليل عمودي لكافة الحركات المالية المرتبطة بكيان محدد عبر كافة حسابات الشجرة.</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="space-y-8">
                        <div className="flex justify-center">
                            <Tabs value={centerType} onValueChange={(v: any) => { setCenterType(v); setSelectedCenterId(''); setReportData(null); }} className="w-fit">
                                <TabsList className="bg-muted p-1 rounded-2xl border h-auto">
                                    <TabsTrigger value="project" className="rounded-xl font-bold gap-2 px-8 py-2.5">
                                        <Target className="h-4 w-4"/> تتبع مشروع
                                    </TabsTrigger>
                                    <TabsTrigger value="department" className="rounded-xl font-bold gap-2 px-8 py-2.5">
                                        <Building2 className="h-4 w-4"/> تتبع قسم
                                    </TabsTrigger>
                                    <TabsTrigger value="employee" className="rounded-xl font-bold gap-2 px-8 py-2.5">
                                        <UserCheck className="h-4 w-4"/> تتبع موظف/مهندس
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                            <div className="md:col-span-5 grid gap-2">
                                <Label className="font-black text-gray-700 pr-1">
                                    {centerType === 'project' ? 'اختر المشروع المستهدف' : centerType === 'department' ? 'اختر القسم' : 'اختر الموظف/المهندس المختص'} *
                                </Label>
                                <InlineSearchList 
                                    value={selectedCenterId}
                                    onSelect={setSelectedCenterId}
                                    options={centerOptions}
                                    placeholder={loading ? "جاري التحميل..." : "ابحث واختر..."}
                                    className="h-12 rounded-2xl bg-white border-2 soft-shadow-input"
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
                                    onClick={handleGenerate} 
                                    disabled={isGenerating || !selectedCenterId}
                                    className="w-full h-12 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin h-5 w-5"/> : <Search className="h-5 w-5" />}
                                    استخراج التقرير
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {reportData ? (
                <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-500">
                    <Card id="printable-area" className="bg-white dark:bg-card shadow-2xl rounded-[2.5rem] overflow-hidden border-none">
                        <div className="p-8 sm:p-12">
                            {/* Header Section */}
                            <div className="flex justify-between items-start border-b-4 border-primary pb-8 mb-10">
                                <div className="text-left space-y-1">
                                    <h2 className="text-3xl font-black text-primary tracking-tighter">كشف حركة مالي مخصص</h2>
                                    <p className="text-lg font-bold text-gray-500 tracking-widest font-mono uppercase">Cost Center Performance</p>
                                    <p className="text-xs font-bold text-muted-foreground mt-2">تاريخ الاستخراج: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Logo className="h-20 w-20 !p-3 shadow-inner border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                    <div>
                                        <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                                        <p className="text-xs text-muted-foreground">{branding?.address}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 p-8 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10">
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">المركز المختار للمراجعة:</Label>
                                        <p className="text-2xl font-black text-primary">
                                            {centerType === 'project' ? projects.find(p => p.id === selectedCenterId)?.projectName : 
                                             centerType === 'department' ? departments.find(d => d.id === selectedCenterId)?.name :
                                             employees.find(e => e.id === selectedCenterId)?.fullName}
                                        </p>
                                        <Badge variant="secondary" className="mt-1 font-bold">
                                            {centerType === 'project' ? 'مركز تكلفة رئيسي (مشروع)' : 
                                             centerType === 'department' ? 'مركز تكلفة إضافي (قسم)' : 
                                             'تتبع أداء (موظف مختص)'}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-6 pt-2">
                                        <div><Label className="text-[10px] font-bold text-muted-foreground">الفترة من</Label><p className="font-bold text-sm">{dateFrom ? format(dateFrom, 'dd/MM/yyyy') : '-'}</p></div>
                                        <div><Label className="text-[10px] font-bold text-muted-foreground">إلى تاريخ</Label><p className="font-bold text-sm">{dateTo ? format(dateTo, 'dd/MM/yyyy') : '-'}</p></div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end justify-center text-left">
                                    <Label className="text-[10px] uppercase font-black text-primary mb-1">صافي الرصد المتدفق</Label>
                                    <p className={cn("text-4xl font-black font-mono tracking-tighter", reportData.netBalance >= 0 ? "text-primary" : "text-red-600")}>
                                        {formatCurrency(reportData.netBalance)}
                                    </p>
                                    <p className="text-[10px] font-bold text-muted-foreground mt-2 italic">(إجمالي المدين - إجمالي الدائن)</p>
                                </div>
                            </div>

                            <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                                <Table>
                                    <TableHeader className="bg-muted/80">
                                        <TableRow className="h-14 border-b-2">
                                            <TableHead className="w-28 font-bold text-center border-l">التاريخ</TableHead>
                                            <TableHead className="w-32 font-bold text-center border-l">رقم القيد</TableHead>
                                            <TableHead className="px-6 font-bold text-foreground">البيان والحساب المتأثر</TableHead>
                                            <TableHead className="w-28 text-left font-bold text-foreground">مدين (+)</TableHead>
                                            <TableHead className="w-28 text-left font-bold text-foreground">دائن (-)</TableHead>
                                            <TableHead className="w-32 text-left font-black text-primary border-r bg-primary/5 px-4">الرصيد</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.lines.map((line, idx) => (
                                            <TableRow key={idx} className="h-auto hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                                <TableCell className="text-center font-bold text-[10px] opacity-60 py-4">{format(line.date, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="text-center font-mono font-black text-[10px] text-primary/80">
                                                    <Link href={`/dashboard/accounting/journal-entries/${line.entryId}`} className="hover:underline no-print">{line.entryNumber}</Link>
                                                    <span className="hidden print:inline">{line.entryNumber}</span>
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <p className="text-[9px] text-muted-foreground font-black uppercase mb-1">الحساب: {line.accountName}</p>
                                                    <p className="font-bold text-xs text-gray-800 leading-relaxed">{line.narration}</p>
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-black text-sm text-blue-600">
                                                    {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-black text-sm text-amber-600">
                                                    {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                                                </TableCell>
                                                <TableCell className="text-left font-mono font-black text-base px-4 bg-primary/[0.02] border-r border-primary/10">
                                                    {formatCurrency(line.balance)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {reportData.lines.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-bold">لا توجد حركات مسجلة لهذا المركز خلال الفترة المختارة.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                    <TableFooter className="bg-muted/20">
                                        <TableRow className="h-20 font-black border-t-4 border-primary/20">
                                            <TableCell colSpan={3} className="text-right px-12 text-lg">إجمالي الحركة للمركز:</TableCell>
                                            <TableCell className="text-left font-mono text-lg text-blue-700">{formatCurrency(reportData.totalDebit)}</TableCell>
                                            <TableCell className="text-left font-mono text-lg text-amber-700">{formatCurrency(reportData.totalCredit)}</TableCell>
                                            <TableCell className="bg-primary/5 border-r border-primary/20" />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>

                            <div className="hidden print:grid grid-cols-2 gap-20 mt-32 text-center text-xs font-black uppercase text-muted-foreground">
                                <div className="space-y-16">
                                    <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد القسم المالي</p>
                                    <div className="pt-2 border-t border-dashed">التوقيع</div>
                                </div>
                                <div className="space-y-16">
                                    <p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد الإدارة العليا</p>
                                    <div className="pt-2 border-t border-dashed">الختم الرسمي</div>
                                </div>
                            </div>
                        </div>
                    </Card>
                    
                    <div className="flex justify-end no-print pb-20">
                        <Button onClick={handlePrint} className="h-14 px-12 rounded-2xl font-black text-xl gap-3 shadow-2xl shadow-primary/30">
                            <Printer className="h-6 w-6" />
                            طباعة الكشف التفصيلي
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="h-[60vh] flex flex-col items-center justify-center border-4 border-dashed rounded-[3.5rem] bg-muted/5 opacity-30 grayscale transition-all">
                    <div className="p-10 bg-muted rounded-full mb-6">
                        <ListTree className="h-24 w-24 text-muted-foreground" />
                    </div>
                    <h3 className="text-3xl font-black text-muted-foreground">بانتظار تحديد البعد المالي</h3>
                    <p className="text-lg font-bold mt-2">اختر المشروع، القسم، أو الموظف واضغط على "استخراج التقرير" لرؤية التاريخ المالي الكامل.</p>
                </div>
            )}
        </div>
    );
}