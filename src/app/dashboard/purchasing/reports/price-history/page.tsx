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
import { History, TrendingUp, ArrowDownIcon, ArrowUpIcon, Search, AlertCircle, Sparkles, Truck, ShieldCheck, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

/**
 * تقرير كشاف الأسعار المطور (Sovereign Price Intelligence):
 * - رصد الارتفاع المفاجئ للأسعار (>15% من المتوسط).
 * - مفاضلة الموردين بناءً على سرعة التوريد وشروط الدفع التاريخية.
 * - تحديد "المورد الأفضل" آلياً لكل صنف.
 */
export default function PriceHistoryReport() {
    const { firestore } = useFirebase();
    const [selectedItemId, setSelectedItemId] = useState('');
    
    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: allQuotes = [], loading: quotesLoading } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations');
    const { data: allRfqs = [], loading: rfqsLoading } = useSubscription<RequestForQuotation>(firestore, 'rfqs');
    const { data: allVendors = [], loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors');

    const loading = itemsLoading || quotesLoading || rfqsLoading || vendorsLoading;

    const historicalData = useMemo(() => {
        if (!selectedItemId || loading) return [];
        const results: any[] = [];
        const vendorMap = new Map(allVendors.map(v => [v.id, v.name]));

        const relevantRfqItemIds = new Map<string, string>();
        allRfqs.forEach(rfq => {
            rfq.items.forEach(item => {
                if (item.internalItemId === selectedItemId) relevantRfqItemIds.set(item.id, rfq.rfqNumber);
            });
        });

        allQuotes.forEach(quote => {
            quote.items.forEach(quoteItem => {
                if (relevantRfqItemIds.has(quoteItem.rfqItemId)) {
                    const date = toFirestoreDate(quote.date);
                    if (date) {
                        results.push({
                            date: date,
                            vendorId: quote.vendorId,
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
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        
        // ✨ تحليل المورد الأفضل (Best Vendor Logic) ✨
        const vendorScores = new Map<string, { price: number; delivery: number; name: string }>();
        historicalData.forEach(d => {
            const current = vendorScores.get(d.vendorId) || { price: 999999, delivery: 999, name: d.vendor };
            const days = parseInt(d.deliveryTime) || 7;
            if (d.price <= current.price) {
                vendorScores.set(d.vendorId, { price: d.price, delivery: days, name: d.vendor });
            }
        });

        const bestVendorEntry = Array.from(vendorScores.values()).sort((a, b) => a.price - b.price || a.delivery - b.delivery)[0];

        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            avg,
            bestVendor: bestVendorEntry?.name,
            latestPrice: historicalData[historicalData.length - 1].price,
            isPriceSurging: historicalData[historicalData.length - 1].price > (avg * 1.15)
        };
    }, [historicalData]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-green-50">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3"><History className="text-green-600 h-7 w-7" /> كشاف الأسعار الاستخباري</CardTitle>
                            <CardDescription>رصد تذبذب الأسعار، مقارنة سرعة التوريد، وتحديد المورد المفضل لكل مادة.</CardDescription>
                        </div>
                        <div className="w-full max-w-md bg-white p-1 rounded-2xl border shadow-inner">
                            <InlineSearchList value={selectedItemId} onSelect={setSelectedItemId} options={items.map(i => ({ value: i.id!, label: i.name }))} placeholder="ابحث عن صنف لفتح راداره..." />
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {selectedItemId && stats && (
                <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
                    {stats.isPriceSurging && (
                        <Alert variant="destructive" className="rounded-3xl border-2 border-red-500 bg-red-50 shadow-red-100 animate-pulse">
                            <AlertTriangle className="h-5 w-5" />
                            <AlertTitle className="font-black">تنبيه ارتفاع حاد في السعر!</AlertTitle>
                            <AlertDescription className="font-bold">آخر سعر تم رصده ({formatCurrency(stats.latestPrice)}) يتجاوز المتوسط التاريخي بنسبة تزيد عن 15%. يرجى مراجعة السوق.</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="rounded-3xl border-none shadow-md p-6 bg-green-50 flex items-center gap-4">
                            <div className="p-3 bg-green-600 rounded-2xl text-white"><ArrowDownIcon className="h-6 w-6"/></div>
                            <div><Label className="text-[10px] font-black uppercase text-green-700 block mb-1">أدنى سعر مرصود</Label><p className="text-2xl font-black font-mono text-green-800">{formatCurrency(stats.min)}</p></div>
                        </Card>
                        <Card className="rounded-3xl border-none shadow-md p-6 bg-blue-50 flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl text-white"><ShieldCheck className="h-6 w-6"/></div>
                            <div><Label className="text-[10px] font-black uppercase text-blue-700 block mb-1">المورد المفضل</Label><p className="text-xl font-black text-blue-800 truncate max-w-[150px]">{stats.bestVendor}</p></div>
                        </Card>
                        <Card className="rounded-3xl border-none shadow-md p-6 bg-white flex items-center gap-4">
                            <div className="p-3 bg-slate-100 rounded-2xl text-slate-600"><TrendingUp className="h-6 w-6"/></div>
                            <div><Label className="text-[10px] font-black uppercase text-slate-500 block mb-1">المتوسط التاريخي</Label><p className="text-2xl font-black font-mono">{formatCurrency(stats.avg)}</p></div>
                        </Card>
                        <Card className="rounded-3xl border-none shadow-md p-6 bg-white flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Sparkles className="h-6 w-6"/></div>
                            <div><Label className="text-[10px] font-black uppercase text-primary block mb-1">آخر سعر مسجل</Label><p className="text-2xl font-black font-mono text-primary">{formatCurrency(stats.latestPrice)}</p></div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 rounded-[2.5rem] border-none shadow-xl p-8 bg-white"><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={historicalData}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} /><XAxis dataKey="formattedDate" fontSize={10} /><YAxis fontSize={10} /><Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', shadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => [formatCurrency(v), 'السعر']} /><Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 6, fill: 'white', strokeWidth: 2 }} activeDot={{ r: 8 }} /></LineChart></ResponsiveContainer></div></Card>
                        <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-white">
                            <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg font-black">أرشيف عروض الموردين</CardTitle></CardHeader>
                            <ScrollArea className="h-80"><Table><TableHeader className="bg-muted/10"><TableRow><TableHead className="text-xs font-bold px-4">المورد</TableHead><TableHead className="text-left text-xs font-bold px-4">السعر والتوريد</TableHead></TableRow></TableHeader><TableBody>{[...historicalData].reverse().map((d, idx) => (<TableRow key={idx} className="h-16 group hover:bg-muted/20 transition-all"><TableCell className="px-4"><p className="font-black text-sm text-gray-800">{d.vendor}</p><div className="flex gap-2 mt-1"><span className="text-[9px] font-bold text-muted-foreground">{d.formattedDate}</span></div></TableCell><TableCell className="text-left px-4"><p className="font-mono font-black text-primary text-base">{formatCurrency(d.price)}</p><div className="flex items-center gap-1 justify-end text-[8px] font-bold text-muted-foreground"><Truck className="h-2 w-2"/> {d.deliveryTime}</div></TableCell></TableRow>))}</TableBody></Table></ScrollArea>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
