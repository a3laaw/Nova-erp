
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function LeaveRequestsPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>طلبات الإجازة</CardTitle>
                <CardDescription>
                هذه الصفحة قيد الإنشاء حاليًا.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                <Construction className="h-16 w-16 mb-4" />
                <p className="text-lg font-semibold">قيد الإنشاء</p>
                <p>سيتم هنا عرض وإدارة طلبات الإجازات المقدمة من الموظفين.</p>
            </CardContent>
        </Card>
    );
}

    