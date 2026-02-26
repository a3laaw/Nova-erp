
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
import { collection, query, orderBy } from 'firebase/firestore';
import type { GoodsReceiptNote } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Search, FileCheck } from 'lucide-react';
import { Input } from '../ui/input';
import { toFirestoreDate } from '@/services/date-converter';

export function GrnList() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: grns, loading } = useSubscription<any>(firestore, 'grns', [orderBy('date', 'desc')]);

  const filteredGrns = useMemo(() => {
    if (!searchQuery) return grns;
    const lower = searchQuery.toLowerCase();
    return grns.filter(g => 
        g.grnNumber.toLowerCase().includes(lower) || 
        g.vendorName?.toLowerCase().includes(lower)
    );
  }, [grns, searchQuery]);

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
                placeholder="ابحث برقم الإذن أو المورد..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم الإذن (GRN)</TableHead>
                        <TableHead>المورد</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>عدد الأصناف</TableHead>
                        <TableHead className="text-left">إجمالي القيمة</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredGrns.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                لا توجد أذونات استلام مسجلة.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredGrns.map((grn) => (
                            <TableRow key={grn.id}>
                                <TableCell className="font-mono font-bold text-primary">{grn.grnNumber}</TableCell>
                                <TableCell className="font-medium">{grn.vendorName}</TableCell>
                                <TableCell>{formatDate(grn.date)}</TableCell>
                                <TableCell>{grn.itemsReceived?.length || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">
                                    {formatCurrency(grn.totalValue || 0)}
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
