'use client';
import { useMemo } from 'react';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import type { Boq, BoqItem } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Eye, ExternalLink } from 'lucide-react';

interface LinkedBoqViewProps {
    boqId: string;
}

export function LinkedBoqView({ boqId }: LinkedBoqViewProps) {
    const { firestore } = useFirebase();

    const boqRef = useMemo(() => firestore && boqId ? doc(firestore, 'boqs', boqId) : null, [firestore, boqId]);
    const { data: boq, loading: boqLoading } = useDocument<Boq>(firestore, boqRef?.path || null);

    const itemsQuery = useMemo(() => {
        if (!boqRef) return null;
        return [orderBy('itemNumber')];
    }, [boqRef]);

    const { data: items, loading: itemsLoading } = useSubscription<BoqItem>(
        firestore,
        boqRef ? `${boqRef.path}/items` : null,
        itemsQuery || []
    );

    const loading = boqLoading || itemsLoading;

    if (loading) {
        return <Skeleton className="h-64 w-full" />;
    }
    
    if (!boq) {
        return (
            <div className="p-8 text-center border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">لم يتم العثور على جدول الكميات المرتبط.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold">{boq.name}</h3>
                    <p className="text-sm text-muted-foreground">رقم: {boq.boqNumber} | الحالة: <Badge variant="outline">{boq.status}</Badge></p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/construction/boq/${boqId}`}>
                        <ExternalLink className="ml-2 h-4 w-4"/>
                        فتح في المكتبة
                    </Link>
                </Button>
            </div>
             <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">م</TableHead>
                            <TableHead className="w-1/2">بيان الأعمال</TableHead>
                            <TableHead>الوحدة</TableHead>
                            <TableHead>الكمية</TableHead>
                            <TableHead>سعر الوحدة</TableHead>
                            <TableHead className="text-left">الإجمالي</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center h-24">الجدول فارغ.</TableCell></TableRow>
                        ) : (
                            items.map(item => (
                                <TableRow key={item.id} className={item.isHeader ? 'bg-muted/50 font-bold' : ''}>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{item.itemNumber}</TableCell>
                                    <TableCell style={{ paddingRight: `${(item.level || 0) * 1.5}rem` }}>
                                        <div>
                                            <p>{item.description}</p>
                                            {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{item.isHeader ? '-' : item.unit}</TableCell>
                                    <TableCell>{item.isHeader ? '-' : item.quantity}</TableCell>
                                    <TableCell>{item.isHeader ? '-' : formatCurrency(item.sellingUnitPrice || 0)}</TableCell>
                                    <TableCell className="text-left font-mono">
                                        {item.isHeader ? '-' : formatCurrency((item.quantity || 0) * (item.sellingUnitPrice || 0))}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                     <TableFooter>
                        <TableRow className="text-base font-bold bg-muted/50">
                            <TableCell colSpan={5}>الإجمالي العام لجدول الكميات</TableCell>
                            <TableCell className="text-left font-mono">{formatCurrency(boq.totalValue || 0)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    );
}
