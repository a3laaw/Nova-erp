'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { QuotationsList } from '@/components/accounting/quotations-list';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';

export default function QuotationsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>عروض الأسعار</CardTitle>
                        <CardDescription>
                        إنشاء وإدارة عروض الأسعار المقدمة للعملاء.
                        </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/quotations/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إنشاء عرض سعر
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <QuotationsList />
            </CardContent>
        </Card>
    )
}
