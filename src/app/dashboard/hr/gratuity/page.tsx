
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GratuityCalculator } from '@/components/hr/gratuity-calculator';

export default function GratuityPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>حاسبة مكافأة نهاية الخدمة</CardTitle>
                <CardDescription>
                    حساب تقديري لمكافأة نهاية الخدمة وبدل الإجازات وفقًا لقانون العمل الكويتي.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <GratuityCalculator />
            </CardContent>
        </Card>
    );
}


    