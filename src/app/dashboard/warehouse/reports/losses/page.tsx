
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { orderBy, where } from 'firebase/firestore';
import type { InventoryAdjustment, Warehouse } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Trash2, Search, Warehouse as HouseIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function InventoryLossReportPage() {
    const { firestore } = useFirebase();
    const [searchQuery, setSearchQuery] = useState('');

    const lossQuery = useMemo(() => [
        where('type', 'in', ['damage', 'theft']),
        orderBy('date', 'desc')
    ], []);
    
    const { data: adjustments = [], loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', lossQuery);
    const { data: warehouses = [] } = useSubscription<Warehouse>(firestore, 'warehouses');
    
    const warehouseMap = useMemo(() => new Map(warehouses.map(w => [w.id, w.name])), [warehouses]);

    const reportData = useMemo(() => {
        const queryLower = searchQuery.toLowerCase();
        return adjustments.filter(adj => 
            adj.adjustmentNumber.toLowerCase().includes(queryLower) ||
            adj.notes?.toLowerCase().includes(queryLower)
        );
    }, [adjustments, searchQuery]);

    const totals = useMemo(() => {
        const totalValue = reportData.reduce((sum, adj) => {
            const adjTotal = adj.items?.reduce((s, i) => s + (i.totalCost || 0), 0) || 0;
            return sum + adjTotal;
        }, 0);
        return { totalValue, count: reportData.length };
    }, [reportData]);

    if (loading) return <div className="p-8 space-y-4"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-96 w-full rounded-2xl" /></div>;

    return (
        <div className="space-y-6" dir="rtl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-red-50 p-6 flex items-center justify-between">
                    <div>
                        <Label className="text-xs font-black text-red-700 uppercase mb-1 block">إجمالي قيمة الخسائر</Label>
                        <p className="text-3xl font-black text-red-800 font-mono">{formatCurrency(totals.totalValue)}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-300" />
                </Card>
                <Card className="rounded-2xl border-none shadow-sm p-6">
                    <Label className="text-xs font-black text-muted-foreground uppercase mb-1 block">عدد عمليات التسوية</Label>
                    <p className="text-3xl font-black font-mono">{totals.count}</p>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm p-6 flex items-end">
                    <div className="relative w-full">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="بحث برقم الإذن..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="pl-8 rounded-xl border-2"
                        />
                    </div>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-card">
                <CardHeader className="bg-red-500/5 border-b pb-6 px-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-xl text-red-600">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black text-red-900">تقرير التوالف والعجز المخزني</CardTitle>
                            <CardDescription>عرض تفصيلي لعمليات شطب المواد التالفة أو المفقودة وأثرها المالي.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow className="h-14">
                                <TableHead className="px-8 font-bold">رقم الإذن</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>المستودع</TableHead>
                                <TableHead>السبب / الملاحظات</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead className="text-left px-8 font-black text-base">القيمة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center text-muted-foreground italic">
                                        لا توجد بيانات تسويات خسارة مسجلة.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reportData.map((adj) => (
                                    <TableRow key={adj.id} className="h-16 hover:bg-red-50/20 transition-colors border-b last:border-0">
                                        <TableCell className="px-8 font-mono font-bold text-red-700">{adj.adjustmentNumber}</TableCell>
                                        <TableCell className="text-sm font-medium">
                                            {toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <HouseIcon className="h-3 w-3 text-muted-foreground" />
                                                <span className="font-bold">{warehouseMap.get(adj.warehouseId!) || 'غير معروف'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-xs truncate italic text-muted-foreground">
                                            {adj.notes || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "font-black px-3 py-0.5",
                                                adj.type === 'theft' ? "border-red-300 text-red-700" : "border-orange-300 text-orange-700"
                                            )}>
                                                {adj.type === 'damage' ? 'تلف' : 'فقد/سرقة'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-8 text-red-600">
                                            {formatCurrency(adj.items?.reduce((sum, i) => sum + (i.totalCost || 0), 0) || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                        <TableFooter className="bg-red-50/50 h-20 border-t-2">
                            <TableRow>
                                <TableCell colSpan={5} className="text-right px-12 font-black text-lg">إجمالي قيمة الهالك خلال الفترة:</TableCell>
                                <TableCell className="text-left font-mono text-2xl font-black text-red-700 px-8">
                                    {formatCurrency(totals.totalValue)}
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
