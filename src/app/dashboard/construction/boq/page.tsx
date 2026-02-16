'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqLibrary } from '@/components/construction/boq-library';

export default function BoqLibraryPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>مكتبة جداول الكميات (BOQ)</CardTitle>
                <CardDescription>
                    عرض وإدارة جميع جداول الكميات للمشاريع والمعاملات من مكان واحد.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <BoqLibrary />
            </CardContent>
        </Card>
    );
}
