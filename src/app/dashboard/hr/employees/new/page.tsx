
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function NewEmployeePage() {
    // This will be replaced with the actual form in a future step.
    return (
        <Card>
            <CardHeader>
                <CardTitle>إضافة موظف جديد</CardTitle>
                <CardDescription>
                هذه الصفحة قيد الإنشاء حاليًا.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center text-muted-foreground min-h-[300px]">
                <Construction className="h-16 w-16 mb-4" />
                <p className="text-lg font-semibold">قيد الإنشاء</p>
                <p>سيتم هنا وضع نموذج مفصل لإضافة موظف جديد.</p>
            </CardContent>
        </Card>
    );
}

    