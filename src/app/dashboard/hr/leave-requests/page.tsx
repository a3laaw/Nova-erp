
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';
export default function LeaveRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>طلبات الإجازات</CardTitle>
                <CardDescription>
                    عرض وإدارة جميع طلبات الإجازات المقدمة من الموظفين.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <LeaveRequestsList />
            </CardContent>
        </Card>
    );
}

    