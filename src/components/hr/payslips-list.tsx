'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, orderBy, doc, getDocs, serverTimestamp, runTransaction, writeBatch } from 'firebase/firestore';
import type { Payslip, Employee, Account } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '../ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { formatCurrency, cleanFirestoreData, cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Eye, CheckCircle, Loader2, Info, Printer, Download, Search, Banknote, Trash2, RefreshCw, FileDown, ChevronDown } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toFirestoreDate } from '@/services/date-converter';
import * as XLSX from 'xlsx';
import { useBranding } from '@/context/branding-context';
import { Logo } from '../layout/logo';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Input } from '../ui/input';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const statusColors: Record<Payslip['status'], string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  processed: 'bg-blue-100 text-blue-800 border-blue-200',
  paid: 'bg-green-100 text-green-800 border-green-200',
};

const statusTranslations: Record<Payslip['status'], string> = {
  draft: 'مسودة مراجعة',
  processed: 'تم التدقيق',
  paid: 'تم الصرف بنجاح',
};

const payslipTypeColors: Record<string, string> = {
    Monthly: 'bg-transparent',
    Leave: 'bg-sky-100 text-sky-800 border-sky-200',
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
    const [showDeleteConfirm, setshowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [loadingPayslips, setLoadingPayslips] = useState(false);

    const fetchPayslips = async () => {
        if (!firestore) return;
        setLoadingPayslips(true);
        try {
            const snap = await getDocs(query(
                collection(firestore, 'payroll'),
                where('year', '==', parseInt(year)),
                where('month', '==', parseInt(month))
            ));
            setPayslips(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payslip)));
            if (snap.empty) {
                toast({ title: 'لا توجد بيانات', description: 'لم يتم العثور على كشوفات منشأة لهذه الفترة.' });
            }
        } catch (e) {
            console.error("Error fetching payslips:", e);
            toast({ variant: 'destructive', title: 'خطأ في التحميل' });
        } finally {
            setLoadingPayslips(false);
        }
    };

    useEffect(() => {
        setPayslips([]);
    }, [year, month]);

    const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

    const loading = loadingPayslips || loadingEmployees;

    const sortedPayslips = useMemo(() => {
        if (!payslips || !employees) return [];
        
        const filteredAndSorted = payslips
            .map(p => {
                const employee = employees.find(e => e.id === p.employeeId);
                return {
                    ...p,
                    employeeName: employee ? employee.fullName : p.employeeName,
                    employeeNumber: employee?.employeeNumber || '---'
                };
            })
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar'));

        if (!searchQuery) return filteredAndSorted;

        const lower = searchQuery.toLowerCase();
        return filteredAndSorted.filter(p => 
            p.employeeName.toLowerCase().includes(lower) || 
            p.employeeNumber.includes(lower)
        );
    }, [payslips, employees, searchQuery]);

    const handleDeleteMonth = async () => {
        if (!firestore) return;
        setshowDeleteConfirm(false);
        setIsDeleting(true);
        try {
            const snap = await getDocs(query(
                collection(firestore, 'payroll'),
                where('year', '==', parseInt(year)),
                where('month', '==', parseInt(month))
            ));
            if (snap.empty) {
                toast({ title: 'لا توجد كشوفات', description: 'لم يتم العثور على كشوفات لهذا الشهر.' });
                return;
            }
            const batch = writeBatch(firestore);
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            setPayslips([]);
            toast({ title: '✅ تم الحذف', description: `تم حذف ${snap.size} كشف راتب لشهر ${month}/${year}.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'خطأ في الحذف', description: e.message });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleConfirmAndPay = async () => {
        if (!firestore || !currentUser || sortedPayslips.length === 0) return;
        
        const draftPayslips = sortedPayslips.filter(p => p.status !== 'paid');
        if (draftPayslips.length === 0) {
            toast({ title: 'لا توجد مسودات', description: 'تم صرف جميع رواتب هذه الفترة مسبقاً.' });
            return;
        }

        setIsProcessing(true);
        try {
            const coaSnap = await getDocs(collection(firestore, 'chartOfAccounts'));
            const allAccounts = coaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Account));

            const salaryExpenseAccount = allAccounts.find(a => a.code === '5201');
            const bankAccount = allAccounts.find(a => a.code === '110102');

            if (!salaryExpenseAccount || !bankAccount) {
                throw new Error("حسابات الرواتب (5201) أو البنك (110102) غير موجودة في شجرة الحسابات.");
            }

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
                    narration: `إثبات وصرف رواتب شهر ${month} / ${year} لعدد ${draftPayslips.length} موظف (ترحيل آلي)`,
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
            fetchPayslips();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'خطأ في الترحيل', description: error.message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleExcelExport = () => {
        if (!sortedPayslips || sortedPayslips.length === 0) {
            toast({ title: 'لا توجد بيانات' });
            return;
        }

        const data = sortedPayslips.map(p => ({
            'رقم الملف': p.employeeNumber,
            'اسم الموظف': p.employeeName,
            'نوع الكشف': payslipTypeTranslations[p.type || 'Monthly'],
            'إجمالي الاستحقاقات': p.earnings.basicSalary + p.earnings.housingAllowance + p.earnings.transportAllowance + p.earnings.commission,
            'استقطاع غياب': p.deductions.absenceDeduction || 0,
            'استقطاع تأخير': p.deductions.lateDeduction || 0,
            'استقطاعات أخرى': p.deductions.otherDeductions || 0,
            'صافي الراتب المستحق': p.netSalary,
            'الحالة': statusTranslations[p.status],
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Payroll");
        XLSX.writeFile(wb, `Payroll_Report_${month}_${year}.xlsx`);
    };

    const totals = useMemo(() => ({
        netSalary: sortedPayslips.reduce((sum, p) => sum + p.netSalary, 0),
    }), [sortedPayslips]);

    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="space-y-6">
            <div className="space-y-4 no-print" dir="rtl">

              {/* الصف الأول: الفلاتر */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="grid gap-1.5">
                  <Label className="font-black text-xs text-muted-foreground">سنة الكشف</Label>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="h-10 rounded-xl bg-white border-2"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="font-black text-xs text-muted-foreground">شهر الكشف</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="h-10 rounded-xl bg-white border-2"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">{months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 col-span-2">
                  <Label className="font-black text-xs text-muted-foreground">بحث في الأسماء والرقم الوظيفي</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="ابحث عن موظف أو رقم ملف..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl bg-white border-2"/>
                  </div>
                </div>
              </div>

              {/* الصف الثاني: الأزرار في فريمات */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                {/* فريم التحميل */}
                <div className="p-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500 shrink-0">📂 البيانات</span>
                  <Button onClick={fetchPayslips} disabled={loadingPayslips} className="flex-1 h-9 rounded-xl font-bold text-xs gap-2 bg-primary hover:bg-primary/90">
                    {loadingPayslips ? <Loader2 className="h-3 w-3 animate-spin"/> : <RefreshCw className="h-3 w-3" />}
                    تحميل الكشوفات
                  </Button>
                </div>

                {/* فريم التصدير والتراجع */}
                <div className="p-3 rounded-2xl border-2 border-green-100 bg-green-50/50 flex items-center gap-2">
                  <span className="text-[10px] font-black text-green-600 shrink-0">📊 أدوات</span>
                  <Button onClick={handleExcelExport} variant="outline" disabled={loading || sortedPayslips.length === 0} className="flex-1 h-9 rounded-xl font-bold text-xs border-green-300 text-green-700 hover:bg-green-100 gap-1">
                    <Download className="h-3 w-3" /> Excel
                  </Button>
                  <Button onClick={() => setshowDeleteConfirm(true)} variant="outline" disabled={isDeleting || loading || sortedPayslips.length === 0} className="flex-1 h-9 rounded-xl font-bold text-xs border-red-200 text-red-600 hover:bg-red-50 gap-1">
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Trash2 className="h-3 w-3" />}
                    تراجع
                  </Button>
                </div>

                {/* زر الصرف */}
                <div className="p-3 rounded-2xl border-2 border-primary/20 bg-primary/5 flex items-center">
                  <Button onClick={handleConfirmAndPay} disabled={isProcessing || loading || sortedPayslips.length === 0} className="w-full h-9 rounded-xl bg-primary text-white font-black text-xs shadow-md shadow-primary/20 gap-2">
                    {isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : <Banknote className="h-4 w-4" />}
                    صرف الرواتب النهائية
                  </Button>
                </div>

              </div>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-gradient-to-l from-white to-purple-50 py-10 px-10 border-b no-print">
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                        <div className="space-y-2 text-right order-1 lg:order-2">
                            <div className="flex items-center justify-end gap-3">
                                <CardTitle className="text-3xl font-black text-gray-800 tracking-tight">كشوف الرواتب المعتمدة</CardTitle>
                                <div className="bg-primary/10 rounded-2xl text-primary shadow-inner">
                                    <Banknote className="h-8 w-8" />
                                </div>
                            </div>
                            <CardDescription className="text-muted-foreground font-bold text-base leading-relaxed">
                                مراجعة وتأكيد دفع الرواتب وإصدار السجلات المالية النهائية.
                            </CardDescription>
                        </div>
                        <div className="bg-muted/30 border p-6 rounded-[2.5rem] shadow-inner min-w-[420px] order-2 lg:order-1">
                            <div className="relative w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                                <Input placeholder="بحث بالاسم أو الرقم..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 h-12 rounded-2xl bg-white border-primary/10 text-gray-800 placeholder:text-muted-foreground font-bold shadow-sm" />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50 h-14">
                            <TableRow className="border-none">
                                <TableHead className="px-8 font-black text-[#7209B7]">رقم الملف</TableHead>
                                <TableHead className="font-black text-[#7209B7]">اسم الموظف</TableHead>
                                <TableHead className="font-black text-[#7209B7]">نوع الكشف</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7]">الراتب الكامل</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7]">الاستقطاعات</TableHead>
                                <TableHead className="text-left font-black text-[#7209B7]">صافي المستحق</TableHead>
                                <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                                <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={8} className="px-8"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>
                                ))
                            ) : sortedPayslips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground font-bold italic">
                                        {loadingPayslips ? 'جاري التحميل...' : 'اضغط على "تحميل الكشوفات" لعرض البيانات.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedPayslips.map(payslip => {
                                    const totalEarnings = (payslip.earnings.basicSalary || 0) + (payslip.earnings.housingAllowance || 0) + (payslip.earnings.transportAllowance || 0);
                                    const totalDeductions = (payslip.deductions.absenceDeduction || 0) + (payslip.deductions.lateDeduction || 0) + (payslip.deductions.otherDeductions || 0);
                                    return (
                                    <TableRow key={payslip.id} className="hover:bg-muted/30 transition-colors h-16">
                                        <TableCell className="px-8 font-mono font-black text-primary text-sm">{payslip.employeeNumber}</TableCell>
                                        <TableCell className="font-black text-gray-800">{payslip.employeeName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("px-3 font-bold text-[10px]", payslipTypeColors[payslip.type || 'Monthly'])}>
                                                {payslipTypeTranslations[payslip.type || 'Monthly']}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-bold text-gray-600">{formatCurrency(totalEarnings)}</TableCell>
                                        <TableCell className="text-left font-mono font-bold text-red-600">({formatCurrency(totalDeductions)})</TableCell>
                                        <TableCell className="text-left font-mono font-black text-primary text-lg">{formatCurrency(payslip.netSalary)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[payslip.status])}>
                                                {statusTranslations[payslip.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border" asChild>
                                                <Link href={`/dashboard/hr/payroll/${payslip.id}`}><Eye className="h-4 w-4" /></Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )})
                            )}
                        </TableBody>
                        <TableFooter className="bg-primary/5 h-20">
                            <TableRow className="border-t-4 border-primary/20">
                                <TableCell colSpan={5} className="text-right px-12 font-black text-xl">إجمالي صافي الرواتب للصرف:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-primary px-4">{formatCurrency(totals.netSalary)}</TableCell>
                                <TableCell colSpan={2}></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

        {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
                <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full mx-4 space-y-6 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-red-100 rounded-2xl">
                            <Trash2 className="h-6 w-6 text-red-600"/>
                        </div>
                        <div>
                            <h3 className="font-black text-lg">تراجع عن كشوف الرواتب</h3>
                            <p className="text-xs text-muted-foreground font-bold">هذا الإجراء سيحذف الكشوفات المولّدة</p>
                        </div>
                    </div>
                    <p className="text-sm font-bold text-gray-700 bg-red-50 p-4 rounded-2xl border border-red-100">
                        هل أنت متأكد من حذف كشوفات رواتب شهر <span className="text-red-600 font-black">{month}/{year}</span>؟<br/>
                        <span className="text-xs text-red-500 font-bold mt-1 block">ملاحظة: لن يُحذف القيد المحاسبي تلقائياً.</span>
                    </p>
                    <div className="flex gap-3">
                        <Button onClick={() => setshowDeleteConfirm(false)} variant="outline" className="flex-1 rounded-xl font-bold">
                            إلغاء
                        </Button>
                        <Button onClick={handleDeleteMonth} variant="destructive" className="flex-1 rounded-xl font-bold gap-2">
                            <Trash2 className="h-4 w-4"/>
                            نعم، احذف
                        </Button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}
