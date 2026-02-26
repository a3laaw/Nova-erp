
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GrnForm } from '@/components/warehouse/grn-form';
import { useRouter } from 'next/navigation';

export default function NewGrnPage() {
    const router = useRouter();
    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إذن استلام مواد جديد (GRN)</CardTitle>
                <CardDescription>إثبات استلام كميات من المورد بناءً على أمر شراء سابق وتغذية المخزون.</CardDescription>
            </CardHeader>
            <CardContent>
                <GrnForm onClose={() => router.back()} />
            </CardContent>
        </Card>
    );
}
