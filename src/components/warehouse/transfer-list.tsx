
'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useSubscription } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { InventoryAdjustment, Warehouse } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeftRight, Search, MapPin } from 'lucide-react';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';

export function TransferList() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: warehouses = [] } = useSubscription<Warehouse>(firestore, 'warehouses');
  const warehouseMap = useMemo(() => new Map(warehouses.map(w => [w.id, w.name])), [warehouses]);

  const transferQuery = useMemo(() => [
    where('type', '==', 'transfer'),
    orderBy('date', 'desc')
  ], []);

  const { data: transfers, loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', transferQuery);

  const filteredTransfers = useMemo(() => {
    if (!searchQuery) return transfers;
    const lower = searchQuery.toLowerCase();
    return transfers.filter(t => 
        t.adjustmentNumber.toLowerCase().includes(lower) || 
        t.notes?.toLowerCase().includes(lower)
    );
  }, [transfers, searchQuery]);

  const formatDate = (dateValue: any) => {
    const date = toFirestoreDate(dateValue);
    return date ? format(date, 'dd/MM/yyyy') : '-';
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
        <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="ابحث برقم التحويل أو الملاحظات..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم التحويل</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>من مستودع</TableHead>
                        <TableHead className="text-center"><ArrowLeftRight className="h-4 w-4 mx-auto opacity-40"/></TableHead>
                        <TableHead>إلى مستودع</TableHead>
                        <TableHead>عدد الأصناف</TableHead>
                        <TableHead className="text-left">القيمة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredTransfers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                لا توجد عمليات تحويل مسجلة.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredTransfers.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell className="font-mono font-bold text-primary">{t.adjustmentNumber}</TableCell>
                                <TableCell>{formatDate(t.date)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3 text-muted-foreground" />
                                        {warehouseMap.get(t.fromWarehouseId!) || '---'}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center opacity-40">➔</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3 text-primary" />
                                        {warehouseMap.get(t.toWarehouseId!) || '---'}
                                    </div>
                                </TableCell>
                                <TableCell>{t.items?.length || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">
                                    {formatCurrency(t.items?.reduce((sum, i) => sum + (i.totalCost || 0), 0) || 0)}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
