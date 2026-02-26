
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransferForm } from '@/components/warehouse/transfer-form';
import { useRouter } from 'next/navigation';

export default function NewTransferPage() {
    const router = useRouter();
    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إذن تحويل مخزني جديد</CardTitle>
                <CardDescription>نقل المواد من مستودع إلى آخر وتحديث أرصدة المستودعات آلياً.</CardDescription>
            </CardHeader>
            <CardContent>
                <TransferForm onClose={() => router.back()} />
            </CardContent>
        </Card>
    );
}
