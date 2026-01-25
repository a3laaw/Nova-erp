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
import { useCollection, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { JournalEntry } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { BookOpen, MoreHorizontal, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    posted: 'مرحّل',
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    posted: 'bg-green-100 text-green-800',
};


export function JournalEntriesList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const entriesQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'journalEntries'), orderBy('date', 'desc'));
  }, [firestore]);

  const [snapshot, loading, error] = useCollection(entriesQuery);

  const entries = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
  }, [snapshot]);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      return format(dateValue.toDate(), 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };
  
  const handleDelete = async () => {
    if (!entryToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'journalEntries', entryToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف قيد اليومية بنجاح.' });
    } catch (error) {
        console.error('Error deleting journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف قيد اليومية.' });
    } finally {
        setIsDeleting(false);
        setEntryToDelete(null);
    }
  }

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم القيد</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>البيان</TableHead>
                        <TableHead>الإجمالي</TableHead>
                        <TableHead>الحالة</TableHead>
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
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة القيود.</div>;
  }

  if (entries.length === 0) {
    return (
        <div className="p-8 text-center border-2 border-dashed rounded-lg">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">لا توجد قيود يومية</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                ابدأ بإنشاء قيد يومية جديد ليظهر هنا.
            </p>
        </div>
    );
  }

  return (
    <>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم القيد</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>البيان</TableHead>
                <TableHead className="text-left">الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono">{entry.entryNumber}</TableCell>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.narration}</TableCell>
                  <TableCell className="text-left font-mono">{formatCurrency(entry.totalDebit)}</TableCell>
                  <TableCell>
                      <Badge variant="outline" className={statusColors[entry.status] || ''}>{statusTranslations[entry.status] || entry.status}</Badge>
                  </TableCell>
                   <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" dir="rtl">
                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => { /* router.push(`/dashboard/accounting/journal-entries/${entry.id}`) */ }}>
                                    <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { /* router.push(`/dashboard/accounting/journal-entries/${entry.id}/edit`) */ }}>
                                    <Pencil className="ml-2 h-4 w-4" /> تعديل
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setEntryToDelete(entry)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="ml-2 h-4 w-4" /> حذف
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
            <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف القيد رقم "{entryToDelete?.entryNumber}" بشكل دائم. لا يمكن التراجع عن هذا الإجراء.
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
