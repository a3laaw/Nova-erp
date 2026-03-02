
'use client';

import { DirectInvoiceForm } from '@/components/purchasing/direct-invoice-form';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ShoppingBag } from 'lucide-react';

export default function DirectPurchaseInvoicePage() {
    return (
        <div className="space-y-6 max-w-5xl mx-auto" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-xl overflow-hidden bg-gradient-to-l from-white to-purple-50">
                <CardHeader className="pb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-700 shadow-inner">
                            <ShoppingBag className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-black text-purple-900">فاتورة مشتريات مباشرة</CardTitle>
                            <CardDescription className="text-base font-medium">تسجيل مشتريات وتحميل تكلفتها على المشروع فوراً (بدون دورة مخزنية).</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                    <DirectInvoiceForm />
                </CardContent>
            </Card>
        </div>
    );
}
