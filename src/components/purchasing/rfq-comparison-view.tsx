'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, Item } from '@/lib/types';
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
import { Award, ShoppingCart, Loader2, Clock, CreditCard, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
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
  const [selectedAwards, setSelectedAwards] = useState<Record<string, string>>({}); 

  // جلب البيانات الأساسية (الموردين وعروضهم)
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

  // تجهيز مصفوفة البيانات
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

  // التعامل مع النقر للترسية الحية
  const handleCellClick = (itemId: string, vendorId: string, price: number) => {
    if (price <= 0 || !!rfq.awardedVendorId) return;
    setSelectedAwards(prev => ({
      ...prev,
      [itemId]: prev[itemId] === vendorId ? '' : vendorId
    }));
  };

  // ترسية كل بنود المورد بنقرة واحدة
  const handleAwardToVendor = (vendorId: string) => {
    if (!!rfq.awardedVendorId) return;
    const newAwards = { ...selectedAwards };
    tableData.forEach(row => {
      const quote = row.quotes.find(q => q.vendorId === vendorId);
      if (quote && quote.price > 0) {
        newAwards[row.item.id] = vendorId;
      }
    });
    setSelectedAwards(newAwards);
  };

  const handleConfirmSplitAward = async () => {
    if (!firestore || !currentUser || !rfq.id) return;
    
    const itemIds = Object.keys(selectedAwards).filter(id => !!selectedAwards[id]);
    if (itemIds.length === 0) {
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

            const vendorsToProcess = [...new Set(Object.values(selectedAwards).filter(Boolean))];
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
                    totalAmount: poItems.reduce((sum, i) => sum + i.total, 0),
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
                awardedPoIds: newPoIds
            });
        });

        toast({ title: 'نجاح الترسية', description: 'تم إنشاء أوامر الشراء للموردين المختارين.' });
        router.push('/dashboard/purchasing/purchase-orders');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'فشل الترسية', description: e.message });
    } finally {
        setIsAwarding(false);
    }
  };

  if (loadingData) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
      {/* استايل خاص للطباعة لإجبار البيانات على الظهور */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .comparison-table-container {
            overflow: visible !important;
            display: block !important;
          }
          table {
            table-layout: auto !important;
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            position: static !important;
            background-color: transparent !important;
            border: 1px solid #ddd !important;
            overflow: visible !important;
            z-index: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
          }
          .award-label {
            display: block !important;
            font-size: 8px !important;
            font-weight: bold !important;
            color: #000 !important;
            margin-top: 2px !important;
          }
          .selected-cell-print {
            background-color: #f0f0f0 !important;
            border: 2px solid #000 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="overflow-x-auto comparison-table-container">
        <Table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col className="w-[220px]" />
            <col className="w-[70px]" />
            {allVendors.map(v => <col key={v.id} className="min-w-[180px]" />)}
          </colgroup>
          <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-30">
            <TableRow className="min-h-24 border-b-2">
              <TableHead className="px-4 sticky right-0 bg-muted/95 border-l font-black text-foreground">بيان الصنف المطلوب</TableHead>
              <TableHead className="text-center font-bold text-xs">الكمية</TableHead>
              {allVendors.map(vendor => {
                const quote = supplierQuotations.find(q => q.vendorId === vendor.id);
                const isCredit = quote?.paymentTerms?.toLowerCase().includes('credit') || quote?.paymentTerms?.includes('آجل') || quote?.paymentTerms?.includes('حساب');
                
                return (
                  <TableHead key={vendor.id} className="p-2 border-r align-top">
                    <div className="flex flex-col h-full gap-2 min-h-[100px]">
                      <div className="text-center px-1">
                        <p className="font-black text-primary text-sm whitespace-normal leading-tight break-words">
                            {vendor.name}
                        </p>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] text-muted-foreground hover:text-primary mt-1 no-print"
                            onClick={() => handleAwardToVendor(vendor.id!)}
                            disabled={!!rfq.awardedVendorId}
                        >ترسية الكل هنا</Button>
                      </div>
                      <div className="flex justify-center gap-1 mt-auto no-print">
                        <Badge variant="outline" className={cn("text-[9px] px-1 h-5 gap-1", isCredit ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700")}>
                            {isCredit ? <CreditCard className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {isCredit ? 'آجل' : 'نقدي'}
                        </Badge>
                        {quote?.deliveryTimeDays && (
                            <Badge variant="secondary" className="text-[9px] px-1 h-5">{quote.deliveryTimeDays} يوم</Badge>
                        )}
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
                <TableCell className="font-bold px-4 sticky right-0 bg-background/95 z-10 border-l">{item.itemName}</TableCell>
                <TableCell className="text-center font-mono font-bold bg-muted/5">{item.quantity}</TableCell>
                {allVendors.map(vendor => {
                  const quote = quotes.find(q => q.vendorId === vendor.id);
                  const isBest = quote?.price === minPrice && minPrice !== Infinity;
                  const isSelected = selectedAwards[item.id] === vendor.id;
                  const isLocked = !!rfq.awardedVendorId;

                  return (
                    <TableCell
                      key={vendor.id}
                      className={cn(
                        "text-center cursor-pointer transition-all border-r p-0",
                        isSelected ? "bg-primary/10 border-primary/40 selected-cell-print" : isBest ? "bg-green-500/5" : "",
                        isLocked && "cursor-default"
                      )}
                      onClick={() => handleCellClick(item.id, vendor.id!, quote?.price || 0)}
                    >
                      {quote?.price ? (
                        <div className="flex flex-col items-center justify-center h-14 relative overflow-visible">
                          <div className={cn(
                            "flex items-center gap-1 font-mono font-black", 
                            isSelected ? "text-primary text-lg" : isBest ? "text-green-700" : "text-foreground/60"
                          )}>
                            {isSelected && <CheckCircle2 className="h-4 w-4 fill-primary/20 no-print" />}
                            {formatCurrency(quote.price)}
                          </div>
                          {/* تمييز صريح في الطباعة */}
                          {isSelected && (
                            <div className="hidden award-label">
                              [ تم الاختيار ]
                            </div>
                          )}
                          {!isSelected && isBest && (
                             <div className="absolute top-1 left-1 text-[8px] font-bold text-green-600 uppercase tracking-tighter no-print">
                                أفضل سعر
                             </div>
                          )}
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

      {!rfq.awardedVendorId && (
        <div className="flex justify-between items-center p-6 bg-primary/5 rounded-3xl border-2 border-primary/10 shadow-lg mx-4 no-print">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Award className="h-8 w-8" /></div>
                <div>
                    <h4 className="font-black text-lg text-primary">اعتماد الترسية المختارة</h4>
                    <p className="text-xs text-muted-foreground">تم اختيار موردين لـ {Object.values(selectedAwards).filter(Boolean).length} من أصل {rfq.items.length} بنود.</p>
                </div>
            </div>
            <Button 
                onClick={handleConfirmSplitAward} 
                disabled={isAwarding || Object.values(selectedAwards).filter(Boolean).length === 0}
                className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3"
            >
                {isAwarding ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShoppingCart className="h-6 w-6" />}
                اعتماد وتحويل لأوامر شراء
            </Button>
        </div>
      )}
    </div>
  );
}
