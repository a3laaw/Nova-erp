'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
// import { PaymentVouchersList } from '@/components/accounting/payment-vouchers-list';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';

export default function PaymentVouchersPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>سندات الصرف</CardTitle>
                        <CardDescription>
                        عرض وإدارة جميع سندات الصرف والشيكات الصادرة.
                        </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/accounting/payment-vouchers/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إنشاء سند صرف
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-center text-muted-foreground p-8">سيتم عرض قائمة سندات الصرف هنا قريباً.</p>
                {/* <PaymentVouchersList /> */}
            </CardContent>
        </Card>
    )
}
