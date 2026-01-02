

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


// Mock data for now, will be replaced with Firestore data
export const initialEmployees: Employee[] = [
    { 
        id: 'emp-1',
        fullName: 'علياء العامري',
        civilId: '123456789012',
        mobile: '0501112222',
        hireDate: '2022-08-15T00:00:00.000Z',
        contractType: 'permanent',
        department: 'هندسة',
        basicSalary: 1200,
        housingAllowance: 400,
        transportAllowance: 100,
        status: 'active',
        terminationDate: null,
        terminationReason: null,
        lastVacationAccrualDate: new Date().toISOString(),
        annualLeaveAccrued: 30,
        annualLeaveUsed: 10,
        carriedLeaveDays: 5,
    },
    { 
        id: 'emp-2',
        fullName: 'خالد المصري',
        civilId: '987654321098',
        mobile: '0553334444',
        hireDate: '2023-01-20T00:00:00.000Z',
        contractType: 'permanent',
        department: 'محاسبة',
        basicSalary: 950,
        housingAllowance: 300,
        transportAllowance: 100,
        status: 'active',
        terminationDate: null,
        terminationReason: null,
        lastVacationAccrualDate: new Date().toISOString(),
        annualLeaveAccrued: 30,
        annualLeaveUsed: 5,
        carriedLeaveDays: 0,
    },
    { 
        id: 'emp-3',
        fullName: 'سارة عبدالله',
        civilId: '112233445566',
        mobile: '0567778888',
        // Hired less than a year ago
        hireDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString(),
        contractType: 'permanent',
        department: 'سكرتارية',
        basicSalary: 700,
        housingAllowance: 0,
        transportAllowance: 50,
        status: 'active',
        terminationDate: null,
        terminationReason: null,
        lastVacationAccrualDate: new Date().toISOString(),
        annualLeaveAccrued: 0,
        annualLeaveUsed: 0,
        carriedLeaveDays: 0,
    }
];

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
    
    return Math.max(0, Math.min(45, totalBalance));
};

export function EmployeesTable() {
    const [employees, setEmployees] = useState(initialEmployees.map(e => ({...e, leaveBalance: null as number | null })));
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        // This ensures the component has mounted on the client
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient) {
            setEmployees(initialEmployees.map(e => ({
                ...e,
                leaveBalance: calculateAnnualLeaveBalance(e)
            })));
        }
    }, [isClient]);


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
                    {employees.map((employee) => (
                        <TableRow key={employee.id}>
                        <TableCell className="font-medium">
                            {employee.fullName}
                            <div className="text-sm text-muted-foreground font-mono">{employee.civilId}</div>
                        </TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{new Date(employee.hireDate).toLocaleDateString('ar-KW', { day: '2-digit', month: '2-digit', year: 'numeric' })}</TableCell>
                        <TableCell className='font-medium'>
                            {isClient && employee.leaveBalance !== null ? `${employee.leaveBalance} يوم` : '...'}
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
