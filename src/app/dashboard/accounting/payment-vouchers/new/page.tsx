'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function NewPaymentVoucherPage() {
    const router = useRouter();

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إنشاء سند صرف جديد</CardTitle>
                <CardDescription>
                    هذه الصفحة قيد الإنشاء حاليًا. سيتم تنفيذها قريبًا.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={() => router.back()}>العودة</Button>
            </CardContent>
        </Card>
    );
}
