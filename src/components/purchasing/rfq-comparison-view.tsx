
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
import { Award, Loader2, CheckCircle2, Undo2, Calculator, Printer, ArrowRight, Star } from 'lucide-react';
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

                // حساب الصافي: (مجموع البنود) - الخصم + التوصيل
                // ملاحظة: إذا كانت الترسية جزئية، قد ترغب في توزيع الخصم والتوصيل تناسبياً، 
                // ولكن للتبسيط سنعتبر الخصم والتوصيل يطبق بالكامل على المورد المختار.
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
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body { background: white !important; height: auto !important; overflow: visible !important; }
          .no-print { display: none !important; }
          
          #printable-multi-page-area {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
          }

          .print-page-container {
            break-after: page;
            page-break-after: always;
            width: 100% !important;
            padding: 0 !important;
            margin-bottom: 40px;
          }

          table { 
            width: 100% !important; 
            border-collapse: collapse !important; 
            border: 1px solid #000 !important; 
            table-layout: auto !important;
          }
          
          th, td { 
            border: 1px solid #ddd !important; 
            padding: 8px !important; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
          }
          
          .text-green-print { color: #16a34a !important; font-weight: bold !important; }
          .text-red-print { color: #dc2626 !important; font-weight: bold !important; }
          .text-blue-print { color: #2563eb !important; font-weight: bold !important; }
          .bg-muted-print { background-color: #f8fafc !important; }
          
          .desc-col-print { 
            width: 1% !important; 
            white-space: normal !important; 
            min-width: 200px !important; 
            text-align: right !important;
          }
          .qty-col-print { 
            width: 1% !important; 
            white-space: nowrap !important; 
            text-align: center !important; 
          }
          
          .awarded-cell-print { 
            border: 3px solid #eab308 !important; 
            background-color: #fefce8 !important; 
          }
          .awarded-badge-print { 
            display: inline-block !important; 
            font-size: 7pt !important; 
            background: #eab308 !important; 
            color: #000 !important; 
            padding: 2px 6px !important; 
            border-radius: 4px !important; 
            margin-bottom: 4px !important; 
            font-weight: bold !important;
          }
        }
      `}} />

      <div className="no-print space-y-6">
        <div className="border-2 rounded-[2rem] shadow-sm overflow-x-auto bg-card">
          <Table className="w-full border-collapse table-auto">
            <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-30">
              <TableRow className="border-b-2">
                <TableHead className="px-4 text-right sticky right-0 bg-muted/95 border-l font-black text-foreground w-auto min-w-[200px]">بيان الصنف المطلوب</TableHead>
                <TableHead className="text-center font-bold px-4 w-auto whitespace-nowrap">الكمية</TableHead>
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
                          <p className="font-black text-primary text-sm leading-tight h-10 flex items-center justify-center">{vendor.name}</p>
                          <Button 
                              variant="ghost" size="sm" 
                              className={cn("h-6 text-[10px] mt-1 rounded-full", isLocked ? "opacity-0" : "text-muted-foreground hover:text-primary hover:bg-primary/10")}
                              onClick={() => handleAwardToVendor(vendor.id!)}
                              disabled={isLocked || rfq.status === 'cancelled'}
                          >
                              ترسية الكل هنا
                          </Button>
                        </div>
                        <div className="space-y-1 bg-background/50 p-2 rounded-xl border shadow-inner">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-muted-foreground">التوريد:</span> 
                            <span className="font-bold">
                                {quote?.deliveryTimeDays === 0 ? 'في نفس اليوم' : quote?.deliveryTimeDays ? `${quote.deliveryTimeDays} يوم` : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between text-[9px]"><span className="text-muted-foreground">الدفع:</span> <span className="font-bold text-blue-600 truncate max-w-[80px]">{quote?.paymentTerms || 'نقدي'}</span></div>
                          <div className="flex justify-between text-[9px] text-green-600"><span>الخصم:</span> <span className="font-bold">{formatCurrency(quote?.discountAmount || 0)}</span></div>
                          <div className="flex justify-between text-[9px] text-red-600"><span>التوصيل:</span> <span className="font-bold">{formatCurrency(quote?.deliveryFees || 0)}</span></div>
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
                <TableRow key={item.id} className="h-14 hover:bg-muted/5 transition-colors border-b last:border-0">
                  <TableCell className="font-bold px-4 text-right sticky right-0 bg-background/95 z-10 border-l">{item.itemName}</TableCell>
                  <TableCell className="text-center font-mono font-bold bg-muted/5 px-4 whitespace-nowrap">{item.quantity}</TableCell>
                  {allVendors.map(vendor => {
                    const quote = quotes.find(q => q.vendorId === vendor.id);
                    const isBest = quote?.price === minPrice && minPrice !== Infinity;
                    const isSelected = selectedAwards[item.id] === vendor.id;
                    return (
                      <TableCell key={vendor.id} className={cn("text-center border-r p-0 min-w-[120px]", !isLocked && rfq.status !== 'cancelled' && "cursor-pointer", isSelected && "bg-primary/10 border-2 border-primary shadow-inner")} onClick={() => handleCellClick(item.id, vendor.id!, quote?.price || 0)}>
                        {quote?.price ? (
                          <div className={cn("font-mono font-black", isSelected ? "text-primary scale-110" : isBest ? "text-green-700" : "text-foreground/60")}>
                            {formatCurrency(quote.price)}
                          </div>
                        ) : "-"}
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
                <div className="flex justify-between items-center p-6 bg-primary/5 rounded-3xl border-2 border-primary/10 shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary h-14 w-14 flex items-center justify-center"><Calculator className="h-8 w-8" /></div>
                        <div>
                            <h4 className="font-black text-lg text-primary">اعتماد الترسية وإصدار الأوامر</h4>
                            <p className="text-xs text-muted-foreground font-medium">سيتم إنشاء أوامر شراء منفصلة لكل مورد تم اختياره تلقائياً.</p>
                        </div>
                    </div>
                    <Button onClick={handleConfirmSplitAward} disabled={isAwarding || Object.values(selectedAwards).filter(Boolean).length === 0} className="h-14 px-12 rounded-2xl font-black text-xl shadow-xl shadow-primary/20 gap-3">
                        {isAwarding ? <Loader2 className="h-6 w-6 animate-spin" /> : <Award className="h-6 w-6" />}
                        اعتماد وتحويل لأوامر شراء
                    </Button>
                </div>
            ) : isLocked && (
                <div className="p-6 bg-green-50 border-2 border-dashed border-green-200 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-10 w-10 text-green-600" />
                        <div>
                            <p className="font-black text-green-800 text-lg">تمت الترسية وإصدار أوامر الشراء بنجاح.</p>
                            <p className="text-xs text-green-700 font-medium">المصفوفة الآن في وضع المراجعة والأرشفة.</p>
                        </div>
                    </div>
                    <Button onClick={handleReopenRfq} disabled={isReopening} variant="ghost" className="rounded-xl text-orange-700 hover:bg-orange-50 font-bold gap-2">
                        {isReopening ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo2 className="h-4 w-4" />}
                        إعادة فتح الترسية (للمدير)
                    </Button>
                </div>
            )}
        </div>
      </div>

      <div id="printable-multi-page-area" className="hidden print:block">
        {vendorChunks.map((chunk, chunkIndex) => (
          <div key={chunkIndex} className="print-page-container">
            <div className="flex justify-between items-start mb-6 border-b-4 border-primary/20 pb-4">
              <div className="flex items-center gap-4">
                <Logo className="h-14 w-14 !p-1 bg-white border" logoUrl={branding?.logo_url} companyName={branding?.company_name} />
                <div>
                  <h1 className="text-xl font-black">{branding?.company_name || 'Nova ERP'}</h1>
                  <p className="text-[9px] text-muted-foreground">{branding?.address}</p>
                </div>
              </div>
              <div className="text-left space-y-1">
                <h2 className="text-2xl font-black text-primary">مصفوفة مقارنة عروض الأسعار</h2>
                <p className="text-[10px] font-bold font-mono">الطلب: {rfq.rfqNumber} | صفحة {chunkIndex + 1} من {vendorChunks.length}</p>
                <p className="text-[9px] text-muted-foreground">تاريخ التحليل: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ar })}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr className="bg-muted-print">
                  <th className="desc-col-print">بيان الصنف المطلوب</th>
                  <th className="qty-col-print">الكمية</th>
                  {chunk.map(vendor => {
                    const quote = supplierQuotations.find(q => q.vendorId === vendor.id);
                    const itemsTotal = rfq.items.reduce((sum, item) => {
                        const price = quote?.items.find(i => i.rfqItemId === item.id)?.unitPrice || 0;
                        return sum + (price * item.quantity);
                    }, 0);
                    const netTotal = itemsTotal - (quote?.discountAmount || 0) + (quote?.deliveryFees || 0);

                    return (
                      <th key={vendor.id} className="text-center align-top">
                        <div className="space-y-1 min-w-[150px]">
                          <p className="font-black text-blue-print border-b-2 pb-1 mb-2 text-sm">{vendor.name}</p>
                          <div className="text-[8pt] font-normal space-y-1 text-right px-2">
                            <div><span className="opacity-60">التوريد:</span> <b>
                                {quote?.deliveryTimeDays === 0 ? 'في نفس اليوم' : quote?.deliveryTimeDays ? `${quote.deliveryTimeDays} يوم` : '-'}
                            </b></div>
                            <div className="text-blue-print"><span className="opacity-60">الدفع:</span> <b>{quote?.paymentTerms || 'نقدي'}</b></div>
                            <div className="text-green-print"><span className="opacity-60">الخصم:</span> <b>{formatCurrency(quote?.discountAmount || 0)}</b></div>
                            <div className="text-red-print"><span className="opacity-60">التوصيل:</span> <b>{formatCurrency(quote?.deliveryFees || 0)}</b></div>
                            <Separator className="my-1 border-gray-300"/>
                            <div className="font-black text-blue-print text-sm pt-1">الصافي: {formatCurrency(netTotal)}</div>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {tableData.map(({ item, quotes, minPrice }) => (
                  <tr key={item.id}>
                    <td className="font-bold text-right text-sm">{item.itemName}</td>
                    <td className="text-center font-mono font-bold">{item.quantity}</td>
                    {chunk.map(vendor => {
                      const quote = quotes.find(q => q.vendorId === vendor.id);
                      const isBest = quote?.price === minPrice && minPrice !== Infinity;
                      const isSelected = selectedAwards[item.id] === vendor.id;
                      return (
                        <td key={vendor.id} className={cn("text-center font-mono font-black text-base", isSelected && "awarded-cell-print")}>
                          {isSelected && <div className="awarded-badge-print">[ تم الاختيار ]</div>}
                          <div className={cn(isBest && !isSelected && "text-green-print")}>
                            {quote?.price ? formatCurrency(quote.price) : "-"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-12 mt-16 text-center text-[9pt] border-t-2 pt-6">
                <div><p className="font-black mb-10">إعداد / قسم المشتريات</p><div className="border-t border-dashed pt-1">التوقيع والتاريخ</div></div>
                <div><p className="font-black mb-10">مراجعة / الإدارة المالية</p><div className="border-t border-dashed pt-1">الختم والاعتماد</div></div>
                <div><p className="font-black mb-10">اعتماد / مدير العمليات</p><div className="border-t border-dashed pt-1">الموافقة النهائية</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
