
'use client';
import { useState, useEffect, useMemo } from 'react';
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
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, type DocumentData, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addMonths, format, differenceInYears } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/context/language-context';

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
    const yearsOfService = differenceInYears(new Date(), hireDate);
    
    // As per Kuwait law, no leave entitlement in the first year of service
    if (yearsOfService < 1) {
        return 0;
    }
    
    // Assuming accrual logic has been handled server-side or via a batch job
    // and stored in the employee document.
    const accrued = employee.annualLeaveAccrued || 0;
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // Max carry-over is 15 days, total balance cannot exceed 45 (30 current + 15 carried).
    const effectiveCarried = Math.min(carried, 15);
    const totalEntitlement = accrued + effectiveCarried;
    const balance = totalEntitlement - used;
    
    return Math.max(0, Math.min(45, Math.floor(balance)));
};

export function EmployeesTable() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { language } = useLanguage();

    const employeesQuery = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'employees'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const [snapshot, loading, error] = useCollection(employeesQuery);

    const employees = useMemo(() => {
        if (!snapshot) return [];
        const employeeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        // Recalculate balance on the client side for display
        return employeeList.map(emp => ({
            ...emp,
            annualLeaveBalance: calculateAnnualLeaveBalance(emp)
        }));
    }, [snapshot]);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [noticeStartDate, setNoticeStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [terminationDate, setTerminationDate] = useState('');
    const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | ''>('');

    const [employeeToRehire, setEmployeeToRehire] = useState<Employee | null>(null);
    const [isRehiring, setIsRehiring] = useState(false);
    const [rehireType, setRehireType] = useState<'continue' | 'new'>('continue');
    const [newHireDate, setNewHireDate] = useState(new Date().toISOString().split('T')[0]);
    const [resetLeaveBalance, setResetLeaveBalance] = useState(false);

    useEffect(() => {
        if (noticeStartDate) {
            const noticeDate = new Date(noticeStartDate);
            const termDate = addMonths(noticeDate, 3);
            setTerminationDate(format(termDate, 'yyyy-MM-dd'));
        }
    }, [noticeStartDate]);

    const handleTerminateClick = (employee: Employee) => {
        setNoticeStartDate(new Date().toISOString().split('T')[0]);
        setEmployeeToTerminate(employee);
    };
    
    const handleRehireClick = (employee: Employee) => {
        setRehireType('continue');
        setResetLeaveBalance(false);
        setNewHireDate(new Date().toISOString().split('T')[0]);
        setEmployeeToRehire(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !firestore || !terminationReason || !noticeStartDate) {
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: 'الرجاء تعبئة تاريخ بدء الإنذار وسبب إنهاء الخدمة.'
            });
            return;
        }

        setIsTerminating(true);
        const employeeRef = doc(firestore, 'employees', employeeToTerminate.id);

        try {
            await updateDoc(employeeRef, {
                status: 'terminated',
                noticeStartDate: new Date(noticeStartDate),
                terminationDate: new Date(terminationDate),
                terminationReason: terminationReason
            });

            toast({
                title: 'نجاح',
                description: `تم إنهاء خدمة الموظف ${employeeToTerminate.fullName} بنجاح.`
            });
            
        } catch (err) {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'خطأ في الحفظ',
                description: 'لم يتم إنهاء خدمة الموظف. الرجاء المحاولة مرة أخرى.'
            });
        } finally {
            setIsTerminating(false);
            setEmployeeToTerminate(null);
            setTerminationReason('');
        }
    };
    
    const handleRehireConfirm = async () => {
        if (!employeeToRehire || !firestore) return;

        setIsRehiring(true);
        const employeeRef = doc(firestore, 'employees', employeeToRehire.id);
        
        const updateData: DocumentData = {
            status: 'active',
            noticeStartDate: null,
            terminationDate: null,
            terminationReason: null,
        };

        if (rehireType === 'new') {
            updateData.hireDate = new Date(newHireDate);
        }

        if (resetLeaveBalance) {
            updateData.annualLeaveAccrued = 0;
            updateData.annualLeaveUsed = 0;
            updateData.carriedLeaveDays = 0;
            updateData.sickLeaveUsed = 0;
            updateData.emergencyLeaveUsed = 0;
            updateData.lastLeaveResetDate = new Date(newHireDate);
            updateData.lastVacationAccrualDate = new Date(newHireDate);
        }

        try {
            await updateDoc(employeeRef, updateData);
             toast({
                title: 'نجاح',
                description: `تمت إعادة خدمة الموظف ${employeeToRehire.fullName} بنجاح.`
            });
        } catch (err) {
            console.error(err);
             toast({
                variant: 'destructive',
                title: 'خطأ في الحفظ',
                description: 'لم تتم إعادة خدمة الموظف. الرجاء المحاولة مرة أخرى.'
            });
        } finally {
            setIsRehiring(false);
            setEmployeeToRehire(null);
        }
    };

    const formatDateCell = (dateValue: any): string => {
        if (!dateValue) return '-';
        try {
            const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
            if (isNaN(d.getTime())) return '-';
            return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', numberingSystem: 'latn' }).format(d);
        } catch (e) {
            return '-';
        }
    }


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
                        <TableRow key={employee.id} className={employee.status === 'terminated' ? 'bg-muted/50 text-muted-foreground' : ''}>
                        <TableCell className="font-medium">
                            {employee.fullName}
                            <div className="text-sm text-muted-foreground font-mono">{employee.civilId}</div>
                        </TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{formatDateCell(employee.hireDate)}</TableCell>
                        <TableCell className='font-medium'>
                            {employee.annualLeaveBalance !== undefined ? `${employee.annualLeaveBalance} يوم` : '...'}
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
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/hr/employees/${employee.id}`}>عرض الملف الشخصي</Link>
                                </DropdownMenuItem>
                                {employee.status !== 'terminated' && (
                                     <DropdownMenuItem asChild>
                                        <Link href={`/dashboard/hr/employees/${employee.id}/edit`}>تعديل</Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {employee.status !== 'terminated' ? (
                                    <DropdownMenuItem onClick={() => handleTerminateClick(employee)} className="text-destructive focus:text-destructive focus:bg-red-50">
                                        إنهاء الخدمة
                                    </DropdownMenuItem>
                                ) : (
                                    <DropdownMenuItem onClick={() => handleRehireClick(employee)} className='text-green-600 focus:text-green-700 focus:bg-green-50'>
                                        إعادة خدمة
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
             <AlertDialog open={!!employeeToTerminate} onOpenChange={(open) => !open && setEmployeeToTerminate(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>إنهاء خدمة الموظف</AlertDialogTitle>
                        <AlertDialogDescription>
                            أدخل تاريخ بدء فترة الإنذار. سيتم حساب تاريخ انتهاء الخدمة الفعلي تلقائيًا بعد 3 أشهر.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                             <Label htmlFor="terminationReason">سبب إنهاء الخدمة</Label>
                             <Select dir="rtl" value={terminationReason} onValueChange={(v) => setTerminationReason(v as any)}>
                                <SelectTrigger id="terminationReason">
                                    <SelectValue placeholder="اختر السبب..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="resignation">استقالة</SelectItem>
                                    <SelectItem value="termination">إنهاء من صاحب العمل</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="noticeStartDate">تاريخ تقديم الاستقالة / بدء الإنذار</Label>
                            <Input
                                id="noticeStartDate"
                                type="date"
                                value={noticeStartDate}
                                onChange={(e) => setNoticeStartDate(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="terminationDate">تاريخ إنهاء الخدمة الفعلي (بعد 3 أشهر)</Label>
                            <Input
                                id="terminationDate"
                                type="date"
                                value={terminationDate}
                                readOnly
                                disabled
                                className="bg-muted"
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={isTerminating} className='bg-destructive hover:bg-destructive/90'>
                            {isTerminating ? 'جاري الحفظ...' : 'تأكيد إنهاء الخدمة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={!!employeeToRehire} onOpenChange={(open) => !open && setEmployeeToRehire(null)}>
                <AlertDialogContent dir="rtl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>إعادة خدمة الموظف: {employeeToRehire?.fullName}</AlertDialogTitle>
                        <AlertDialogDescription>
                            اختر الخيارات المناسبة لإعادة خدمة الموظف.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>نوع إعادة الخدمة</Label>
                            <RadioGroup value={rehireType} onValueChange={(v) => setRehireType(v as any)} className='flex gap-4'>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="continue" id="continue" />
                                    <Label htmlFor="continue">استمرار الخدمة السابقة</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="new" id="new" />
                                    <Label htmlFor="new">اعتباره تعيين جديد</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {rehireType === 'new' && (
                            <div className="grid gap-2">
                                <Label htmlFor="newHireDate">تاريخ التعيين الجديد</Label>
                                <Input
                                    id="newHireDate"
                                    type="date"
                                    value={newHireDate}
                                    onChange={(e) => setNewHireDate(e.target.value)}
                                />
                            </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                            <Checkbox id="resetLeave" checked={resetLeaveBalance} onCheckedChange={(checked) => setResetLeaveBalance(checked as boolean)} />
                            <Label htmlFor="resetLeave">تصفير رصيد الإجازات السابق</Label>
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRehiring}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRehireConfirm} disabled={isRehiring} className='bg-green-600 hover:bg-green-700'>
                            {isRehiring ? 'جاري الحفظ...' : 'تأكيد إعادة الخدمة'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
    

    
