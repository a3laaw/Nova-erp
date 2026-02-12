'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { VendorsList } from '@/components/purchasing/vendors-list';

export default function VendorsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <CardTitle>إدارة الموردين</CardTitle>
                <CardDescription>
                    عرض وإدارة قائمة الموردين والشركات التي تتعامل معها.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <VendorsList />
            </CardContent>
        </Card>
    )
}
