'use client';
import { useState, useEffect } from 'react';
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
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Employee } from '@/lib/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, type DocumentData } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { Skeleton } from '@/components/ui/skeleton';

const statusTranslations: Record<Employee['status'], string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدمته',
};

const statusColors: Record<Employee['status'], string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

const calculateAnnualLeaveBalance = (employee: Employee): number => {
    if (!employee.hireDate) return 0;
    const hireDate = new Date(employee.hireDate);
    // Use a client-side safe date
    const today = new Date();
    const yearsOfService = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsOfService < 1) {
        return 0;
    }
    
    const accrued = employee.annualLeaveAccrued || 0;
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // Max carry-over is 15 days, total balance cannot exceed 45 (30 current + 15 carried).
    const totalBalance = accrued + Math.min(carried, 15) - used;
    
    return Math.max(0, Math.min(45, Math.floor(totalBalance)));
};

export function EmployeesTable() {
    const { firestore } = useFirebase();
    const [employees, setEmployees] = useState<(Employee & { leaveBalance: number | null })[]>([]);

    const employeesCollection = firestore ? collection(firestore, 'employees') : null;
    const employeesQuery = employeesCollection ? query(employeesCollection, orderBy('createdAt', 'desc')) : null;

    const [value, loading, error] = useCollection(employeesQuery);

    useEffect(() => {
        if (value) {
            const employeesData = value.docs.map(doc => {
                const data = { id: doc.id, ...doc.data() } as Employee;
                return {
                    ...data,
                    leaveBalance: calculateAnnualLeaveBalance(data)
                }
            });
            setEmployees(employeesData);
        }
    }, [value]);


    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className='text-lg font-medium'>قائمة الموظفين</h3>
                    <p className='text-sm text-muted-foreground'>
                        عرض وإدارة جميع الموظفين في الشركة.
                    </p>
                </div>
                <Button size="sm" className="gap-1" asChild>
                    <Link href="/dashboard/hr/employees/new">
                        <PlusCircle className="ml-2 h-4 w-4" />
                        إضافة موظف
                    </Link>
                </Button>
            </div>
            <div className='border rounded-lg'>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>اسم الموظف</TableHead>
                    <TableHead>القسم</TableHead>
                    <TableHead>تاريخ التعيين</TableHead>
                    <TableHead>رصيد الإجازة السنوية</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>
                        <span className="sr-only">الإجراءات</span>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && (
                        Array.from({ length: 3 }).map((_, i) => (
                           <TableRow key={`skel-${i}`}>
                                <TableCell colSpan={6}>
                                    <Skeleton className="h-8 w-full" />
                                </TableCell>
                           </TableRow>
                        ))
                    )}
                    {error && (
                         <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-destructive">
                                حدث خطأ أثناء جلب البيانات.
                            </TableCell>
                        </TableRow>
                    )}
                    {!loading && employees.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                لا يوجد موظفون حالياً. قم بإضافة موظف جديد.
                            </TableCell>
                        </TableRow>
                    )}
                    {employees.map((employee) => (
                        <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                            {employee.fullName}
                            <div className="text-sm text-muted-foreground font-mono">{employee.civilId}</div>
                        </TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</TableCell>
                        <TableCell className='font-medium'>
                            {employee.leaveBalance !== null ? `${employee.leaveBalance} يوم` : '...'}
                        </TableCell>
                        <TableCell>
                            <Badge variant={'outline'} className={statusColors[employee.status]}>
                                {statusTranslations[employee.status]}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                aria-haspopup="true"
                                size="icon"
                                variant="ghost"
                                >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Toggle menu</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem>عرض الملف الشخصي</DropdownMenuItem>
                                <DropdownMenuItem>تعديل</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-red-50">
                                    إنهاء الخدمة
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
        </>
    );
}
