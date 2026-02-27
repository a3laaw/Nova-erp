
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, runTransaction, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { Award, ShoppingCart, Loader2, Clock, CreditCard, CheckCircle2, Undo2, AlertCircle, Truck, Tag, Calculator } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [isReopening, setIsReopening] = useState(false);
  
  const [selectedAwards, setSelectedAwards] = useState<Record<string, string>>({}); 

  const isLocked = useMemo(() => {
    return rfq.status === 'cancelled' || (rfq.awardedPoIds && rfq.awardedPoIds.length > 0);
  }, [rfq.status, rfq.awardedPoIds]);

  useEffect(() => {
    if (rfq.awardedItems) {
        setSelectedAwards(rfq.awardedItems);
    } else {
        setSelectedAwards({});
    }
  }, [rfq.awardedItems, rfq.id]);

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
            const fetchedVendors: Vendor[] = [];
            for (let i = 0; i < vendorIds.length; i += 30) {
              const chunk = vendorIds.slice(i, i + 30);
              const snap = await getDocs(query(collection(firestore, 'vendors'), where('__name__', 'in', chunk)));
              snap.forEach(d => fetchedVendors.push({ id: d.id, ...d.data() } as Vendor));
            }
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

  const allVendors = useMemo(() => [
    ...registeredVendors,
    ...(rfq.prospectiveVendors || [])
  ], [registeredVendors, rfq.prospectiveVendors]);

  // منطق تصغير الجدول آلياً للطباعة بناءً على عدد الموردين
  const printScaleClass = useMemo(() => {
    if (allVendors.length > 8) return "print-scale-xs";
    if (allVendors.length > 5) return "print-scale-sm";
    return "print-scale-normal";
  }, [allVendors.length]);

  const tableData = useMemo(() => {
    return rfq.items.map(item => {
      const quotesPerVendor = allVendors.map(vendor => {
        const quote = supplierQuotations.find(q => q.vendorId === vendor.id);
        const itemPrice = quote?.items.find(i => i.rfqItemId === item.id)?.unitPrice || 0;
        return { vendorId: vendor.id!, price: itemPrice };
      });

      const validPrices = quotesPerVendor.filter(q => q.price > 0).map(q => q.price);
      const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : Infinity;

      return {
        item,
        quotes: quotesPerVendor,
        minPrice
      };
    });
  }, [rfq.items, allVendors, supplierQuotations]);

  const handleCellClick = (itemId: string, vendorId: string, price: number) => {
    if (price <= 0 || isLocked) return;
    setSelectedAwards(prev => ({
      ...prev,
      [itemId]: prev[itemId] === vendorId ? '' : vendorId
    }));
  };

  const handleAwardToVendor = (vendorId: string) => {
    if (isLocked) return;
    const newAwards = { ...selectedAwards };
    tableData.forEach(row => {
      const quote = row.quotes.find(q => q.vendorId === vendorId);
      if (quote && quote.price > 0) {
        newAwards[row.item.id] = vendorId;
      }
    });
    setSelectedAwards(newAwards);
  };

  const handleReopenRfq = async () => {
    if (!firestore || isReopening) return;
    setIsReopening(true);
    try {
        await updateDoc(doc(firestore, 'rfqs', rfq.id!), { 
            status: 'sent',
            awardedPoIds: []
        });
        toast({ title: 'تم فتح الطلب', description: 'يمكنك الآن تعديل الترسية مرة أخرى.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل إعادة فتح الطلب.' });
    } finally {
        setIsReopening(false);
    }
  };

  const handleConfirmSplitAward = async () => {
    if (!firestore || !currentUser || !rfq.id) return;
    
    const awardedEntries = Object.entries(selectedAwards).filter(([_, vId]) => !!vId);
    if (awardedEntries.length === 0) {
        toast({ variant: 'destructive', title: 'خطأ', description: 'يرجى اختيار مورد واحد على الأقل لترسية بند واحد.' });
        return;
    }

    setIsAwarding(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentYear = new Date().getFullYear();
            const poCounterRef = doc(firestore, 'counters', 'purchaseOrders');
            const poCounterDoc = await transaction.get(poCounterRef);
            let nextPoSeq = (poCounterDoc.data()?.counts?.[currentYear] || 0) + 1;

            const vendorsToProcess = [...new Set(awardedEntries.map(([_, vId]) => vId))];
            const newPoIds: string[] = [];

            for (const vId of vendorsToProcess) {
                const vendorData = allVendors.find(v => v.id === vId)!;
                const quote = supplierQuotations.find(q => q.vendorId === vId)!;
                const awardedItemsInThisPo = rfq.items.filter(ri => selectedAwards[ri.id] === vId);

                const poItems = awardedItemsInThisPo.map(item => {
                    const price = quote.items.find(qi => qi.rfqItemId === item.id)!.unitPrice;
                    return {
                        internalItemId: item.internalItemId,
                        itemName: item.itemName,
                        quantity: item.quantity,
                        unitPrice: price,
                        total: price * item.quantity
                    };
                });

                const poNumber = `PO-${currentYear}-${String(nextPoSeq).padStart(4, '0')}`;
                const newPoRef = doc(collection(firestore, 'purchaseOrders'));
                newPoIds.push(newPoRef.id);

                transaction.set(newPoRef, {
                    poNumber,
                    orderDate: serverTimestamp(),
                    vendorId: vId,
                    vendorName: vendorData.name,
                    projectId: rfq.projectId || null,
                    items: poItems,
                    totalAmount: (poItems.reduce((sum, i) => sum + i.total, 0) - (quote.discountAmount || 0) + (quote.deliveryFees || 0)),
                    status: 'draft',
                    rfqId: rfq.id,
                    supplierQuotationId: quote.id,
                    paymentTerms: quote.paymentTerms || '',
                    createdAt: serverTimestamp(),
                    createdBy: currentUser.id
                });

                nextPoSeq++;
            }

            transaction.set(poCounterRef, { counts: { [currentYear]: nextPoSeq - 1 } }, { merge: true });
            
            transaction.update(doc(firestore, 'rfqs', rfq.id!), {
                status: 'closed',
                awardedVendorId: vendorsToProcess.length === 1 ? vendorsToProcess[0] : 'multiple',
                awardedPoIds: newPoIds,
                awardedItems: selectedAwards 
            });
        });

        toast({ title: 'نجاح الترسية', description: 'تم إنشاء أوامر الشراء وحفظ الترسية.' });
        router.push('/dashboard/purchasing/purchase-orders');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل الترسية', description: e.message });
    } finally {
        setIsAwarding(false);
    }
  };

  if (loadingData) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <div className={cn("space-y-6", printScaleClass)}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .comparison-table-container { overflow: visible !important; display: block !important; }
          table { table-layout: auto !important; width: 100% !important; border-collapse: collapse !important; }
          th, td { position: static !important; background-color: transparent !important; border: 1px solid #ddd !important; padding: 4px !important; overflow: visible !important; }
          .selected-cell-print { background-color: #f1f5f9 !important; border: 2px solid #000 !important; }
          .award-label { display: block !important; font-size: 8px !important; font-weight: 900 !important; color: #000 !important; margin-top: 2px !important; }
          .no-print { display: none !important; }
          .sticky { position: static !important; transform: none !important; }
          /* Dynamic Scaling for large tables */
          .print-scale-xs td, .print-scale-xs th { font-size: 8px !important; }
          .print-scale-sm td, .print-scale-sm th { font-size: 10px !important; }
        }
      `}} />

      <div className="overflow-x-auto comparison-table-container border-2 rounded-[2rem] shadow-sm bg-card">
        <Table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
          <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-30 no-print">
            <TableRow className="border-b-2">
              <TableHead className="px-4 sticky right-0 bg-muted/95 border-l font-black text-foreground min-w-[200px]">بيان الصنف المطلوب</TableHead>
              <TableHead className="text-center font-bold text-xs w-16">الكمية</TableHead>
              {allVendors.map(vendor => {
                const quote = supplierQuotations.find(q => q.vendorId === vendor.id);
                const itemsTotal = rfq.items.reduce((sum, item) => {
                    const price = quote?.items.find(i => i.rfqItemId === item.id)?.unitPrice || 0;
                    return sum + (price * item.quantity);
                }, 0);
                const netTotal = itemsTotal - (quote?.discountAmount || 0) + (quote?.deliveryFees || 0);

                return (
                  <TableHead key={vendor.id} className="p-3 border-r align-top min-w-[180px]">
                    <div className="flex flex-col h-full gap-2">
                      <div className="text-center">
                        <p className="font-black text-primary text-sm leading-tight break-words">
                            {vendor.name}
                        </p>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn("h-6 text-[10px] mt-1 no-print rounded-full", isLocked ? "opacity-0" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
                            onClick={() => handleAwardToVendor(vendor.id!)}
                            disabled={isLocked}
                        >
                            ترسية الكل
                        </Button>
                      </div>
                      <div className="space-y-1 bg-background/50 p-2 rounded-xl border shadow-inner">
                        <div className="flex justify-between text-[9px]"><span className="text-muted-foreground">التوريد:</span> <span className="font-bold">{quote?.deliveryTimeDays || '-'} يوم</span></div>
                        <div className="flex justify-between text-[9px]"><span className="text-muted-foreground">الدفع:</span> <span className="font-bold text-blue-600 truncate max-w-[80px]">{quote?.paymentTerms || 'نقدي'}</span></div>
                        <div className="flex justify-between text-[9px] text-green-600"><span className="font-medium">الخصم:</span> <span className="font-bold">{formatCurrency(quote?.discountAmount || 0)}</span></div>
                        <div className="flex justify-between text-[9px] text-red-600"><span className="font-medium">التوصيل:</span> <span className="font-bold">{formatCurrency(quote?.deliveryFees || 0)}</span></div>
                        <Separator className="my-1"/>
                        <div className="flex justify-between text-[10px] font-black text-primary"><span>الصافي:</span> <span>{formatCurrency(netTotal)}</span></div>
                      </div>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {tableData.map(({ item, quotes, minPrice }) => (
              <TableRow key={item.id} className="h-14 hover:bg-muted/5 transition-colors border-b">
                <TableCell className="font-bold px-4 md:sticky right-0 bg-background/95 z-10 border-l">{item.itemName}</TableCell>
                <TableCell className="text-center font-mono font-bold bg-muted/5">{item.quantity}</TableCell>
                {allVendors.map(vendor => {
                  const quote = quotes.find(q => q.vendorId === vendor.id);
                  const isBest = quote?.price === minPrice && minPrice !== Infinity;
                  const isSelected = selectedAwards[item.id] === vendor.id;

                  return (
                    <TableCell
                      key={vendor.id}
                      className={cn(
                        "text-center transition-all border-r p-0",
                        !isLocked && "cursor-pointer",
                        isSelected ? "bg-blue-50/50 border-2 border-primary ring-inset selected-cell-print" : isBest ? "bg-green-500/5" : ""
                      )}
                      onClick={() => handleCellClick(item.id, vendor.id!, quote?.price || 0)}
                    >
                      {quote?.price ? (
                        <div className="flex flex-col items-center justify-center h-14 relative overflow-visible">
                          <div className={cn(
                            "flex items-center gap-1 font-mono font-black", 
                            isSelected ? "text-primary text-base scale-110" : isBest ? "text-green-700" : "text-foreground/60"
                          )}>
                            {formatCurrency(quote.price)}
                          </div>
                          {isSelected && <div className="hidden award-label text-[8px] font-black uppercase text-primary mt-1">[ تم الاختيار ]</div>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/20 italic">-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {!isLocked ? (
        <div className="flex justify-between items-center p-6 bg-primary/5 rounded-3xl border-2 border-primary/10 shadow-lg mx-4 no-print">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Calculator className="h-8 w-8" /></div>
                <div>
                    <h4 className="font-black text-lg text-primary">اعتماد الترسية المختارة</h4>
                    <p className="text-xs text-muted-foreground">سيتم خصم الخصومات وإضافة رسوم التوصيل لكل أمر شراء آلياً.</p>
                </div>
            </div>
            <Button onClick={handleConfirmSplitAward} disabled={isAwarding || Object.values(selectedAwards).filter(Boolean).length === 0} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3">
                {isAwarding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Award className="h-6 w-6" />}
                اعتماد وتحويل لأوامر شراء
            </Button>
        </div>
      ) : (
          <div className="mx-4 space-y-4 no-print">
              <div className="p-6 bg-green-50 border-2 border-dashed border-green-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <div>
                          <p className="font-black text-green-800">تمت الترسية وإصدار أوامر الشراء بنجاح.</p>
                          <p className="text-xs text-green-700">البيانات مجمّدة للمراجعة، يمكنك إعادة فتح الطلب إذا كنت تمتلك الصلاحية.</p>
                      </div>
                  </div>
                  <Button onClick={handleReopenRfq} disabled={isReopening} variant="outline" className="rounded-xl border-orange-200 text-orange-700 hover:bg-orange-50 font-bold gap-2">
                      {isReopening ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4" />}
                      إعادة فتح للتعديل
                  </Button>
              </div>
          </div>
      )}
    </div>
  );
}
