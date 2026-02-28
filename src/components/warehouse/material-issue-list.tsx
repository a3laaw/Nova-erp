
'use client';

import { useMemo, useState, useEffect } from 'react';
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
import { collection, getDocs, orderBy, where, doc, deleteDoc } from 'firebase/firestore';
import type { InventoryAdjustment, JournalEntry } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, Loader2, MoreHorizontal, Eye, Trash2, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export function MaterialIssueList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const issueQuery = useMemo(() => [
    where('type', '==', 'material_issue'),
    orderBy('date', 'desc')
  ], []);

  const { data: issues, loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', issueQuery);

  const { data: journalEntries } = useSubscription<JournalEntry>(firestore, 'journalEntries');
  const existingJeIds = useMemo(() => new Set(journalEntries.map(d => d.id)), [journalEntries]);

  const filteredIssues = useMemo(() => {
    if (!issues) return [];
    if (!searchQuery) return issues;
    const lower = searchQuery.toLowerCase();
    return issues.filter(i => 
        i.adjustmentNumber?.toLowerCase().includes(lower) || 
        i.notes?.toLowerCase().includes(lower)
    );
  }, [issues, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'inventoryAdjustments', itemToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف إذن الصرف بنجاح.' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف الإذن.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  };

  if (loading && issues.length === 0) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
        <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="ابحث برقم الإذن أو الملاحظات..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم الإذن</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>عدد الأصناف</TableHead>
                        <TableHead className="text-left">القيمة المصروفة</TableHead>
                        <TableHead>الملاحظات</TableHead>
                        <TableHead className="w-[80px]"><span className="sr-only">الإجراءات</span></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredIssues.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                {loading ? <Loader2 className="animate-spin mx-auto h-6 w-6 text-primary" /> : 'لا توجد أذونات صرف مسجلة.'}
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredIssues.map((issue) => {
                            const hasIntegrityError = !issue.journalEntryId || !existingJeIds.has(issue.journalEntryId);
                            return (
                                <TableRow key={issue.id} className={cn(hasIntegrityError && "bg-red-50/30 hover:bg-red-50/50")}>
                                    <TableCell className="font-mono font-bold text-primary">
                                        <div className="flex items-center gap-2">
                                            {hasIntegrityError && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <AlertCircle className="h-4 w-4 text-red-600" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>خلل مالي: لا يوجد قيد تكلفة مرتبط بهذا الصرف.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            <Link href={`/dashboard/warehouse/material-issue/${issue.id}`} className="hover:underline">
                                                {issue.adjustmentNumber}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell>{formatDate(issue.date)}</TableCell>
                                    <TableCell>{issue.items?.length || 0}</TableCell>
                                    <TableCell className="text-left font-mono font-semibold">
                                        {formatCurrency(issue.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{issue.notes || '-'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" dir="rtl">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/warehouse/material-issue/${issue.id}`)}>
                                                    <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setItemToDelete(issue)} className="text-destructive">
                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>

        <AlertDialog open={!!itemToDelete} onOpenChange={() => setItemToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد حذف إذن الصرف؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف سجل إذن الصرف من النظام. يرجى التأكد من أن هذا الإجراء لا يؤثر على موازنة المشروع.</AlertDialogDescription>
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
