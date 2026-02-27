'use client';
import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { RfqComparisonView } from '@/components/purchasing/rfq-comparison-view';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart, Printer } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CompareRfqPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfq, loading } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);
    
    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8"><Skeleton className="h-[500px] w-full rounded-2xl" /></div>;
    
    if (!rfq) return <div className="text-center py-20">لم يتم العثور على طلب التسعير.</div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm overflow-hidden print:shadow-none print:border-none">
                <CardHeader className="flex flex-col md:flex-row justify-between items-center bg-muted/30 px-8 py-6 gap-4 no-print">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black flex items-center gap-3">
                            <BarChart className="text-primary h-7 w-7" />
                            مصفوفة مقارنة عروض الأسعار
                        </CardTitle>
                        <CardDescription>تحليل العروض لطلب رقم: <span className="font-mono font-bold text-foreground">{rfq.rfqNumber}</span></CardDescription>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button className="gap-2 rounded-xl font-bold shadow-lg" onClick={handlePrint}>
                            <Printer className="h-4 w-4"/> 
                            طباعة التحليل
                        </Button>
                        
                        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => router.back()}>
                            <ArrowRight className="h-4 w-4"/> 
                            العودة
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="bg-white p-4 print:p-0">
                        <RfqComparisonView rfq={rfq} />
                    </div>
                </CardContent>
                <CardFooter className="p-6 border-t bg-muted/10 no-print">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                        <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500" />
                        يتم تمييز أفضل سعر مقدم لكل صنف باللون الأخضر. يمكنك تغيير اتجاه الورقة (أفقي/رأسي) من إعدادات الطباعة في المتصفح.
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
