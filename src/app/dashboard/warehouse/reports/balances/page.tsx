
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
import { Search, Package, AlertTriangle, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

export default function StockBalancesReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items');
    const { data: warehouses = [], loading: warehousesLoading } = useSubscription<Warehouse>(firestore, 'warehouses');
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

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Package className="text-primary"/> أرصدة المخازن الحالية</CardTitle>
                <CardDescription>عرض الكميات المتوفرة لكل صنف في المستودعات وتنبيهات النقص.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
                    <div className="grid gap-2">
                        <Label>المستودع</Label>
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger>
                                <SelectValue placeholder="كل المستودعات" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المستودعات</SelectItem>
                                {warehouses.map(w => <SelectItem key={w.id} value={w.id!}>{w.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>بحث عن صنف</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="الاسم أو الرمز..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                        </div>
                    </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>الصنف</TableHead>
                                <TableHead>الرمز (SKU)</TableHead>
                                <TableHead className="text-center">الرصيد الحالي</TableHead>
                                <TableHead>الوحدة</TableHead>
                                <TableHead className="text-left">القيمة التقريبية</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockData.map((item) => (
                                <TableRow key={item.id} className={cn(item.isLow && "bg-red-50/50 hover:bg-red-50")}>
                                    <TableCell className="font-bold">{item.name}</TableCell>
                                    <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                    <TableCell className={cn("text-center font-black text-lg", item.isLow ? "text-red-600" : "text-primary")}>
                                        {item.totalQty}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{item.unitOfMeasure}</TableCell>
                                    <TableCell className="text-left font-mono">
                                        {formatCurrency(item.totalQty * (item.costPrice || 0))}
                                    </TableCell>
                                    <TableCell>
                                        {item.isLow ? (
                                            <Badge variant="destructive" className="gap-1">
                                                <AlertTriangle className="h-3 w-3" /> نقص مخزون
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">متوفر</Badge>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
