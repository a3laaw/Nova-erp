'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionRequestsList } from '@/components/hr/permission-requests-list';

export default function PermissionRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الاستئذانات</CardTitle>
                <CardDescription>عرض وتقديم وموافقة على طلبات الاستئذان (تأخير أو خروج مبكر).</CardDescription>
            </CardHeader>
            <CardContent>
                <PermissionRequestsList />
            </CardContent>
        </Card>
    );
}
