'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import type { Boq, BoqItem } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, Pencil, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { toFirestoreDate } from '@/services/date-converter';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';

export default function BoqDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const boqRef = useMemo(() => firestore && id ? doc(firestore, 'boqs', id) : null, [firestore, id]);
    const { data: boq, loading: boqLoading } = useDocument<Boq>(firestore, boqRef?.path);

    const itemsQuery = useMemo(() => {
        if (!boqRef) return null;
        return [orderBy('itemNumber')];
    }, [boqRef]);

    const { data: items, loading: itemsLoading } = useSubscription<BoqItem>(firestore, `${boqRef?.path}/items`, itemsQuery || []);

    const loading = boqLoading || itemsLoading;

    if (loading) {
        return (
            <div className="space-y-4 max-w-4xl mx-auto">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    if (!boq) {
        return <p className="text-center">لم يتم العثور على جدول الكميات.</p>;
    }
    
    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center no-print">
                <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> العودة للقائمة</Button>
                <div className="flex gap-2">
                    <Button asChild variant="outline"><Link href={`/dashboard/construction/boq/${id}/edit`}><Pencil className="ml-2 h-4"/> تعديل</Link></Button>
                    <Button onClick={() => window.print()}><Printer className="ml-2 h-4"/> طباعة</Button>
                </div>
            </div>

            <Card className="printable-area">
                <CardHeader>
                    <CardTitle className="text-2xl">{boq.name}</CardTitle>
                    <CardDescription>رقم المرجع: {boq.boqNumber}</CardDescription>
                     <div className="flex items-center gap-4 pt-2">
                        <span>العميل: <strong>{boq.clientName || '-'}</strong></span>
                        <Separator orientation="vertical" className="h-4" />
                        <span>الحالة: <Badge variant="outline">{boq.status}</Badge></span>
                    </div>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader><TableRow><TableHead className="w-1/2">بيان الأعمال</TableHead><TableHead>الوحدة</TableHead><TableHead>الكمية</TableHead><TableHead>سعر الوحدة</TableHead><TableHead className="text-left">الإجمالي</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {items.map(item => (
                                <TableRow key={item.id} className={item.isHeader ? 'bg-muted font-bold' : ''}>
                                    <TableCell style={{ paddingRight: `${item.level * 2}rem` }}>{item.description}</TableCell>
                                    <TableCell>{item.isHeader ? '-' : item.unit}</TableCell>
                                    <TableCell>{item.isHeader ? '-' : item.quantity}</TableCell>
                                    <TableCell>{item.isHeader ? '-' : formatCurrency(item.sellingUnitPrice || 0)}</TableCell>
                                    <TableCell className="text-left font-mono">
                                        {item.isHeader ? '' : formatCurrency((item.quantity || 0) * (item.sellingUnitPrice || 0))}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="text-base font-bold bg-muted/50">
                                <TableCell colSpan={4}>الإجمالي العام</TableCell>
                                <TableCell className="text-left font-mono">{formatCurrency(boq.totalValue || 0)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
