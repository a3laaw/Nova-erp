'use client';
import { useState } from 'react';
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
const initialEmployees: Employee[] = [
    { 
        id: 'emp-1',
        fullName: 'علياء العامري',
        civilId: '123456789012',
        mobile: '0501112222',
        hireDate: '2022-08-15T00:00:00.000Z',
        contractType: 'permanent',
        department: 'هندسة',
        basicSalary: 1200,
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
    const today = new Date();
    const yearsOfService = (today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsOfService < 1) {
        return 0;
    }
    
    const accrued = employee.annualLeaveAccrued || 0;
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // As per Kuwait law, max carry-over is often 30 days total if company policy allows, but the user requested 15 days can be carried.
    // The total balance that can be used shouldn't exceed a certain limit, e.g., 45 (30 current + 15 carried). Let's use MIN(45, ...).
    return Math.min(45, accrued + carried - used);
};


export function EmployeesTable() {
    const [employees, setEmployees] = useState(initialEmployees);

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className='text-lg font-medium'>قائمة الموظفين</h3>
                    <p className='text-sm text-muted-foreground'>
                        عرض وإدارة جميع الموظفين في الشركة.
                    </p>
                </div>
                <Button size="sm" className="gap-1">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة موظف
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
                        <TableCell>{new Date(employee.hireDate).toLocaleDateString('ar-KW')}</TableCell>
                        <TableCell className='font-medium'>
                            {calculateAnnualLeaveBalance(employee)} يوم
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
