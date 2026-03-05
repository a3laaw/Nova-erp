
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SubcontractorsList } from '@/components/construction/subcontractors-list';
import { HardHat } from 'lucide-react';

export default function SubcontractorsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-inner">
                            <HardHat className="h-8 w-8" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">إدارة المقاولين من الباطن</CardTitle>
                            <CardDescription className="text-base font-medium">
                                سجل شامل لكافة المقاولين والشركات المنفذة مع تتبع التقييمات الفنية.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <SubcontractorsList />
                </CardContent>
            </Card>
        </div>
    );
}
