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
import { collection, query, orderBy, doc, deleteDoc, writeBatch, where, getDocs, updateDoc } from 'firebase/firestore';
import type { CashReceipt } from '@/lib/types';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { MoreHorizontal, Eye, Pencil, Trash2, Search, ArrowDownLeft, User, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { searchCashReceipts } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '../ui/date-input';
import { useAuth } from '@/context/auth-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const paymentMethodTranslations: Record<string, string> = {
    'Cash': 'نقداً',
    'Cheque': 'شيك',
    'Bank Transfer': 'تحويل بنكي',
    'K-Net': 'كي-نت'
};

export function CashReceiptsList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const tenantId = currentUser?.currentCompanyId;
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
    if (!receiptToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    
    const receiptPath = getTenantPath(`cashReceipts/${receiptToDelete.id}`, tenantId);
    const batch = writeBatch(firestore);
    batch.delete(doc(firestore, receiptPath!));

    if (receiptToDelete.journalEntryId) {
        const jePath = getTenantPath(`journalEntries/${receiptToDelete.journalEntryId}`, tenantId);
        batch.delete(doc(firestore, jePath!));
    }

    batch.commit()
      .then(() => {
        toast({ title: 'نجاح التطهير', description: 'تم حذف سند القبض والقيد المحاسبي المرتبط به نهائياً.' });
      })
      .catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: receiptPath!,
            operation: 'delete'
        }));
      })
      .finally(() => {
        setIsDeleting(false);
        setReceiptToDelete(null);
      });
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
            <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="رقم السند أو اسم العميل..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-black"
                />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <DateInput value={dateFrom ? new Date(dateFrom) : undefined} onChange={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')} className="w-40 h-9 text-xs" placeholder="من تاريخ"/>
                <DateInput value={dateTo ? new Date(dateTo) : undefined} onChange={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')} className="w-40 h-9 text-xs" placeholder="إلى تاريخ"/>
            </div>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
          <Table>
            <TableHeader className="bg-[#F8F9FE]">
              <TableRow className="border-none">
                <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم السند</TableHead>
                <TableHead className="font-black text-[#7209B7]">الطرف المسدد</TableHead>
                <TableHead className="font-black text-[#7209B7]">تاريخ التحصيل</TableHead>
                <TableHead className="font-black text-[#7209B7]">طريقة الدفع</TableHead>
                <TableHead className="text-left font-black text-[#7209B7]">القيمة الإجمالية</TableHead>
                <TableHead className="text-center font-black text-[#7209B7]">تحكم</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredReceipts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-black italic">لا توجد سندات قبض مسجلة للفترة المحددة.</TableCell></TableRow>
                ) : (
                    filteredReceipts.map((receipt) => (
                        <TableRow key={receipt.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16 border-b last:border-0">
                            <TableCell className="px-8 font-mono font-black text-primary">
                                <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}`} className="hover:underline">{receipt.voucherNumber}</Link>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#F8F9FE] rounded-full group-hover:bg-white transition-colors">
                                        <User className="h-4 w-4 text-[#7209B7]" />
                                    </div>
                                    {receipt.clientId ? (
                                        <Link href={`/dashboard/clients/${receipt.clientId}`} className='font-black text-gray-800 hover:underline'>
                                            {receipt.clientNameAr}
                                        </Link>
                                    ) : (
                                        <span className="font-black text-gray-800">{receipt.clientNameAr}</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="font-bold text-xs opacity-60">{formatDate(receipt.receiptDate)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className="px-3 font-black text-[10px] bg-white border-primary/20 text-primary">
                                    {paymentMethodTranslations[receipt.paymentMethod] || receipt.paymentMethod}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(receipt.amount)}</TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-2xl p-2 shadow-2xl border-none bg-white">
                                        <DropdownMenuLabel className="font-black px-3 py-2 text-[#1e1b4b]">خيارات السند</DropdownMenuLabel>
                                        <DropdownMenuItem asChild className="rounded-xl py-3 cursor-pointer font-bold gap-3">
                                            <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}`} className="flex items-center gap-2">
                                                <Eye className="h-4 w-4 text-primary" /> عرض السند والطباعة
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild className="rounded-xl py-3 cursor-pointer font-bold gap-3">
                                            <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}/edit`} className="flex items-center gap-2">
                                                <Pencil className="h-4 w-4 text-primary" /> تعديل البيانات
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-slate-100" />
                                        <DropdownMenuItem onClick={() => setReceiptToDelete(receipt)} className="text-red-600 font-black rounded-xl py-3 cursor-pointer gap-3 focus:bg-red-50">
                                            <Trash2 className="ml-2 h-4 w-4" /> حذف السند نهائياً
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
        
         <AlertDialog open={!!receiptToDelete} onOpenChange={() => setReceiptToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-8 w-8"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        سيتم حذف السند رقم <strong className="text-foreground">"{receiptToDelete?.voucherNumber}"</strong> وكافة قيوده المحاسبية المرتبطة. هذا الإجراء سيؤثر على ميزان المراجعة ومديونية العميل.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                        {isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
