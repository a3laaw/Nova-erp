'use client';

import { useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useFirebase } from '@/firebase';
import { query, where } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation, RfqItem } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Award } from 'lucide-react';

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
    
    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }

    return (
        <div className="border rounded-lg overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[300px] min-w-[250px] sticky left-0 bg-background z-10">الصنف</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        {comparisonData.vendors.map(vendor => (
                            <TableHead key={vendor.id} className="text-center min-w-[150px]">{vendor.name}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {comparisonData.data.map(({ rfqItem, quotes }) => {
                        const prices = quotes.map(q => q.unitPrice).filter(p => p !== Infinity);
                        const minPrice = prices.length > 0 ? Math.min(...prices) : Infinity;

                        return (
                        <TableRow key={rfqItem.id}>
                            <TableCell className="font-semibold sticky left-0 bg-background z-10">{rfqItem.itemName}</TableCell>
                            <TableCell className="text-center font-mono">{rfqItem.quantity}</TableCell>
                            {comparisonData.vendors.map(vendor => {
                                const quote = quotes.find(q => q.vendorId === vendor.id);
                                const isBestPrice = quote?.unitPrice === minPrice && minPrice !== Infinity;
                                return (
                                <TableCell key={vendor.id} className={cn("text-center font-mono", isBestPrice && "bg-green-100 dark:bg-green-900/50")}>
                                     {quote?.unitPrice === Infinity ? (
                                        <span className="text-muted-foreground">-</span>
                                     ) : (
                                        <div className="flex items-center justify-center gap-1">
                                            {isBestPrice && <Award className="h-4 w-4 text-green-600" />}
                                            {formatCurrency(quote.unitPrice)}
                                        </div>
                                     )}
                                </TableCell>
                                )
                            })}
                        </TableRow>
                        )
                    })}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold text-base bg-muted">
                        <TableCell colSpan={2}>الإجمالي</TableCell>
                         {comparisonData.vendors.map(vendor => (
                            <TableCell key={vendor.id} className="text-center font-mono">
                                {formatCurrency(comparisonData.totals[vendor.id!])}
                            </TableCell>
                         ))}
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    );
}
