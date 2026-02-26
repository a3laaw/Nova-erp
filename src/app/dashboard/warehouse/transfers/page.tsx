
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { TransferList } from '@/components/warehouse/transfer-list';

export default function TransfersPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="text-primary" />
                            التحويلات المخزنية
                        </CardTitle>
                        <CardDescription>متابعة حركة نقل المواد والعهدة بين المستودعات والأفرع.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/warehouse/transfers/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إذن تحويل جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <TransferList />
            </CardContent>
        </Card>
    );
}
