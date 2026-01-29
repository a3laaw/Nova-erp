
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function FinancialStatementNotesPage() {
  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>الإيضاحات المتممة للقوائم المالية</CardTitle>
        <CardDescription>
          تفاصيل وشروحات إضافية حول السياسات المحاسبية والبنود الهامة في القوائم المالية.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-muted/50">
          <FileText className="w-16 h-16 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">هذه الميزة قيد التطوير حاليًا.</p>
          <p className="mt-1 text-xs text-muted-foreground">سيتم إضافة محرر لإدارة الإيضاحات هنا قريبًا.</p>
        </div>
      </CardContent>
    </Card>
  );
}
