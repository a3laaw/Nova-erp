
'use client';

import { useMemo, useState } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Item, InventoryAdjustment, GoodsReceiptNote } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { History, Search, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';

interface Movement {
    date: Date;
    type: string;
    reference: string;
    description: string;
    in: number;
    out: number;
    balanceAfter: number;
}

export default function ItemCardReportPage() {
    const { firestore } = useFirebase();
    const [selectedItemId, setSelectedItemId] = useState('');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: grns = [], loading: grnsLoading } = useSubscription<any>(firestore, 'grns', [orderBy('date', 'asc')]);
    const { data: adjustments = [], loading: adjustmentsLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', [orderBy('date', 'asc')]);

    const loading = itemsLoading || grnsLoading || adjustmentsLoading;

    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: `${i.name} (${i.sku})` })), [items]);

    const movementHistory = useMemo(() => {
        if (!selectedItemId || loading) return [];

        const history: Movement[] = [];

        // 1. Collect GRNs
        grns.forEach(grn => {
            const line = grn.itemsReceived?.find((i: any) => i.internalItemId === selectedItemId);
            if (line) {
                history.push({
                    date: toFirestoreDate(grn.date)!,
                    type: 'استلام بضاعة',
                    reference: grn.grnNumber,
                    description: `من المورد: ${grn.vendorName}`,
                    in: line.quantityReceived,
                    out: 0,
                    balanceAfter: 0 // Calc later
                });
            }
        });

        // 2. Collect Adjustments & Issues & Transfers
        adjustments.forEach(adj => {
            const line = adj.items.find(i => i.itemId === selectedItemId);
            if (line) {
                if (adj.type === 'transfer') {
                    // Two entries for transfer: one out, one in
                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: 'تحويل (خروج)',
                        reference: adj.adjustmentNumber,
                        description: `إلى مستودع آخر`,
                        in: 0,
                        out: line.quantity,
                        balanceAfter: 0
                    });
                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: 'تحويل (دخول)',
                        reference: adj.adjustmentNumber,
                        description: `من مستودع آخر`,
                        in: line.quantity,
                        out: 0,
                        balanceAfter: 0
                    });
                } else {
                    const isOut = ['material_issue', 'damage', 'theft'].includes(adj.type);
                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: adj.type === 'opening_balance' ? 'رصيد افتتاحي' : (isOut ? 'صرف مواد' : 'تعديل مخزني'),
                        reference: adj.adjustmentNumber,
                        description: adj.notes || '-',
                        in: isOut ? 0 : line.quantity,
                        out: isOut ? line.quantity : 0,
                        balanceAfter: 0
                    });
                }
            }
        });

        // 3. Sort and calculate running balance
        history.sort((a, b) => a.date.getTime() - b.date.getTime());
        let runningBalance = 0;
        history.forEach(m => {
            runningBalance += m.in - m.out;
            m.balanceAfter = runningBalance;
        });

        return history.reverse(); // Newest first for display
    }, [selectedItemId, grns, adjustments, loading]);

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><History className="text-primary"/> كرت حركة الصنف</CardTitle>
                <CardDescription>تتبع كافة العمليات التي تمت على مادة معينة بالترتيب الزمني.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="max-w-md mx-auto">
                    <Label className="mb-2 block">اختر الصنف المراد مراجعته</Label>
                    <InlineSearchList 
                        value={selectedItemId}
                        onSelect={setSelectedItemId}
                        options={itemOptions}
                        placeholder="ابحث عن صنف..."
                        disabled={itemsLoading}
                    />
                </div>

                {!selectedItemId ? (
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl opacity-40">
                        <Search className="h-12 w-12 mb-2" />
                        <p className="font-bold">يرجى اختيار صنف لعرض حركته.</p>
                    </div>
                ) : (
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>نوع الحركة</TableHead>
                                    <TableHead>المرجع</TableHead>
                                    <TableHead>البيان</TableHead>
                                    <TableHead className="text-center">وارد (+)</TableHead>
                                    <TableHead className="text-center">صادر (-)</TableHead>
                                    <TableHead className="text-left border-r bg-muted/20 px-6">الرصيد التراكمي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movementHistory.map((m, idx) => (
                                    <TableRow key={idx} className="h-14 hover:bg-muted/5 transition-colors border-b last:border-0">
                                        <TableCell className="text-xs font-medium">{format(m.date, 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "whitespace-nowrap",
                                                m.in > 0 ? "border-green-200 text-green-700 bg-green-50" : "border-amber-200 text-amber-700 bg-amber-50"
                                            )}>
                                                {m.in > 0 ? <ArrowDownCircle className="h-3 w-3 ml-1" /> : <ArrowUpCircle className="h-3 w-3 ml-1" />}
                                                {m.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-primary">{m.reference}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate">{m.description}</TableCell>
                                        <TableCell className="text-center font-mono text-green-600 font-bold">{m.in > 0 ? `+${m.in}` : '-'}</TableCell>
                                        <TableCell className="text-center font-mono text-red-600 font-bold">{m.out > 0 ? `-${m.out}` : '-'}</TableCell>
                                        <TableCell className="text-left font-mono font-black text-lg px-6 bg-muted/5 border-r">
                                            {m.balanceAfter}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
