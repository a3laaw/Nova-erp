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
import { searchCashReceipts } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';

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
        if (doc.id !== excludeReceiptId) {
            total += doc.data().amount || 0;
        }
    });
    return total;
};


export function CashReceiptsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [receiptToDelete, setReceiptToDelete] = useState<CashReceipt | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');


  const receiptsQueryConstraints = useMemo(() => [orderBy('receiptDate', 'desc')], []);
  const { data: receipts, loading, error } = useSubscription<CashReceipt>(firestore, 'cashReceipts', receiptsQueryConstraints);
  
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
    if (!date) return '-';
    return format(date, 'dd/MM/yyyy');
  };
  
  const handleDelete = async () => {
    if (!receiptToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        const batch = writeBatch(firestore);
        const receiptRef = doc(firestore, 'cashReceipts', receiptToDelete.id!);
        
        if (receiptToDelete.projectId && receiptToDelete.clientId) {
            const projectRef = doc(firestore, 'clients', receiptToDelete.clientId, 'transactions', receiptToDelete.projectId);
            const projectSnap = await getDoc(projectRef);

            if (projectSnap.exists()) {
                const transactionData = projectSnap.data();
                
                const receiptsForProjectQuery = query(collection(firestore, 'cashReceipts'), where('projectId', '==', receiptToDelete.projectId), limit(2));
                const receiptsSnap = await getDocs(receiptsForProjectQuery);
                const isLastReceipt = receiptsSnap.docs.length === 1 && receiptsSnap.docs[0].id === receiptToDelete.id;

                const updates: any = {};

                if (transactionData.contract?.clauses) {
                    const totalPaidAfterDeletion = await getTotalPaidForProject(receiptToDelete.projectId, firestore, receiptToDelete.id!);
                    let accumulatedAmount = 0;
                    let dueClauseFound = false;
                    const updatedClauses = transactionData.contract.clauses.map((clause: any) => {
                        const newClause = { ...clause };
                        if (totalPaidAfterDeletion >= accumulatedAmount + clause.amount) {
                            newClause.status = 'مدفوعة';
                        } else if (totalPaidAfterDeletion > accumulatedAmount && !dueClauseFound) {
                            newClause.status = 'مستحقة';
                            dueClauseFound = true;
                        } else {
                            newClause.status = 'غير مستحقة';
                        }
                        accumulatedAmount += clause.amount;
                        return newClause;
                    });
                    updates['contract.clauses'] = updatedClauses;
                }
                
                if (isLastReceipt) {
                    const currentStages = transactionData.stages || [];
                    const contractStageIndex = currentStages.findIndex((s: any) => s.name === 'توقيع العقد');
                    if (contractStageIndex !== -1 && currentStages[contractStageIndex].status === 'completed') {
                        currentStages[contractStageIndex].status = 'pending';
                        currentStages[contractStageIndex].endDate = null;
                        updates['stages'] = currentStages;
                    }
                }
                
                if (Object.keys(updates).length > 0) {
                    batch.update(projectRef, updates);
                }
            }
        }
        
        batch.delete(receiptRef);
        if (receiptToDelete.journalEntryId) {
            batch.delete(doc(firestore, 'journalEntries', receiptToDelete.journalEntryId));
        }

        await batch.commit();

        toast({ title: 'نجاح', description: 'تم حذف سند القبض والقيد المرتبط به.' });
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
                            placeholder="رقم السند, اسم العميل, المبلغ..."
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
                <TableHead>رقم السند</TableHead>
                <TableHead>اسم العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead className="text-left">المبلغ</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {receipts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6}>
                            <div className="p-8 text-center border-2 border-dashed rounded-lg">
                                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">لا توجد سندات قبض</h3>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    ابدأ بإنشاء سند قبض جديد ليظهر هنا.
                                </p>
                            </div>
                        </TableCell>
                    </TableRow>
                ) : filteredReceipts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            لا توجد نتائج تطابق بحثك.
                        </TableCell>
                    </TableRow>
                ) : (
                    filteredReceipts.map((receipt) => (
                        <TableRow key={receipt.id}>
                        <TableCell className="font-mono">
                            <Link href={`/dashboard/accounting/cash-receipts/${receipt.id}`} className="hover:underline text-primary">
                                {receipt.voucherNumber}
                            </Link>
                        </TableCell>
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
                    ))
                )}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!receiptToDelete} onOpenChange={() => setReceiptToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف السند رقم "{receiptToDelete?.voucherNumber}" والقيد المحاسبي المرتبط به بشكل دائم. سيؤثر هذا على حالة دفعات العقد المرتبط.
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
