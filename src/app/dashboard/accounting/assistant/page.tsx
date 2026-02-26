'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function AccountingAssistantPage() {
  return (
    <div className="space-y-6" dir="rtl">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                المساعد المحاسبي
                </CardTitle>
                <CardDescription>
                هذه الميزة غير مفعلة حالياً.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>تنبيه</AlertTitle>
                    <AlertDescription>
                        تم إيقاف تشغيل ميزات الذكاء الاصطناعي في هذا الإصدار. يرجى استخدام قيود اليومية اليدوية وسندات القبض والصرف لإدارة حساباتك.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    </div>
  );
}
