'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function EquityStatementPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>قائمة التغير في حقوق الملكية</CardTitle>
        <CardDescription>
          تتبع التغير في حصص الملاك والأرباح المحتجزة خلال فترة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
          <Users className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">هذه الميزة قيد التطوير حاليًا.</p>
        </div>
      </CardContent>
    </Card>
  );
}
