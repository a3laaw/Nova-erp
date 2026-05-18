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
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-green-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-10 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-600/10 rounded-2xl text-green-600 shadow-inner">
                                <ArrowDownLeft className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-black">سندات القبض (التحصيل)</CardTitle>
                                <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-16">متابعة كافة المبالغ المحصلة من العملاء والتحويلات البنكية.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-12 px-10 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-green-100 bg-green-600 hover:bg-green-700">
                            <Link href="/dashboard/accounting/cash-receipts/new">
                                <PlusCircle className="h-6 w-6" />
                                إضافة
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="pt-8">
                    <CashReceiptsList />
                </CardContent>
            </Card>
        </div>
    )
}
