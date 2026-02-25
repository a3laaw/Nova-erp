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
import { PurchaseOrdersList } from '@/components/purchasing/purchase-orders-list';

export default function PurchasingPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>أوامر الشراء</CardTitle>
                        <CardDescription>إنشاء وتتبع أوامر الشراء للموردين.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/purchasing/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            أمر شراء جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <PurchaseOrdersList />
            </CardContent>
        </Card>
    );
}