'use client';

import { useMemo, useState, useCallback } from 'react';
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
import { doc, deleteDoc, orderBy } from 'firebase/firestore';
import type { Quotation } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { FileText, Eye, Pencil, Trash2, User, MoreHorizontal, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from '../ui/dropdown-menu';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { searchQuotations } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';
import { useAuth } from '@/context/auth-context';

const statusMap: Record<string, { label: string, color: string }> = {
    draft: { label: 'مسودة', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    sent: { label: 'مرسل', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'مقبول / عقد مبرم', color: 'bg-green-50 text-green-700 border-green-200' },
    rejected: { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200' },
    expired: { label: 'منتهي', color: 'bg-gray-50 text-gray-700 border-gray-200' }
};

export function QuotationsList({ searchQuery, dateFrom, dateTo, statusFilter = 'all' }: any) {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [itemToDelete, setItemToDelete] = useState<Quotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const tenantId = currentUser?.currentCompanyId;

  const { data: quotations, loading } = useSubscription<Quotation>(firestore, 'quotations', [orderBy('date', 'desc')]);

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

    if (searchQuery) results = searchQuotations(results, searchQuery);
    return results;
  }, [quotations, searchQuery, dateFrom, dateTo, statusFilter]);

  const formatDate = useCallback((dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  }, []);
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    try {
        const finalPath = getTenantPath(`quotations/${itemToDelete.id}`, tenantId);
        await deleteDoc(doc(firestore, finalPath!));
        toast({ title: 'نجاح الحفظ', description: 'تم مسح عرض السعر نهائياً من السجلات.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف عرض السعر.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-16 w-full rounded-2xl" /><Skeleton className="h-16 w-full rounded-2xl" /></div>;

  return (
    <div className="rounded-[2rem] border-none shadow-sm overflow-hidden bg-white">
      <Table className="border-separate border-spacing-y-2 px-2">
        <TableHeader className="bg-[#F8F9FE]">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className="px-8 py-5 font-black text-[#7209B7] text-right rounded-r-2xl">رقم العرض</TableHead>
            <TableHead className="font-black text-[#7209B7] text-right">المالك / العميل</TableHead>
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
                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground opacity-40 font-bold italic">لا توجد عروض أسعار مسجلة.</TableCell>
                </TableRow>
            ) : (
                filteredQuotations.map((quotation) => (
                    <TableRow key={quotation.id} className="group border-none shadow-sm transition-all duration-300 hover:bg-[#F3E8FF]/20">
                        <TableCell className="px-8 py-5 font-mono font-black text-[#7209B7] text-sm rounded-r-2xl">
                            <Link href={`/dashboard/accounting/quotations/${quotation.id}`} className='hover:underline'>{quotation.quotationNumber}</Link>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#F8F9FE] rounded-full group-hover:bg-white transition-colors">
                                    <User className="h-4 w-4 text-[#7209B7]" />
                                </div>
                                <span className="font-black text-gray-800">{quotation.clientName}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-bold text-gray-600">{quotation.subject}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{formatDate(quotation.date)}</TableCell>
                        <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(quotation.totalAmount)}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant="outline" className={cn("font-black px-4 py-1 rounded-full border-2", statusMap[quotation.status]?.color)}>
                                {statusMap[quotation.status]?.label || quotation.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center rounded-l-2xl">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl border bg-slate-50 transition-all">
                                        <MoreHorizontal className="h-4 w-4"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" dir="rtl" className="rounded-xl p-2 shadow-2xl border-none bg-white">
                                    <DropdownMenuLabel className="font-black px-3 py-2 text-xs text-slate-400 uppercase tracking-widest">خيارات العرض</DropdownMenuLabel>
                                    
                                    <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer">
                                        <Eye className="h-4 w-4 text-primary"/> عرض وتصدير PDF
                                    </DropdownMenuItem>

                                    {quotation.status !== 'accepted' && (
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/quotations/${quotation.id}/edit`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer">
                                            <Pencil className="h-4 w-4 text-primary"/> تعديل البيانات
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator className="bg-slate-100" />
                                    
                                    <DropdownMenuItem 
                                        onClick={() => setItemToDelete(quotation)} 
                                        className="text-red-600 font-black rounded-lg py-3 gap-3 cursor-pointer focus:bg-red-50"
                                    >
                                        <Trash2 className="ml-2 h-4 w-4" /> حذف العرض نهائياً
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))
            )}
        </TableBody>
      </Table>

      <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-4 bg-red-100 rounded-3xl w-fit mb-4 shadow-inner"><Trash2 className="h-10 w-10 text-red-600"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700 tracking-tighter">تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        سيتم مسح عرض السعر رقم <strong className="text-foreground">"{itemToDelete?.quotationNumber}"</strong> نهائياً من السجلات. لا يمكن التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-10 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">إلغاء</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDelete} 
                        disabled={isDeleting} 
                        className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200 min-w-[180px]"
                    >
                        {isDeleting ? <Loader2 className="h-5 w-5 animate-spin"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
