'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { CashFlowProjectionChart } from '@/components/accounting/cash-flow-projection-chart';

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
