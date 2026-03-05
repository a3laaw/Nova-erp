
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { GrnList } from '@/components/warehouse/grn-list';

export default function GrnsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-emerald-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-600/10 rounded-2xl text-emerald-600 shadow-inner">
                                <FileCheck className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">أذونات استلام المواد (GRN)</CardTitle>
                                <CardDescription className="text-base font-medium">تأكيد وصول البضائع من الموردين وتحديث رصيد المخزن فوراً.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-emerald-100 bg-emerald-600 hover:bg-emerald-700">
                            <Link href="/dashboard/warehouse/grns/new">
                                <PlusCircle className="h-5 w-5" />
                                إذن استلام جديد
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <GrnList />
                </CardContent>
            </Card>
        </div>
    );
}
