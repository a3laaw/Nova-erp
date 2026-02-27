'use client';
import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useDocument } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { RequestForQuotation } from '@/lib/types';
import { RfqComparisonView } from '@/components/purchasing/rfq-comparison-view';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, BarChart, Printer, LayoutHorizontal, LayoutVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CompareRfqPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore } = useFirebase();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

    const rfqRef = useMemo(() => (firestore && id ? doc(firestore, 'rfqs', id) : null), [firestore, id]);
    const { data: rfq, loading } = useDocument<RequestForQuotation>(firestore, rfqRef?.path || null);
    
    const handlePrint = () => {
        const element = document.getElementById('comparison-printable-area');
        if (!element || !rfq) return;
        
        import('html2pdf.js').then(module => {
            const html2pdf = module.default;
            const opt = {
                margin: [0.3, 0.3, 0.3, 0.3],
                filename: `Comparison_Matrix_${rfq.rfqNumber}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, letterRendering: true, backgroundColor: '#ffffff' },
                jsPDF: { 
                    unit: 'in', 
                    format: orientation === 'landscape' ? 'a3' : 'a4', 
                    orientation: orientation 
                }
            };
            html2pdf().from(element).set(opt).save();
        });
    };

    if (loading) return <div className="p-8"><Skeleton className="h-[500px] w-full rounded-2xl" /></div>;
    
    if (!rfq) return <div className="text-center py-20">لم يتم العثور على طلب التسعير.</div>;

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-2xl border-none shadow-sm overflow-hidden">
                <CardHeader className="flex flex-col md:flex-row justify-between items-center bg-muted/30 px-8 py-6 gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-black flex items-center gap-3">
                            <BarChart className="text-primary h-7 w-7" />
                            مصفوفة مقارنة عروض الأسعار
                        </CardTitle>
                        <CardDescription>تحليل العروض لطلب رقم: <span className="font-mono font-bold text-foreground">{rfq.rfqNumber}</span></CardDescription>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 no-print">
                        <div className="bg-background p-1 rounded-xl border flex items-center">
                            <Button 
                                variant={orientation === 'portrait' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 gap-2 rounded-lg"
                                onClick={() => setOrientation('portrait')}
                            >
                                <LayoutVertical className="h-4 w-4" />
                                <span className="text-xs">رأسي (A4)</span>
                            </Button>
                            <Button 
                                variant={orientation === 'landscape' ? 'secondary' : 'ghost'} 
                                size="sm" 
                                className="h-8 gap-2 rounded-lg"
                                onClick={() => setOrientation('landscape')}
                            >
                                <LayoutHorizontal className="h-4 w-4" />
                                <span className="text-xs">أفقي (A3)</span>
                            </Button>
                        </div>

                        <Button className="gap-2 rounded-xl font-bold shadow-lg" onClick={handlePrint}>
                            <Printer className="h-4 w-4"/> 
                            تصدير للطباعة
                        </Button>
                        
                        <Button variant="ghost" className="gap-2 rounded-xl" onClick={() => router.back()}>
                            <ArrowRight className="h-4 w-4"/> 
                            العودة
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0" id="comparison-printable-area">
                    <div className={cn(
                        "bg-white p-4 print:p-0",
                        orientation === 'landscape' ? "min-w-[1200px] print:min-w-full" : "w-full"
                    )}>
                        <RfqComparisonView rfq={rfq} />
                    </div>
                </CardContent>
                <CardFooter className="p-6 border-t bg-muted/10 no-print">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
                        <div className="h-3 w-3 rounded-full bg-green-500/20 border border-green-500" />
                        يتم تمييز أفضل سعر مقدم لكل صنف باللون الأخضر. الوضع الأفقي (A3) مناسب للجداول التي تحتوي على أكثر من 4 موردين.
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
