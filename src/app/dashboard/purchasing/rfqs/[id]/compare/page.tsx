'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { RfqComparisonView } from '@/components/purchasing/rfq-comparison-view';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CompareRfqPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfq, loading, error } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);
    
    if (loading) {
        return <Skeleton className="h-96 w-full" />;
    }
    
    if (!rfq) {
        return <p className="text-center">لم يتم العثور على طلب التسعير.</p>;
    }

    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2"><BarChart /> جدول مقارنة الأسعار</CardTitle>
                        <CardDescription>مقارنة بين عروض الأسعار المستلمة للطلب رقم: {rfq.rfqNumber}</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => router.back()}><ArrowRight className="ml-2 h-4"/> العودة</Button>
                </div>
            </CardHeader>
            <CardContent>
                <RfqComparisonView rfq={rfq} />
            </CardContent>
            <CardFooter>
                <p className="text-xs text-muted-foreground">يتم تظليل أقل سعر لكل صنف باللون الأخضر.</p>
            </CardFooter>
        </Card>
    );
}
