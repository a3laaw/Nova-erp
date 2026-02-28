
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
import { collection, query, orderBy, doc, deleteDoc, writeBatch, where, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import type { PurchaseOrder } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { FileText, MoreHorizontal, Eye, Pencil, Trash2, Search, Undo2, Loader2, AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toFirestoreDate } from '@/services/date-converter';
import { searchPurchaseOrders } from '@/lib/cache/fuse-search';
import { DateInput } from '../ui/date-input';
import Link from 'next/link';
import { useAuth } from '@/context/auth-context';


const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    received: 'bg-green-100 text-green-800',
    partially_received: 'bg-indigo-100 text-indigo-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    approved: 'معتمد',
    received: 'تم الاستلام',
    partially_received: 'مستلم جزئياً',
    cancelled: 'ملغي',
};

export function PurchaseOrdersList() {
  const { firestore } = useFirebase();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [itemToDelete, setItemToDelete] = useState<PurchaseOrder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const poQueryConstraints = useMemo(() => [orderBy('orderDate', 'desc')], []);
  const { data: purchaseOrders, loading, error } = useSubscription<PurchaseOrder>(firestore, 'purchaseOrders', poQueryConstraints);

  const filteredPOs = useMemo(() => {
    const dateFiltered = purchaseOrders.filter(po => {
        const poDate = toFirestoreDate(po.orderDate);
        
        if (!dateFrom && !dateTo) return true;
        if (!poDate) return false;
      
        const matchesDateFrom = !dateFrom || (poDate >= new Date(new Date(dateFrom).setHours(0, 0, 0, 0)));
        const matchesDateTo = !dateTo || (poDate <= new Date(new Date(dateTo).setHours(23, 59, 59, 999)));
        
        return matchesDateFrom && matchesDateTo;
    });

    return searchPurchaseOrders(dateFiltered, searchQuery);
  }, [purchaseOrders, searchQuery, dateFrom, dateTo]);


  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    if (!date) return '-';
    return format(date, 'dd/MM/yyyy');
  };

  const handleUndoApproval = async (po: PurchaseOrder) => {
    if (!firestore || !currentUser || isProcessing) return;
    
    if (currentUser.role !== 'Admin' && currentUser.role !== 'Accountant') {
        toast({ variant: 'destructive', title: 'غير مسموح', description: 'ليس لديك صلاحية التعديل على أوامر الشراء.' });
        return;
    }

    setIsProcessing(true);
    try {
        const grnsQuery = query(collection(firestore, 'grns'), where('purchaseOrderId', '==', po.id));
        const grnsSnap = await getDocs(grnsQuery);
        
        const activeGrns = grnsSnap.docs.filter(d => d.data().status !== 'cancelled');
        
        if (activeGrns.length > 0) {
            toast({ 
                variant: 'destructive', 
                title: 'لا يمكن التراجع', 
                description: 'تم البدء باستلام بضاعة لهذا الأمر بالفعل. يجب حذف أذونات الاستلام أولاً.' 
            });
            return;
        }

        const poRef = doc(firestore, 'purchaseOrders', po.id!);
        await updateDoc(poRef, { 
            status: 'draft',
            approvedBy: deleteField(),
            approvedAt: deleteField()
        });
        
        toast({ title: 'تم التراجع', description: 'تمت إعادة أمر الشراء لحالة المسودة بنجاح.' });
    } catch (error) {
        console.error("Undo approval failed:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن الاعتماد.' });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleDelete = async () => {
    if (!itemToDelete || !firestore) return;
    setIsDeleting(true);
    try {
        // --- الرقابة: منع الحذف إذا كان مرتبطاً بقيد محاسبي (عبر إذن الاستلام) ---
        const grnsQuery = query(collection(firestore, 'grns'), where('purchaseOrderId', '==', itemToDelete.id));
        const grnsSnap = await getDocs(grnsQuery);
        
        const activeGrns = grnsSnap.docs.filter(d => d.data().status !== 'cancelled');
        
        if (activeGrns.length > 0) {
            toast({ 
                variant: 'destructive', 
                title: 'منع الحذف الرقابي', 
                description: 'لا يمكن حذف أمر شراء مرتبط بقيود محاسبية (أذونات استلام). يرجى إلغاء أذونات الاستلام أولاً لتصفية الأثر المالي.' 
            });
            setIsDeleting(false);
            setItemToDelete(null);
            return;
        }

        const batch = writeBatch(firestore);
        
        batch.delete(doc(firestore, 'purchaseOrders', itemToDelete.id!));

        if (itemToDelete.rfqId) {
            const rfqRef = doc(firestore, 'rfqs', itemToDelete.rfqId);
            batch.update(rfqRef, {
                status: 'sent', 
                awardedVendorId: null,
                awardedPoId: null
            });
        }

        await batch.commit();
        toast({ 
            title: 'نجاح', 
            description: itemToDelete.rfqId 
                ? 'تم حذف أمر الشراء وإعادة فتح طلب التسعير المرتبط للمفاضلة.' 
                : 'تم حذف أمر الشراء بنجاح.' 
        });
    } catch (error) {
        console.error('Error deleting purchase order:', error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل حذف أمر الشراء.' });
    } finally {
        setIsDeleting(false);
        setItemToDelete(null);
    }
  }

  if (loading) {
    return (
        <div className="border rounded-lg">
            <Table><TableHeader><TableRow><TableHead>رقم الطلب</TableHead><TableHead>المورد</TableHead></TableRow></TableHeader>
                <TableBody>{Array.from({ length: 5 }).map((_, i) => (<TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>))}</TableBody>
            </Table>
        </div>
    );
  }
  
  if (error) {
      return <div className="text-center py-10 text-destructive">فشل تحميل قائمة أوامر الشراء.</div>;
  }

  return (
    <>
        <div className="bg-muted/50 p-4 rounded-lg mb-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="grid gap-2 md:col-span-1">
                    <Label htmlFor="search">بحث ذكي</Label>
                    <div className="relative">
                        <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            id="search"
                            placeholder="رقم الطلب, اسم المورد..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 rtl:pr-10"
                        />
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="dateFrom">من تاريخ</Label>
                    <DateInput
                        id="dateFrom"
                        value={dateFrom}
                        onChange={setDateFrom}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="dateTo">إلى تاريخ</Label>
                     <DateInput
                        id="dateTo"
                        value={dateTo}
                        onChange={setDateTo}
                    />
                </div>
            </div>
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>المورد</TableHead>
                <TableHead>تاريخ الطلب</TableHead>
                <TableHead className="text-left">إجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredPOs.length === 0 ? (
                     <TableRow><TableCell colSpan={6} className="h-24 text-center">
                        {searchQuery || dateFrom || dateTo ? 'لا توجد نتائج تطابق بحثك.' : 'لا توجد أوامر شراء بعد.'}
                     </TableCell></TableRow>
                ) : (
                    filteredPOs.map((po) => (
                        <TableRow key={po.id}>
                            <TableCell className="font-mono font-bold">
                                <Link href={`/dashboard/purchasing/purchase-orders/${po.id}`} className="text-primary hover:underline">
                                    {po.poNumber}
                                </Link>
                            </TableCell>
                            <TableCell>{po.vendorName}</TableCell>
                            <TableCell>{formatDate(po.orderDate)}</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(po.totalAmount)}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[po.status]}>{statusTranslations[po.status]}</Badge>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isProcessing}>
                                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" dir="rtl">
                                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/purchasing/purchase-orders/${po.id}`)}>
                                            <Eye className="ml-2 h-4 w-4" /> عرض / طباعة
                                        </DropdownMenuItem>
                                        
                                        {po.status === 'approved' && (
                                            <DropdownMenuItem onClick={() => handleUndoApproval(po)} className="text-orange-600 focus:text-orange-700 focus:bg-orange-50">
                                                <Undo2 className="ml-2 h-4 w-4" /> تراجع عن الاعتماد (إعادة لمسودة)
                                            </DropdownMenuItem>
                                        )}

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setItemToDelete(po)} className="text-destructive focus:text-destructive">
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
                    <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive h-5 w-5"/> تأكيد الحذف الرقابي
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {itemToDelete?.rfqId 
                            ? `سيتم حذف أمر الشراء رقم "${itemToDelete?.poNumber}" وإعادة فتح طلب التسعير المرتبط به للمفاضلة مرة أخرى.`
                            : `سيتم حذف أمر الشراء رقم "${itemToDelete?.poNumber}" بشكل دائم.`}
                        <br/><br/>
                        <span className="font-bold text-destructive">تنبيه:</span> لا يمكن حذف الأوامر التي ولّدت قيوداً محاسبية (التي تم استلام بضائعها بالفعل).
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting ? 'جاري الفحص والحذف...' : 'نعم، قم بالحذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
