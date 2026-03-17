
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
import { orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { CustodyReconciliation } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Eye, MoreHorizontal, Trash2, Loader2, Search, Wallet, CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
    pending: 'بانتظار المراجعة',
    approved: 'تم الاعتماد والترحيل',
    rejected: 'مرفوضة',
};

export function CustodyReconciliationList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<CustodyReconciliation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: reconciliations, loading } = useSubscription<CustodyReconciliation>(
    firestore, 
    'custody_reconciliations', 
    [orderBy('createdAt', 'desc')]
  );

  const filteredItems = useMemo(() => {
    if (!reconciliations) return [];
    if (!searchQuery) return reconciliations;
    const lower = searchQuery.toLowerCase();
    return reconciliations.filter(r => 
        r.reconciliationNumber.toLowerCase().includes(lower) || 
        r.employeeName.toLowerCase().includes(lower)
    );
  }, [reconciliations, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'custody_reconciliations', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف طلب التسوية بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الطلب.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  if (loading && reconciliations.length === 0) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
        <div className="relative max-w-sm no-print">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
            <Input 
                placeholder="رقم التسوية أو اسم الموظف..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl border-2"
            />
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl">
            <Table>
                <TableHeader className="bg-muted/50 h-14">
                    <TableRow className="border-none">
                        <TableHead className="px-8 font-black text-[#7209B7]">رقم التسوية</TableHead>
                        <TableHead className="font-black text-[#7209B7]">الموظف</TableHead>
                        <TableHead className="font-black text-[#7209B7]">تاريخ التقديم</TableHead>
                        <TableHead className="text-left font-black text-[#7209B7]">المبلغ الإجمالي</TableHead>
                        <TableHead className="font-black text-[#7209B7]">حالة المراجعة</TableHead>
                        <TableHead className="w-[80px] text-center"><span className="sr-only">إجراء</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredItems.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic font-bold">
                                لا توجد طلبات تسوية معلقة حالياً.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredItems.map((item) => (
                            <TableRow key={item.id} className="hover:bg-[#F3E8FF]/20 h-16 group transition-colors">
                                <TableCell className="px-8 font-mono font-black text-primary">
                                    <Link href={`/dashboard/hr/custody-reconciliation/${item.id}`} className="hover:underline">
                                        {item.reconciliationNumber}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-black text-gray-800">{item.employeeName}</TableCell>
                                <TableCell className="font-bold text-xs opacity-60">{formatDate(item.createdAt)}</TableCell>
                                <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(item.totalAmount)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[item.status])}>
                                        {statusTranslations[item.status]}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20 transition-all">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                            <DropdownMenuLabel>إجراءات المراجعة</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/hr/custody-reconciliation/${item.id}`)}>
                                                <Eye className="ml-2 h-4 w-4" />
                                                {item.status === 'pending' ? 'مراجعة وربط محاسبي' : 'عرض التفاصيل'}
                                            </DropdownMenuItem>
                                            {item.status === 'pending' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onClick={() => setItemToDelete(item)} className="text-destructive">
                                                        <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب
                                                    </DropdownMenuItem>
                                                </>
                                            )}
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
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف طلب التسوية "{itemToDelete?.reconciliationNumber}" نهائياً من النظام.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black">
                        {isDeleting ? <Loader2 className="animate-spin ml-2 h-4 w-4"/> : 'نعم، حذف الطلب'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
