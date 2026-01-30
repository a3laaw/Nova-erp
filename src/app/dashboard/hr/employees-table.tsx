'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { MoreHorizontal, PlusCircle, Trash2, RefreshCw, Loader2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { doc, updateDoc } from 'firebase/firestore';
import { useLanguage } from '@/context/language-context';
import { useFirebase } from '@/firebase';
import { useSubscription, SmartCache } from '@/lib/cache/smart-cache';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';
import type { Employee } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { searchEmployees } from '@/lib/cache/fuse-search';
import { Label } from '@/components/ui/label';
import { addMonths, format, differenceInDays } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toFirestoreDate, fromFirestoreDate } from '@/services/date-converter';
import { calculateAnnualLeaveBalance } from '@/services/leave-calculator';
import { InlineSearchList } from '../ui/inline-search-list';


type ClientStatus = 'new' | 'contracted' | 'cancelled' | 'reContracted';

interface ClientWithEmployee extends Client {
  assignedEngineerName?: string;
}

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

export function EmployeesTable() {
  const { language } = useLanguage();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- NEW DATA FETCHING LOGIC ---
  const { data: employees, setData: setEmployees, loading, error } = useSubscription<Employee>(firestore, 'employees');
  
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

  const processedEmployees = useMemo(() => {
    if (!employees) return [];
    const getSafeTimestamp = (date: any): number => {
        if (!date) return 0;
        if (typeof date.toMillis === 'function') return date.toMillis();
        return new Date(date).getTime();
    };
    const employeeList = employees.map(emp => ({
        ...emp,
        annualLeaveBalance: calculateAnnualLeaveBalance(emp)
    }));
    return employeeList.sort((a,b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt));
  }, [employees]);


  const filteredEmployees = useMemo(() => {
    return searchEmployees(processedEmployees, searchQuery);
  }, [processedEmployees, searchQuery]);

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
        toast({ variant: 'destructive', title: 'خطأ', description: 'الرجاء اختيار سبب إنهاء الخدمة.' });
        return;
    }

    setIsTerminating(true);
    const originalEmployees = [...employees];
    setEmployees(prev => prev.map(emp => emp.id === employeeToTerminate.id ? {...emp, status: 'terminated'} : emp));
    setEmployeeToTerminate(null);

    const employeeRef = doc(firestore, 'employees', employeeToTerminate.id);

    try {
        await updateDoc(employeeRef, {
            status: 'terminated',
            noticeStartDate: isImmediate ? null : toFirestoreDate(noticeStartDate),
            terminationDate: toFirestoreDate(terminationDate),
            terminationReason: terminationReason
        });

        toast({ title: 'نجاح', description: `تم إنهاء خدمة الموظف ${employeeToTerminate.fullName} بنجاح.` });
        
    } catch (err) {
        setEmployees(originalEmployees);
        console.error(err);
        toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم يتم إنهاء خدمة الموظف. تم التراجع.' });
    } finally {
        setIsTerminating(false);
    }
  };
  
  const handleRehireConfirm = async () => {
    if (!employeeToRehire || !firestore) return;

    setIsRehiring(true);
    const originalEmployees = [...employees];
    setEmployees(prev => prev.map(emp => emp.id === employeeToRehire.id ? { ...emp, status: 'active' } : emp));
    setEmployeeToRehire(null);

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
         toast({ title: 'نجاح', description: `تمت إعادة خدمة الموظف ${employeeToRehire.fullName} بنجاح.` });
    } catch (err) {
         setEmployees(originalEmployees);
         console.error(err);
         toast({ variant: 'destructive', title: 'خطأ في الحفظ', description: 'لم تتم إعادة خدمة الموظف. تم التراجع.' });
    } finally {
        setIsRehiring(false);
    }
  };

  const formatDateCell = (dateValue: any): string => {
      const dateString = fromFirestoreDate(dateValue);
      if (!dateString) return '-';
      
      try {
          const [year, month, day] = dateString.split('-');
          if (!year || !month || !day) return '-';
          return `${day}/${month}/${year}`;
      } catch(e) {
          console.error("Failed to format date in table:", e);
          return dateString;
      }
  }

  const refreshData = useCallback(async () => {
    toast({ title: 'تحديث البيانات...', description: 'جاري إعادة المزامنة من الخادم.' });
    await SmartCache.invalidate('employees');
    // useSubscription will automatically fetch new data
  }, []);

  const t = {
    ar: {
      title: 'إدارة الموظفين',
      description: 'عرض وتحديث حالات ملفات الموظفين.',
      addClient: 'إضافة موظف',
      fileNumber: 'رقم الملف',
      fullName: 'الاسم الكامل',
      assignedEngineer: 'المهندس المسؤول',
      mobile: 'رقم الجوال',
      status: 'الحالة',
      loading: 'جاري تحميل البيانات...',
      error: 'حدث خطأ أثناء جلب البيانات.',
      noClients: 'لا يوجد موظفون حالياً.',
      actions: 'الإجراءات',
      viewProfile: 'عرض الملف',
      edit: 'تعديل',
      delete: 'حذف',
      deleteConfirmTitle: 'هل أنت متأكد؟',
      deleteConfirmDesc: 'سيتم حذف ملف العميل بشكل دائم. لا يمكن التراجع عن هذا الإجراء.',
      cancel: 'إلغاء',
      confirmDelete: 'نعم، قم بالحذف',
      searchPlaceholder: 'ابحث بالاسم، الرقم الوظيفي، أو الرقم المدني...'
    },
    en: {
      title: 'Employee Management',
      description: 'View and update client file statuses.',
      addClient: 'Add Employee',
      fileNumber: 'File Number',
      fullName: 'Full Name',
      assignedEngineer: 'Assigned Engineer',
      mobile: 'Mobile',
      status: 'Status',
      loading: 'Loading data...',
      error: 'An error occurred while fetching data.',
      noClients: 'No employees to display at the moment.',
      actions: 'Actions',
      viewProfile: 'View Profile',
      edit: 'Edit',
      delete: 'Delete',
      deleteConfirmTitle: 'Are you sure?',
      deleteConfirmDesc: 'This will permanently delete the employee file. This action cannot be undone.',
      cancel: 'Cancel',
      confirmDelete: 'Yes, delete',
      searchPlaceholder: 'Search by name, file no., or mobile...'
    }
  }
  const currentText = t[language];

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className='text-lg font-medium'>قائمة الموظفين</h3>
          <p className='text-sm text-muted-foreground'>
            عرض وإدارة جميع الموظفين في الشركة.
          </p>
        </div>
         <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={refreshData} disabled={loading}>
                 {loading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />}
                 تحديث
             </Button>
            <Button size="sm" className="gap-1" asChild>
                <Link href="/dashboard/hr/employees/new">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة موظف
                </Link>
            </Button>
        </div>
      </div>
       <div className="mb-4">
            <Input
                placeholder={currentText.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
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
              {loading && filteredEmployees.length === 0 && Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                      <TableCell colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                      </TableCell>
                  </TableRow>
              ))}
              {error && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-destructive">
                          {error.message}
                      </TableCell>
                  </TableRow>
              )}
              {!loading && filteredEmployees.length === 0 && (
                  <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                          {searchQuery ? 'لا توجد نتائج تطابق بحثك.' : 'لا يوجد موظفون حالياً. قم بإضافة موظف جديد.'}
                      </TableCell>
                  </TableRow>
              )}
              {filteredEmployees.map((employee) => (
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

    