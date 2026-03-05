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
import { collection, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { JournalEntry } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency, cn } from '@/lib/utils';
import { BookOpen, MoreHorizontal, Eye, Pencil, Trash2, Loader2, CheckCircle, Undo2, Search, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import Link from 'next/link';
import { searchJournalEntries } from '@/lib/cache/fuse-search';
import { toFirestoreDate } from '@/services/date-converter';
import { DateInput } from '../ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    posted: 'مرحّل',
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    posted: 'bg-green-100 text-green-800 border-green-200',
};

export function JournalEntriesList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isUnposting, setIsUnposting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entryTypeFilter, setEntryTypeFilter] = useState('all');

  const entriesQueryConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: entries, loading } = useSubscription<JournalEntry>(firestore, 'journalEntries', entriesQueryConstraints);

  const filteredEntries = useMemo(() => {
    const dateFiltered = entries.filter(entry => {
        const entryDate = toFirestoreDate(entry.date);
        if (!dateFrom && !dateTo) return true;
        if (!entryDate) return false;
        const matchesDateFrom = !dateFrom || (entryDate >= new Date(new Date(dateFrom).setHours(0, 0, 0, 0)));
        const matchesDateTo = !dateTo || (entryDate <= new Date(new Date(dateTo).setHours(23, 59, 59, 999)));
        return matchesDateFrom && matchesDateTo;
    });

    const searchFiltered = searchJournalEntries(dateFiltered, searchQuery);
    if (entryTypeFilter === 'all') return searchFiltered;

    return searchFiltered.filter(entry => {
        const isCommissionEntry = entry.narration?.includes('عمولة');
        return entryTypeFilter === 'commission' ? isCommissionEntry : !isCommissionEntry;
    });
  }, [entries, searchQuery, dateFrom, dateTo, entryTypeFilter]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  const handlePostEntry = async (entryId: string) => {
    if (!firestore || isPosting || isUnposting) return;
    setIsPosting(true);
    try {
        await updateDoc(doc(firestore, 'journalEntries', entryId), { status: 'posted' });
        toast({ title: 'نجاح', description: 'تم ترحيل القيد بنجاح.' });
    } finally { setIsPosting(false); }
  };
  
  const handleUnpostEntry = async (entryId: string) => {
    if (!firestore || isPosting || isUnposting) return;
    setIsUnposting(true);
    try {
        await updateDoc(doc(firestore, 'journalEntries', entryId), { status: 'draft' });
        toast({ title: 'نجاح', description: 'تم التراجع عن ترحيل القيد.' });
    } finally { setIsUnposting(false); }
  };

  const handleDelete = async () => {
    if (!entryToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        await deleteDoc(doc(firestore, 'journalEntries', entryToDelete.id!));
        toast({ title: 'نجاح', description: 'تم حذف قيد اليومية.' });
    } finally { setIsDeleting(false); setEntryToDelete(null); }
  }

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
            <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="ابحث بالرقم أو البيان..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold"
                />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <DateInput value={dateFrom} onChange={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')} className="w-36 h-9 text-xs" placeholder="من تاريخ"/>
                <DateInput value={dateTo} onChange={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')} className="w-36 h-9 text-xs" placeholder="إلى تاريخ"/>
                <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
                    <SelectTrigger className="w-32 h-9 text-xs bg-white rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl">
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="manual">يدوي</SelectItem>
                        <SelectItem value="commission">عمولات</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
          <Table>
            <TableHeader className="bg-[#F8F9FE]">
              <TableRow className="border-none">
                <TableHead className="px-8 py-5 font-black text-[#7209B7]">رقم القيد</TableHead>
                <TableHead className="font-black text-[#7209B7]">التاريخ</TableHead>
                <TableHead className="font-black text-[#7209B7]">البيان</TableHead>
                <TableHead className="text-left font-black text-[#7209B7]">الإجمالي</TableHead>
                <TableHead className="font-black text-[#7209B7]">الحالة</TableHead>
                <TableHead className="text-center font-black text-[#7209B7]">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-bold">لا توجد قيود مسجلة.</TableCell></TableRow>
                ) : (
                    filteredEntries.map((entry) => {
                        const isSystemEntry = entry.narration?.startsWith('[') || entry.linkedReceiptId;
                        return (
                        <TableRow key={entry.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16">
                            <TableCell className="px-8 font-mono font-black text-primary">
                                <Link href={`/dashboard/accounting/journal-entries/${entry.id}`} className="hover:underline">{entry.entryNumber}</Link>
                            </TableCell>
                            <TableCell className="font-bold text-xs opacity-60">{formatDate(entry.date)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                                <div className="flex items-center gap-2">
                                    {isSystemEntry && <ShieldCheck className="h-3 w-3 text-blue-500 shrink-0" />}
                                    <span className="font-medium text-gray-700">{entry.narration}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(entry.totalDebit)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn("px-3 font-black text-[10px]", statusColors[entry.status])}>
                                    {statusTranslations[entry.status]}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-xl">
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}`)}><Eye className="ml-2 h-4 w-4" /> عرض</DropdownMenuItem>
                                        {entry.status === 'draft' && (
                                            <>
                                                <DropdownMenuItem onClick={() => handlePostEntry(entry.id!)} className="text-green-600"><CheckCircle className="ml-2 h-4 w-4" /> ترحيل</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}/edit`)}><Pencil className="ml-2 h-4 w-4" /> تعديل</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setEntryToDelete(entry)} className="text-destructive"><Trash2 className="ml-2 h-4 w-4" /> حذف</DropdownMenuItem>
                                            </>
                                        )}
                                        {entry.status === 'posted' && (
                                            <DropdownMenuItem onClick={() => handleUnpostEntry(entry.id!)} className="text-orange-600"><Undo2 className="ml-2 h-4 w-4" /> تراجع</DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )})
                )}
            </TableBody>
          </Table>
        </div>
        
         <AlertDialog open={!!entryToDelete} onOpenChange={() => setEntryToDelete(null)}>
            <AlertDialogContent dir="rtl" className="rounded-3xl">
                <AlertDialogHeader><AlertDialogTitle>تأكيد الحذف؟</AlertDialogTitle><AlertDialogDescription>سيتم حذف القيد رقم "{entryToDelete?.entryNumber}" بشكل دائم.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                    <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive rounded-xl">نعم، حذف</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
