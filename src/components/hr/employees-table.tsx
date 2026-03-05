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
import { MoreHorizontal, Trash2, Edit, Loader2, Calendar, Search } from 'lucide-react';
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
import { DateInput } from '../ui/date-input';
import { cn } from '@/lib/utils';


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
    
    const [statusFilter, setStatusFilter] = useState('active');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [serviceDurationFilter, setServiceDurationFilter] = useState('all');
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    
    const combinedSearch = externalSearchQuery || internalSearchQuery;

    const employeesQuery = useMemo(() => [orderBy('createdAt', 'desc')], []);
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
        
        return searchEmployees(filtered, combinedSearch);
    }, [employees, combinedSearch, statusFilter, departmentFilter, serviceDurationFilter]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        return date ? format(date, 'dd/MM/yyyy') : '-';
    };

    const handleTerminateConfirm = async () => {
        if (!employeeToTerminate || !terminationReason || !firestore) return;
        setIsTerminating(true);
        try {
            const employeeRef = doc(firestore, 'employees', employeeToTerminate.id!);
            await updateDoc(employeeRef, { status: 'terminated', terminationDate: new Date(), terminationReason: terminationReason });
            toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف.'});
        } finally { setIsTerminating(false); setEmployeeToTerminate(null); setTerminationReason(null); }
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
                            <TableHead className="font-black text-[#7209B7]">الرقم الوظيفي</TableHead>
                            <TableHead className="font-black text-[#7209B7]">القسم</TableHead>
                            <TableHead className="font-black text-[#7209B7]">تاريخ التعيين</TableHead>
                            <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                            <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <TableRow key={i}><TableCell colSpan={6} className="px-8"><Skeleton className="h-6 w-full rounded-lg" /></TableCell></TableRow>
                            ))
                        ) : filteredEmployees.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold italic">لا توجد سجلات موظفين مطابقة.</TableCell></TableRow>
                        ) : (
                            filteredEmployees.map((employee) => (
                                <TableRow key={employee.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                                    <TableCell className="px-8 font-black text-gray-800">
                                        <Link href={`/dashboard/hr/employees/${employee.id}`} className="hover:underline">{employee.fullName}</Link>
                                    </TableCell>
                                    <TableCell className="font-mono font-bold opacity-60 text-xs">{employee.employeeNumber}</TableCell>
                                    <TableCell className="font-medium text-xs">{employee.department}</TableCell>
                                    <TableCell className="font-bold text-xs opacity-60">{formatDate(employee.hireDate)}</TableCell>
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
                                            <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                                <DropdownMenuItem asChild><Link href={`/dashboard/hr/employees/${employee.id}`}><Edit className="ml-2 h-4 w-4" /> عرض الملف</Link></DropdownMenuItem>
                                                <DropdownMenuItem asChild><Link href={`/dashboard/hr/employees/${employee.id}/edit`}>تعديل</Link></DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                {employee.status !== 'terminated' && (
                                                    <DropdownMenuItem onClick={() => setEmployeeToTerminate(employee)} className="text-destructive">إنهاء الخدمة</DropdownMenuItem>
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
                <AlertDialogContent dir="rtl" className="rounded-3xl">
                    <AlertDialogHeader><AlertDialogTitle>إنهاء خدمة الموظف</AlertDialogTitle><AlertDialogDescription>هل أنت متأكد من تغيير حالة الموظف "{employeeToTerminate?.fullName}" إلى منتهية خدمته؟</AlertDialogDescription></AlertDialogHeader>
                    <div className="flex gap-4 justify-center py-4">
                        <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')} className="rounded-xl">استقالة</Button>
                        <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')} className="rounded-xl">إنهاء خدمات</Button>
                    </div>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">تراجع</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminateConfirm} disabled={!terminationReason || isTerminating} className="bg-destructive rounded-xl">تأكيد الإنهاء</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
