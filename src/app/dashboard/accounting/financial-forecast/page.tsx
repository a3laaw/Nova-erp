'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp, Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const CashFlowProjectionChart = dynamic(
    () => import('@/components/accounting/cash-flow-projection-chart').then(mod => mod.CashFlowProjectionChart),
    { 
        ssr: false,
        loading: () => (
            <div className="flex justify-center items-center h-80">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mr-2">جاري تحميل الرسم البياني...</p>
            </div>
        ),
    }
);

export default function FinancialForecastPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="text-primary" />
                        <CardTitle>التنبؤ بالتدفقات النقدية</CardTitle>
                    </div>
                    <CardDescription>
                        عرض التدفقات النقدية المتوقعة للأشهر القادمة بناءً على دفعات العقود والمصاريف الثابتة.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CashFlowProjectionChart />
                </CardContent>
            </Card>
        </div>
    );
}
