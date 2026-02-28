
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PaymentApplicationForm } from '@/components/construction/payment-application-form';
import { useRouter } from 'next/navigation';

export default function NewPaymentApplicationPage() {
    const router = useRouter();
    return (
        <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6" dir="rtl">
            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-gradient-to-l from-white to-sky-50">
                <CardHeader className="pb-8">
                    <CardTitle className="text-3xl font-black">إصدار مستخلص أعمال (مطالبة مالية للعميل)</CardTitle>
                    <CardDescription className="text-base">قم باختيار المشروع وتحديد الكميات المنفذة في الموقع لإصدار مطالبة مالية رسمية للعميل بناءً على بنود المقايسة.</CardDescription>
                </CardHeader>
                <CardContent>
                    <PaymentApplicationForm onClose={() => router.back()} />
                </CardContent>
            </Card>
        </div>
    );
}
