'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqList } from '@/components/construction/boq-list';

export default function BoqListPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>جداول الكميات المركزية (BOQ)</CardTitle>
                <CardDescription>
                    عرض وإدارة جميع جداول الكميات للمشاريع والمعاملات من مكان واحد.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <BoqList />
            </CardContent>
        </Card>
    );
}
