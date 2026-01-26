'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { PaymentVoucher } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export function PaymentVouchersList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [voucherToDelete, setVoucherToDelete] = useState<PaymentVoucher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const vouchersQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'paymentVouchers'), orderBy('paymentDate', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(vouchersQuery);

  const vouchers = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentVoucher));
  }, [snapshot]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      return format(dateValue.toDate(), 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };
  
  const handleDelete = async () => {
    if (!voucherToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'paymentVouchers', voucherToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف سند الصرف بنجاح.' });
    } catch (error) {
        console.error('Error deleting payment voucher:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف سند الصرف.' });
    } finally {
        setIsDeleting(false);
        setVoucherToDelete(null);
    }
  }

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم السند</TableHead>
                        <TableHead>اسم المستفيد</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }
  
  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة السندات.</div>;
  }

  if (vouchers.length === 0) {
    return (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد سندات صرف</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                ابدأ بإنشاء سند صرف جديد ليظهر هنا.
            </p>
        </div>
    );
  }

  return (
    <>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم السند</TableHead>
                <TableHead>اسم المستفيد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vouchers.map((voucher) => (
                <TableRow key={voucher.id}>
                  <TableCell className="font-mono">{voucher.voucherNumber}</TableCell>
                  <TableCell>{voucher.payeeName}</TableCell>
                  <TableCell>{formatDate(voucher.paymentDate)}</TableCell>
                  <TableCell className="font-mono">{formatCurrency(voucher.amount)}</TableCell>
                  <TableCell>
                      <Badge variant="outline">{voucher.status}</Badge>
                  </TableCell>
                   <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { /*router.push(`/dashboard/accounting/payment-vouchers/${voucher.id}`)*/ }}>
                                    <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { /*router.push(`/dashboard/accounting/payment-vouchers/${voucher.id}/edit`)*/ }}>
                                    <Pencil className="ml-2 h-4 w-4" /> تعديل
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setVoucherToDelete(voucher)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="ml-2 h-4 w-4" /> حذف
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!voucherToDelete} onOpenChange={() => setVoucherToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف السند رقم "{voucherToDelete?.voucherNumber}" بشكل دائم.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? <><Loader2 className="ml-2 h-4 w-4 animate-spin"/> جاري الحذف...</> : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
