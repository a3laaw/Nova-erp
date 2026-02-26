'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { Item, InventoryAdjustment, ItemCategory } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hourglass, AlertCircle, Package, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StagnantItemsReportPage() {
    const { firestore } = useFirebase();

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: adjustments = [], loading: adjustmentsLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments');
    const { data: grns = [], loading: grnsLoading } = useSubscription<any>(firestore, 'grns');

    const loading = itemsLoading || adjustmentsLoading || grnsLoading;

    const stagnantData = useMemo(() => {
        if (loading) return [];

        // Aggregate all movement IDs for each item
        const movementCountMap = new Map<string, number>();
        items.forEach(i => movementCountMap.set(i.id!, 0));

        adjustments.forEach(adj => {
            adj.items.forEach(line => {
                if (movementCountMap.has(line.itemId)) {
                    movementCountMap.set(line.itemId, movementCountMap.get(line.itemId)! + 1);
                }
            });
        });

        grns.forEach(grn => {
            grn.itemsReceived?.forEach((line: any) => {
                if (movementCountMap.has(line.internalItemId)) {
                    movementCountMap.set(line.internalItemId, movementCountMap.get(line.internalItemId)! + 1);
                }
            });
        });

        // Construct final list of items with NO or VERY LOW movements
        return items
            .map(item => ({
                ...item,
                movementCount: movementCountMap.get(item.id!) || 0
            }))
            .filter(item => item.movementCount <= 1) // Considering stagnant if 0 or 1 movement (like only opening balance)
            .sort((a, b) => a.movementCount - b.movementCount);

    }, [items, adjustments, grns, loading]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm bg-amber-50 border-amber-200">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                            <Hourglass className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-amber-800">الأصناف الراكدة (بطيئة الحركة)</CardTitle>
                            <CardDescription className="text-amber-700/70">أصناف في المخزن لم يتم إجراء أي حركات صرف أو توريد عليها منذ فترة طويلة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-6">الصنف</TableHead>
                                <TableHead>الرمز (SKU)</TableHead>
                                <TableHead className="text-center">إجمالي الحركات</TableHead>
                                <TableHead className="text-left">سعر التكلفة</TableHead>
                                <TableHead className="text-center">الحالة</TableHead>
                                <TableHead className="text-center">الإجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stagnantData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        كل الأصناف في المخازن نشطة ومتحركة.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stagnantData.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/30 transition-colors border-b last:border-0">
                                        <TableCell className="px-6 font-bold">{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                        <TableCell className="text-center font-black">
                                            <Badge variant={item.movementCount === 0 ? 'destructive' : 'outline'}>
                                                {item.movementCount === 0 ? 'لا توجد حركات' : 'حركة واحدة فقط'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-left font-mono">{formatCurrency(item.costPrice || 0)}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1 text-xs text-amber-600 font-bold">
                                                <AlertCircle className="h-3 w-3" /> راكد
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="sm" className="gap-2" asChild>
                                                <Link href={`/dashboard/warehouse/reports/item-movement?itemId=${item.id}`}>
                                                    <History className="h-4 w-4" /> تفاصيل الحركة
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
