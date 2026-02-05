'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function HrPlaceholderPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>وحدة الموارد البشرية</CardTitle>
        <CardDescription>
          هذه الوحدة قيد إعادة البناء والتطوير.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
        <Construction className="h-16 w-16 mb-4" />
        <p className="text-lg font-semibold">قيد الإنشاء</p>
        <p>نعمل حاليًا على إعادة تصميم هذه الوحدة بالكامل. شكرًا لصبركم.</p>
      </CardContent>
    </Card>
  );
}
