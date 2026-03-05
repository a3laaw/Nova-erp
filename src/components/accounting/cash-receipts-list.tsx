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
import { collection, query, orderBy, doc, deleteDoc, writeBatch, getDoc, updateDoc, where, getDocs, limit } from 'firebase/firestore';
import type { CashReceipt } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { MoreHorizontal, Eye, Pencil, Trash2, Loader2, Search } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { searchCashReceipts } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '../ui/date-input';

const paymentMethodTranslations: Record<string, string> = {
    'Cash': 'نقداً',
    'Cheque': 'شيك',
    'Bank Transfer': 'تحويل بنكي',
    'K-Net': 'كي-نت'
};

const getTotalPaidForProject = async (projectId: string, db: any, excludeReceiptId?: string) => {
    let total = 0;
    if (!projectId || !db) return total;
    const receiptsQuery = query(collection(db, 'cashReceipts'), where('projectId', '==', projectId));
    const receiptsSnap = await getDocs(receiptsQuery);
    receiptsSnap.forEach(doc => {
        if (doc.id !== excludeReceiptId) total += doc.data().amount || 0;
    });
    return total;
};

export function CashReceiptsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [receiptToDelete, setReceiptToDelete] = useState<CashReceipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const receiptsQueryConstraints = useMemo(() => [orderBy('receiptDate', 'desc')], []);
  const { data: receipts, loading } = useSubscription<CashReceipt>(firestore, 'cashReceipts', receiptsQueryConstraints);
  
  const filteredReceipts = useMemo(() => {
    const dateFiltered = receipts.filter(receipt => {
        const receiptDate = toFirestoreDate(receipt.receiptDate);
        if (!dateFrom && !dateTo) return true;
        if (!receiptDate) return false;
        const matchesDateFrom = !dateFrom || (receiptDate >= new Date(new Date(dateFrom).setHours(0, 0, 0, 0)));
        const matchesDateTo = !dateTo || (receiptDate <= new Date(new Date(dateTo).setHours(23, 59, 59, 999)));
        return matchesDateFrom && matchesDateTo;
    });
    return searchCashReceipts(dateFiltered, searchQuery);
  }, [receipts, searchQuery, dateFrom, dateTo]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };
  
  const handleDelete = async () => {
    if (!receiptToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        const receiptRef = doc(firestore, 'cashReceipts', receiptToDelete.id!);
        batch.delete(receiptRef);
        if (receiptToDelete.journalEntryId) batch.delete(doc(firestore, 'journalEntries', receiptToDelete.journalEntryId));
        await batch.commit();
        toast({ title: 'نجاح', description: 'تم حذف سند القبض والقيد المرتبط به.' });
    } finally { setIsDeleting(false); setReceiptToDelete(null); }
  }

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
            <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="رقم السند أو العميل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
                />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <DateInput value={dateFrom} onChange={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')} className="w-40 h-9 text-xs" placeholder="من تاريخ"/>
                <DateInput value={dateTo} onChange={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')} className="w-40 h-9 text-xs" placeholder="إلى تاريخ"/>
            </div>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
          <Table>
            <TableHeader className="bg-[#F8F9FE]">
              <TableRow className="border-none">
                <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم السند</TableHead>
                <TableHead className="font-black text-[#7209B7]">العميل</TableHead>
                <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                <TableHead className="font-black text-[#7209B7]">الطريقة</TableHead>
                <TableHead className="text-left font-black text-[#7209B7]">المبلغ</TableHead>
                <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredReceipts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold">لا توجد سندات قبض مسجلة.</TableCell></TableRow>
                ) : (
                    filteredReceipts.map((receipt) => (
                        <TableRow key={receipt.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                            <TableCell className="px-8 font-mono font-black text-primary">
                                <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}`} className="hover:underline">{receipt.voucherNumber}</Link>
                            </TableCell>
                            <TableCell className="font-black text-gray-800">{receipt.clientNameAr}</TableCell>
                            <TableCell className="font-bold text-xs opacity-60">{formatDate(receipt.receiptDate)}</TableCell>
                            <TableCell><Badge variant="outline" className="px-3 font-black text-[10px] bg-sky-50 text-sky-700">{paymentMethodTranslations[receipt.paymentMethod] || receipt.paymentMethod}</Badge></TableCell>
                            <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(receipt.amount)}</TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/cash-receipts/${receipt.id}`)}><Eye className="ml-2 h-4 w-4" /> عرض</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/cash-receipts/${receipt.id}/edit`)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setReceiptToDelete(receipt)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!receiptToDelete} onOpenChange={() => setReceiptToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف السند رقم "{receiptToDelete?.voucherNumber}" نهائياً.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive rounded-xl">نعم، حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
