'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, Pencil, CheckCircle, Undo2, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { JournalEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn, getTenantPath } from '@/lib/utils';
import { format } from 'date-fns';
import { Logo } from '@/components/layout/logo';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useBranding } from '@/context/branding-context';
import { toFirestoreDate } from '@/services/date-converter';
import html2pdf from 'html2pdf.js';
import { useAuth } from '@/context/auth-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const statusTranslations: Record<string, string> = {
    draft: 'بانتظار المراجعة',
    posted: 'مرحّل نهائياً',
};

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    posted: 'bg-green-100 text-green-800 border-green-200',
};

export default function ViewJournalEntryPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { branding, loading: brandingLoading } = useBranding();

  const tenantId = currentUser?.currentCompanyId;
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const entryPath = useMemo(() => tenantId ? getTenantPath(`journalEntries/${id}`, tenantId) : null, [id, tenantId]);
  const { data: entry, loading: entryLoading } = useDocument<JournalEntry>(firestore, entryPath);
  
  const formattedDate = useMemo(() => {
      const date = toFirestoreDate(entry?.date);
      return date ? format(date, 'dd / MM / yyyy') : '';
  }, [entry]);

  const handlePostEntry = async () => {
    const currentTenantId = currentUser?.currentCompanyId;
    if (!firestore || !id || !currentTenantId || isProcessing) return;
    setIsProcessing(true);
    
    const path = getTenantPath(`journalEntries/${id}`, currentTenantId);
    const docRef = doc(firestore, path);
    const updateData = { status: 'posted' as const };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'تم ترحيل القيد بنجاح' });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'فشل الترحيل', description: 'حدث خطأ أثناء محاولة ترحيل القيد. تأكد من وجود صلاحيات كافية.' });
      })
      .finally(() => { 
        setIsProcessing(false); 
      });
  };
  
  const handleUnpostEntry = async () => {
    const currentTenantId = currentUser?.currentCompanyId;
    if (!firestore || !id || !currentTenantId || isProcessing) return;
    setIsProcessing(true);

    const path = getTenantPath(`journalEntries/${id}`, currentTenantId);
    const docRef = doc(firestore, path);
    const updateData = { status: 'draft' as const };

    updateDoc(docRef, updateData)
      .then(() => {
        toast({ title: 'تم التراجع عن الترحيل' });
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'فشل التراجع عن الترحيل', description: 'حدث خطأ أثناء محاولة إلغاء ترحيل القيد.' });
      })
      .finally(() => { 
        setIsProcessing(false); 
      });
  };

  const handlePrint = () => {
    if (!printableAreaRef.current) return;
    setIsPrinting(true);

    const element = printableAreaRef.current;
    const opt = {
      margin: 10,
      filename: `JV-${entry?.entryNumber || id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setIsPrinting(false);
    }).catch(err => {
      console.error("Printing Error:", err);
      toast({ variant: 'destructive', title: 'فشل الطباعة', description: 'حدث خطأ أثناء إنشاء ملف PDF.' });
      setIsPrinting(false);
    });
  };

  if (entryLoading || brandingLoading) return <div className="p-8 max-w-4xl mx-auto space-y-8"><Skeleton className="h-64 w-full rounded-[2.5rem]" /></div>;
  if (!entry) return <div className="text-center py-20 font-black opacity-30">لم يتم العثور على القيد.</div>;

  return (
    <div className="bg-gray-100 p-4 sm:p-8" dir="rtl">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-[2.5rem] overflow-hidden border">
            <div id="printable-area" ref={printableAreaRef} className="p-8 md:p-12 bg-white">
                <header className="flex justify-between items-start pb-8 border-b-4 border-primary mb-10">
                    <div className="flex items-center gap-6">
                        <Logo className="h-20 w-16 !p-2 shadow-inner border rounded-2xl" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                        <div>
                            <h1 className="text-2xl font-black text-[#1e1b4b]">{branding?.company_name || 'Nova ERP'}</h1>
                            <p className="text-xs text-muted-foreground font-bold">{branding?.address}</p>
                        </div>
                    </div>
                    <div className="text-left space-y-2">
                        <h2 className="text-3xl font-black text-primary">قيد يومية</h2>
                        <div className='flex items-center gap-2 justify-end'>
                            <Badge variant="outline" className={cn("px-4 py-1 border-2 font-black text-[10px] rounded-full", statusColors[entry.status])}>
                                {statusTranslations[entry.status]}
                            </Badge>
                        </div>
                        <p className="font-mono text-sm font-black text-slate-400">REF: {entry.entryNumber}</p>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-8 mb-10 p-6 bg-slate-50 rounded-2xl border-2 border-dashed">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-slate-400">البيان / الوصف</Label>
                        <p className="font-black text-lg text-[#1e1b4b]">{entry.narration}</p>
                    </div>
                    <div className="text-left">
                        <Label className="text-[10px] font-black uppercase text-slate-400">التاريخ</Label>
                        <p className="font-black text-lg font-mono text-primary">{formattedDate}</p>
                        {entry.reference && <p className="text-xs font-bold text-slate-400 mt-1">المرجع: {entry.reference}</p>}
                    </div>
                </div>

                <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-primary/5 h-14 border-b-2">
                            <TableRow className="border-none">
                                <TableHead className="px-8 font-black text-primary text-right">الحساب المالي</TableHead>
                                <TableHead className="text-left font-black text-primary w-32">مدين (+)</TableHead>
                                <TableHead className="text-left font-black text-primary w-32">دائن (-)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entry.lines.map((line, idx) => (
                                <TableRow key={idx} className="h-14 border-b last:border-0 hover:bg-transparent">
                                    <TableCell className="px-8 font-black text-slate-800">{line.accountName}</TableCell>
                                    <TableCell className="text-left font-mono font-bold text-blue-600">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</TableCell>
                                    <TableCell className="text-left font-mono font-bold text-red-600">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5 h-16">
                            <TableRow className="border-t-4 border-primary/20">
                                <TableCell className="px-8 font-black text-[#1e1b4b]">الإجمالي:</TableCell>
                                <TableCell className="text-left font-mono font-black text-primary text-lg">{formatCurrency(entry.totalDebit)}</TableCell>
                                <TableCell className="text-left font-mono font-black text-primary text-lg">{formatCurrency(entry.totalCredit)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>

                <footer className="mt-32 grid grid-cols-2 gap-20 text-center text-[10px] font-black uppercase text-muted-foreground">
                    <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">إعداد المحاسب</p><div className="pt-2 border-t border-dashed">التوقيع</div></div>
                    <div className="space-y-16"><p className="text-foreground border-b-2 border-foreground pb-2 text-sm">اعتماد المدير المالي</p><div className="pt-2 border-t border-dashed">الختم الرسمي</div></div>
                </footer>
            </div>

            <div className="p-8 bg-muted/10 border-t flex justify-between items-center">
                <Button variant="ghost" onClick={() => router.back()} className="rounded-xl font-bold gap-2"><ArrowRight className="h-4 w-4"/> عودة</Button>
                <div className="flex gap-3">
                    {entry.status === 'draft' && (
                        <>
                            <Button variant="outline" onClick={() => router.push(`/dashboard/accounting/journal-entries/${entry.id}/edit`)} className="rounded-xl font-bold border-2">تعديل</Button>
                            <Button onClick={handlePostEntry} disabled={isProcessing} className="rounded-xl font-black gap-2 shadow-xl shadow-primary/20">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="h-4 w-4"/>} ترحيل القيد
                            </Button>
                        </>
                    )}
                    {entry.status === 'posted' && (
                        <Button variant="outline" onClick={handleUnpostEntry} disabled={isProcessing} className="rounded-xl font-bold text-orange-600 border-orange-200 hover:bg-orange-50 gap-2">
                             <Undo2 className="h-4 w-4"/> تراجع عن الترحيل
                        </Button>
                    )}
                    <Button onClick={handlePrint} disabled={isPrinting} variant="secondary" className="rounded-xl font-black gap-2 h-11 px-8">
                        {isPrinting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Printer className="h-4 w-4"/>}
                        {isPrinting ? 'جاري الإنشاء...' : 'طباعة'}
                    </Button>
                </div>
            </div>
        </div>
    </div>
  );
}
