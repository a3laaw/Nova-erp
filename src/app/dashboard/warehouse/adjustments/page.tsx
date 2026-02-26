
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Ban } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useSubscription } from '@/firebase';
import { where, orderBy } from 'firebase/firestore';
import type { InventoryAdjustment } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function AdjustmentsPage() {
    const { firestore } = useFirebase();
    
    const adjQuery = [
        where('type', 'in', ['damage', 'theft', 'other']),
        orderBy('date', 'desc')
    ];
    
    const { data: adjustments, loading } = useSubscription<InventoryAdjustment>(firestore, 'inventoryAdjustments', adjQuery);

    const typeTranslations: Record<string, string> = {
        damage: 'تلف مواد',
        theft: 'فقد / سرقة',
        other: 'تسوية أخرى'
    };

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Ban className="text-destructive" />
                            تسويات المخزون (تلف / فقد)
                        </CardTitle>
                        <CardDescription>تسجيل ومعالجة المواد التالفة أو المفقودة لضمان دقة الجرد.</CardDescription>
                    </div>
                    <Button asChild variant="destructive" size="sm">
                        <Link href="/dashboard/warehouse/adjustments/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            تسجيل تسوية جديدة
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الإذن</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الملاحظات</TableHead>
                                <TableHead className="text-left">قيمة الخسارة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="text-center p-8"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                            ) : adjustments.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">لا توجد تسويات مسجلة.</TableCell></TableRow>
                            ) : (
                                adjustments.map(adj => (
                                    <TableRow key={adj.id}>
                                        <TableCell className="font-mono font-bold">{adj.adjustmentNumber}</TableCell>
                                        <TableCell>{toFirestoreDate(adj.date) ? format(toFirestoreDate(adj.date)!, 'dd/MM/yyyy') : '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={adj.type === 'theft' ? 'bg-red-50 text-red-700' : ''}>
                                                {typeTranslations[adj.type] || adj.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{adj.notes || '-'}</TableCell>
                                        <TableCell className="text-left font-mono text-red-600">
                                            {formatCurrency(adj.items?.reduce((sum, i) => sum + i.totalCost, 0) || 0)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
