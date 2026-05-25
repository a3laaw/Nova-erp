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
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { BookOpen, MoreHorizontal, Eye, Pencil, Trash2, Loader2, CheckCircle, Undo2, Search, ShieldCheck } from 'lucide-react';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  
  const tenantId = currentUser?.currentCompanyId;

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
    if (!firestore || !tenantId || isPosting || isUnposting) return;
    setIsPosting(true);
    
    const entryPath = getTenantPath(`journalEntries/${entryId}`, tenantId);
    const docRef = doc(firestore, entryPath!);
    const updateData = { status: 'posted' as const };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'نجاح الترحيل', description: 'تم ترحيل القيد بنجاح للحسابات الختامية.' });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: entryPath!,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsPosting(false);
      });
  };
  
  const handleUnpostEntry = async (entryId: string) => {
    if (!firestore || !tenantId || isPosting || isUnposting) return;
    setIsUnposting(true);
    
    const entryPath = getTenantPath(`journalEntries/${entryId}`, tenantId);
    const docRef = doc(firestore, entryPath!);
    const updateData = { status: 'draft' as const };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'تراجع عن الترحيل', description: 'عاد القيد لحالة المسودة للتحرير.' });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: entryPath!,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsUnposting(false);
      });
  };

  const handleDelete = async () => {
    if (!entryToDelete || !firestore || !tenantId) return;
    setIsDeleting(true);
    
    const entryPath = getTenantPath(`journalEntries/${entryToDelete.id}`, tenantId);
    const docRef = doc(firestore, entryPath!);

    deleteDoc(docRef)
      .then(() => {
        toast({ title: 'حذف القيد', description: 'تم مسح القيد نهائياً من الدفاتر.' });
      })
      .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: entryPath!,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsDeleting(false);
        setEntryToDelete(null);
      });
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <div className="space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-[#F8F9FE] p-4 rounded-[2rem] border shadow-inner no-print">
            <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                <Input
                    placeholder="بحث برقم القيد أو البيان..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-white border-none shadow-sm font-bold text-black"
                />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <DateInput value={dateFrom ? new Date(dateFrom) : undefined} onChange={(d) => setDateFrom(d ? format(d, 'yyyy-MM-dd') : '')} className="w-36 h-9 text-xs" placeholder="من تاريخ"/>
                <DateInput value={dateTo ? new Date(dateTo) : undefined} onChange={(d) => setDateTo(d ? format(d, 'yyyy-MM-dd') : '')} className="w-36 h-9 text-xs" placeholder="إلى تاريخ"/>
                <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
                    <SelectTrigger className="w-32 h-9 text-xs bg-white rounded-xl text-black font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent dir="rtl" className="bg-white">
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="manual">قيود يدوية</SelectItem>
                        <SelectItem value="commission">قيود العمولات</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-white">
          <Table>
            <TableHeader className="bg-[#F8F9FE] h-14">
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
                        <TableRow key={entry.id} className="hover:bg-[#F3E8FF]/20 group transition-colors h-16 border-b last:border-0">
                            <TableCell className="px-8 font-mono font-black text-primary text-sm">
                                <Link href={`/dashboard/accounting/journal-entries/${entry.id}`} className="hover:underline">{entry.entryNumber}</Link>
                            </TableCell>
                            <TableCell className="font-bold text-xs opacity-60">{formatDate(entry.date)}</TableCell>
                            <TableCell className="max-w-xs truncate">
                                <div className="flex items-center gap-2">
                                    {isSystemEntry && <ShieldCheck className="h-3 w-3 text-blue-500 shrink-0" />}
                                    <span className="font-bold text-gray-800">{entry.narration}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-left font-mono font-black text-[#2E5BCC] text-lg">{formatCurrency(entry.totalDebit)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={cn("px-3 font-black text-[10px] border-2", statusColors[entry.status])}>
                                    {statusTranslations[entry.status]}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border group-hover:border-primary/20 transition-all"><MoreHorizontal className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl" className="rounded-xl p-2 shadow-2xl border-none bg-white">
                                        <DropdownMenuLabel className="font-black px-3 py-2 text-[#1e1b4b]">إدارة القيد</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}`)} className="rounded-lg py-3 font-bold gap-3 cursor-pointer text-black">
                                            <Eye className="h-4 w-4 text-primary" /> عرض وتصدير
                                        </DropdownMenuItem>
                                        {entry.status === 'draft' && (
                                            <>
                                                <DropdownMenuItem onClick={() => handlePostEntry(entry.id!)} className="text-green-600 font-bold gap-3 py-3 rounded-lg cursor-pointer hover:bg-green-50">
                                                    <CheckCircle className="h-4 w-4" /> ترحيل القيد
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}/edit`)} className="font-bold gap-3 py-3 rounded-lg cursor-pointer text-black">
                                                    <Pencil className="ml-2 h-4 w-4 text-primary" /> تعديل
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-slate-100" />
                                                <DropdownMenuItem onClick={() => setEntryToDelete(entry)} className="text-red-600 font-black gap-3 py-3 rounded-lg cursor-pointer focus:bg-red-50">
                                                    <Trash2 className="ml-2 h-4 w-4" /> حذف نهائي
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        {entry.status === 'posted' && (
                                            <DropdownMenuItem onClick={() => handleUnpostEntry(entry.id!)} className="text-orange-600 font-bold gap-3 py-3 rounded-lg cursor-pointer hover:bg-orange-50">
                                                <Undo2 className="ml-2 h-4 w-4" /> تراجع عن الترحيل
                                            </DropdownMenuItem>
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
            <AlertDialogContent dir="rtl" className="rounded-[2.5rem] p-10 border-none shadow-2xl bg-white">
                <AlertDialogHeader>
                    <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><Trash2 className="h-8 w-8"/></div>
                    <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد الحذف النهائي؟</AlertDialogTitle>
                    <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2 text-slate-600">
                        سيتم حذف القيد رقم <strong className="text-foreground">"{entryToDelete?.entryNumber}"</strong> بشكل دائم. هذا الإجراء سيؤثر على ميزان المراجعة والحسابات الختامية.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold h-12 px-8 border-2 text-black">تراجع</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-xl font-black h-12 px-12 shadow-xl shadow-red-200">
                        {isDeleting ? <Loader2 className="animate-spin h-4 w-4"/> : 'نعم، حذف نهائي'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
