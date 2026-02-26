'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy } from 'firebase/firestore';
import type { Item, ItemCategory } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, DollarSign, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';

export default function ItemCostReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: categories = [], loading: categoriesLoading } = useSubscription<ItemCategory>(firestore, 'itemCategories');

    const loading = itemsLoading || categoriesLoading;

    const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories]);

    const reportData = useMemo(() => {
        const queryLower = searchQuery.toLowerCase();
        return items
            .filter(i => i.name.toLowerCase().includes(queryLower) || i.sku.toLowerCase().includes(queryLower))
            .map(item => {
                const cost = item.costPrice || 0;
                const selling = item.sellingPrice || 0;
                const profit = selling - cost;
                const margin = cost > 0 ? (profit / cost) * 100 : 0;

                return {
                    ...item,
                    categoryName: categoryMap.get(item.categoryId) || 'غير مصنف',
                    profit,
                    margin
                };
            })
            .sort((a, b) => b.margin - a.margin);
    }, [items, categoryMap, searchQuery]);

    const totals = useMemo(() => {
        const avgMargin = reportData.length > 0 
            ? reportData.reduce((sum, i) => sum + i.margin, 0) / reportData.length 
            : 0;
        return { avgMargin };
    }, [reportData]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-green-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-green-700 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> متوسط هامش الربح
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-green-700">{totals.avgMargin.toFixed(1)}%</div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <Search className="h-4 w-4" /> بحث سريع
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input 
                            placeholder="ابحث بالاسم أو الرمز..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-10 rounded-xl border-2"
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardHeader className="border-b bg-muted/10 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black">تحليل تكلفة وأسعار الأصناف</CardTitle>
                            <CardDescription>مقارنة بين تكلفة الشراء وسعر البيع لجميع الأصناف والخدمات.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6">الصنف / الفئة</TableHead>
                                <TableHead className="text-left">سعر التكلفة</TableHead>
                                <TableHead className="text-left">سعر البيع</TableHead>
                                <TableHead className="text-left">الربح لكل وحدة</TableHead>
                                <TableHead className="text-center">النسبة (%)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                                    <TableCell className="px-6">
                                        <div className="font-bold">{item.name}</div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Badge variant="outline" className="text-[9px] h-4 py-0">{item.categoryName}</Badge>
                                            <span className="font-mono">{item.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-left font-mono">{formatCurrency(item.costPrice || 0)}</TableCell>
                                    <TableCell className="text-left font-mono font-bold text-primary">{formatCurrency(item.sellingPrice || 0)}</TableCell>
                                    <TableCell className={cn("text-left font-mono font-bold", item.profit >= 0 ? "text-green-600" : "text-red-600")}>
                                        {formatCurrency(item.profit)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={item.margin > 0 ? 'secondary' : 'destructive'} className="font-mono">
                                            {item.margin.toFixed(1)}%
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
