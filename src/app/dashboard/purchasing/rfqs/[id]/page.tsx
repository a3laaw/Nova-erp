'use client';
import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument, useSubscription } from '@/firebase';
import { doc, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, GanttChartSquare, BarChart, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { SupplierQuotationCard } from '@/components/purchasing/supplier-quotation-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل',
    closed: 'مغلق',
    cancelled: 'ملغي',
};

export default function RfqDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


    const rfqRef = useMemo(() => firestore && id ? doc(firestore, 'rfqs', id) : null, [firestore, id]);
    const { data: rfq, loading: rfqLoading, error } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);

    const vendorsQuery = useMemo(() => {
        if (!firestore || !rfq?.vendorIds || rfq.vendorIds.length === 0) return null;
        return [where('__name__', 'in', rfq.vendorIds)];
    }, [firestore, rfq?.vendorIds]);
    const { data: vendors, loading: vendorsLoading } = useSubscription<Vendor>(firestore, 'vendors', vendorsQuery || []);
    
    const supplierQuotesQuery = useMemo(() => {
        if (!firestore || !id) return null;
        return [where('rfqId', '==', id)];
    }, [firestore, id]);
    const { data: supplierQuotations, loading: quotesLoading } = useSubscription<SupplierQuotation>(firestore, 'supplierQuotations', supplierQuotesQuery || []);

    const loading = rfqLoading || vendorsLoading || quotesLoading;
    
    const handleChangeStatus = async (newStatus: RequestForQuotation['status']) => {
        if (!rfqRef) return;
        setIsUpdatingStatus(true);
        try {
            await updateDoc(rfqRef, { status: newStatus });
        } catch (e) {
            console.error("Failed to update status", e);
        } finally {
            setIsUpdatingStatus(false);
        }
    };


    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        );
    }
    
    if (!rfq) {
        return <div className="text-center py-10">لم يتم العثور على طلب التسعير.</div>;
    }

    return (
        <div className="space-y-6" dir="rtl">
             <Card>
                <CardHeader>
                     <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                <FileText />
                                {`طلب تسعير #${rfq.rfqNumber}`}
                                <Badge variant="outline" className={statusColors[rfq.status]}>{statusTranslations[rfq.status]}</Badge>
                            </CardTitle>
                            <CardDescription>
                                تاريخ الطلب: {toFirestoreDate(rfq.date) ? format(toFirestoreDate(rfq.date)!, 'PPP') : '-'}
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                            {rfq.status === 'sent' && (
                                <Button onClick={() => handleChangeStatus('closed')} disabled={isUpdatingStatus}>
                                    <XCircle className="ml-2 h-4 w-4" />
                                    إغلاق الطلب وبدء المقارنة
                                </Button>
                            )}
                            {rfq.status === 'closed' && (
                                <Button asChild>
                                    <Link href={`/dashboard/purchasing/rfqs/${id}/compare`}>
                                        <BarChart className="ml-2 h-4 w-4" />
                                        عرض جدول المقارنة
                                    </Link>
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> العودة للقائمة</Button>
                         </div>
                    </div>
                </CardHeader>
                 <CardContent>
                    <h3 className="font-semibold mb-2">الأصناف المطلوبة ({rfq.items.length})</h3>
                     <div className="border rounded-md">
                        {rfq.items.map(item => (
                            <div key={item.id} className="flex justify-between items-center p-3 border-b last:border-b-0">
                                <span className="font-medium">{item.itemName}</span>
                                <span className="text-sm font-mono bg-muted px-2 py-1 rounded-md">{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><GanttChartSquare /> عروض أسعار الموردين</CardTitle>
                    <CardDescription>أدخل عروض الأسعار المستلمة من الموردين أدناه للبدء في المقارنة.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map(vendor => {
                        const existingQuote = supplierQuotations.find(q => q.vendorId === vendor.id);
                        return (
                            <SupplierQuotationCard 
                                key={vendor.id}
                                rfq={rfq}
                                vendor={vendor}
                                existingQuote={existingQuote}
                            />
                        )
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
