'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { RfqsList } from '@/components/purchasing/rfqs-list';

export default function RfqsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>طلبات التسعير (RFQ)</CardTitle>
                        <CardDescription>إنشاء وتتبع طلبات عروض الأسعار المرسلة للموردين.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/purchasing/rfqs/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            طلب تسعير جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <RfqsList />
            </CardContent>
        </Card>
    );
}
