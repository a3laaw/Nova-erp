'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LineChart } from 'lucide-react';

export default function IncomeStatementPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>قائمة الدخل</CardTitle>
        <CardDescription>
          تقيس الأداء المالي والربحية للشركة خلال فترة محددة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <LineChart className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">هذه الميزة قيد التطوير حاليًا.</p>
        </div>
      </CardContent>
    </Card>
  );
}
