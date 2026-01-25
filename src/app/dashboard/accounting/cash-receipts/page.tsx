'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { CashReceiptsList } from '@/components/accounting/cash-receipts-list';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';

export default function CashReceiptsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>سندات القبض</CardTitle>
                        <CardDescription>
                        عرض وإدارة جميع سندات القبض المالية.
                        </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/accounting/cash-receipts/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إنشاء سند قبض
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <CashReceiptsList />
            </CardContent>
        </Card>
    )
}
