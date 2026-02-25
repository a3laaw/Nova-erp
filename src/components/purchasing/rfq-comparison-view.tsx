'use client';

import { useMemo } from 'react';
import { useSubscription } from '@/firebase';
import { useFirebase } from '@/firebase';
import { query, where } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, RfqItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { Award, AlertCircle } from 'lucide-react';

interface RfqComparisonViewProps {
  rfq: RequestForQuotation;
}

interface ComparisonData {
    rfqItem: RfqItem;
    quotes: {
        vendorId: string;
        vendorName: string;
        unitPrice: number;
    }[];
}

export function RfqComparisonView({ rfq }: RfqComparisonViewProps) {
    const { firestore } = useFirebase();

    const supplierQuotesQuery = useMemo(() => {
        if (!firestore || !rfq.id) return null;
        return [where('rfqId', '==', rfq.id)];
    }, [firestore, rfq.id]);

    const { data: supplierQuotations, loading: quotesLoading } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations', supplierQuotesQuery || []);

    const vendorsQuery = useMemo(() => {
        if (!firestore || !rfq.vendorIds || rfq.vendorIds.length === 0) return null;
        return [where('__name__', 'in', rfq.vendorIds)];
    }, [firestore, rfq.vendorIds]);
    const { data: vendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', vendorsQuery || []);

    const loading = quotesLoading || vendorsLoading;
    
    const comparisonData = useMemo((): { data: ComparisonData[], vendors: Vendor[], totals: Record<string, number> } => {
        if (loading || !rfq || !supplierQuotations || !vendors) {
            return { data: [], vendors: [], totals: {} };
        }

        const participatingVendors = vendors.filter(v => supplierQuotations.some(q => q.vendorId === v.id));
        const totals: Record<string, number> = {};
        participatingVendors.forEach(v => totals[v.id!] = 0);

        const data = rfq.items.map(rfqItem => {
            const quotes = participatingVendors.map(vendor => {
                const vendorQuote = supplierQuotations.find(q => q.vendorId === vendor.id);
                const quoteItem = vendorQuote?.items.find(i => i.rfqItemId === rfqItem.id);
                const unitPrice = quoteItem?.unitPrice ?? Infinity;
                
                if (unitPrice !== Infinity) {
                    totals[vendor.id!] += unitPrice * rfqItem.quantity;
                }
                
                return {
                    vendorId: vendor.id!,
                    vendorName: vendor.name,
                    unitPrice: unitPrice,
                };
            });
            return { rfqItem, quotes };
        });

        return { data, vendors: participatingVendors, totals };
    }, [loading, rfq, supplierQuotations, vendors]);
    
    if (loading) return <div className="p-8"><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    if (comparisonData.vendors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4 border-2 border-dashed rounded-2xl m-6">
                <AlertCircle className="h-12 w-12 opacity-20" />
                <p className="font-bold">لم يتم استلام أي عروض أسعار لهذا الطلب بعد.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto print:overflow-visible">
            <Table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                    <col className="w-[250px]" />
                    <col className="w-[80px]" />
                    {comparisonData.vendors.map(v => <col key={v.id} className="w-[180px]" />)}
                </colgroup>
                <TableHeader className="bg-muted/80 backdrop-blur-sm sticky top-0 z-20">
                    <TableRow className="h-16 border-b-2">
                        <TableHead className="font-black text-foreground px-4 sticky right-0 bg-muted/95 border-l">اسم الصنف المطلوب</TableHead>
                        <TableHead className="text-center font-bold text-xs uppercase px-1">الكمية</TableHead>
                        {comparisonData.vendors.map(vendor => (
                            <TableHead key={vendor.id} className="text-center px-4 font-black text-primary border-r">
                                <div className="flex flex-col items-center">
                                    <span className="truncate w-full">{vendor.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">عرض المورد</span>
                                </div>
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {comparisonData.data.map(({ rfqItem, quotes }) => {
                        const prices = quotes.map(q => q.unitPrice).filter(p => p !== Infinity);
                        const minPrice = prices.length > 0 ? Math.min(...prices) : Infinity;

                        return (
                        <TableRow key={rfqItem.id} className="h-14 hover:bg-transparent transition-colors border-b">
                            <TableCell className="font-bold px-4 sticky right-0 bg-background/95 z-10 border-l">{rfqItem.itemName}</TableCell>
                            <TableCell className="text-center font-mono font-bold bg-muted/5">{rfqItem.quantity}</TableCell>
                            {comparisonData.vendors.map(vendor => {
                                const quote = quotes.find(q => q.vendorId === vendor.id);
                                const isBestPrice = quote?.unitPrice === minPrice && minPrice !== Infinity;
                                return (
                                <TableCell key={vendor.id} className={cn("text-center font-mono font-bold border-r px-4", isBestPrice ? "bg-green-500/10 text-green-700" : "text-foreground/70")}>
                                     {quote?.unitPrice === Infinity ? (
                                        <span className="text-muted-foreground/30 italic text-xs">- غير مسعر -</span>
                                     ) : (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {isBestPrice && <Award className="h-4 w-4 text-green-600 fill-green-600/20" />}
                                                <span>{formatCurrency(quote.unitPrice)}</span>
                                            </div>
                                            <span className="text-[9px] text-muted-foreground font-normal">إجمالي: {formatCurrency(quote.unitPrice * rfqItem.quantity)}</span>
                                        </div>
                                     )}
                                </TableCell>
                                )
                            })}
                        </TableRow>
                        )
                    })}
                </TableBody>
                <TableFooter className="bg-muted/30">
                    <TableRow className="h-20 border-t-4 border-primary/20">
                        <TableCell colSpan={2} className="text-right px-8 font-black text-lg">إجمالي قيمة التوريد الكاملة:</TableCell>
                         {comparisonData.vendors.map(vendor => (
                            <TableCell key={vendor.id} className="text-center font-mono text-xl font-black text-primary border-r bg-primary/5">
                                {formatCurrency(comparisonData.totals[vendor.id!])}
                            </TableCell>
                         ))}
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
