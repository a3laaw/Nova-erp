
'use client';

import { useState, useMemo, useCallback } from 'react';
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
import {
  collection,
  query,
  orderBy,
  doc,
  getDocs,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import type { RequestForQuotation, SupplierQuotation } from '@/lib/types';
import { format } from 'date-fns';
import {
  FileText,
  MoreHorizontal,
  Eye,
  Trash2,
  Search,
  ClipboardList,
  Loader2,
  Undo2,
  AlertTriangle,
  Sparkles,
  BarChart
} from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';
import Link from 'next/link';
import { searchRfqs } from '@/lib/cache/fuse-search';
import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  closed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusTranslations: Record<string, string> = {
  draft: 'مسودة',
  sent: 'مرسل للموردين',
  closed: 'مغلق للمقارنة',
  cancelled: 'ملغي',
};

export function RfqsList() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [itemToDelete, setItemToDelete] = useState<RequestForQuotation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const rfqQueryConstraints = useMemo(() => [orderBy('date', 'desc')], []);
  const { data: rfqs, loading, error } = useSubscription<RequestForQuotation>(
    firestore,
    'rfqs',
    rfqQueryConstraints
  );

  // جلب عروض الأسعار لمعرفة أي الطلبات جاهزة للمقارنة
  const { data: allQuotes } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations');

  const filteredRfqs = useMemo(() => {
    return searchRfqs(rfqs, searchQuery);
  }, [rfqs, searchQuery]);

  const formatDate = useCallback((dateValue: any) => {
    try {
      const date = toFirestoreDate(dateValue);
      if (!date) return '-';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  }, []);

  const handleReopen = async (rfqId: string) => {
    if (!firestore || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'rfqs', rfqId), { status: 'sent' });
      toast({ title: 'تمت العملية', description: 'تم إعادة فتح الطلب لاستقبال عروض إضافية.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إعادة فتح الطلب.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
      const rfqId = itemToDelete.id!;
      const poRef = collection(firestore, 'purchaseOrders');
      const poQuery = query(poRef, where('rfqId', '==', rfqId));
      const poSnap = await getDocs(poQuery);

      const hasFinancialImpact = poSnap.docs.some(d => ['received', 'partially_received'].includes(d.data().status));
      
      if (hasFinancialImpact) {
          toast({ 
              variant: 'destructive', 
              title: 'منع الحذف الرقابي', 
              description: 'لا يمكن حذف طلب تسعير ولد أوامر شراء مرتبطة بقيود محاسبية قائمة.' 
          });
          setIsDeleting(false);
          setItemToDelete(null);
          return;
      }

      const quotesRef = collection(firestore, 'supplierQuotations');
      const quotesQuery = query(quotesRef, where('rfqId', '==', rfqId));
      const quotesSnap = await getDocs(quotesQuery);

      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'rfqs', rfqId));
      quotesSnap.docs.forEach((quoteDoc) => batch.delete(quoteDoc.ref));
      poSnap.docs.forEach((poDoc) => batch.delete(poDoc.ref));

      await batch.commit();
      toast({ title: 'نجاح', description: `تم حذف الطلب وعروض الأسعار المرتبطة.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف طلب التسعير.' });
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center mb-6">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث برقم الطلب (مثال: RFQ-2024)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rtl:pr-10 h-11 rounded-xl shadow-sm font-bold border-2"
          />
        </div>
      </div>

      <div className="border-2 rounded-[2rem] overflow-hidden shadow-sm bg-white">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="h-14 border-b-2">
              <TableHead className="px-8 font-black">رقم الطلب</TableHead>
              <TableHead className="font-bold">التاريخ</TableHead>
              <TableHead className="text-center font-bold">العروض المستلمة</TableHead>
              <TableHead className="font-bold">الحالة</TableHead>
              <TableHead className="w-[120px] text-center font-bold">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rfqs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/10 m-4">
                    <ClipboardList className="mx-auto h-16 w-16 text-muted-foreground/30" />
                    <h3 className="mt-4 text-xl font-black">لا توجد طلبات تسعير بعد</h3>
                    <p className="mt-2 text-sm text-muted-foreground">ابدأ بإنشاء طلب تسعير جديد لإرساله للموردين.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredRfqs.map((rfq) => {
                const quoteCount = allQuotes?.filter(q => q.rfqId === rfq.id).length || 0;
                return (
                  <TableRow key={rfq.id} className="group hover:bg-primary/5 transition-colors h-16">
                    <TableCell className="px-8 font-mono font-black text-primary text-base">
                      <Link href={`/dashboard/purchasing/rfqs/${rfq.id}`} className="hover:underline">
                        {rfq.rfqNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-bold opacity-60 text-xs">{formatDate(rfq.date)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Badge variant={quoteCount > 0 ? "default" : "secondary"} className={cn("px-3 rounded-full font-black", quoteCount > 0 && "bg-green-600")}>
                            {quoteCount} عروض
                        </Badge>
                        {quoteCount > 0 && rfq.status !== 'draft' && (
                            <Link href={`/dashboard/purchasing/rfqs/${rfq.id}/compare`} className="p-1.5 bg-primary/10 rounded-lg text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                                <Sparkles className="h-4 w-4" />
                            </Link>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('px-3 py-1 font-black text-[10px]', statusColors[rfq.status])}>
                        {statusTranslations[rfq.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border group-hover:border-primary/20" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" dir="rtl" className="rounded-xl shadow-xl p-2 border-none">
                          <DropdownMenuLabel className="font-black px-3 py-2">خيارات الطلب</DropdownMenuLabel>
                          <DropdownMenuItem asChild className="rounded-lg py-3">
                            <Link href={`/dashboard/purchasing/rfqs/${rfq.id}`} className="gap-2 font-bold"><Eye className="h-4 w-4" /> إدارة العروض</Link>
                          </DropdownMenuItem>
                          
                          {quoteCount > 0 && (
                            <DropdownMenuItem asChild className="rounded-lg py-3 text-primary font-black bg-primary/5">
                                <Link href={`/dashboard/purchasing/rfqs/${rfq.id}/compare`} className="gap-2"><BarChart className="h-4 w-4" /> مصفوفة المقارنة</Link>
                            </DropdownMenuItem>
                          )}

                          {rfq.status === 'closed' && (
                            <DropdownMenuItem onClick={() => handleReopen(rfq.id!)} className="text-orange-600 rounded-lg py-3 font-bold gap-2">
                              <Undo2 className="h-4 w-4" /> إعادة فتح للتحرير
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setItemToDelete(rfq)}
                            className="text-destructive rounded-lg py-3 font-bold gap-2 focus:bg-red-50"
                          >
                            <Trash2 className="ml-2 h-4 w-4" /> حذف الطلب نهائياً
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
        <AlertDialogContent dir="rtl" className="rounded-[2rem] shadow-2xl border-none p-10">
          <AlertDialogHeader>
            <div className="p-3 bg-red-100 rounded-2xl text-red-600 w-fit mb-4 shadow-inner"><AlertTriangle className="h-10 w-10" /></div>
            <AlertDialogTitle className="text-2xl font-black text-red-700">تأكيد حذف طلب التسعير؟</AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-medium leading-relaxed mt-2">
              سيتم حذف الطلب رقم <strong className="text-foreground">"{itemToDelete?.rfqNumber}"</strong> وكافة عروض الأسعار وأوامر الشراء المبرمة بناءً عليه نهائياً.
              <br/><br/>
              <span className="font-bold text-red-600 underline italic">تنبيه: لا يمكن حذف الطلبات التي تم توريد بضائعها فعلياً للمخازن.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel className="rounded-xl font-bold h-12 px-8">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 rounded-xl font-black h-12 px-12 shadow-lg"
            >
              {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'نعم، حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
