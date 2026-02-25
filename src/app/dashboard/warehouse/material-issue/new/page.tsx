
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MaterialIssueForm } from '@/components/warehouse/material-issue-form';
import { useRouter } from 'next/navigation';

export default function NewMaterialIssuePage() {
    const router = useRouter();
    return (
        <Card className="max-w-4xl mx-auto" dir="rtl">
            <CardHeader>
                <CardTitle>إذن صرف مواد جديد</CardTitle>
                <CardDescription>تحميل تكلفة المواد على مشروع محدد (مركز تكلفة).</CardDescription>
            </CardHeader>
            <CardContent>
                <MaterialIssueForm onClose={() => router.back()} />
            </CardContent>
        </Card>
    );
}
