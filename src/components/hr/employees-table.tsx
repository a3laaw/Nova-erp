'use client';
import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Trash2, Edit, Loader2 } from 'lucide-react';
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
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';

type EmployeeStatus = 'active' | 'on-leave' | 'terminated';

const statusTranslations: Record<EmployeeStatus, string> = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدماته',
};

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-green-100 text-green-800',
  'on-leave': 'bg-yellow-100 text-yellow-800',
  terminated: 'bg-red-100 text-red-800',
};

export function EmployeesTable() {
    const { firestore } = useFirebase();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    
    const [searchQuery, setSearchQuery] = useState('');
    
    const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees');

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);


    const filteredEmployees = useMemo(() => {
        return searchEmployees(employees, searchQuery);
    }, [employees, searchQuery]);

    const formatDate = (dateValue: any) => {
        const date = toFirestoreDate(dateValue);
        if (!date) return '-';
        return format(date, 'dd/MM/yyyy');
    };

    const handleTerminateClick = (employee: Employee) => {
        setEmployeeToTerminate(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !firestore || !terminationReason) {
             toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء تحديد سبب إنهاء الخدمة.' });
             return;
        };
        setIsTerminating(true);
        // Add termination logic here
        console.log(`Terminating ${employeeToTerminate.fullName} for ${terminationReason}`);
        await new Promise(res => setTimeout(res, 1000));
        setIsTerminating(false);
        setEmployeeToTerminate(null);
        setTerminationReason(null);
        toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف بنجاح.'});
    };

    return (
        <div className="space-y-4">
            <Input
              placeholder="ابحث بالاسم، الرقم الوظيفي، أو الرقم المدني..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
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
                        {loading && Array.from({length: 5}).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading && filteredEmployees.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="h-24 text-center">لا يوجد موظفون لعرضهم.</TableCell></TableRow>
                        )}
                        {!loading && filteredEmployees.map((employee) => (
                            <TableRow key={employee.id}>
                                <TableCell className="font-medium">{employee.fullName}</TableCell>
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
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem>عرض الملف</DropdownMenuItem>
                                            <DropdownMenuItem>تعديل</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleTerminateClick(employee)} className="text-destructive">إنهاء الخدمة</DropdownMenuItem>
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
                        <div className="mt-4 space-y-2">
                             <Label>الرجاء تحديد سبب إنهاء الخدمة:</Label>
                             <div className="flex gap-4">
                                <Button variant={terminationReason === 'resignation' ? 'default' : 'outline'} onClick={() => setTerminationReason('resignation')}>استقالة</Button>
                                <Button variant={terminationReason === 'termination' ? 'default' : 'outline'} onClick={() => setTerminationReason('termination')}>إنهاء خدمات</Button>
                            </div>
                        </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={!terminationReason || isTerminating} className="bg-destructive hover:bg-destructive/90">
                            {isTerminating ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، قم بالإنهاء'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
