
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { TransferList } from '@/components/warehouse/transfer-list';

export default function TransfersPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-cyan-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-cyan-600/10 rounded-2xl text-cyan-600 shadow-inner">
                                <ArrowLeftRight className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">التحويلات المخزنية</CardTitle>
                                <CardDescription className="text-base font-medium">متابعة حركة نقل المواد والعهدة بين المستودعات والأفرع والمواقع.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-cyan-100 bg-cyan-600 hover:bg-cyan-700">
                            <Link href="/dashboard/warehouse/transfers/new">
                                <PlusCircle className="ml-2 h-4 w-4" />
                                إذن تحويل جديد
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <TransferList />
                </CardContent>
            </Card>
        </div>
    );
}
