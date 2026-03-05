'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionRequestsList } from '@/components/hr/permission-requests-list';
import { Clock } from 'lucide-react';

export default function PermissionRequestsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-indigo-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600/10 rounded-2xl text-indigo-600 shadow-inner">
                            <Clock className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إدارة الاستئذانات</CardTitle>
                            <CardDescription className="text-base font-medium">متابعة طلبات التأخير الصباحي والخروج المبكر لضبط مسيرات الرواتب.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <PermissionRequestsList />
                </CardContent>
            </Card>
        </div>
    );
}