'use client';

import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Payslip, Employee } from '@/lib/types';
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
import { formatCurrency } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { MoreHorizontal, Eye, CheckCircle, Loader2, Info } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import Link from 'next/link';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';

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

export function PayslipsList() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const [year, setYear] = useState(new Date().getFullYear().toString());
    const [month, setMonth] = useState((new Date().getMonth() + 1).toString());
    const [isProcessing, setIsProcessing] = useState(false);

    const payslipsQuery = useMemo(() => {
        if (!firestore) return null;
        return [
            where('year', '==', parseInt(year)),
            where('month', '==', parseInt(month)),
        ];
    }, [firestore, year, month]);

    const { data: payslips, loading: loadingPayslips } = useSubscription<Payslip>(firestore, 'payroll', payslipsQuery || []);
    const { data: employees, loading: loadingEmployees } = useSubscription<Employee>(firestore, 'employees');

    const loading = loadingPayslips || loadingEmployees;

    const sortedPayslips = useMemo(() => {
        if (!payslips || !employees) return [];
        const employeeIdSet = new Set(employees.map(e => e.id));
        
        return payslips
            .filter(p => p.employeeId && employeeIdSet.has(p.employeeId))
            .map(p => {
                const employee = employees.find(e => e.id === p.employeeId);
                return {
                    ...p,
                    employeeName: employee ? employee.fullName : p.employeeName,
                };
            })
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'ar'));
    }, [payslips, employees]);

    const handleConfirmAndPay = async () => {
        // TODO: Implement payment confirmation and journal entry creation
        toast({ title: 'قيد التنفيذ', description: 'سيتم تنفيذ هذه الميزة قريباً.' });
    };
    
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const totals = useMemo(() => {
        if (!sortedPayslips) return { netSalary: 0 };
        return {
            netSalary: sortedPayslips.reduce((sum, p) => sum + p.netSalary, 0),
        }
    }, [sortedPayslips]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/50 p-4 rounded-lg">
                <div className="grid gap-2">
                    <Label htmlFor="year-select">السنة</Label>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger id="year-select" className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="month-select">الشهر</Label>
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger id="month-select" className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {months.map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex-grow"></div>
                 <Button onClick={handleConfirmAndPay} disabled={isProcessing || !sortedPayslips || sortedPayslips.length === 0}>
                    {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <CheckCircle className="ml-2 h-4 w-4" />}
                    تأكيد دفع الرواتب وإنشاء قيد
                 </Button>
            </div>
            
            {sortedPayslips && sortedPayslips.length === 0 && !loading && (
                 <Alert>
                    <AlertTitle>لا توجد بيانات</AlertTitle>
                    <AlertDescription>
                        لم يتم توليد كشوف رواتب للشهر المحدد. الرجاء الذهاب إلى تبويب "معالجة الرواتب" لإنشائها أولاً.
                    </AlertDescription>
                </Alert>
            )}
            
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>اسم الموظف</TableHead>
                            <TableHead className="text-left">صافي الراتب</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead>الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({length: 5}).map((_, i) => (
                             <TableRow key={i}>
                                <TableCell colSpan={4}><Skeleton className="h-6 w-full"/></TableCell>
                             </TableRow>
                        ))}
                        {!loading && sortedPayslips.map(payslip => (
                             <TableRow key={payslip.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <span>{payslip.employeeName}</span>
                                        {payslip.notes && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{payslip.notes}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(payslip.netSalary)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[payslip.status]}>
                                        {statusTranslations[payslip.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                     <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                        <Link href={`/dashboard/hr/payroll/${payslip.id}`}>
                                            <Eye className="h-4 w-4" />
                                        </Link>
                                     </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                         <TableRow className="font-bold bg-muted">
                            <TableCell>الإجمالي</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(totals.netSalary)}</TableCell>
                            <TableCell colSpan={2}></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    );
}
