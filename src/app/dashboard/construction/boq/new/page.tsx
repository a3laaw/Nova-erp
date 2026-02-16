'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqForm } from '@/components/construction/boq/boq-form';

export default function NewBoqPage() {
    return (
        <Card dir="rtl" className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>إنشاء جدول كميات جديد</CardTitle>
                <CardDescription>
                    أدخل تفاصيل جدول الكميات. يمكنك ربطه بعميل لاحقًا.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <BoqForm />
            </CardContent>
        </Card>
    );
}

