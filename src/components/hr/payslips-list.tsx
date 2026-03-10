'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy, doc, writeBatch, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import type { Payslip, Employee, Account } from '@/lib/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, cleanFirestoreData } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Eye, CheckCircle, Loader2, Info, Printer, Download, Search, Banknote } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { toFirestoreDate } from '@/services/date-converter';
import * as XLSX from 'xlsx';
import { useBranding } from '@/context/branding-context';
import { Logo } from '../layout/logo';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Input } from '../ui/input';
import { useAuth } from '@/context/auth-context';

const statusColors: Record<Payslip['status'], string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  processed: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
};

const statusTranslations: Record<Payslip['status'], string> = {
  draft: 'مسودة',
  processed: 'تمت المعالجة',
  paid: 'مدفوع',
};

const payslipTypeColors: Record<string, string> = {
    Monthly: 'bg-transparent',
    Leave: 'bg-sky-100 text-sky-800',
};

const payslipTypeTranslations: Record<string, string> = {
    Monthly: 'راتب شهري',
    Leave: 'راتب إجازة',
};


export function PayslipsList() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { branding } = useBranding();

    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    const [searchQuery, setSearchQuery] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // استبدال useSubscription بـ useEffect و getDocs
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loadingPayslips, setLoadingPayslips] = useState(false);

    useEffect(() => {
        if (!firestore) return;
        const fetchPayslips = async () => {
            setLoadingPayslips(true);
            try {
                const snap = await getDocs(query(
                    collection(firestore, 'payroll'),
                    where('year', '==', parseInt(year)),
                    where('month', '==', parseInt(month))
                ));
                setPayslips(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payslip)));
            } catch (e) {
                console.error("Error fetching payslips:", e);
            } finally {
                setLoadingPayslips(false);
            }
        };
        fetchPayslips();
    }, [firestore, year, month]);

    const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

    const loading = loadingPayslips || loadingEmployees;

    const sortedPayslips = useMemo(() => {
        if (!payslips || !employees) return [];
        const employeeIdSet = new Set(employees.map(e => e.id));
        
        const filteredAndSorted = payslips
            .filter(p => p.employeeId && employeeIdSet.has(p.employeeId))
            .map(p => {
                const employee = employees.find(e => e.id === p.employeeId);
                return {
                    ...p,
                    employeeName: employee ? employee.fullName : p.employeeName,
                };
            })
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar'));

        if (!searchQuery) return filteredAndSorted;

        return filteredAndSorted.filter(p => 
            p.employeeName.toLowerCase().includes(searchQuery.toLowerCase())
        );

    }, [payslips, employees, searchQuery]);

    const handleConfirmAndPay = async () => {
        if (!firestore || !currentUser || sortedPayslips.length === 0) return;
        
        const draftPayslips = sortedPayslips.filter(p => p.status !== 'paid');
        if (draftPayslips.length === 0) {
            toast({ title: 'لا توجد مسودات', description: 'تم دفع كافة رواتب هذا الشهر مسبقاً.' });
            return;
        }

        setIsProcessing(true);
        try {
            const coaSnap = await getDocs(collection(firestore, 'chartOfAccounts'));
            const allAccounts = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

            const salaryExpenseAccount = allAccounts.find(a => a.code === '5201'); 
            const bankAccount = allAccounts.find(a => a.code === '110102'); 

            if (!salaryExpenseAccount || !bankAccount) throw new Error("حسابات الرواتب أو البنك غير موجودة في الشجرة.");

            await runTransaction(firestore, async (transaction) => {
                const currentYear = new Date().getFullYear();
                const jeCounterRef = doc(firestore, 'counters', 'journalEntries');
                const counterSnap = await transaction.get(jeCounterRef);
                const nextNumber = ((counterSnap.data()?.counts || {})[currentYear] || 0) + 1;
                
                const newJeRef = doc(collection(firestore, 'journalEntries'));
                const jeNumber = `JV-PR-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

                const totalNetSalaries = draftPayslips.reduce((sum, p) => sum + p.netSalary, 0);

                transaction.set(newJeRef, {
                    entryNumber: jeNumber,
                    date: serverTimestamp(),
                    narration: `إثبات وصرف رواتب شهر ${month} / ${year} لعدد ${draftPayslips.length} موظف`,
                    status: 'posted',
                    totalDebit: totalNetSalaries,
                    totalCredit: totalNetSalaries,
                    lines: [
                        { accountId: salaryExpenseAccount.id, accountName: salaryExpenseAccount.name, debit: totalNetSalaries, credit: 0 },
                        { accountId: bankAccount.id, accountName: bankAccount.name, debit: 0, credit: totalNetSalaries }
                    ],
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                });

                draftPayslips.forEach(p => {
                    const pRef = doc(firestore, 'payroll', p.id!);
                    transaction.update(pRef, { status: 'paid', paidAt: serverTimestamp() });
                });

                transaction.set(jeCounterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            });

            toast({ title: 'نجاح الترحيل المالي', description: `تم صرف ${draftPayslips.length} راتب وتوليد القيد المحاسبي بنجاح.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ في الترحيل', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleExcelExport = () => {
        if (!sortedPayslips || sortedPayslips.length === 0) {
            toast({ title: 'لا توجد بيانات للتصدير' });
            return;
        }

        const dataForSheet = sortedPayslips.map(p => {
            const totalEarnings = (p.earnings.basicSalary || 0) + (p.earnings.housingAllowance || 0) + (p.earnings.transportAllowance || 0) + (p.earnings.commission || 0);
            const totalDeductions = (p.deductions.absenceDeduction || 0) + (p.deductions.otherDeductions || 0);
            return {
                'اسم الموظف': p.employeeName,
                'نوع الكشف': payslipTypeTranslations[p.type || 'Monthly'],
                'إجمالي الاستحقاقات': totalEarnings,
                'إجمالي الاستقطاعات': totalDeductions,
                'صافي الراتب': p.netSalary,
                'الحالة': statusTranslations[p.status],
                'ملاحظات': p.notes || ''
            }
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Data");
        
        const fileName = `Payroll_Export_${year}_${month}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        toast({ title: 'تم التصدير', description: `تم تحميل ملف ${fileName} بنجاح.` });
    };

    const handlePrint = () => {
        window.print();
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const totals = useMemo(() => {
        if (!sortedPayslips) return { netSalary: 0 };
        return {
            netSalary: sortedPayslips.reduce((sum, p) => sum + p.netSalary, 0),
        }
    }, [sortedPayslips]);

    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('ar', { month: 'long' });

    return (
        <div className="space-y-4">
             <div id="payslips-printable-area">
                <div className="hidden print:block mb-6">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                             <div>
                                <h1 className="font-bold text-lg">{branding?.company_name || 'Nova ERP'}</h1>
                                <p className="text-sm text-muted-foreground">{branding?.address}</p>
                             </div>
                        </div>
                        <div className="text-left">
                            <h2 className="text-xl font-bold">كشف رواتب الموظفين</h2>
                            <p className="text-muted-foreground">عن شهر {monthName} {year}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg mb-6 no-print">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-end">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 items-end flex-grow">
                             <div className="grid gap-2">
                                <Label htmlFor="year-select">السنة</Label>
                                <Select value={year} onValueChange={setYear}>
                                    <SelectTrigger id="year-select"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="month-select">الشهر</Label>
                                <Select value={month} onValueChange={setMonth}>
                                    <SelectTrigger id="month-select"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2 col-span-2 md:col-span-1">
                                <Label htmlFor="search">بحث بالاسم</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="search" placeholder="ابحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rtl:pr-10"/>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                           <Button onClick={handlePrint} variant="outline" disabled={loading || sortedPayslips.length === 0}><Printer className="ml-2 h-4 w-4" /> طباعة</Button>
                           <Button onClick={handleExcelExport} variant="outline" disabled={loading || sortedPayslips.length === 0} className="border-green-600 text-green-700 hover:bg-green-50"><Download className="ml-2 h-4 w-4" /> تصدير Excel</Button>
                           <Button onClick={handleConfirmAndPay} disabled={isProcessing || loading || sortedPayslips.length === 0} className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100 font-bold gap-2">
                                {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <Banknote className="ml-2 h-4 w-4" />}
                                اعتماد وصرف الرواتب
                            </Button>
                        </div>
                    </div>
                </div>
                
                {sortedPayslips && sortedPayslips.length === 0 && !loading && (
                    <Alert>
                        <AlertTitle>لا توجد بيانات</AlertTitle>
                        <AlertDescription>
                            لم يتم توليد كشوف رواتب للشهر المحدد. الرجاء الذهاب إلى تبويب "معالجة الرواتب" لإنشائها أولاً.
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>اسم الموظف</TableHead>
                                <TableHead>نوع الكشف</TableHead>
                                <TableHead className="text-left">الاستحقاقات</TableHead>
                                <TableHead className="text-left">الاستقطاعات</TableHead>
                                <TableHead className="text-left font-bold">صافي الراتب</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead className="no-print"><span className="sr-only">الإجراءات</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-14 w-full"/></TableCell></TableRow>
                            ))}
                            {!loading && sortedPayslips.map(payslip => {
                                const totalEarnings = (payslip.earnings.basicSalary || 0) + (payslip.earnings.housingAllowance || 0) + (payslip.earnings.transportAllowance || 0) + (payslip.earnings.commission || 0);
                                const totalDeductions = (payslip.deductions.absenceDeduction || 0) + (payslip.deductions.otherDeductions || 0);
                                return (
                                <TableRow key={payslip.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{payslip.employeeName}</span>
                                            {payslip.notes && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                                                        <TooltipContent><p>{payslip.notes}</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={payslipTypeColors[payslip.type || 'Monthly']}>
                                            {payslipTypeTranslations[payslip.type || 'Monthly']}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(totalEarnings)}</TableCell>
                                    <TableCell className="text-left font-mono text-destructive">{formatCurrency(totalDeductions)}</TableCell>
                                    <TableCell className="text-left font-mono font-bold text-base">{formatCurrency(payslip.netSalary)}</TableCell>
                                    <TableCell><Badge variant="outline" className={statusColors[payslip.status]}>{statusTranslations[payslip.status]}</Badge></TableCell>
                                    <TableCell className="no-print text-center">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <Link href={`/dashboard/hr/payroll/${payslip.id}`}>
                                                <Eye className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow className="font-black text-xl h-20">
                                <TableCell colSpan={4} className="text-right px-10">إجمالي الرواتب الصافية للفترة:</TableCell>
                                <TableCell className="text-left font-mono text-primary">{formatCurrency(totals.netSalary)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
        </div>
    );
}
