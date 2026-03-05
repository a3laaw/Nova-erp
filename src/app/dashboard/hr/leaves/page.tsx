'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';
import { CalendarX } from 'lucide-react';

export default function LeaveRequestsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-pink-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-600/10 rounded-2xl text-pink-600 shadow-inner">
                            <CalendarX className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إدارة طلبات الإجازات</CardTitle>
                            <CardDescription className="text-base font-medium">عرض وتقديم وموافقة على طلبات الإجازات للموظفين مع تحديث تلقائي للأرصدة.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <LeaveRequestsList />
                </CardContent>
            </Card>
        </div>
    );
}