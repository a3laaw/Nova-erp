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
import type { CashReceipt } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const paymentMethodTranslations: Record<string, string> = {
    'Cash': 'نقداً',
    'Cheque': 'شيك',
    'Bank Transfer': 'تحويل بنكي',
    'K-Net': 'كي-نت'
};

export function CashReceiptsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [receiptToDelete, setReceiptToDelete] = useState<CashReceipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  const receiptsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cashReceipts'), orderBy('receiptDate', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(receiptsQuery);

  const receipts = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashReceipt));
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
    if (!receiptToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'cashReceipts', receiptToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف سند القبض بنجاح.' });
    } catch (error) {
        console.error('Error deleting cash receipt:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف سند القبض.' });
    } finally {
        setIsDeleting(false);
        setReceiptToDelete(null);
    }
  }

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم السند</TableHead>
                        <TableHead>اسم العميل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>طريقة الدفع</TableHead>
                        <TableHead className="text-left">المبلغ</TableHead>
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

  if (receipts.length === 0) {
    return (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد سندات قبض</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                ابدأ بإنشاء سند قبض جديد ليظهر هنا.
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
                <TableHead>اسم العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((receipt) => (
                <TableRow key={receipt.id}>
                  <TableCell className="font-mono">{receipt.voucherNumber}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/clients/${receipt.clientId}`} className="hover:underline">
                      {receipt.clientNameAr}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(receipt.receiptDate)}</TableCell>
                  <TableCell>
                      <Badge variant="outline">{paymentMethodTranslations[receipt.paymentMethod] || receipt.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell className="text-left font-mono">{formatCurrency(receipt.amount)}</TableCell>
                   <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/cash-receipts/${receipt.id}`)}>
                                    <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/cash-receipts/${receipt.id}/edit`)}>
                                    <Pencil className="ml-2 h-4 w-4" /> تعديل
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setReceiptToDelete(receipt)} className="text-destructive focus:text-destructive">
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
        
         <AlertDialog open={!!receiptToDelete} onOpenChange={() => setReceiptToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف السند رقم "{receiptToDelete?.voucherNumber}" بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
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
