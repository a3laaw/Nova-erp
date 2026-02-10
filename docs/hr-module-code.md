# الكود الكامل لوحدة الموارد البشرية (HR)

هذا المستند يحتوي على الشرح الكامل والأكواد المصدرية لجميع الملفات المتعلقة بوحدة الموارد البشرية في النظام.

---

## 1. نظرة عامة على المميزات

هذا ملخص للمميزات الرئيسية في هذه الوحدة، مأخوذ من ملف الشرح `docs/hr-features.md`.

*   **ملف الموظف المتكامل:** سجل شامل لكل موظف يحتوي على جميع بياناته الشخصية، الوظيفية، والمالية.
*   **إدارة إنهاء الخدمة وسجل التدقيق:** يمكنك إنهاء خدمة موظف مع تحديد السبب، ويقوم النظام بتسجيل جميع التغييرات التي تطرأ على ملف الموظف في سجل تدقيق خاص به.
*   **نظام الإجازات والاستئذانات:** نظام متكامل لتقديم ومتابعة طلبات الإجازات (سنوية، مرضية، طارئة) والاستئذانات (تأخير أو خروج مبكر) مع دورة موافقات وقيود ذكية وتحديث تلقائي لأرصدة الموظفين.
*   **الحضور والانصراف والرواتب:** وحدة متكاملة لمعالجة رواتب الموظفين، بدءًا من رفع ملف الحضور، ومعالجة البيانات بذكاء، وإنشاء كشوف الرواتب، وانتهاءً بإنشاء قيد محاسبي تلقائي عند تأكيد الدفع.
*   **حاسبة مكافأة نهاية الخدمة:** أداة دقيقة لحساب مستحقات نهاية الخدمة للموظف وفقًا لقانون العمل الكويتي.

---

## 2. الأكواد المصدرية

فيما يلي الأكواد الكاملة للملفات بالترتيب.

### ملف الموظفين (`src/app/dashboard/hr/employees/page.tsx`)

هذه هي الصفحة الرئيسية لقائمة الموظفين.

```tsx
'use client';
import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { EmployeesTable } from '@/components/hr/employees-table';
import { Input } from '@/components/ui/input';

export default function EmployeesPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>إدارة الموظفين</CardTitle>
                        <CardDescription>
                            عرض وتحديث ملفات الموظفين وإدارة حساباتهم.
                        </CardDescription>
                    </div>
                     <Button asChild size="sm" className="gap-1">
                        <Link href="/dashboard/hr/employees/new">
                            <PlusCircle className="h-4 w-4" />
                            إضافة موظف جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-4">
                    <Input
                      placeholder="ابحث بالاسم، الرقم الوظيفي، أو الرقم المدني..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="max-w-sm"
                    />
                </div>
                <EmployeesTable searchQuery={searchQuery} />
            </CardContent>
        </Card>
    );
}
```

### جدول الموظفين (`src/components/hr/employees-table.tsx`)

هذا المكون يعرض قائمة الموظفين مع إمكانية البحث والإجراءات.

