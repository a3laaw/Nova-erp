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
import { useSubscription, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { Quotation } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { searchQuotations } from '@/lib/cache/fuse-search';

const statusTranslations: Record<Quotation['status'], string> = {
    draft: 'مسودة',
    sent: 'تم الإرسال',
    accepted: 'مقبول',
    rejected: 'مرفوض',
    expired: 'منتهي الصلاحية'
};

const statusColors: Record<Quotation['status'], string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-800'
};

export function QuotationsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<Quotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const quotationsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'quotations'), orderBy('date', 'desc'));
  }, [firestore]);

  const { data: quotations, loading, error } = useSubscription<Quotation>(firestore, 'quotations', quotationsQuery ? [orderBy('date', 'desc')] : []);

  const filteredQuotations = useMemo(() => {
    const dateFiltered = quotations.filter(quotation => {
      const quotationDate = quotation.date?.toDate ? quotation.date.toDate() : null;
      if (!quotationDate) return false;
      const matchesDateFrom = !dateFrom || (quotationDate >= new Date(new Date(dateFrom).setHours(0, 0, 0, 0)));
      const matchesDateTo = !dateTo || (quotationDate <= new Date(new Date(dateTo).setHours(23, 59, 59, 999)));
      return matchesDateFrom && matchesDateTo;
    });
    return searchQuotations(dateFiltered, searchQuery);
  }, [quotations, searchQuery, dateFrom, dateTo]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      return format(dateValue.toDate(), 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'quotations', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف عرض السعر بنجاح.' });
    } catch (error) {
        console.error('Error deleting quotation:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف عرض السعر.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  }

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم العرض</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الإجمالي</TableHead>
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
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة عروض الأسعار.</div>;
  }

  return (
    <>
        <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="grid gap-2 md:col-span-1">
                    <Label htmlFor="search">بحث ذكي</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="search"
                            placeholder="رقم العرض, اسم العميل, الموضوع..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="dateFrom">من تاريخ</Label>
                    <Input 
                        id="dateFrom"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="dateTo">إلى تاريخ</Label>
                    <Input 
                        id="dateTo"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                    />
                </div>
            </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم العرض</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-left">الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {quotations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6}>
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا توجد عروض أسعار</h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    ابدأ بإنشاء عرض سعر جديد ليظهر هنا.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : filteredQuotations.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            لا توجد نتائج تطابق بحثك.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredQuotations.map((quotation) => (
                        <TableRow key={quotation.id}>
                        <TableCell className="font-mono">{quotation.quotationNumber}</TableCell>
                        <TableCell>
                            <Link href={`/dashboard/clients/${quotation.clientId}`} className="hover:underline">
                            {quotation.clientName}
                            </Link>
                        </TableCell>
                        <TableCell>{formatDate(quotation.date)}</TableCell>
                        <TableCell className="text-left font-mono">{formatCurrency(quotation.totalAmount)}</TableCell>
                        <TableCell><Badge variant="outline" className={statusColors[quotation.status]}>{statusTranslations[quotation.status]}</Badge></TableCell>
                        <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}`)}>
                                            <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                        </DropdownMenuItem>
                                        {quotation.status === 'draft' && (
                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)}>
                                                <Pencil className="ml-2 h-4 w-4" /> تعديل
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setItemToDelete(quotation)} className="text-destructive focus:text-destructive">
                                            <Trash2 className="ml-2 h-4 w-4" /> حذف
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف عرض السعر رقم "{itemToDelete?.quotationNumber}" بشكل دائم.
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

    