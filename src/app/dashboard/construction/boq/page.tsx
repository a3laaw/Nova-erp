
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqLibrary } from '@/components/construction/boq-library';
import { ClipboardList } from 'lucide-react';

export default function BoqLibraryPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-blue-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <ClipboardList className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">مكتبة جداول الكميات (BOQ)</CardTitle>
                            <CardDescription className="text-base font-medium">
                                إدارة بنود الحصر والتسعير المرجعية للمشاريع الإنشائية لتوحيد المعايير.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <BoqLibrary />
                </CardContent>
            </Card>
        </div>
    );
}
