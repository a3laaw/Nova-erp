
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Item, Warehouse, InventoryAdjustment, GoodsReceiptNote } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertTriangle, Building2, TrendingDown, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StockBalancesReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items');
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses', [orderBy('name')]);
    const { data: grns = [], loading: grnsLoading } = useSubscription<any>(firestore, 'grns');
    const { data: adjustments = [], loading: adjustmentsLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments');

    const loading = itemsLoading || warehousesLoading || grnsLoading || adjustmentsLoading;

    const stockData = useMemo(() => {
        if (loading) return [];

        const balances = new Map<string, Record<string, number>>(); // itemId -> { warehouseId: qty }

        // 1. Process Adjustments (Opening, Damage, Issue, Transfer)
        adjustments.forEach(adj => {
            adj.items.forEach(line => {
                if (!balances.has(line.itemId)) balances.set(line.itemId, {});
                const itemBalances = balances.get(line.itemId)!;

                if (adj.type === 'transfer' && adj.fromWarehouseId && adj.toWarehouseId) {
                    itemBalances[adj.fromWarehouseId] = (itemBalances[adj.fromWarehouseId] || 0) - line.quantity;
                    itemBalances[adj.toWarehouseId] = (itemBalances[adj.toWarehouseId] || 0) + line.quantity;
                } else if (adj.type === 'material_issue' && adj.warehouseId) {
                    itemBalances[adj.warehouseId] = (itemBalances[adj.warehouseId] || 0) - line.quantity;
                } else if (adj.warehouseId) {
                    const multiplier = (adj.type === 'damage' || adj.type === 'theft') ? -1 : 1;
                    itemBalances[adj.warehouseId] = (itemBalances[adj.warehouseId] || 0) + (line.quantity * multiplier);
                }
            });
        });

        // 2. Process GRNs (Receipts)
        grns.forEach(grn => {
            if (!grn.warehouseId) return;
            grn.itemsReceived?.forEach((line: any) => {
                if (!balances.has(line.internalItemId)) balances.set(line.internalItemId, {});
                const itemBalances = balances.get(line.internalItemId)!;
                itemBalances[grn.warehouseId] = (itemBalances[grn.warehouseId] || 0) + line.quantityReceived;
            });
        });

        // 3. Construct final list
        const results = items.map(item => {
            const itemBalances = balances.get(item.id!) || {};
            let totalQty = 0;
            
            if (selectedWarehouseId === 'all') {
                totalQty = Object.values(itemBalances).reduce((sum, q) => sum + q, 0);
            } else {
                totalQty = itemBalances[selectedWarehouseId] || 0;
            }

            return {
                ...item,
                totalQty,
                isLow: item.inventoryTracked && totalQty <= (item.reorderLevel || 0),
            };
        });

        const queryLower = searchQuery.toLowerCase();
        return results.filter(r => 
            r.totalQty !== 0 && 
            (r.name.toLowerCase().includes(queryLower) || r.sku.toLowerCase().includes(queryLower))
        ).sort((a,b) => a.name.localeCompare(b.name, 'ar'));

    }, [items, grns, adjustments, loading, searchQuery, selectedWarehouseId]);

    const totals = useMemo(() => {
        const lowStockCount = stockData.filter(i => i.isLow).length;
        const totalValue = stockData.reduce((sum, i) => sum + (i.totalQty * (i.costPrice || 0)), 0);
        return { lowStockCount, totalValue };
    }, [stockData]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" /> إجمالي قيمة المخزون
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black font-mono text-primary">{formatCurrency(totals.totalValue)}</div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-amber-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-amber-700 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-amber-600" /> أصناف تحت حد الطلب
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-amber-700">{totals.lowStockCount} <span className="text-sm font-normal">صنفاً</span></div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <Search className="h-4 w-4" /> خيارات الفلترة
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger className="h-9 rounded-xl">
                                <SelectValue placeholder="كل المستودعات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المستودعات</SelectItem>
                                {warehouses.map(w => <SelectItem key={w.id} value={w.id!}>{w.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input 
                            placeholder="ابحث بالاسم أو الرمز..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="h-9 rounded-xl"
                        />
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-2xl border-none shadow-sm">
                <CardHeader className="border-b bg-muted/10">
                    <CardTitle className="text-xl font-black">أرصدة الأصناف التفصيلية</CardTitle>
                    <CardDescription>الكميات المتوفرة والقيم المقدرة حسب متوسط التكلفة.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="px-6">الصنف</TableHead>
                                    <TableHead>الرمز (SKU)</TableHead>
                                    <TableHead className="text-center">الرصيد الحالي</TableHead>
                                    <TableHead>الوحدة</TableHead>
                                    <TableHead className="text-left">القيمة التقريبية</TableHead>
                                    <TableHead>الحالة</TableHead>
                                    <TableHead className="text-center w-[80px]">الحركة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stockData.map((item) => (
                                    <TableRow key={item.id} className={cn("group transition-colors", item.isLow && "bg-red-50/30 hover:bg-red-50/50")}>
                                        <TableCell className="px-6 font-black text-foreground/80">{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                        <TableCell className={cn("text-center font-black text-xl", item.isLow ? "text-red-600" : "text-primary")}>
                                            {item.totalQty}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground font-medium">{item.unitOfMeasure}</TableCell>
                                        <TableCell className="text-left font-mono font-bold">
                                            {formatCurrency(item.totalQty * (item.costPrice || 0))}
                                        </TableCell>
                                        <TableCell>
                                            {item.isLow ? (
                                                <Badge variant="destructive" className="gap-1 px-2">
                                                    <AlertTriangle className="h-3 w-3" /> نقص مخزون
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold">متوفر</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href={`/dashboard/warehouse/reports/item-movement?itemId=${item.id}`} title="عرض كرت الصنف">
                                                    <History className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
