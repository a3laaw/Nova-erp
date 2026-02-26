'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { Item, InventoryAdjustment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ShoppingBag, Box, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';

export default function BestIssuedItemsReportPage() {
    const { firestore } = useFirebase();

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    
    // We filter for 'material_issue' which are items sent to project sites (Our "Sales")
    const issueQuery = useMemo(() => [where('type', '==', 'material_issue')], []);
    const { data: issues = [], loading: issuesLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', issueQuery);

    const loading = itemsLoading || issuesLoading;

    const reportData = useMemo(() => {
        if (loading) return [];

        const qtyMap = new Map<string, number>(); // itemId -> totalQtyIssued
        const valueMap = new Map<string, number>(); // itemId -> totalValueIssued

        issues.forEach(issue => {
            issue.items.forEach(line => {
                const currentQty = qtyMap.get(line.itemId) || 0;
                const currentValue = valueMap.get(line.itemId) || 0;
                qtyMap.set(line.itemId, currentQty + line.quantity);
                valueMap.set(line.itemId, currentValue + line.totalCost);
            });
        });

        return items
            .map(item => ({
                ...item,
                issuedQty: qtyMap.get(item.id!) || 0,
                issuedValue: valueMap.get(item.id!) || 0
            }))
            .filter(i => i.issuedQty > 0)
            .sort((a, b) => b.issuedQty - a.issuedQty);

    }, [items, issues, loading]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm bg-primary/5">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl text-primary">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black">الأصناف الأكثر استخداماً في المواقع</CardTitle>
                            <CardDescription>تحليل الأصناف الأكثر طلباً وصرفاً للمشاريع الإنشائية خلال الفترة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-12 text-center">الترتيب</TableHead>
                                <TableHead className="px-6">الصنف</TableHead>
                                <TableHead>الرمز (SKU)</TableHead>
                                <TableHead className="text-center font-bold">إجمالي الكمية المصروفة</TableHead>
                                <TableHead className="text-left font-bold">إجمالي القيمة</TableHead>
                                <TableHead className="text-center">الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                                        <ShoppingBag className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        لا توجد أذونات صرف مسجلة بعد.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.map((item, index) => (
                                    <TableRow key={item.id} className={cn("hover:bg-muted/30 transition-colors border-b last:border-0", index < 3 && "bg-primary/5")}>
                                        <TableCell className="text-center font-black text-muted-foreground">
                                            {index < 3 ? <Star className="h-4 w-4 mx-auto text-yellow-500 fill-yellow-500" /> : index + 1}
                                        </TableCell>
                                        <TableCell className="px-6 font-bold">{item.name}</TableCell>
                                        <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-xl font-black text-primary font-mono">{item.issuedQty}</span>
                                            <span className="text-[10px] text-muted-foreground block">{item.unitOfMeasure}</span>
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-bold">{formatCurrency(item.issuedValue)}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant={index < 3 ? 'default' : 'outline'} className="rounded-full">
                                                {index === 0 ? 'الأكثر طلباً' : index < 3 ? 'طلب عالٍ' : 'نشط'}
                                            </Badge>
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
