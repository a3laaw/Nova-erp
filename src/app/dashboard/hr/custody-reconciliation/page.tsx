
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CustodyReconciliationList } from '@/components/hr/custody-reconciliation-list';
import { RotateCcw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAppTheme } from '@/context/theme-context';
import { cn } from '@/lib/utils';

/**
 * صفحة إدارة تسويات العهد (منظور المحاسب والمدير):
 * تعرض قائمة بكافة التسويات المرفوعة من الميدان لاتخاذ إجراءات التوجيه المحاسبي.
 */
export default function CustodyReconciliationsPage() {
    const { theme } = useAppTheme();
    const isGlass = theme === 'glass';

    return (
        <div className="space-y-6" dir="rtl">
            <Card className={cn(
                "rounded-[2.5rem] border-none shadow-sm overflow-hidden",
                isGlass ? "glass-effect" : "bg-gradient-to-l from-white to-purple-50"
            )}>
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <Wallet className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">إدارة تسويات العهد النقدية</CardTitle>
                                <CardDescription className="text-base font-medium">مراجعة مصروفات الموظفين الميدانية وربطها محاسبياً بشجرة الحسابات.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-purple-100">
                            <Link href="/dashboard/hr/custody-reconciliation/new">
                                <RotateCcw className="h-5 w-5" />
                                رفع تسوية جديدة
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className={cn(
                "border-none shadow-sm rounded-3xl overflow-hidden",
                isGlass ? "glass-effect" : "bg-white"
            )}>
                <CardContent className="pt-8">
                    <CustodyReconciliationList />
                </CardContent>
            </Card>
        </div>
    );
}
