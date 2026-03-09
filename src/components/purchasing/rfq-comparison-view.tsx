'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, where, runTransaction, doc, serverTimestamp, orderBy, updateDoc } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, PurchaseOrder } from '@/lib/types';
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
import { Award, Loader2, CheckCircle2, Undo2, Calculator, Printer, ArrowRight, Star, Sparkles, Zap, ShieldCheck, Truck, Percent, Ban } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Label } from '../ui/label';
import { Separator } from '@/components/ui/separator';
import { useBranding } from '@/context/branding-context';
import { Logo } from '../layout/logo';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toFirestoreDate } from '@/services/date-converter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RfqComparisonViewProps {
  rfq: RequestForQuotation;
}

const VENDORS_PER_PAGE = 3; 

export function RfqComparisonView({ rfq }: RfqComparisonViewProps) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { branding } = useBranding();

  const [isAwarding, setIsAwarding] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [selectedAwards, setSelectedAwards] = useState<Record<string, string>>({}); 

  const { data: allVendorsList, loading: vendorsLoading } = useSubscription<Vendor>(
    firestore, 
    'vendors', 
    useMemo(() => [orderBy('name')], [])
  );

  const quotesQuery = useMemo(() => [where('rfqId', '==', rfq.id)], [rfq.id]);
  const { data: supplierQuotations, loading: quotesLoading } = useSubscription<SupplierQuotation>(
    firestore, 
    'supplierQuotations', 
    quotesQuery
  );

  const allVendors = useMemo(() => {
    if (!allVendorsList) return [];
    const registered = allVendorsList.filter(v => rfq.vendorIds?.includes(v.id!));
    const prospective = rfq.prospectiveVendors || [];
    return [...registered, ...prospective];
  }, [allVendorsList, rfq.vendorIds, rfq.prospectiveVendors]);

  const vendorChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < allVendors.length; i += VENDORS_PER_PAGE) {
      chunks.push(allVendors.slice(i, i + VENDORS_PER_PAGE));
    }
    return chunks;
  }, [allVendors]);

  // محرك تحليل المميزات والعيوب (Intelligence Analysis)
  const vendorIntelligence = useMemo(() => {
    const analysis: Record<string, any> = {};
    
    allVendors.forEach(v => {
        const quote = supplierQuotations.find(q => q.vendorId === v.id);
        if (!quote) return;

        analysis[v.id!] = {
            isFastest: quote.deliveryTimeDays === Math.min(...supplierQuotations.map(q => q.deliveryTimeDays || 999)),
            isCheapestNet: false, // Calculated per item usually
            highestDiscount: quote.discountAmount === Math.max(...supplierQuotations.map(q => q.discountAmount || 0)) && quote.discountAmount > 0,
            hasFreeDelivery: (quote.deliveryFees || 0) === 0,
            isCredit: quote.paymentTerms?.includes('آجل') || quote.paymentTerms?.toLowerCase().includes('credit'),
        };
    });
    
    return analysis;
  }, [allVendors, supplierQuotations]);

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
    if (price <= 0 || isLocked || rfq.status === 'cancelled') return;
    setSelectedAwards(prev => ({
      ...prev,
      [itemId]: prev[itemId] === vendorId ? '' : vendorId
    }));
  };

  const handleAwardToVendor = (vendorId: string) => {
    if (isLocked || rfq.status === 'cancelled') return;
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

                const itemsSum = poItems.reduce((sum, i) => sum + i.total, 0);
                const finalTotal = itemsSum - (quote.discountAmount || 0) + (quote.deliveryFees || 0);

                transaction.set(newPoRef, {
                    poNumber,
                    orderDate: serverTimestamp(),
                    vendorId: vId,
                    vendorName: vendorData.name,
                    projectId: rfq.projectId || null,
                    items: poItems,
                    totalAmount: finalTotal,
                    discountAmount: quote.discountAmount || 0,
                    deliveryFees: quote.deliveryFees || 0,
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

  const loading = vendorsLoading || quotesLoading;

  if (loading) return <div className="p-8"><Skeleton className="h-[500px] w-full rounded-2xl" /></div>;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <div className="border-2 rounded-[2.5rem] shadow-xl overflow-x-auto bg-card scrollbar-none">
          <Table className="w-full border-collapse table-auto">
            <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-30">
              <TableRow className="border-b-2">
                <TableHead className="px-6 text-right sticky right-0 bg-muted/95 border-l font-black text-foreground w-auto min-w-[250px]">بيان الصنف المطلوب</TableHead>
                <TableHead className="text-center font-bold px-4 w-auto whitespace-nowrap">الكمية</TableHead>
                {allVendors.map(vendor => {
                  const quote = supplierQuotations.find(q => q.vendorId === vendor.id);
                  const intel = vendorIntelligence[vendor.id!] || {};
                  
                  const itemsTotal = rfq.items.reduce((sum, item) => {
                      const price = quote?.items.find(i => i.rfqItemId === item.id)?.unitPrice || 0;
                      return sum + (price * item.quantity);
                  }, 0);
                  const netTotal = itemsTotal - (quote?.discountAmount || 0) + (quote?.deliveryFees || 0);

                  return (
                    <TableHead key={vendor.id} className="p-4 border-r align-top min-w-[220px]">
                      <div className="flex flex-col h-full gap-3">
                        <div className="text-center">
                          <p className="font-black text-primary text-base leading-tight h-12 flex items-center justify-center">{vendor.name}</p>
                          <div className="flex flex-wrap justify-center gap-1 mt-1">
                             {intel.isFastest && <Badge className="bg-orange-500 hover:bg-orange-500 text-[8px] font-black h-4 px-1.5 gap-1"><Zap className="h-2 w-2"/> الأسرع</Badge>}
                             {intel.highestDiscount && <Badge className="bg-green-600 hover:bg-green-600 text-[8px] font-black h-4 px-1.5 gap-1"><Percent className="h-2 w-2"/> خصم عالٍ</Badge>}
                             {intel.isCredit && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-blue-200 text-blue-700 bg-blue-50">آجل</Badge>}
                             {intel.hasFreeDelivery && <Badge variant="outline" className="text-[8px] font-black h-4 px-1.5 border-teal-200 text-teal-700 bg-teal-50">توصيل مجاني</Badge>}
                          </div>
                        </div>
                        <div className="space-y-1.5 bg-background/50 p-3 rounded-2xl border shadow-inner">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground font-bold">التوريد:</span> 
                            <span className={cn("font-black", intel.isFastest ? "text-orange-600" : "")}>
                                {quote?.deliveryTimeDays === 0 ? 'فوري' : quote?.deliveryTimeDays ? `${quote.deliveryTimeDays} يوم` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground font-bold">طريقة الدفع:</span> 
                            <span className={cn("font-black", intel.isCredit ? "text-blue-600" : "")}>{quote?.paymentTerms || 'نقدي'}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-green-600">
                            <span className="font-bold">إجمالي الخصم:</span> 
                            <span className="font-black">{formatCurrency(quote?.discountAmount || 0)}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-red-600">
                            <span className="font-bold">التوصيل:</span> 
                            <span className="font-black">{intel.hasFreeDelivery ? 'مجاني' : formatCurrency(quote?.deliveryFees || 0)}</span>
                          </div>
                          <Separator className="my-1.5"/>
                          <div className="flex justify-between text-xs font-black text-primary"><span>الصافي المعتمد:</span> <span>{formatCurrency(netTotal)}</span></div>
                        </div>
                        {!isLocked && (
                            <Button 
                                variant="outline" size="sm" 
                                className="h-8 text-[10px] font-black border-primary/20 text-primary hover:bg-primary hover:text-white rounded-xl"
                                onClick={() => handleAwardToVendor(vendor.id!)}
                                disabled={isLocked || rfq.status === 'cancelled'}
                            >
                                اختيار كامل العرض للترسية
                            </Button>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map(({ item, quotes, minPrice }) => (
                <TableRow key={item.id} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                  <TableCell className="font-black px-6 text-right sticky right-0 bg-background/95 z-10 border-l text-sm">{item.itemName}</TableCell>
                  <TableCell className="text-center font-mono font-black bg-muted/5 px-4 whitespace-nowrap text-muted-foreground">{item.quantity}</TableCell>
                  {allVendors.map(vendor => {
                    const quote = quotes.find(q => q.vendorId === vendor.id);
                    const isBest = quote?.price === minPrice && minPrice !== Infinity;
                    const isSelected = selectedAwards[item.id] === vendor.id;
                    return (
                      <TableCell key={vendor.id} className={cn("text-center border-r p-0 min-w-[140px] transition-all", !isLocked && rfq.status !== 'cancelled' && "cursor-pointer", isSelected && "bg-primary/5 border-2 border-primary shadow-inner")} onClick={() => handleCellClick(item.id, vendor.id!, quote?.price || 0)}>
                        {quote?.price ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className={cn("font-mono font-black text-lg", isSelected ? "text-primary scale-110" : isBest ? "text-green-700" : "text-foreground/60")}>
                                {formatCurrency(quote.price)}
                            </div>
                            {isBest && !isSelected && <Badge className="h-3 text-[7px] font-black bg-green-100 text-green-700 border-none px-1">الأقل سعراً</Badge>}
                            {isSelected && <Badge className="h-4 text-[8px] font-black bg-primary text-white border-none px-2 rounded-full shadow-sm animate-in zoom-in">مختار للترسية</Badge>}
                          </div>
                        ) : (
                            <div className="opacity-20 flex flex-col items-center"><Ban className="h-4 w-4"/> <span className="text-[8px] font-bold">لم يسعّر</span></div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-6">
            {rfq.status !== 'cancelled' && !isLocked ? (
                <div className="flex justify-between items-center p-8 bg-primary/5 rounded-[2.5rem] border-2 border-primary/10 shadow-2xl animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-primary/10 rounded-3xl text-primary shadow-inner"><Calculator className="h-10 w-10" /></div>
                        <div>
                            <h4 className="font-black text-2xl text-primary tracking-tight">اعتماد قرار الشراء</h4>
                            <p className="text-sm text-muted-foreground font-bold mt-1">سيقوم النظام آلياً بفرز الأصناف المختارة وتوليد أوامر شراء منفصلة (POs) لكل مورد تم اختياره.</p>
                        </div>
                    </div>
                    <Button onClick={handleConfirmSplitAward} disabled={isAwarding || Object.values(selectedAwards).filter(Boolean).length === 0} className="h-16 px-16 rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 gap-3 min-w-[350px]">
                        {isAwarding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Award className="h-6 w-6" />}
                        اعتماد الترسية وإصدار الأوامر
                    </Button>
                </div>
            ) : isLocked && (
                <div className="p-8 bg-green-50 border-2 border-dashed border-green-200 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-2xl text-green-600"><CheckCircle2 className="h-10 w-10" /></div>
                        <div>
                            <p className="font-black text-green-800 text-2xl tracking-tight">تمت الترسية وتحويل الطلب لأوامر شراء</p>
                            <p className="text-sm text-green-700 font-bold">المصفوفة الآن مؤرشفة ومرتبطة بـ {rfq.awardedPoIds?.length} أوامر شراء صادرة.</p>
                        </div>
                    </div>
                    <Button onClick={handleReopenRfq} disabled={isReopening} variant="outline" className="h-12 px-8 rounded-xl text-orange-700 border-orange-200 hover:bg-orange-50 font-black gap-2 transition-all">
                        {isReopening ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4" />}
                        تراجع عن الترسية (إعادة تحرير)
                    </Button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
