'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export function TaskPrioritization() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          قائمة المهام المقترحة
        </CardTitle>
        <CardDescription>
          يرجى مراجعة الجدول الزمني للمشاريع لتحديد أولويات العمل.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-center text-muted-foreground text-sm italic">
        لا توجد مهام مقترحة حالياً.
      </CardContent>
    </Card>
  );
}
