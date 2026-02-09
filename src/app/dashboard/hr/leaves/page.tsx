'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LeaveRequestsList } from '@/components/hr/leave-requests-list';

export default function LeaveRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الإجازات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الإجازات للموظفين.</CardDescription>
            </CardHeader>
            <CardContent>
                <LeaveRequestsList />
            </CardContent>
        </Card>
    );
}
