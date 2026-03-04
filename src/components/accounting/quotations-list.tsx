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
import type { Quotation } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Search, User } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { searchQuotations } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';

interface QuotationsListProps {
  searchQuery?: string;
  dateFrom?: Date;
  dateTo?: Date;
  statusFilter?: string;
}

const statusMap: Record<string, { label: string, color: string }> = {
    draft: { label: 'مسودة (Draft)', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    sent: { label: 'مرسل (Sent)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'مقبول (Accepted)', color: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: 'مرفوض (Rejected)', color: 'bg-red-50 text-red-700 border-red-200' },
    expired: { label: 'منتهي (Expired)', color: 'bg-gray-50 text-gray-700 border-gray-200' }
};

export function QuotationsList({ searchQuery, dateFrom, dateTo, statusFilter = 'all' }: QuotationsListProps) {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<Quotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const quotationsQueryConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: quotations, loading, error } = useSubscription<Quotation>(firestore, 'quotations', quotationsQueryConstraints);

  const filteredQuotations = useMemo(() => {
    let results = quotations.filter(quotation => {
        const quotationDate = toFirestoreDate(quotation.date);
        
        const matchesStatus = statusFilter === 'all' || quotation.status === statusFilter;
        let matchesDate = true;
        if (dateFrom && dateTo && quotationDate) {
            matchesDate = quotationDate >= dateFrom && quotationDate <= dateTo;
        }
        
        return matchesStatus && matchesDate;
    });

    if (searchQuery) {
        results = searchQuotations(results, searchQuery);
    }
    return results;
  }, [quotations, searchQuery, dateFrom, dateTo, statusFilter]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'quotations', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف عرض السعر بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف عرض السعر.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>;

  return (
    <div className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
      <Table className="border-separate border-spacing-y-2 px-2">
        <TableHeader className="bg-[#F8F9FE]">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="px-6 py-5 font-black text-[#7209B7] text-right rounded-r-2xl">رقم العرض</TableHead>
            <TableHead className="font-black text-[#7209B7] text-right">العميل</TableHead>
            <TableHead className="font-black text-[#7209B7] text-right">الموضوع</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">التاريخ</TableHead>
            <TableHead className="font-black text-[#7209B7] text-left">الإجمالي</TableHead>
            <TableHead className="font-black text-[#7209B7] text-center">الحالة</TableHead>
            <TableHead className="w-[120px] font-black text-[#7209B7] text-center rounded-l-2xl">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="before:block before:h-2">
            {filteredQuotations.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground opacity-40">
                        لا توجد عروض أسعار مسجلة تطابق البحث.
                    </TableCell>
                </TableRow>
            ) : (
                filteredQuotations.map((quotation) => (
                    <TableRow key={quotation.id} className="group border-none shadow-sm transition-all duration-300 hover:bg-[#F3E8FF]/50 [&:nth-child(even)]:bg-[#F3E8FF]/20">
                        <TableCell className="px-6 py-5 font-mono font-black text-[#7209B7] text-sm rounded-r-2xl">
                            {quotation.quotationNumber}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#F8F9FE] rounded-full group-hover:bg-white transition-colors">
                                    <User className="h-4 w-4 text-[#7209B7]" />
                                </div>
                                <span className="font-black text-[#14453D]">{quotation.clientName}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-bold text-foreground/80">{quotation.subject}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{formatDate(quotation.date)}</TableCell>
                        <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(quotation.totalAmount)}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant="outline" className={cn("font-black px-4 py-1 rounded-full border-2", statusMap[quotation.status]?.color)}>
                                {statusMap[quotation.status]?.label || quotation.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center rounded-l-2xl">
                            <div className="flex items-center justify-center gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-9 w-9 rounded-xl border-2 border-[#7209B7]/20 text-[#7209B7] hover:bg-[#7209B7] hover:text-white transition-all shadow-none" 
                                    asChild
                                >
                                    <Link href={`/dashboard/accounting/quotations/${quotation.id}`}>
                                        <Eye className="h-4 w-4" />
                                    </Link>
                                </Button>
                                {quotation.status === 'draft' && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 rounded-xl border-2 border-[#7209B7]/20 text-[#7209B7] hover:bg-[#7209B7] hover:text-white transition-all shadow-none" 
                                        asChild
                                    >
                                        <Link href={`/dashboard/accounting/quotations/${quotation.id}/edit`}>
                                            <Pencil className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))
            )}
        </TableBody>
      </Table>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف عرض السعر رقم "{itemToDelete?.quotationNumber}" بشكل دائم.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                        {isDeleting ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
