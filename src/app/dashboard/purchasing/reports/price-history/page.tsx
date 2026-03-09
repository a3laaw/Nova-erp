'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { Item, SupplierQuotation, RequestForQuotation, Vendor } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, cn } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { History, TrendingUp, ArrowDownIcon, ArrowUpIcon, Search, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ar } from 'date-fns/locale';

export default function PriceHistoryReport() {
    const { firestore } = useFirebase();
    const [selectedItemId, setSelectedItemId] = useState('');
    
    const { data: items, loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: allQuotes, loading: quotesLoading } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations');
    const { data: allRfqs, loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, 'rfqs');
    const { data: allVendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors');

    const loading = itemsLoading || quotesLoading || rfqsLoading || vendorsLoading;

    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: i.name })), [items]);

    const historicalData = useMemo(() => {
        if (!selectedItemId || loading) return [];

        const results: any[] = [];
        const vendorMap = new Map(allVendors.map(v => [v.id, v.name]));

        // 1. Find all RFQ Items IDs that link to this specific internal Item ID
        const relevantRfqItemIds = new Map<string, string>(); // rfqItemId -> rfqNumber
        allRfqs.forEach(rfq => {
            rfq.items.forEach(item => {
                if (item.internalItemId === selectedItemId) {
                    relevantRfqItemIds.set(item.id, rfq.rfqNumber);
                }
            });
        });

        // 2. Filter quotations that contain these RFQ Items
        allQuotes.forEach(quote => {
            quote.items.forEach(quoteItem => {
                if (relevantRfqItemIds.has(quoteItem.rfqItemId)) {
                    const date = toFirestoreDate(quote.date);
                    if (date) {
                        results.push({
                            date: date,
                            vendor: vendorMap.get(quote.vendorId) || 'مورد غير معروف',
                            price: quoteItem.unitPrice,
                            rfqNumber: relevantRfqItemIds.get(quoteItem.rfqItemId),
                            paymentTerms: quote.paymentTerms || 'غير محدد',
                            deliveryTime: quote.deliveryTimeDays === 0 ? 'فوري' : `${quote.deliveryTimeDays} يوم`,
                            formattedDate: format(date, 'yyyy-MM-dd')
                        });
                    }
                }
            });
        });

        return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [selectedItemId, allQuotes, allRfqs, allVendors, loading]);

    const stats = useMemo(() => {
        if (historicalData.length === 0) return null;
        const prices = historicalData.map(d => d.price);
        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg: prices.reduce((a, b) => a + b, 0) / prices.length
        };
    }, [historicalData]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-green-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3 text-foreground">
                                <History className="text-green-600 h-7 w-7" />
                                كشاف الأسعار التاريخي
                            </CardTitle>
                            <CardDescription>ابحث عن أي صنف لعرض أرشيف أسعاره والمفاضلة بين الموردين بناءً على التاريخ.</CardDescription>
                        </div>
                        <div className="w-full max-w-md bg-white p-1 rounded-2xl border shadow-inner">
                            <InlineSearchList 
                                value={selectedItemId}
                                onSelect={setSelectedItemId}
                                options={itemOptions}
                                placeholder="ابحث عن صنف (أسمنت، حديد، كابلات...)"
                                className="border-none shadow-none focus-visible:ring-0 text-lg font-bold"
                            />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {!selectedItemId ? (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-40">
                    <Search className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black text-muted-foreground">يرجى اختيار صنف لعرض السجل المالي له.</p>
                </div>
            ) : (
                <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="rounded-3xl border-none shadow-sm p-6 bg-green-50">
                            <Label className="text-xs font-black text-green-700 uppercase mb-2 block">أدنى سعر تم رصده</Label>
                            <p className="text-3xl font-black text-green-800 font-mono flex items-center gap-2">
                                <ArrowDownIcon className="h-6 w-6"/> {formatCurrency(stats?.min || 0)}
                            </p>
                        </Card>
                        <Card className="rounded-3xl border-none shadow-sm p-6 bg-red-50">
                            <Label className="text-xs font-black text-red-700 uppercase mb-2 block">أعلى سعر تم رصده</Label>
                            <p className="text-3xl font-black text-red-800 font-mono flex items-center gap-2">
                                <ArrowUpIcon className="h-6 w-6"/> {formatCurrency(stats?.max || 0)}
                            </p>
                        </Card>
                        <Card className="rounded-3xl border-none shadow-sm p-6 bg-blue-50">
                            <Label className="text-xs font-black text-blue-700 uppercase mb-2 block">متوسط السعر التاريخي</Label>
                            <p className="text-3xl font-black text-blue-800 font-mono">{formatCurrency(stats?.avg || 0)}</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 rounded-[2rem] border-none shadow-sm p-6 bg-white overflow-hidden">
                            <CardHeader className="px-0 pt-0">
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary"/> منحنى السعر الزمني
                                </CardTitle>
                            </CardHeader>
                            <div className="h-80 w-full mt-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={historicalData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                        <XAxis dataKey="formattedDate" fontSize={10} tickMargin={10} />
                                        <YAxis fontSize={10} tickMargin={10} />
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: number) => [formatCurrency(value), 'السعر']}
                                        />
                                        <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 6, fill: 'white', strokeWidth: 2 }} activeDot={{ r: 8 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card className="rounded-[2rem] border-none shadow-sm overflow-hidden flex flex-col bg-white">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="text-lg font-black">أرشيف عروض الموردين</CardTitle>
                            </CardHeader>
                            <ScrollArea className="flex-1">
                                <Table>
                                    <TableHeader className="bg-muted/10 sticky top-0 z-10 backdrop-blur-sm">
                                        <TableRow>
                                            <TableHead className="text-xs font-bold px-4">المورد</TableHead>
                                            <TableHead className="text-left text-xs font-bold px-4">السعر</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historicalData.length === 0 ? (
                                            <TableRow><TableCell colSpan={2} className="h-32 text-center text-muted-foreground italic">لم نصل لعروض لهذا الصنف من قبل.</TableCell></TableRow>
                                        ) : (
                                            [...historicalData].reverse().map((d, idx) => (
                                                <TableRow key={idx} className="h-16 group hover:bg-muted/20 transition-all">
                                                    <TableCell className="px-4">
                                                        <p className="font-black text-sm text-gray-800">{d.vendor}</p>
                                                        <div className="flex gap-2 mt-1">
                                                            <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold opacity-60">RFQ: {d.rfqNumber}</Badge>
                                                            <span className="text-[9px] font-bold text-muted-foreground">{d.formattedDate}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-left font-mono font-black text-primary px-4">
                                                        {formatCurrency(d.price)}
                                                        <div className="text-[8px] text-muted-foreground font-bold mt-1">دفع: {d.paymentTerms}</div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
