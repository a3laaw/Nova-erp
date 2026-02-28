
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileStack } from 'lucide-react';
import Link from 'next/link';
import { PurchaseRequestList } from '@/components/purchasing/purchase-request-list';

export default function PurchaseRequestsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileStack className="text-primary" />
                            طلبات الشراء الداخلية
                        </CardTitle>
                        <CardDescription>إدارة طلبات احتياج المواد من المواقع والأقسام قبل تحويلها لأوامر شراء رسمية.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/purchasing/requests/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            طلب شراء جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <PurchaseRequestList />
            </CardContent>
        </Card>
    );
}
