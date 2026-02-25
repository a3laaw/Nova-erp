
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
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { format } from 'date-fns';
import { FileText, MoreHorizontal, Eye, Trash2, Search, ClipboardList } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { searchRfqs } from '@/lib/cache/fuse-search';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    sent: 'bg-blue-100 text-blue-800 border-blue-200',
    closed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل للموردين',
    closed: 'مغلق للمقارنة',
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
    return searchRfqs(rfqs, searchQuery);
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
        <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
    );
  }
  
  if (error) return <div className="text-center py-10 text-destructive font-bold">فشل تحميل قائمة طلبات التسعير.</div>;

  return (
    <>
        <div className="flex items-center mb-6">
             <div className="relative w-full max-w-md">
                <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ابحث برقم الطلب (مثال: RFQ-2024)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rtl:pr-10 h-11 rounded-xl shadow-sm"
                />
            </div>
        </div>

        <div className="border rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-1/4">رقم الطلب</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead className="text-center">الموردين</TableHead>
                <TableHead className="text-center">الأصناف</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[100px] text-center">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {rfqs.length === 0 ? (
                     <TableRow>
                        <TableCell colSpan={6}>
                            <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/10 m-4">
                                <ClipboardList className="mx-auto h-16 w-16 text-muted-foreground/30" />
                                <h3 className="mt-4 text-xl font-black">لا توجد طلبات تسعير بعد</h3>
                                <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto">
                                    ابدأ بإنشاء طلب تسعير جديد لإرساله لمورديك والمفاضلة بين أسعارهم.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : filteredRfqs.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-bold">
                            لا توجد نتائج تطابق بحثك الحالي.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredRfqs.map((rfq) => (
                        <TableRow key={rfq.id} className="group hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono font-bold text-primary">
                                <Link href={`/dashboard/purchasing/rfqs/${rfq.id}`} className="hover:underline">
                                    {rfq.rfqNumber}
                                </Link>
                            </TableCell>
                            <TableCell className="font-medium text-foreground/70">{formatDate(rfq.date)}</TableCell>
                            <TableCell className="text-center"><Badge variant="secondary">{rfq.vendorIds?.length || 0}</Badge></TableCell>
                            <TableCell className="text-center"><Badge variant="outline">{rfq.items?.length || 0}</Badge></TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn("px-2 font-bold", statusColors[rfq.status])}>{statusTranslations[rfq.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>خيارات الطلب</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/purchasing/rfqs/${rfq.id}`)}>
                                            <Eye className="ml-2 h-4 w-4"/> إدارة العروض
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setItemToDelete(rfq)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                            <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب
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
                    <AlertDialogTitle className="text-destructive font-black text-xl">تأكيد حذف طلب التسعير؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف الطلب رقم <span className="font-bold text-foreground">"{itemToDelete?.rfqNumber}"</span> وكافة عروض الأسعار المرتبطة به نهائياً.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting} className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                        {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
