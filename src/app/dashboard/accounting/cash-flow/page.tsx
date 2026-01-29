'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeftRight } from 'lucide-react';

export default function CashFlowPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>قائمة التدفقات النقدية</CardTitle>
        <CardDescription>
          تتبع حركة النقد الفعلي الداخل والخارج من الأنشطة التشغيلية والاستثمارية والتمويلية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <ArrowLeftRight className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">هذه الميزة قيد التطوير حاليًا.</p>
        </div>
      </CardContent>
    </Card>
  );
}
