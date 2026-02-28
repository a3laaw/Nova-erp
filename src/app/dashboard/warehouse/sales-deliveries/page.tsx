'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Store } from 'lucide-react';
import Link from 'next/link';
import { MaterialIssueList } from '@/components/warehouse/material-issue-list';

export default function SalesDeliveriesPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Store className="text-primary" />
                            فواتير مبيعات المعرض / التسليم المباشر
                        </CardTitle>
                        <CardDescription>عرض وإدارة عمليات بيع وتسليم البضائع المباشرة للعملاء.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/warehouse/material-issue/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            فاتورة مبيعات جديدة
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <MaterialIssueList filterType="direct_sale" />
            </CardContent>
        </Card>
    );
}
