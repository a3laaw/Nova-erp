
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowDownLeft } from 'lucide-react';
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
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-green-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-600/10 rounded-2xl text-green-600 shadow-inner">
                                <ArrowDownLeft className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">سندات القبض (التحصيل)</CardTitle>
                                <CardDescription className="text-base font-medium">متابعة كافة المبالغ المحصلة من العملاء والتحويلات البنكية.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-green-100 bg-green-600 hover:bg-green-700">
                            <Link href="/dashboard/accounting/cash-receipts/new">
                                <PlusCircle className="h-5 w-5" />
                                إنشاء سند قبض
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <CashReceiptsList />
                </CardContent>
            </Card>
        </div>
    )
}
