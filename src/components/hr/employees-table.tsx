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
import { useFirebase, useCollection } from '@/firebase';
import { collection, query, orderBy, type DocumentData, doc, updateDoc } from 'firebase/firestore';
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
import { addMonths, format, differenceInDays } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/context/language-context';
import { toFirestoreDate, fromFirestoreDate } from '@/services/date-converter';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';

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

const terminationReasons: {value: string, label: string}[] = [
    { value: 'resignation', label: 'استقالة' },
    { value: 'termination', label: 'إنهاء خدمة (من الشركة)' },
    { value: 'probation', label: 'إنهاء فترة التجربة' },
];


function InlineSearchList({ value, onSelect, options, placeholder }: { value: string; onSelect: (value: string) => void; options: { label: string; value: string }[]; placeholder: string; }) {
    const [search, setSearch] = useState('');
    const [showOptions, setShowOptions] = useState(false);
    const MAX_DISPLAY_ITEMS = 50;

    useEffect(() => {
        setSearch(options.find(o => o.value === value)?.label || '');
    }, [value, options]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    );
    
    const displayOptions = filteredOptions.slice(0, MAX_DISPLAY_ITEMS);

    return (
        <div className="relative">
            <Input
                value={search}
                placeholder={placeholder}
                onFocus={() => setShowOptions(true)}
                onBlur={() => setTimeout(() => setShowOptions(false), 150)} // Delay to allow click
                onChange={(e) => {
                    setSearch(e.target.value);
                    setShowOptions(true);
                    if (value) onSelect('');
                }}
            />
            {showOptions && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md">
                    <ul className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <li className="p-2 text-sm text-muted-foreground">لا توجد نتائج</li>
                        ) : (
                            <>
                                {displayOptions.map(opt => (
                                    <li
                                        key={opt.value}
                                        className="cursor-pointer p-2 text-sm hover:bg-accent hover:text-accent-foreground"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            onSelect(opt.value);
                                            setSearch(opt.label);
                                            setShowOptions(false);
                                        }}
                                    >
                                        {opt.label}
                                    </li>
                                ))}
                                {filteredOptions.length > MAX_DISPLAY_ITEMS && (
                                    <li className="p-2 text-xs text-center text-muted-foreground">
                                        ... و {filteredOptions.length - MAX_DISPLAY_ITEMS} نتائج أخرى
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

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
        return employeeList.map(emp => ({
            ...emp,
            annualLeaveBalance: calculateAnnualLeaveBalance(emp)
        }));
    }, [snapshot]);

    const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
    const [isTerminating, setIsTerminating] = useState(false);
    const [noticeStartDate, setNoticeStartDate] = useState('');
    const [terminationDate, setTerminationDate] = useState('');
    const [terminationReason, setTerminationReason] = useState<string>('');
    const [isImmediate, setIsImmediate] = useState(false);


    const [employeeToRehire, setEmployeeToRehire] = useState<Employee | null>(null);
    const [isRehiring, setIsRehiring] = useState(false);
    const [rehireType, setRehireType] = useState<'continue' | 'new'>('continue');
    const [newHireDate, setNewHireDate] = useState('');
    const [resetLeaveBalance, setResetLeaveBalance] = useState(false);

    useEffect(() => {
        if (isImmediate || !noticeStartDate) {
            return;
        }
        const noticeDate = toFirestoreDate(noticeStartDate);
        if (noticeDate) {
            const termDate = addMonths(noticeDate, 3);
            setTerminationDate(format(termDate, 'yyyy-MM-dd'));
        }
    }, [noticeStartDate, isImmediate]);
    
     useEffect(() => {
        if (employeeToTerminate) {
            const hireDate = toFirestoreDate(employeeToTerminate.hireDate);
            const isProbation = hireDate ? differenceInDays(new Date(), hireDate) <= 90 : false;
            
            setTerminationReason(isProbation ? 'probation' : '');
            setTerminationDate(new Date().toISOString().split('T')[0]);
            setIsImmediate(isProbation);
            setNoticeStartDate(new Date().toISOString().split('T')[0]);
        }
    }, [employeeToTerminate]);
    
    const handleTerminateClick = (employee: Employee) => {
        setEmployeeToTerminate(employee);
    };
    
    const handleRehireClick = (employee: Employee) => {
        setRehireType('continue');
        setResetLeaveBalance(false);
        setNewHireDate(new Date().toISOString().split('T')[0]);
        setEmployeeToRehire(employee);
    };

    const handleTerminationConfirm = async () => {
        if (!employeeToTerminate || !firestore || !terminationReason) {
            toast({
                variant: 'destructive',
                title: 'خطأ',
                description: 'الرجاء اختيار سبب إنهاء الخدمة.'
            });
            return;
        }

        setIsTerminating(true);
        const employeeRef = doc(firestore, 'employees', employeeToTerminate.id);

        try {
            await updateDoc(employeeRef, {
                status: 'terminated',
                noticeStartDate: isImmediate ? null : toFirestoreDate(noticeStartDate),
                terminationDate: toFirestoreDate(terminationDate),
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
            setIsImmediate(false);
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
        
        const rehireDate = toFirestoreDate(newHireDate);

        if (rehireType === 'new' && rehireDate) {
            updateData.hireDate = rehireDate;
        }

        if (resetLeaveBalance && rehireDate) {
            updateData.annualLeaveAccrued = 0;
            updateData.annualLeaveUsed = 0;
            updateData.carriedLeaveDays = 0;
            updateData.sickLeaveUsed = 0;
            updateData.emergencyLeaveUsed = 0;
            updateData.lastLeaveResetDate = rehireDate;
            updateData.lastVacationAccrualDate = rehireDate;
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
        const dateString = fromFirestoreDate(dateValue); // This gives "yyyy-MM-dd" or ""
        if (!dateString) return '-';
        
        try {
            const [year, month, day] = dateString.split('-');
            if (!year || !month || !day) return '-';
            return `${day}/${month}/${year}`;
        } catch(e) {
            console.error("Failed to format date in table:", e);
            return dateString; // Fallback to yyyy-mm-dd
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
                                {error.message}
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
                            <div className="text-sm text-muted-foreground font-mono">#{employee.employeeNumber}</div>
                            <div className="text-sm text-muted-foreground font-mono">{employee.civilId}</div>
                        </TableCell>
                        <TableCell>{employee.department}</TableCell>
                        <TableCell>{formatDateCell(employee.hireDate)}</TableCell>
                        <TableCell className='font-medium'>
                            {(employee as any).annualLeaveBalance !== undefined ? `${(employee as any).annualLeaveBalance} يوم` : '...'}
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
                <AlertDialogContent
                    dir="rtl"
                    onPointerDownOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]')) {
                            e.preventDefault();
                        }
                    }}
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('[cmdk-root]') || target.closest('[role="listbox"]')) {
                            e.preventDefault();
                        }
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>إنهاء خدمة الموظف</AlertDialogTitle>
                        <AlertDialogDescription>
                           اختر سبب وتاريخ إنهاء الخدمة للموظف: {employeeToTerminate?.fullName}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                             <Label>سبب إنهاء الخدمة</Label>
                             <InlineSearchList 
                                value={terminationReason}
                                onSelect={setTerminationReason}
                                options={terminationReasons}
                                placeholder="اختر السبب..."
                             />
                        </div>
                        <div className="flex items-center space-x-2">
                           <Checkbox id="immediate" checked={isImmediate} onCheckedChange={(checked) => setIsImmediate(checked as boolean)} />
                           <Label htmlFor="immediate">إنهاء فوري بدون فترة إنذار</Label>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="noticeStartDate" className={isImmediate ? 'text-muted-foreground' : ''}>تاريخ تقديم الاستقالة / بدء الإنذار</Label>
                            <Input
                                id="noticeStartDate"
                                type="date"
                                value={noticeStartDate}
                                onChange={(e) => setNoticeStartDate(e.target.value)}
                                disabled={isImmediate}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="terminationDate" className={!isImmediate ? 'text-muted-foreground' : ''}>تاريخ إنهاء الخدمة الفعلي</Label>
                            <Input
                                id="terminationDate"
                                type="date"
                                value={terminationDate}
                                onChange={(e) => setTerminationDate(e.target.value)}
                                readOnly={!isImmediate}
                                disabled={!isImmediate}
                                className={!isImmediate ? 'bg-muted' : ''}
                            />
                        </div>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isTerminating}>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleTerminationConfirm} disabled={isTerminating || !terminationReason} className='bg-destructive hover:bg-destructive/90'>
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
