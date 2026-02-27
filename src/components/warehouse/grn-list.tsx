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
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Search, Loader2, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export function GrnList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const queryConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: grns, loading } = useSubscription<any>(firestore, 'grns', queryConstraints);

  const filteredGrns = useMemo(() => {
    if (!grns) return [];
    if (!searchQuery) return grns;
    const lower = searchQuery.toLowerCase();
    return grns.filter(g => 
        g.grnNumber?.toLowerCase().includes(lower) || 
        g.vendorName?.toLowerCase().includes(lower)
    );
  }, [grns, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'grns', itemToDelete.id));
        toast({ title: 'نجاح', description: 'تم حذف إذن الاستلام بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الإذن.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  if (loading && grns.length === 0) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
        </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="ابحث برقم الإذن أو المورد..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم الإذن (GRN)</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>{'عدد الأصناف'}</TableHead>
                        <TableHead className="text-left">إجمالي القيمة</TableHead>
                        <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredGrns.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {loading ? <Loader2 className="animate-spin mx-auto h-6 w-6 text-primary" /> : 'لا توجد أذونات استلام مسجلة.'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredGrns.map((grn) => (
                            <TableRow key={grn.id}>
                                <TableCell className="font-mono font-bold">
                                    <Link href={`/dashboard/warehouse/grns/${grn.id}`} className="text-primary hover:underline">
                                        {grn.grnNumber}
                                    </Link>
                                </TableCell>
                                <TableCell className="font-medium">{grn.vendorName}</TableCell>
                                <TableCell>{formatDate(grn.date)}</TableCell>
                                <TableCell>{grn.itemsReceived?.length || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">
                                    {formatCurrency(grn.totalValue || 0)}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" dir="rtl">
                                            <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouse/grns/${grn.id}`)}>
                                                <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => setItemToDelete(grn)} className="text-destructive">
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
                    <AlertDialogTitle>حذف إذن الاستلام؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف الإذن فقط، ولن يتم التراجع عن الحركات المخزنية أو المحاسبية آلياً. يفضل عمل "تسوية" بدلاً من الحذف.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'جاري الحذف...' : 'نعم، حذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
