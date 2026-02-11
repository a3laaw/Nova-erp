'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirebase, useSubscription } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, writeBatch, doc, getDocs, limit, deleteDoc } from 'firebase/firestore';
import type { Employee } from '@/lib/types';
import { Loader2, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';

function TerminatedEmployeesManager() {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const terminatedEmployeesQuery = useMemo(() => {
    if (!firestore) return null;
    return [where('status', '==', 'terminated')];
  }, [firestore]);
  
  const { data: terminatedEmployees, loading } = useSubscription<Employee>(firestore, 'employees', terminatedEmployeesQuery || []);

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };
  
  const handleConfirmDelete = async () => {
    if (!firestore || !employeeToDelete) return;
    setIsProcessing(true);
    try {
        const batch = writeBatch(firestore);
        
        const employeeRef = doc(firestore, 'employees', employeeToDelete.id!);
        batch.delete(employeeRef);

        const usersQuery = query(collection(firestore, 'users'), where('employeeId', '==', employeeToDelete.id!), limit(1));
        const userSnap = await getDocs(usersQuery);
        if (!userSnap.empty) {
            const userDocRef = userSnap.docs[0].ref;
            batch.delete(userDocRef);
        }

        await batch.commit();
        toast({ title: 'نجاح', description: `تم حذف الموظف "${employeeToDelete.fullName}" وبياناته بشكل نهائي.` });

    } catch(e) {
        console.error(e);
        toast({variant: 'destructive', title: 'خطأ', description: 'فشل حذف الموظف بشكل نهائي.'});
    } finally {
        setIsProcessing(false);
        setEmployeeToDelete(null);
    }
  };

  return (
    <div className="space-y-4">
        <h3 className="font-semibold">إدارة الموظفين المنتهية خدماتهم</h3>
        <p className="text-sm text-muted-foreground">
            هذه القائمة تعرض الموظفين الذين تم إنهاء خدمتهم فقط. يمكنك حذف بياناتهم بشكل نهائي من النظام من هنا.
        </p>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>الاسم</TableHead>
                        <TableHead>الرقم الوظيفي</TableHead>
                        <TableHead>تاريخ إنهاء الخدمة</TableHead>
                        <TableHead className="text-left"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && <TableRow><TableCell colSpan={4} className="text-center p-4"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>}
                    {!loading && terminatedEmployees.length === 0 && <TableRow><TableCell colSpan={4} className="text-center h-24">لا يوجد موظفون منتهية خدماتهم حاليًا.</TableCell></TableRow>}
                    {!loading && terminatedEmployees.map(emp => (
                        <TableRow key={emp.id}>
                            <TableCell>{emp.fullName}</TableCell>
                            <TableCell>{emp.employeeNumber}</TableCell>
                            <TableCell>{emp.terminationDate ? format(toFirestoreDate(emp.terminationDate)!, 'dd/MM/yyyy') : '-'}</TableCell>
                            <TableCell className="text-left">
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteClick(emp)}>
                                    <Trash2 className="ml-2 h-4 w-4"/> حذف نهائي
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من رغبتك في حذف بيانات الموظف "{employeeToDelete?.fullName}" بشكل نهائي؟ سيتم حذف ملفه وحسابه من النظام ولا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmDelete} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                        {isProcessing ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحذف...</> : 'نعم، قم بالحذف النهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

// Main Component
export function DataIntegrityManager() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>أداة سلامة البيانات</CardTitle>
                <CardDescription>
                    أدوات متقدمة لفحص وتصحيح وحذف البيانات في النظام لضمان الدقة الكاملة. استخدمها بحذر.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <TerminatedEmployeesManager />
            </CardContent>
        </Card>
    );
}