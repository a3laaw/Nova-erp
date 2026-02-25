
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
import type { InventoryAdjustment } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { ArrowUpFromLine, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toFirestoreDate } from '@/services/date-converter';

export function MaterialIssueList() {
  const { firestore } = useFirebase();
  const [searchQuery, setSearchQuery] = useState('');

  const issueQuery = useMemo(() => [
    where('type', '==', 'material_issue'),
    orderBy('date', 'desc')
  ], []);

  const { data: issues, loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', issueQuery);

  const filteredIssues = useMemo(() => {
    if (!searchQuery) return issues;
    const lower = searchQuery.toLowerCase();
    return issues.filter(i => 
        i.adjustmentNumber.toLowerCase().includes(lower) || 
        i.notes?.toLowerCase().includes(lower)
    );
  }, [issues, searchQuery]);

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
                placeholder="ابحث برقم الإذن أو الملاحظات..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
            />
        </div>
        <div className="border rounded-lg">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>رقم الإذن</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>عدد الأصناف</TableHead>
                        <TableHead className="text-left">القيمة المصروفة</TableHead>
                        <TableHead>الملاحظات</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredIssues.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                لا توجد أذونات صرف مسجلة.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredIssues.map((issue) => (
                            <TableRow key={issue.id}>
                                <TableCell className="font-mono font-bold text-primary">{issue.adjustmentNumber}</TableCell>
                                <TableCell>{formatDate(issue.date)}</TableCell>
                                <TableCell>{issue.items?.length || 0}</TableCell>
                                <TableCell className="text-left font-mono font-semibold">
                                    {formatCurrency(issue.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{issue.notes || '-'}</TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    </div>
  );
}
