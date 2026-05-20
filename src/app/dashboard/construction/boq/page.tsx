'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BoqLibrary } from '@/components/construction/boq-library';
import { ClipboardList } from 'lucide-react';

export default function BoqLibraryPage() {
    return (
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-blue-50">
                <CardHeader className="pb-8 px-10 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-600 shadow-inner">
                            <ClipboardList className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black">مكتبة المقايسات (BOQ)</CardTitle>
                            <CardDescription className="text-base font-bold text-slate-500 mt-1">
                                إدارة بنود الحصر والتسعير المرجعية للمشاريع الإنشائية لتوحيد المعايير الفنية والمالية.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="pt-8">
                    <BoqLibrary />
                </CardContent>
            </Card>
        </div>
    );
}
