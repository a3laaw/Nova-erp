
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Item, InventoryAdjustment, GoodsReceiptNote } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { History, Search, ArrowDownCircle, ArrowUpCircle, RefreshCw, AlertCircle, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { InlineSearchList } from '@/components/ui/inline-search-list';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { useSearchParams, useRouter } from 'next/navigation';

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
    const searchParams = useSearchParams();
    const router = useRouter();
    const [selectedItemId, setSelectedItemId] = useState(searchParams.get('itemId') || '');

    const { data: items = [], loading: itemsLoading } = useSubscription<Item>(firestore, 'items', [orderBy('name')]);
    const { data: grns = [], loading: grnsLoading } = useSubscription<any>(firestore, 'grns', [orderBy('date', 'asc')]);
    const { data: adjustments = [], loading: adjustmentsLoading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', [orderBy('date', 'asc')]);

    const loading = itemsLoading || grnsLoading || adjustmentsLoading;

    // Update URL when item changes
    useEffect(() => {
        if (selectedItemId) {
            router.replace(`/dashboard/warehouse/reports/item-movement?itemId=${selectedItemId}`, { scroll: false });
        }
    }, [selectedItemId, router]);

    const itemOptions = useMemo(() => items.map(i => ({ value: i.id!, label: `${i.name} (${i.sku})` })), [items]);
    
    const currentItem = useMemo(() => items.find(i => i.id === selectedItemId), [items, selectedItemId]);

    const movementHistory = useMemo(() => {
        if (!selectedItemId || loading) return [];

        const history: Movement[] = [];

        // 1. Collect GRNs (الوارد من المشتريات)
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
                    balanceAfter: 0
                });
            }
        });

        // 2. Collect Adjustments & Issues & Transfers
        adjustments.forEach(adj => {
            const line = adj.items.find(i => i.itemId === selectedItemId);
            if (line) {
                if (adj.type === 'transfer') {
                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: 'تحويل (خروج)',
                        reference: adj.adjustmentNumber,
                        description: `نقل إلى مستودع آخر`,
                        in: 0,
                        out: line.quantity,
                        balanceAfter: 0
                    });
                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: 'تحويل (دخول)',
                        reference: adj.adjustmentNumber,
                        description: `استلام من مستودع آخر`,
                        in: line.quantity,
                        out: 0,
                        balanceAfter: 0
                    });
                } else {
                    const isOut = ['material_issue', 'damage', 'theft'].includes(adj.type);
                    const typeLabel = {
                        opening_balance: 'رصيد افتتاحي',
                        material_issue: 'صرف مواد للموقع',
                        damage: 'تسوية تلف',
                        theft: 'تسوية فقد',
                        other: 'تعديل مخزني'
                    }[adj.type] || 'أخرى';

                    history.push({
                        date: toFirestoreDate(adj.date)!,
                        type: typeLabel,
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

    const stats = useMemo(() => {
        if (movementHistory.length === 0) return { totalIn: 0, totalOut: 0, currentBalance: 0 };
        const totalIn = movementHistory.reduce((sum, m) => sum + m.in, 0);
        const totalOut = movementHistory.reduce((sum, m) => sum + m.out, 0);
        return {
            totalIn,
            totalOut,
            currentBalance: totalIn - totalOut
        };
    }, [movementHistory]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-primary/5 pb-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black flex items-center gap-3">
                                <History className="text-primary h-7 w-7"/> 
                                بطاقة حركة الصنف
                            </CardTitle>
                            <CardDescription className="text-base">تتبع كامل لمسار المادة من الشراء وحتى الصرف النهائي.</CardDescription>
                        </div>
                        <div className="w-full max-w-md bg-background p-1 rounded-2xl border shadow-inner">
                            <InlineSearchList 
                                value={selectedItemId}
                                onSelect={setSelectedItemId}
                                options={itemOptions}
                                placeholder="ابحث عن صنف لعرض حركته..."
                                disabled={itemsLoading}
                                className="border-none shadow-none focus-visible:ring-0 text-lg font-bold"
                            />
                        </div>
                    </div>
                </CardHeader>
                
                {selectedItemId && currentItem && (
                    <CardContent className="-mt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-card border p-4 rounded-xl shadow-sm flex items-center justify-between">
                                <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">الرصيد الحالي</Label>
                                    <p className="text-3xl font-black text-primary font-mono">{stats.currentBalance}</p>
                                </div>
                                <div className="p-3 bg-primary/10 rounded-full text-primary">
                                    <Package className="h-6 w-6" />
                                </div>
                            </div>
                            <div className="bg-card border p-4 rounded-xl shadow-sm space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">إجمالي الوارد (+)</Label>
                                <p className="text-2xl font-black text-green-600 font-mono">{stats.totalIn}</p>
                            </div>
                            <div className="bg-card border p-4 rounded-xl shadow-sm space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">إجمالي الصادر (-)</Label>
                                <p className="text-2xl font-black text-amber-600 font-mono">{stats.totalOut}</p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {!selectedItemId ? (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[2.5rem] bg-muted/5 opacity-40">
                    <Search className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black text-muted-foreground">يرجى اختيار صنف من القائمة أعلاه لعرض سجل الحركات.</p>
                </div>
            ) : (
                <div className="border-2 rounded-[2rem] overflow-hidden shadow-xl bg-card">
                    <Table>
                        <TableHeader className="bg-muted/80 backdrop-blur-sm">
                            <TableRow className="h-14 border-b-2">
                                <TableHead className="w-40 font-bold">التاريخ والوقت</TableHead>
                                <TableHead className="w-40 font-bold">نوع الحركة</TableHead>
                                <TableHead className="w-32 font-bold">رقم المرجع</TableHead>
                                <TableHead className="font-bold">تفاصيل البيان</TableHead>
                                <TableHead className="text-center font-bold">وارد (+)</TableHead>
                                <TableHead className="text-center font-bold">صادر (-)</TableHead>
                                <TableHead className="text-left border-r bg-primary/5 px-6 font-black text-primary">الرصيد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12 w-full"/></TableCell></TableRow>
                                ))
                            ) : movementHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center">
                                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                            <AlertCircle className="h-8 w-8 opacity-20" />
                                            <p>لا توجد حركات مسجلة لهذا الصنف بعد.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                movementHistory.map((m, idx) => (
                                    <TableRow key={idx} className="h-16 hover:bg-muted/5 transition-colors border-b last:border-0 group">
                                        <TableCell className="text-xs font-bold text-muted-foreground">
                                            {format(m.date, 'dd/MM/yyyy')}
                                            <div className="text-[10px] opacity-60 font-mono mt-0.5">{format(m.date, 'HH:mm:ss')}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "whitespace-nowrap px-2 font-bold gap-1.5",
                                                m.in > 0 ? "border-green-200 text-green-700 bg-green-50" : "border-amber-200 text-amber-700 bg-amber-50"
                                            )}>
                                                {m.in > 0 ? <ArrowDownCircle className="h-3 w-3" /> : <ArrowUpCircle className="h-3 w-3" />}
                                                {m.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-black text-primary/80">{m.reference}</TableCell>
                                        <TableCell className="text-sm font-medium leading-relaxed max-w-[300px]">{m.description}</TableCell>
                                        <TableCell className="text-center font-mono text-lg font-black text-green-600">
                                            {m.in > 0 ? `+${m.in}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-lg font-black text-amber-600">
                                            {m.out > 0 ? `-${m.out}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-left font-mono font-black text-2xl px-6 bg-primary/[0.02] border-r border-primary/10 group-hover:bg-primary/5 transition-colors">
                                            {m.balanceAfter}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
