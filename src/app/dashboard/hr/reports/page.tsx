'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function HrReportsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>تقارير الموارد البشرية</CardTitle>
                <CardDescription>
                    عرض تقارير متنوعة حول الموظفين، الحضور، الإجازات، والرواتب.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">قيد الإنشاء</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        يتم العمل على بناء هذه الصفحة حاليًا.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
