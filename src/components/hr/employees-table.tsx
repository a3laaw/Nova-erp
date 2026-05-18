
'use client';
import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit, Loader2, Calendar, Search, Eye, EyeOff, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from '@/services/date-converter';
import { format, differenceInYears } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, query, orderBy, collection } from 'firebase/firestore';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '../ui/input';
import { cn, formatCurrency, getTenantPath } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type EmployeeStatus = 'active' | 'on-leave' | 'terminated';

const statusTranslations: Record<EmployeeStatus, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

interface EmployeesTableProps {
    searchQuery: string;
}

export function EmployeesTable({ searchQuery: externalSearchQuery }: EmployeesTableProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const tenantId = currentUser?.currentCompanyId;
    
    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const [showSalaries, setShowSalaries] = useState(false);
    
    const combinedSearch = externalSearchQuery || internalSearchQuery;

    const employeesQuery = useMemo(() => [orderBy('employeeNumber', 'asc')], []);
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', employeesQuery);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);

    const departmentOptions = useMemo(() => {
        const depts = new Set((employees || []).map(emp => emp.department).filter(Boolean));
        return Array.from(depts);
    }, [employees]);


    const filteredEmployees = useMemo(() => {
        const today = new Date();
        let filtered = employees || [];

        if (statusFilter !== 'all') {
            filtered = filtered.filter(emp => emp.status === statusFilter);
        }

        if (departmentFilter !== 'all') {
            filtered = filtered.filter(emp => emp.department === departmentFilter);
        }
        
        if (serviceDurationFilter !== 'all') {
            filtered = filtered.filter(emp => {
                const hireDate = toFirestoreDate(emp.hireDate);
                if (!hireDate) return false;
                const yearsOfService = differenceInYears(today, hireDate);
                switch (serviceDurationFilter) {
                    case '1-3': return yearsOfService >= 1 && yearsOfService < 3;
                    case '3-6': return yearsOfService >= 3 && yearsOfService < 6;
                    case '6-10': return yearsOfService >= 6 && yearsOfService < 10;
                    case '10+': return yearsOfService >= 10;
                    default: return true;
                }
            });
        }
        
        const sorted = [...filtered].sort((a, b) => {
            const numA = parseInt(a.employeeNumber) || 0;
            const numB = parseInt(b.employeeNumber) || 0;
            return numA - numB;
        });

        return searchEmployees(sorted, combinedSearch);
    }, [employees, combinedSearch, statusFilter, departmentFilter, serviceDurationFilter]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        return date ? format(date, 'dd/MM/yyyy') : '-';
    };

    const handleTerminateConfirm = async () => {
        if (!employeeToTerminate || !terminationReason || !firestore || !tenantId) return;
        setIsTerminating(true);
        
        const employeePath = getTenantPath(`employees/${employeeToTerminate.id}`, tenantId);
        const employeeRef = doc(firestore, employeePath);
        const updateData = { status: 'terminated' as const, terminationDate: new Date(), terminationReason: terminationReason };

        try {
            await updateDoc(employeeRef, updateData).catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: employeePath,
                    operation: 'update',
                    requestResourceData: updateData
                }));
                throw serverError;
            });
            toast({ title: 'تم إنهاء الخدمة', description: `تم تحديث حالة ${employeeToTerminate.fullName} بنجاح.`});
        } finally { 
            setIsTerminating(false); 
            setEmployeeToTerminate(null); 
            setTerminationReason(null); 
        }
    };

    const handleReactivate = async (employee: Employee) => {
        if (!firestore || !tenantId) return;
        
        const employeePath = getTenantPath(`employees/${employee.id}`, tenantId);
        const employeeRef = doc(firestore, employeePath);
        const updateData = { status: 'active' as const, terminationReason: null, terminationDate: null };

        try {
            await updateDoc(employeeRef, updateData).catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: employeePath,
                    operation: 'update',
                    requestResourceData: updateData
                }));
                throw serverError;
            });
            toast({ title: 'تمت إعادة التنشيط', description: `عاد ${employee.fullName} إلى الخدمة النشطة.` });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
                <div className="flex flex-wrap gap-2 items-center flex-grow">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32 h-9 text-xs bg-white rounded-xl"><SelectValue placeholder="الحالة"/></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">الكل</SelectItem>
                            {Object.entries(statusTranslations).map(([key, value]) => (<SelectItem key={key} value={key}>{value}</SelectItem>))}
                        </SelectContent>
                    </Select>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                        <SelectTrigger className="w-40 h-9 text-xs bg-white rounded-xl"><SelectValue placeholder="القسم"/></SelectTrigger>
                        <SelectContent dir="rtl">
                            <SelectItem value="all">كل الأقسام</SelectItem>
                            {departmentOptions.map(dept => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                    <Input
                        placeholder="ابحث بالاسم أو الرقم..."
                        value={internalSearchQuery}
                        onChange={(e) => setInternalSearchQuery(e.target.value)}
                        className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
                    />
                </div>
            </div>

            <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
                <Table>
                    <TableHeader className="bg-[#F8F9FE]">
                        <TableRow className="border-none">
                            <TableHead className="px-8 py-5 font-black text-[#7209B7]">الاسم الكامل</TableHead>
                            <TableHead className="font-black text-[#7209B7]">رقم الملف</TableHead>
                            <TableHead className="font-black text-[#7209B7]">الوظيفة والقسم</TableHead>
                            <TableHead className="font-black text-[#7209B7]">تاريخ التعيين</TableHead>
                            <TableHead className="text-left font-black text-[#7209B7] flex items-center justify-end gap-2 h-14">
                                <span>الراتب</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-primary hover:bg-primary/10 rounded-full" 
                                    onClick={() => setShowSalaries(!showSalaries)}
                                >
                                    {showSalaries ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </Button>
                            </TableHead>
                            <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                            <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={7} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
                            ))
                        ) : filteredEmployees.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد سجلات موظفين مطابقة.</TableCell></TableRow>
                        ) : (
                            filteredEmployees.map((employee) => (
                                <TableRow key={employee.id} className={cn("hover:bg-[#F3E8FF]/20 group transition-colors h-16", employee.status === 'terminated' && "opacity-60")}>
                                    <TableCell className="px-8 font-black text-gray-800">
                                        <Link href={`/dashboard/hr/employees/${employee.id}`} className="hover:underline">{employee.fullName}</Link>
                                    </TableCell>
                                    <TableCell className="font-mono font-bold opacity-60 text-xs">{employee.employeeNumber}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black text-sm text-primary">{employee.jobTitle}</span>
                                            <span className="text-[10px] text-muted-foreground font-bold">{employee.department}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-xs opacity-60">{formatDate(employee.hireDate)}</TableCell>
                                    <TableCell className="text-left font-mono font-black text-blue-700">
                                        {showSalaries ? formatCurrency(employee.basicSalary) : '***.***'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[employee.status])}>
                                            {statusTranslations[employee.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-xl p-2 shadow-2xl">
                                                <DropdownMenuLabel className="font-black px-3 py-2">خيارات الملف</DropdownMenuLabel>
                                                <DropdownMenuItem asChild className="rounded-lg py-3">
                                                    <Link href={`/dashboard/hr/employees/${employee.id}`} className="flex items-center gap-2">
                                                        <Eye className="h-4 w-4" /> عرض الملف الشامل
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild className="rounded-lg py-3">
                                                    <Link href={`/dashboard/hr/employees/${employee.id}/edit`} className="flex items-center gap-2">
                                                        <Edit className="ml-2 h-4 w-4" /> تعديل البيانات
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {employee.status !== 'terminated' ? (
                                                    <DropdownMenuItem onClick={() => setEmployeeToTerminate(employee)} className="text-destructive font-bold gap-2 rounded-lg py-3">
                                                        <Trash2 className="h-4 w-4" /> إنهاء الخدمة
                                                    </DropdownMenuItem>
                                                ) : (
                                                    <DropdownMenuItem onClick={() => handleReactivate(employee)} className="text-green-600 font-bold gap-2 rounded-lg py-3">
                                                        <RotateCcw className="h-4 w-4" /> إضافة
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!employeeToTerminate} onOpenChange={() => setEmployeeToTerminate(null)}>
                <AlertDialogContent dir="rtl" className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-black text-red-700">إنهاء خدمة موظف</AlertDialogTitle>
                        <AlertDialogDescription className="text-lg font-bold">هل أنت متأكد من تغيير حالة الموظف "{employeeToTerminate?.fullName}" إلى منتهية خدمته؟ سيتم تجميد حسابه فوراً.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="flex gap-4 justify-center py-6">
                        <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')} className="rounded-xl h-11 px-10 font-black">استقالة</Button>
                        <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')} className="rounded-xl h-11 px-10 font-black">إنهاء خدمات</Button>
                    </div>
                    <AlertDialogFooter className="gap-2 border-t pt-6">
                        <AlertDialogCancel className="rounded-xl font-bold">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminateConfirm} disabled={!terminationReason || isTerminating} className="bg-red-600 hover:bg-red-700 rounded-xl font-black px-10 shadow-lg shadow-red-100">
                            {isTerminating ? <Loader2 className="animate-spin h-5 w-5"/> : 'تأكيد الإنهاء النهائي'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
