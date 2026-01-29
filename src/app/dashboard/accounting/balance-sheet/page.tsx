'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Scale } from 'lucide-react';

export default function BalanceSheetPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>قائمة المركز المالي (الميزانية العمومية)</CardTitle>
        <CardDescription>
          عرض الأصول والالتزامات وحقوق الملكية للشركة في لحظة زمنية معينة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Scale className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">هذه الميزة قيد التطوير حاليًا.</p>
        </div>
      </CardContent>
    </Card>
  );
}
