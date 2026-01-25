'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter, useParams } from "next/navigation";

export default function ViewJournalEntryPage() {
    const router = useRouter();
    const params = useParams();

    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>عرض قيد اليومية</CardTitle>
                <CardDescription>
                    صفحة عرض تفاصيل قيد اليومية (رقم: {Array.isArray(params.id) ? params.id[0] : params.id}). سيتم تنفيذ هذه الميزة قريبًا.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Button onClick={() => router.back()}>العودة</Button>
            </CardContent>
        </Card>
    )
}
