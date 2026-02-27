
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, runTransaction, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, RfqItem, PurchaseOrder } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn, cleanFirestoreData } from '@/lib/utils';
import { Award, AlertCircle, ShoppingCart, Loader2, UserPlus, Undo2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '../ui/label';

interface RfqComparisonViewProps {
  rfq: RequestForQuotation;
}

export function RfqComparisonView({ rfq }: RfqComparisonViewProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const [registeredVendors, setRegisteredVendors] = useState<Vendor[]>([]);
  const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  const [isAwarding, setIsAwarding] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [vendorToAward, setVendorToAward] = useState<any | null>(null);

  useEffect(() => {
    if (!firestore || !rfq.id) {
      setLoadingData(false);
      return;
    }

    const fetchData = async () => {
      setLoadingData(true);
      try {
        const quotesSnap = await getDocs(query(collection(firestore, 'supplierQuotations'), where('rfqId', '==', rfq.id)));
        const fetchedQuotes = quotesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierQuotation));
        setSupplierQuotations(fetchedQuotes);

        const vendorIds = rfq.vendorIds || [];
        if (vendorIds.length > 0) {
            const chunks = [];
            for (let i = 0; i < vendorIds.length; i += 30) {
              chunks.push(vendorIds.slice(i, i + 30));
            }

            const vendorPromises = chunks.map(chunk => 
              getDocs(query(collection(firestore, 'vendors'), where('__name__', 'in', chunk)))
            );
            const vendorSnapshots = await Promise.all(vendorPromises);
            const fetchedVendors = vendorSnapshots.flatMap(snap => 
              snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))
            );
            setRegisteredVendors(fetchedVendors);
        }

      } catch (err) {
        console.error("Error fetching comparison data:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [firestore, rfq.id, rfq.vendorIds]);

  const comparisonData = useMemo(() => {
    if (loadingData || !rfq) {
      return { data: [], vendors: [], totals: {} };
    }

    const allAvailableVendors = [
        ...registeredVendors,
        ...(rfq.prospectiveVendors || [])
    ];

    const participatingVendors = allAvailableVendors.filter((v) =>
      supplierQuotations.some((q) => q.vendorId === v.id)
    );

    const tempTotals: Record<string, number> = {};
    participatingVendors.forEach((v) => {
      tempTotals[v.id!] = 0;
    });

    const tableRows = rfq.items.map((item) => {
      const quotes = participatingVendors.map((vendor) => {
        const vendorQuote = supplierQuotations.find((q) => q.vendorId === vendor.id);
        const quoteItem = vendorQuote?.items.find((qi) => qi.rfqItemId === item.id);
        const unitPrice = quoteItem?.unitPrice ?? Infinity;

        if (unitPrice !== Infinity) {
          tempTotals[vendor.id!] += unitPrice * item.quantity;
        }

        return {
          vendorId: vendor.id!,
          vendorName: vendor.name,
          unitPrice: unitPrice,
        };
      });
      return { rfqItem: item, quotes };
    });

    return { data: tableRows, vendors: participatingVendors, totals: tempTotals };
  }, [loadingData, rfq, supplierQuotations, registeredVendors]);

  const handleAwardClick = (vendor: any) => {
      setVendorToAward(vendor);
  };

  const handleConfirmAward = async () => {
    if (!firestore || !vendorToAward || !currentUser || !rfq.id) return;
    setIsAwarding(true);

    try {
        const isProspective = String(vendorToAward.id).startsWith('prospective-');
        
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const counterRef = doc(firestore, 'counters', 'purchaseOrders');
            const counterDoc = await transaction.get(counterRef);
            
            const quote = supplierQuotations.find(q => q.vendorId === vendorToAward.id);
            if (!quote) throw new Error("لم يتم العثور على عرض السعر المختار.");

            const rfqRef = doc(firestore, 'rfqs', rfq.id!);
            
            let finalVendorId = vendorToAward.id;

            if (isProspective) {
                const newVendorRef = doc(collection(firestore, 'vendors'));
                finalVendorId = newVendorRef.id;
                transaction.set(newVendorRef, {
                    name: vendorToAward.name,
                    contactPerson: 'تم التحويل من طلب تسعير (مورد محتمل سابقاً)',
                    createdAt: serverTimestamp(),
                });
                const quoteRef = doc(firestore, 'supplierQuotations', quote.id!);
                transaction.update(quoteRef, { vendorId: finalVendorId });
            }

            let nextNumber = 1;
            if (counterDoc.exists()) {
                const counts = counterDoc.data()?.counts || {};
                nextNumber = (counts[currentYear] || 0) + 1;
            }
            const poNumber = `PO-${currentYear}-${String(nextNumber).padStart(4, '0')}`;

            const poItems = rfq.items.map(item => {
                const quoteItem = quote.items.find(qi => qi.rfqItemId === item.id);
                const unitPrice = quoteItem?.unitPrice || 0;
                return {
                    internalItemId: item.internalItemId,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    unitPrice: unitPrice,
                    total: unitPrice * item.quantity
                };
            });

            const totalAmount = poItems.reduce((sum, item) => sum + item.total, 0);

            const newPoRef = doc(collection(firestore, 'purchaseOrders'));
            const poData = {
                poNumber,
                orderDate: serverTimestamp(),
                vendorId: finalVendorId,
                vendorName: vendorToAward.name,
                projectId: rfq.projectId || null,
                items: poItems,
                totalAmount,
                status: 'draft',
                rfqId: rfq.id,
                supplierQuotationId: quote.id,
                createdAt: serverTimestamp(),
                createdBy: currentUser.id
            };

            transaction.set(newPoRef, cleanFirestoreData(poData));
            transaction.set(counterRef, { counts: { [currentYear]: nextNumber } }, { merge: true });
            
            transaction.update(rfqRef, { 
                status: 'closed',
                awardedVendorId: finalVendorId,
                awardedPoId: newPoRef.id
            });
        });

        toast({ title: 'اكتملت عملية الترسية', description: `تم إنشاء مسودة أمر شراء بنجاح.` });
        setVendorToAward(null);
    } catch (error: any) {
        console.error("Awarding failed:", error);
        toast({ variant: 'destructive', title: 'فشل الترسية', description: error.message });
    } finally {
        setIsAwarding(false);
    }
  };

  const handleUndoAward = async () => {
    if (!firestore || !rfq.id || !rfq.awardedPoId) return;
    
    setIsUndoing(true);
    try {
        const poRef = doc(firestore, 'purchaseOrders', rfq.awardedPoId);
        const rfqRef = doc(firestore, 'rfqs', rfq.id);

        // We use a transaction to ensure atomic deletion and status update
        await runTransaction(firestore, async (transaction) => {
            transaction.delete(poRef);
            transaction.update(rfqRef, {
                status: 'sent',
                awardedVendorId: null,
                awardedPoId: null
            });
        });

        toast({ title: 'تم التراجع', description: 'تم حذف أمر الشراء وإعادة فتح طلب التسعير للمقارنة.' });
    } catch (error: any) {
        console.error("Undo failed:", error);
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التراجع عن الترسية.' });
    } finally {
        setIsUndoing(false);
    }
  };

  if (loadingData)
    return (
      <div className="p-8">
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );

  if (comparisonData.vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4 border-2 border-dashed rounded-2xl m-6">
        <AlertCircle className="h-12 w-12 opacity-20" />
        <p className="font-bold">لم يتم استلام أي عروض أسعار لهذا الطلب بعد.</p>
      </div>
    );
  }

  const isAlreadyAwarded = !!rfq.awardedVendorId;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto print:overflow-visible">
        <Table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col className="w-[250px]" />
            <col className="w-[80px]" />
            {comparisonData.vendors.map((v) => (
              <col key={v.id} className="w-[180px]" />
            ))}
          </colgroup>
          <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-20">
            <TableRow className="h-16 border-b-2">
              <TableHead className="font-black text-foreground px-4 sticky right-0 bg-muted/95 border-l">
                اسم الصنف المطلوب
              </TableHead>
              <TableHead className="text-center font-bold text-xs uppercase px-1">الكمية</TableHead>
              {comparisonData.vendors.map((vendor) => (
                <TableHead key={vendor.id} className="text-center px-4 font-black text-primary border-r">
                  <div className="flex flex-col items-center">
                    <span className="truncate w-full text-center">{vendor.name}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">عرض المورد</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparisonData.data.map(({ rfqItem, quotes }) => {
              const prices = quotes.map((q) => q.unitPrice).filter((p) => p !== Infinity);
              const minPrice = prices.length > 0 ? Math.min(...prices) : Infinity;

              return (
                <TableRow key={rfqItem.id} className="h-14 hover:bg-transparent transition-colors border-b">
                  <TableCell className="font-bold px-4 sticky right-0 bg-background/95 z-10 border-l">
                    {rfqItem.itemName}
                  </TableCell>
                  <TableCell className="text-center font-mono font-bold bg-muted/5">
                    {rfqItem.quantity}
                  </TableCell>
                  {comparisonData.vendors.map((vendor) => {
                    const quote = quotes.find((q) => q.vendorId === vendor.id);
                    const isBestPrice = quote?.unitPrice === minPrice && minPrice !== Infinity;
                    const isWinner = rfq.awardedVendorId === vendor.id;

                    return (
                      <TableCell
                        key={vendor.id}
                        className={cn(
                          'text-center font-mono font-bold border-r px-4',
                          isWinner ? 'bg-primary/5 text-primary' : isBestPrice ? 'bg-green-500/10 text-green-700' : 'text-foreground/70'
                        )}
                      >
                        {quote?.unitPrice === Infinity ? (
                          <span className="text-muted-foreground/30 italic text-xs">- غير مسعر -</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center justify-center gap-1.5">
                              {(isWinner || isBestPrice) && <Award className={cn("h-4 w-4", isWinner ? "text-primary fill-primary/20" : "text-green-600 fill-green-600/20")} />}
                              <span>{formatCurrency(quote!.unitPrice)}</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground font-normal">
                              إجمالي: {formatCurrency(quote!.unitPrice * rfqItem.quantity)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-muted/30">
            <TableRow className="h-24 border-t-4 border-primary/20">
              <TableCell colSpan={2} className="text-right px-8 font-black text-lg">
                إجمالي العرض / الترسية:
              </TableCell>
              {comparisonData.vendors.map((vendor) => {
                const isWinner = rfq.awardedVendorId === vendor.id;
                
                return (
                  <TableCell
                    key={vendor.id}
                    className={cn("text-center border-r px-2", isWinner ? "bg-primary/10" : "bg-primary/5")}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className={cn("font-mono text-xl font-black", isWinner ? "text-primary" : "text-foreground/60")}>
                          {formatCurrency(comparisonData.totals[vendor.id!] || 0)}
                      </span>
                      
                      {isAlreadyAwarded ? (
                          isWinner ? (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="h-8 rounded-lg text-[10px] font-bold gap-1 px-3 shadow-md no-print"
                                onClick={handleUndoAward}
                                disabled={isUndoing}
                              >
                                {isUndoing ? <Loader2 className="h-3 w-3 animate-spin"/> : <Undo2 className="h-3 w-3" />}
                                تراجع عن الترسية
                              </Button>
                          ) : (
                              <div className="h-8 flex items-center justify-center">
                                  <Badge variant="secondary" className="text-[9px] opacity-50">تمت الترسية لمورد آخر</Badge>
                              </div>
                          )
                      ) : (
                        <Button 
                            size="sm" 
                            variant="default"
                            className="h-8 rounded-lg text-[10px] font-bold gap-1 px-3 bg-green-600 hover:bg-green-700 no-print"
                            onClick={() => handleAwardClick(vendor)}
                            disabled={isAwarding}
                        >
                            {isAwarding && vendorToAward?.id === vendor.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <ShoppingCart className="h-3 w-3" />}
                            ترسية وإنشاء أمر شراء
                        </Button>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <AlertDialog open={!!vendorToAward} onOpenChange={() => setVendorToAward(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-black">
                <Award className="text-green-600 h-6 w-6" />
                تأكيد الترسية والتحويل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base space-y-4">
              <p>هل أنت متأكد من اختيار عرض سعر المورد <span className="font-bold text-foreground">"{vendorToAward?.name}"</span>؟</p>
              
              {vendorToAward && String(vendorToAward.id).startsWith('prospective-') && (
                  <div className="p-4 bg-blue-50 text-blue-800 rounded-2xl border border-blue-100 text-sm flex items-start gap-3">
                      <UserPlus className="h-5 w-5 mt-0.5 shrink-0 text-blue-600" />
                      <p>هذا المورد محتمل وغير مسجل في النظام. سيقوم النظام بتسجيله تلقائياً كمورد رسمي لإتمام العملية المحاسبية بشكل سليم.</p>
                  </div>
              )}
              <p className="text-sm text-muted-foreground italic">سيتم إنشاء مسودة أمر شراء (Draft PO) ببيانات هذا العرض فوراً.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel disabled={isAwarding} className="rounded-xl px-6">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAward}
              disabled={isAwarding}
              className="bg-green-600 hover:bg-green-700 font-bold rounded-xl px-8"
            >
              {isAwarding ? <Loader2 className="h-4 w-4 animate-spin ml-2"/> : <ShoppingCart className="h-4 w-4 ml-2"/>}
              تأكيد وإنشاء الأمر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
