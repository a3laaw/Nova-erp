
'use client';

import { useMemo, useState } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Item, Warehouse, InventoryAdjustment, GoodsReceiptNote, CompanyActivityType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Package, AlertTriangle, Building2, TrendingDown, FileSearch, Loader2, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function StockBalancesReportPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportResults, setReportResults] = useState<any[] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');

    const handleGenerate = async () => {
        if (!firestore) return;
        setIsGenerating(true);
        try {
            const [itemsSnap, grnsSnap, adjsSnap, warehousesSnap] = await Promise.all([
                getDocs(collection(firestore, 'items')),
                getDocs(collection(firestore, 'grns')),
                getDocs(collection(firestore, 'inventoryAdjustments')),
                getDocs(collection(firestore, 'warehouses'))
            ]);

            const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Item));
            const warehouses = warehousesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Warehouse));
            const balances = new Map<string, Record<string, number>>();

            adjsSnap.docs.forEach(docSnap => {
                const adj = docSnap.data() as InventoryAdjustment;
                adj.items?.forEach(line => {
                    if (!balances.has(line.itemId)) balances.set(line.itemId, {});
                    const itemBalances = balances.get(line.itemId)!;
                    if (adj.type === 'transfer' && adj.fromWarehouseId && adj.toWarehouseId) {
                        itemBalances[adj.fromWarehouseId] = (itemBalances[adj.fromWarehouseId] || 0) - line.quantity;
                        itemBalances[adj.toWarehouseId] = (itemBalances[adj.toWarehouseId] || 0) + line.quantity;
                    } else if (adj.warehouseId) {
                        const isOut = ['material_issue', 'damage', 'theft', 'purchase_return'].includes(adj.type);
                        itemBalances[adj.warehouseId] = (itemBalances[adj.warehouseId] || 0) + (line.quantity * (isOut ? -1 : 1));
                    }
                });
            });

            grnsSnap.docs.forEach(docSnap => {
                const grn = docSnap.data();
                if (!grn.warehouseId) return;
                grn.itemsReceived?.forEach((line: any) => {
                    if (!balances.has(line.internalItemId)) balances.set(line.internalItemId, {});
                    balances.get(line.internalItemId)![grn.warehouseId] = (balances.get(line.internalItemId)![grn.warehouseId] || 0) + line.quantityReceived;
                });
            });

            const results = items.map(item => {
                const itemBalances = balances.get(item.id!) || {};
                const totalQty = selectedWarehouseId === 'all' 
                    ? Object.values(itemBalances).reduce((sum, q) => sum + q, 0)
                    : itemBalances[selectedWarehouseId] || 0;

                return { ...item, totalQty, isLow: item.inventoryTracked && totalQty <= (item.reorderLevel || 0) };
            }).filter(r => r.totalQty !== 0);

            setReportResults(results);
            toast({ title: 'نجاح الاستخراج', description: 'تم تثبيت أرصدة المخازن الحالية للمراجعة.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'خطأ', description: 'فشل جلب الأرصدة.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const finalDisplayData = useMemo(() => {
        if (!reportResults) return [];
        const lower = searchQuery.toLowerCase();
        return reportResults.filter(r => r.name.toLowerCase().includes(lower) || r.sku.toLowerCase().includes(lower));
    }, [reportResults, searchQuery]);

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-sky-50 no-print">
                <CardHeader>
                    <CardTitle className="text-2xl font-black flex items-center gap-3">
                        <Package className="text-primary h-7 w-7" /> جرد الأرصدة المخزنية (النتائج المثبتة)
                    </CardTitle>
                    <CardDescription>عرض الكميات الحقيقية المتوفرة في الرفوف. اضغط على الزر لتجميد القراءة الحالية.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="grid gap-2 w-64">
                        <Label className="font-bold mr-1">تصفية حسب المستودع</Label>
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger className="rounded-xl h-10 bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل المستودعات</SelectItem>
                                {/* Warehouses would be populated here if subscribed */}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 flex-grow">
                        <Label className="font-bold mr-1">بحث في الأصناف</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="بحث بالاسم أو الرمز..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 rounded-xl bg-background" />
                        </div>
                    </div>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="h-10 px-10 rounded-xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                        {isGenerating ? <Loader2 className="animate-spin h-5 w-5" /> : <FileSearch className="h-5 w-5" />}
                        إنشاء تقرير الجرد
                    </Button>
                </CardContent>
            </Card>

            {reportResults ? (
                <Card className="rounded-[2rem] border-none shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                    <CardHeader className="bg-muted/10 border-b pb-4">
                        <CardTitle className="text-lg font-black">أرصدة الأصناف النهائية</CardTitle>
                    </CardHeader>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="px-8 font-bold">الصنف</TableHead>
                                <TableHead>الرمز (SKU)</TableHead>
                                <TableHead className="text-center font-bold">الرصيد المتوفر</TableHead>
                                <TableHead>وحدة القياس</TableHead>
                                <TableHead className="text-left px-8 font-bold">القيمة التقديرية</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {finalDisplayData.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">لا توجد أصناف تطابق البحث في هذه اللقطة.</TableCell></TableRow>
                            ) : (
                                finalDisplayData.map(item => (
                                    <TableRow key={item.id} className={cn("h-14 hover:bg-muted/30 border-b last:border-0", item.isLow && "bg-red-50/30")}>
                                        <TableCell className="px-8 font-bold">
                                            {item.name}
                                            {item.isLow && <Badge variant="destructive" className="mr-2 text-[8px] h-4">نقص مخزون</Badge>}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs opacity-60">{item.sku}</TableCell>
                                        <TableCell className="text-center font-black text-xl text-primary font-mono">{item.totalQty}</TableCell>
                                        <TableCell className="text-xs font-bold text-muted-foreground">{item.unitOfMeasure}</TableCell>
                                        <TableCell className="text-left px-8 font-mono font-bold">{formatCurrency(item.totalQty * (item.costPrice || 0))}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                <div className="h-96 flex flex-col items-center justify-center border-2 border-dashed rounded-[3rem] bg-muted/5 opacity-40">
                    <Package className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black text-muted-foreground">يرجى الضغط على زر "إنشاء تقرير الجرد" لعرض أرصدة المخازن المثبتة.</p>
                </div>
            )}
        </div>
    );
}
