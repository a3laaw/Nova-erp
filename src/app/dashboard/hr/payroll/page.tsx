
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function PayrollPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>كشوف الرواتب والحضور</CardTitle>
                <CardDescription>
                هذه الصفحة قيد الإنشاء حاليًا.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                <Construction className="h-16 w-16 mb-4" />
                <p className="text-lg font-semibold">قيد الإنشاء</p>
                <p>سيتم هنا إدارة سجلات الحضور والانصراف وإنشاء كشوف الرواتب الشهرية.</p>
            </CardContent>
        </Card>
    );
}

    