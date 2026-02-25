'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc, collection, query, where, updateDoc, getDocs } from 'firebase/firestore';
import type { RequestForQuotation, Vendor, SupplierQuotation } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, FileText, GanttChartSquare, BarChart, XCircle, Send, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toFirestoreDate } from '@/services/date-converter';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { SupplierQuotationCard } from '@/components/purchasing/supplier-quotation-card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const statusColors: Record<string, string> = {
    draft: 'bg-yellow-100 text-yellow-800',
    sent: 'bg-blue-100 text-blue-800',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
};

const statusTranslations: Record<string, string> = {
    draft: 'مسودة',
    sent: 'مرسل للموردين',
    closed: 'مغلق (تحت المقارنة)',
    cancelled: 'ملغي',
};

export default function RfqDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [supplierQuotations, setSupplierQuotations] = useState<SupplierQuotation[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    const rfqRef = useMemo(() => firestore && id ? doc(firestore, 'rfqs', id) : null, [firestore, id]);
    const { data: rfq, loading: rfqLoading } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);

    // إصلاح #3: جلب الموردين في مجموعات (Chunks) لتجنب حد الـ 30 في Firestore IN Query
    useEffect(() => {
        if (!firestore || !rfq?.vendorIds || rfq.vendorIds.length === 0) {
            setDataLoading(false);
            return;
        }

        const fetchData = async () => {
            setDataLoading(true);
            try {
                const vendorIds = rfq.vendorIds;
                const chunks = [];
                for (let i = 0; i < vendorIds.length; i += 30) {
                    chunks.push(vendorIds.slice(i, i + 30));
                }

                const vendorPromises = chunks.map(chunk => 
                    getDocs(query(collection(firestore, 'vendors'), where('__name__', 'in', chunk)))
                );
                const vendorSnapshots = await Promise.all(vendorPromises);
                const fetchedVendors = vendorSnapshots.flatMap(snap => 
                    snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))
                );
                setVendors(fetchedVendors);

                const quotesSnap = await getDocs(query(collection(firestore, 'supplierQuotations'), where('rfqId', '==', id)));
                setSupplierQuotations(quotesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SupplierQuotation)));

            } catch (err) {
                console.error("Error fetching RFQ related data:", err);
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [firestore, rfq?.vendorIds, id]);
    
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

    const loading = rfqLoading || dataLoading;

    if (loading) {
        return (
            <div className="space-y-6" dir="rtl">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>
            </div>
        );
    }
    
    if (!rfq) return <div className="text-center py-20 text-muted-foreground">لم يتم العثور على طلب التسعير.</div>;

    // إصلاح #4: حماية التاريخ
    const safeDate = (() => {
        try {
            return toFirestoreDate(rfq.date);
        } catch {
            return null;
        }
    })();

    return (
        <div className="space-y-6" dir="rtl">
             {rfq.vendorIds?.length > 30 && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>قائمة موردين كبيرة</AlertTitle>
                    <AlertDescription>
                        يحتوي هذا الطلب على {rfq.vendorIds.length} مورداً. تم تقسيم جلب البيانات لضمان الاستقرار.
                    </AlertDescription>
                </Alert>
             )}

             <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                     <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <CardTitle className="text-3xl font-black text-foreground flex items-center gap-2">
                                    <FileText className="text-primary"/>
                                    {`طلب تسعير #${rfq.rfqNumber}`}
                                </CardTitle>
                                <Badge className={cn("text-xs px-3", statusColors[rfq.status])}>{statusTranslations[rfq.status]}</Badge>
                            </div>
                            <CardDescription className="text-base font-medium">
                                تاريخ الطلب: {safeDate ? format(safeDate, 'eeee, dd MMMM yyyy', { locale: ar }) : '-'}
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                            {rfq.status === 'draft' && (
                                <Button onClick={() => handleChangeStatus('sent')} disabled={isUpdatingStatus} className="gap-2">
                                    <Send className="h-4 w-4" /> إرسال الطلب
                                </Button>
                            )}
                            {rfq.status === 'sent' && (
                                <Button onClick={() => handleChangeStatus('closed')} disabled={isUpdatingStatus} className="bg-green-600 hover:bg-green-700 gap-2">
                                    <XCircle className="h-4 w-4" /> إغلاق الطلب والمقارنة
                                </Button>
                            )}
                            {rfq.status === 'closed' && (
                                <Button asChild className="bg-primary shadow-lg shadow-primary/20 gap-2">
                                    <Link href={`/dashboard/purchasing/rfqs/${id}/compare`}>
                                        <BarChart className="h-4 w-4" /> عرض مصفوفة المقارنة
                                    </Link>
                                </Button>
                            )}
                            <Button variant="ghost" onClick={() => router.back()} className="gap-2"><ArrowRight className="h-4 w-4"/> العودة</Button>
                         </div>
                    </div>
                </CardHeader>
                 <CardContent>
                    <div className="p-4 bg-white/50 dark:bg-muted/20 rounded-xl border">
                        <h3 className="text-sm font-bold text-muted-foreground mb-3">الأصناف المطلوبة:</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {rfq.items.map(item => (
                                <div key={item.id} className="flex justify-between items-center p-3 bg-card border rounded-lg shadow-sm">
                                    <span className="font-bold text-sm">{item.itemName}</span>
                                    <Badge variant="secondary" className="font-mono">{item.quantity}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex items-center gap-3 mb-2">
                <GanttChartSquare className="text-primary h-6 w-6" />
                <h3 className="text-xl font-black">عروض أسعار الموردين ({vendors.length})</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            </div>
        </div>
    );
}
