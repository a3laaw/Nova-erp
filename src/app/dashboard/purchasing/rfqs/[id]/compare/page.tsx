'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useSubscription } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { RfqComparisonView } from '@/components/purchasing/rfq-comparison-view';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart3, Printer, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function CompareRfqPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfqData, loading } = useSubscription<RequestForQuotation>(firestore, rfqRef?.path || null);
    const rfq = useMemo(() => (rfqData && rfqData.length > 0) ? rfqData[0] : null, [rfqData]);
    
    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div className="p-8 max-w-6xl mx-auto"><Skeleton className="h-[600px] w-full rounded-[2.5rem]" /></div>;
    
    if (!rfq) return <div className="text-center py-20 font-black opacity-40">لم يتم العثور على طلب التسعير المطلوب.</div>;

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden print:shadow-none print:border-none print:bg-transparent">
                <CardHeader className="flex flex-col md:flex-row justify-between items-center bg-muted/30 px-10 py-8 gap-6 no-print">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-primary/10 rounded-3xl text-primary shadow-inner">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-3xl font-black tracking-tighter">مصفوفة المقارنة والترسية الذكية</CardTitle>
                            <CardDescription className="text-base font-bold">تحليل العروض المالية لطلب رقم: <span className="font-mono font-black text-primary px-2 bg-primary/5 rounded-lg border border-primary/10">{rfq.rfqNumber}</span></CardDescription>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <Button className="h-12 px-10 rounded-2xl font-black text-lg gap-3 shadow-xl shadow-primary/20" onClick={handlePrint}>
                            <Printer className="h-6 w-6"/> 
                            طباعة مصفوفة التحليل
                        </Button>
                        
                        <Button variant="ghost" className="h-12 rounded-2xl font-bold gap-2 text-slate-500 hover:bg-white" onClick={() => router.back()}>
                            <ArrowRight className="h-5 w-5"/> 
                            العودة للطلب
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 print:p-0">
                    <div className="bg-white p-6 lg:p-10 print:p-0">
                        <RfqComparisonView rfq={rfq} />
                    </div>
                </CardContent>
                <CardFooter className="p-8 border-t bg-muted/10 no-print flex items-center gap-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <BarChart3 className="h-4 w-4 opacity-40" />
                    Nova ERP — Smart Procurement & Split-Award Engine
                </CardFooter>
            </Card>
        </div>
    );
}