```tsx
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
import { MoreHorizontal, Trash2, Edit, Loader2, Calendar } from 'lucide-react';
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
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { useFirebase, useSubscription } from '@/firebase';
import { doc, updateDoc, query, orderBy, collection } from 'firebase/firestore';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';


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

export function EmployeesTable({ searchQuery }: EmployeesTableProps) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    
    const employeesQuery = useMemo(() => {
        if (!firestore) return null;
        return [orderBy('createdAt', 'desc')];
    }, [firestore]);

    const { data: employees, loading, error } = useSubscription<Employee>(firestore, 'employees', employeesQuery || []);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);

    const augmentedEmployees = useMemo(() => {
        if (!employees) return [];
        const today = new Date();
        return employees.map(emp => ({
            ...emp,
            annualLeaveBalance: calculateAnnualLeaveBalance(emp, today)
        }));
    }, [employees]);


    const filteredEmployees = useMemo(() => {
        if (!augmentedEmployees) return [];
        return searchEmployees(augmentedEmployees, searchQuery);
    }, [augmentedEmployees, searchQuery]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        if (!date) return '-';
        return format(date, 'dd/MM/yyyy');
    };

    const handleTerminateClick = (employee: Employee) => {
        setEmployeeToTerminate(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !terminationReason || !firestore) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد سبب إنهاء الخدمة.' });
             return;
        };
        setIsTerminating(true);
        try {
            const employeeRef = doc(firestore, 'employees', employeeToTerminate.id!);
            await updateDoc(employeeRef, {
                status: 'terminated',
                terminationDate: new Date(),
                terminationReason: terminationReason
            });
            toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف بنجاح.'});
        } catch (error) {
            console.error("Error terminating employee:", error);
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنهاء خدمة الموظف.' });
        } finally {
            setIsTerminating(false);
            setEmployeeToTerminate(null);
            setTerminationReason(null);
        }
    };

    return (
        <>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>الاسم الكامل</TableHead>
                            <TableHead>الرقم الوظيفي</TableHead>
                            <TableHead>القسم</TableHead>
                            <TableHead>تاريخ التعيين</TableHead>
                            <TableHead>رصيد الإجازة</TableHead>
                            <TableHead>الحالة</TableHead>
                            <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">
                                {searchQuery ? 'لا توجد نتائج تطابق البحث.' : 'لا يوجد موظفون لعرضهم.'}
                            </TableCell></TableRow>
                        )}
                        {!loading && filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">
                                    <Link href={\`/dashboard/hr/employees/\${employee.id}\`} className="hover:underline">
                                        {employee.fullName}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-mono">{employee.employeeNumber}</TableCell>
                                <TableCell>{employee.department}</TableCell>
                                <TableCell>{formatDate(employee.hireDate)}</TableCell>
                                <TableCell>{employee.annualLeaveBalance ?? '-'}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={statusColors[employee.status]}>
                                        {statusTranslations[employee.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                                <MoreHorizontal className="h-4 w-4" />
                                                <span className="sr-only">Toggle menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem asChild>
                                                <Link href={\`/dashboard/hr/employees/\${employee.id}/edit\`}>تعديل</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {employee.status !== 'terminated' && (
                                                <DropdownMenuItem onClick={() => handleTerminateClick(employee)} className="text-destructive focus:text-destructive">إنهاء الخدمة</DropdownMenuItem>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <AlertDialog open={!!employeeToTerminate} onOpenChange={() => setEmployeeToTerminate(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>تأكيد إنهاء الخدمة</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم تغيير حالة الموظف "{employeeToTerminate?.fullName}" إلى "منتهية خدمته" وتجميد حسابه.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-4 space-y-2">
                         <Label>الرجاء تحديد سبب إنهاء الخدمة:</Label>
                         <div className="flex gap-4">
                            <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')}>استقالة</Button>
                            <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')}>إنهاء خدمات</Button>
                        </div>
                    </div>
                    <AlertDialogFooter className='mt-4'>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={!terminationReason || isTerminating} className="bg-destructive hover:bg-destructive/90">
                            {isTerminating ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإنهاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
```

### ملف الإجازات (`src/app/dashboard/hr/leaves/page.tsx`)

هذه هي الصفحة الرئيسية لطلبات الإجازات.

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';

export default function LeaveRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الإجازات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الإجازات للموظفين.</CardDescription>
            </CardHeader>
            <CardContent>
                <LeaveRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الاستئذانات (`src/app/dashboard/hr/permissions/page.tsx`)

هذه هي الصفحة الرئيسية لطلبات الاستئذانات.

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionRequestsList } from '@/components/hr/permission-requests-list';

export default function PermissionRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الاستئذانات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الاستئذان (تأخير أو خروج مبكر).</CardDescription>
            </CardHeader>
            <CardContent>
                <PermissionRequestsList />
            </CardContent>
        </Card>
    );
}
```

### ملف الرواتب (`src/app/dashboard/hr/payroll/page.tsx`)

هذه الصفحة تنظم عملية الرواتب في ثلاث خطوات (تابات).

```tsx
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttendanceUploader } from '@/components/hr/attendance-uploader';
import { PayrollGenerator } from '@/components/hr/payroll-generator';
import { Users2, Sheet, FileSpreadsheet } from 'lucide-react';
import { PayslipsList } from '@/components/hr/payslips-list';

