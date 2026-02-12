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
import { useFirebase } from '@/firebase';
import { useSubscription } from '@/hooks/use-subscription';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { format } from 'date-fns';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Search } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل',
    closed: 'مغلق',
    cancelled: 'ملغي',
};

export function RfqsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<RequestForQuotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const rfqQueryConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: rfqs, loading, error } = useSubscription<RequestForQuotation>(firestore, 'rfqs', rfqQueryConstraints);

  const filteredRfqs = useMemo(() => {
    if (!searchQuery) return rfqs;
    return rfqs.filter(rfq => 
        rfq.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        statusTranslations[rfq.status]?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [rfqs, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    if (!date) return '-';
    return format(date, 'dd/MM/yyyy');
  };
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'rfqs', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف طلب التسعير بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف طلب التسعير.' });
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
                        <TableHead>رقم الطلب</TableHead>
                        <TableHead>التاريخ</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }
  
  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة طلبات التسعير.</div>;
  }

  return (
    <>
        <div className="flex items-center mb-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث برقم الطلب أو الحالة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10"
                />
            </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>عدد الموردين</TableHead>
                <TableHead>عدد الأصناف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {rfqs.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={6}>
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا توجد طلبات تسعير</h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    ابدأ بإنشاء طلب جديد ليظهر هنا.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : filteredRfqs.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            لا توجد نتائج تطابق بحثك.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredRfqs.map((rfq) => (
                        <TableRow key={rfq.id}>
                            <TableCell className="font-mono">
                                <Link href={`/dashboard/purchasing/rfqs/${rfq.id}`} className="hover:underline text-primary">
                                    {rfq.rfqNumber}
                                </Link>
                            </TableCell>
                            <TableCell>{formatDate(rfq.date)}</TableCell>
                            <TableCell className="text-center">{rfq.vendorIds?.length || 0}</TableCell>
                            <TableCell className="text-center">{rfq.items?.length || 0}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[rfq.status]}>{statusTranslations[rfq.status]}</Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/purchasing/rfqs/${rfq.id}`)}>
                                            <Eye className="ml-2 h-4 w-4"/> عرض ومقارنة
                                        </DropdownMenuItem>
                                        <DropdownMenuItem disabled>
                                            <Pencil className="ml-2 h-4 w-4"/> تعديل
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setItemToDelete(rfq)} className="text-destructive focus:text-destructive">
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
                    <AlertDialogDescription>سيتم حذف الطلب رقم "{itemToDelete?.rfqNumber}" بشكل دائم.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
