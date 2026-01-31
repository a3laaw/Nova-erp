
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, Pencil, CheckCircle, Undo2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, getDocs, collection, query, limit, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import type { JournalEntry, Company } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/context/branding-context';

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    posted: 'مرحّل',
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    posted: 'bg-green-100 text-green-800',
};


export default function ViewJournalEntryPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { branding, loading: brandingLoading } = useBranding();

  const [isProcessing, setIsProcessing] = useState(false);

  const entryRef = useMemo(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'journalEntries', id);
  }, [firestore, id]);

  const { data: entry, loading: entryLoading, error: entryError } = useDocument<JournalEntry>(firestore, entryRef ? entryRef.path : null);
  
  const handlePrint = () => {
    window.print();
  };

  const handlePostEntry = async () => {
    if (!entry || !entry.id || !firestore) return;
    setIsProcessing(true);
    try {
        const entryRefDoc = doc(firestore, 'journalEntries', entry.id);
        await updateDoc(entryRefDoc, { status: 'posted' });
        toast({ title: 'نجاح', description: 'تم ترحيل القيد بنجاح.' });
    } catch (error) {
        console.error('Error posting journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل ترحيل القيد.' });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleUnpostEntry = async () => {
    if (!entry || !entry.id || !firestore) return;
    setIsProcessing(true);
    try {
        const entryRefDoc = doc(firestore, 'journalEntries', entry.id);
        await updateDoc(entryRefDoc, { status: 'draft' });
        toast({ title: 'نجاح', description: 'تم التراجع عن ترحيل القيد بنجاح.' });
    } catch (error) {
        console.error('Error un-posting journal entry:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن ترحيل القيد.' });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const formattedDate = useMemo(() => {
      if (!entry?.date) return '';
      try {
          return format(entry.date.toDate(), 'dd / MM / yyyy');
      } catch {
          return '';
      }
  }, [entry]);


  if (entryLoading || brandingLoading) {
      return (
         <div className="p-8 max-w-4xl mx-auto bg-white space-y-8">
            <header className="flex justify-between items-center pb-4 border-b">
                <Skeleton className="h-20 w-1/3" />
                <Skeleton className="h-20 w-1/4" />
            </header>
            <main className="space-y-8 mt-8">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
            </main>
        </div>
      );
  }

  if (!entry) {
      return (
        <div className="text-center py-10" dir="rtl">
            <p className="text-destructive">لم يتم العثور على قيد اليومية المطلوب.</p>
            <Button onClick={() => router.push('/dashboard/accounting/journal-entries')} className="mt-4">
                العودة إلى قيود اليومية
            </Button>
        </div>
      );
  }

  return (
    <div className="bg-gray-100 dark:bg-gray-900 p-4 sm:p-8 print:bg-white print:p-0" dir="rtl">
        <div className="max-w-4xl mx-auto bg-white dark:bg-card shadow-lg rounded-lg printable-wrapper print:shadow-none print:border-none">
            <div id="printable-area" className="printable-content">
                {branding?.letterhead_image_url && (
                    <img 
                        src={branding.letterhead_image_url} 
                        alt="Letterhead"
                        className="w-full h-auto block"
                    />
                )}
                <div className="p-8 md:p-12">
                    {!branding?.letterhead_image_url && (
                        <header className="pb-4 border-b-2 border-gray-800 dark:border-gray-300">
                            <div className="flex justify-between items-start">
                                <div className="text-left flex-shrink-0">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">قـيـد يـومـيـة</h2>
                                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Journal Entry</p>
                                    <div className='flex items-center gap-2 mt-2'>
                                    <p className="font-mono text-sm text-muted-foreground">{entry.entryNumber} : <span className='font-sans'>رقم القيد</span></p>
                                    <Badge variant="outline" className={statusColors[entry.status] || ''}>{statusTranslations[entry.status] || entry.status}</Badge>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                <Logo className="h-16 w-16 !p-3" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                                    <div>
                                    <h1 className="font-bold text-lg">{branding?.company_name}</h1>
                                    <p className="text-sm text-muted-foreground">{branding?.nameEn}</p>
                                    <p className="text-xs text-muted-foreground mt-2">{branding?.address}</p>
                                    </div>
                                </div>
                            </div>
                        </header>
                    )}

                    <main className="py-8 space-y-8">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                            <div className="flex items-baseline">
                                <span className="w-20 font-semibold text-gray-600 dark:text-gray-400">التاريخ:</span>
                                <span className="flex-1 border-b border-dashed border-gray-400 pb-1 text-center font-mono text-gray-800 dark:text-gray-200">{formattedDate}</span>
                            </div>
                            <div className="flex items-baseline">
                                <span className="w-20 font-semibold text-gray-600 dark:text-gray-400">المرجع:</span>
                                <span className="flex-1 border-b border-dashed border-gray-400 pb-1 text-gray-800 dark:text-gray-200">{entry.reference || '---'}</span>
                            </div>
                            <div className="flex items-baseline col-span-2">
                                <span className="w-20 font-semibold text-gray-600 dark:text-gray-400">البيان:</span>
                                <span className="flex-1 border-b border-dashed border-gray-400 pb-1 text-gray-800 dark:text-gray-200">{entry.narration || '---'}</span>
                            </div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-2/5">الحساب</TableHead>
                                    <TableHead className="text-left">مدين</TableHead>
                                    <TableHead className="text-left">دائن</TableHead>
                                    <TableHead>ملاحظات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entry.lines.map((line, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{line.accountName}</TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(line.debit)}</TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(line.credit)}</TableCell>
                                        <TableCell>{line.notes || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="font-bold bg-muted/50">
                                    <TableCell>الإجمالي</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(entry.totalDebit)}</TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(entry.totalCredit)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </main>
                    
                    <footer className="pt-24">
                        <div className="grid grid-cols-2 gap-20">
                            <div className="text-center">
                                <div className="border-t-2 border-gray-300 pt-2">
                                    <p className="font-semibold">المحاسب</p>
                                    <p className="text-sm text-muted-foreground">Accountant's Signature</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="border-t-2 border-gray-300 pt-2">
                                    <p className="font-semibold">المدير المالي</p>
                                    <p className="text-sm text-muted-foreground">CFO's Signature</p>
                                </div>
                            </div>
                        </div>
                    </footer>
                </div>
            </div>
             <div className="p-6 bg-muted/50 rounded-b-lg flex justify-end gap-2 no-print">
                {entry.status === 'draft' && (
                    <>
                        <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}/edit`)} disabled={isProcessing}>
                            <Pencil className="ml-2 h-4 w-4" /> تعديل
                        </Button>
                        <Button onClick={handlePostEntry} disabled={isProcessing}>
                            <CheckCircle className="ml-2 h-4 w-4" /> ترحيل القيد
                        </Button>
                    </>
                )}
                 {entry.status === 'posted' && (
                    <Button variant="outline" onClick={handleUnpostEntry} disabled={isProcessing}>
                        <Undo2 className="ml-2 h-4 w-4" /> التراجع عن الترحيل
                    </Button>
                )}
                <Button onClick={handlePrint} variant="outline" disabled={isProcessing}>
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة
                </Button>
            </div>
        </div>
    </div>
  );
}
