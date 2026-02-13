
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SubcontractorsList } from '@/components/construction/subcontractors-list';

export default function SubcontractorsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة المقاولين من الباطن</CardTitle>
                <CardDescription>
                    عرض وإدارة قائمة المقاولين من الباطن وتقييم أدائهم.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <SubcontractorsList />
            </CardContent>
        </Card>
    );
}
