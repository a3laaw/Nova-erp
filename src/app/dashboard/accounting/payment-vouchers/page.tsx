
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowUpRight } from 'lucide-react';
import { PaymentVouchersList } from '@/components/accounting/payment-vouchers-list';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';

export default function PaymentVouchersPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-red-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-600/10 rounded-2xl text-red-600 shadow-inner">
                                <ArrowUpRight className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">سندات الصرف (المدفوعات)</CardTitle>
                                <CardDescription className="text-base font-medium">إدارة الشيكات الصادرة والمدفوعات النقدية للموردين والمصاريف.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-red-100 bg-red-600 hover:bg-red-700">
                            <Link href="/dashboard/accounting/payment-vouchers/new">
                                <PlusCircle className="h-5 w-5" />
                                إنشاء سند صرف
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <PaymentVouchersList />
                </CardContent>
            </Card>
        </div>
    )
}
