'use client';
// This file has been restored with the correct implementation.
// It was previously marked for deletion.
import { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, getDocs, writeBatch, where } from 'firebase/firestore';
import type { Employee, UserProfile } from '@/lib/types';
import { format } from 'date-fns';
import { MoreHorizontal, PlusCircle, Trash2, Eye, Pencil, UserX, UserCheck, Search, FileText } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { useSubscription } from '@/hooks/use-subscription';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

const statusColors: { [key: string]: string } = {
  active: 'bg-green-100 text-green-800 border-green-200',
  'on-leave': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  terminated: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: { [key: string]: string } = {
  active: 'نشط',
  'on-leave': 'في إجازة',
  terminated: 'منتهية خدمته',
};


export function EmployeesTable() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [employeeToTerminate, setEmployeeToTerminate] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [terminationReason, setTerminationReason] = useState<'resignation' | 'termination' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const employeesQuery = useMemo(() => [orderBy('createdAt', 'desc')], []);
  const { data: employees, loading } = useSubscription<Employee>(firestore, 'employees', employeesQuery);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;
    const lowercasedQuery = searchQuery.toLowerCase();
    return employees.filter(
      emp => emp.fullName.toLowerCase().includes(lowercasedQuery) ||
             emp.employeeNumber?.includes(lowercasedQuery) ||
             emp.civilId?.includes(lowercasedQuery)
    );
  }, [employees, searchQuery]);


  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleTermination = async () => {
    if (!employeeToTerminate || !terminationReason || !firestore) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        const empRef = doc(firestore, 'employees', employeeToTerminate.id!);
        batch.update(empRef, { 
            status: 'terminated',
            terminationDate: serverTimestamp(),
            terminationReason: terminationReason,
        });

        // Deactivate associated user account
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('employeeId', '==', employeeToTerminate.id));
        const userSnap = await getDocs(q);
        if (!userSnap.empty) {
            const userDoc = userSnap.docs[0];
            batch.update(userDoc.ref, { isActive: false });
        }
        await batch.commit();

        toast({ title: 'نجاح', description: 'تم إنهاء خدمة الموظف وتجميد حسابه.' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إنهاء خدمة الموظف.' });
    } finally {
        setIsProcessing(false);
        setEmployeeToTerminate(null);
        setTerminationReason(null);
    }
  };

  const handleDelete = async () => {
    if (!employeeToDelete || !firestore) return;
    setIsProcessing(true);
    try {
        await deleteDoc(doc(firestore, 'employees', employeeToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف الموظف.' });
    } catch(e) {
         toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الموظف.' });
    } finally {
        setIsProcessing(false);
        setEmployeeToDelete(null);
    }
  }


  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center">
            <Input 
                placeholder="ابحث بالاسم، الرقم الوظيفي، أو الرقم المدني..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="max-w-sm"
            />
            <Button asChild>
                <Link href="/dashboard/hr/employees/new">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    إضافة موظف جديد
                </Link>
            </Button>
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>الاسم الكامل</TableHead>
                        <TableHead>الرقم الوظيفي</TableHead>
                        <TableHead>القسم</TableHead>
                        <TableHead>المسمى الوظيفي</TableHead>
                        <TableHead>تاريخ التعيين</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead><span className="sr-only">الإجراءات</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && Array.from({length: 5}).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                    {!loading && filteredEmployees.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                                {searchQuery ? 'لا توجد نتائج مطابقة.' : 'لا يوجد موظفون. قم بإضافة موظف جديد.'}
                            </TableCell>
                        </TableRow>
                    )}
                    {filteredEmployees.map(employee => (
                        <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.fullName}</TableCell>
                            <TableCell>{employee.employeeNumber || '-'}</TableCell>
                            <TableCell>{employee.department}</TableCell>
                            <TableCell>{employee.jobTitle}</TableCell>
                            <TableCell>{formatDate(employee.hireDate)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[employee.status]}>{statusTranslations[employee.status] || employee.status}</Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        <DropdownMenuItem asChild><Link href={`/dashboard/hr/employees/${employee.id}`}><FileText className="ml-2 h-4 w-4"/>عرض الملف</Link></DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/employees/${employee.id}/edit`)}><Pencil className="ml-2 h-4 w-4"/>تعديل</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                         {employee.status === 'active' && (
                                            <DropdownMenuItem onClick={() => setEmployeeToTerminate(employee)} className="text-destructive focus:text-destructive">
                                                <UserX className="ml-2 h-4 w-4" /> إنهاء الخدمة
                                            </DropdownMenuItem>
                                         )}
                                         <DropdownMenuItem onClick={() => setEmployeeToDelete(employee)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="ml-2 h-4 w-4" /> حذف الملف
                                        </DropdownMenuItem>
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
                    <AlertDialogTitle>تأكيد إنهاء الخدمة؟</AlertDialogTitle>
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
                    <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleTermination} disabled={isProcessing || !terminationReason} className="bg-destructive hover:bg-destructive/90">
                        {isProcessing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UserX className="ml-2 h-4 w-4" />}
                        تأكيد الإنهاء
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
            <AlertDialogContent dir="rtl">
                 <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف ملف الموظف "{employeeToDelete?.fullName}" نهائيًا. لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                         {isProcessing ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