export default function PayrollPage() {
    return (
        <Tabs defaultValue="attendance" dir="rtl">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="attendance">
                    <Users2 className="ml-2 h-4 w-4" />
                    1. رفع الحضور والانصراف
                </TabsTrigger>
                <TabsTrigger value="payroll">
                    <Sheet className="ml-2 h-4 w-4" />
                    2. معالجة الرواتب
                </TabsTrigger>
                 <TabsTrigger value="payslips">
                    <FileSpreadsheet className="ml-2 h-4 w-4" />
                    3. عرض الكشوفات
                </TabsTrigger>
            </TabsList>
            <TabsContent value="attendance" className="mt-4">
                <AttendanceUploader />
            </TabsContent>
            <TabsContent value="payroll" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>معالجة كشوف الرواتب</CardTitle>
                        <CardDescription>
                           توليد كشوف الرواتب الشهرية بناءً على سجلات الحضور والغياب للموظفين.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayrollGenerator />
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="payslips" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>كشوف الرواتب المُنشأة</CardTitle>
                        <CardDescription>
                           مراجعة وتأكيد دفع كشوف الرواتب التي تم إنشاؤها.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <PayslipsList />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
```

### حاسبة نهاية الخدمة (`src/app/dashboard/hr/gratuity-calculator/page.tsx`)

هذه الصفحة تعرض واجهة حاسبة نهاية الخدمة.

```tsx
'use client';

import { GratuityCalculatorView } from "@/components/hr/gratuity-calculator-view";

export default function GratuityCalculatorPage() {
    return <GratuityCalculatorView />;
}
```

### منطق حساب الإجازات ونهاية الخدمة (`src/services/leave-calculator.ts`)

هذا الملف يحتوي على الدوال الرياضية لحساب أيام العمل، أرصدة الإجازات، ومستحقات نهاية الخدمة وفقاً للقانون.

```ts
import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

export function calculateWorkingDays(
  startDate: Date | undefined,
  endDate: Date | undefined,
  weeklyHolidays: string[],
  publicHolidays: Holiday[]
): { totalDays: number, workingDays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { totalDays: 0, workingDays: 0 };
  }

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const interval = { start: startDate, end: endDate };
  const allDaysInInterval = eachDayOfInterval(interval);

  const weeklyHolidayIndexes = new Set(weeklyHolidays.map(day => dayNameToIndex[day]));
  const publicHolidayDates = new Set(publicHolidays.map(h => format(toFirestoreDate(h.date)!, 'yyyy-MM-dd')));

  let workingDays = 0;

  for (const day of allDaysInInterval) {
    const dayIndex = day.getDay();
    const dateString = format(day, 'yyyy-MM-dd');
    
    if (!weeklyHolidayIndexes.has(dayIndex) && !publicHolidayDates.has(dateString)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays };
}

export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // Calculate total months of service
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    
    // Accrual is 30 days per year, which is 2.5 days per month.
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};


export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) {
      return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'تاريخ التعيين غير صالح.', yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

    if (lastSalary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let rawGratuity = 0;
    const dailyWage = lastSalary / 26; // As per common practice for Kuwait law

    // Kuwaiti Private Sector Labor Law No. 6 of 2010, Article 51
    if (yearsOfService <= 5) {
        // 15 days' remuneration for each of the first five years
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // 15 days for first 5 years + one month's remuneration for each year thereafter.
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        const subsequentYearsGratuity = subsequentYears * lastSalary;
        rawGratuity = firstFiveYearsGratuity + subsequentYearsGratuity;
    }

    // Cap at 1.5 years salary
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.`;

    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
        }
        // If > 10 years, they get the full amount, so no change needed.
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
        yearsOfService,
        lastSalary,
        leaveBalance,
        dailyWage,
    };
};
```
