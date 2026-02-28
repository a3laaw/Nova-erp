
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PurchaseRequestForm } from '@/components/purchasing/purchase-request-form';

export default function NewPurchaseRequestPage() {
    const router = useRouter();
    return (
        <Card className="max-w-4xl mx-auto rounded-3xl border-none shadow-xl overflow-hidden" dir="rtl">
            <CardHeader className="bg-muted/30 pb-8 px-8 border-b">
                <CardTitle className="text-3xl font-black text-foreground">طلب شراء داخلي جديد</CardTitle>
                <CardDescription className="text-base font-medium">قم بتحديد المواد المطلوبة للموقع أو القسم ليتم مراجعتها واعتمادها من الإدارة.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                <PurchaseRequestForm onClose={() => router.back()} />
            </CardContent>
        </Card>
    );
}
