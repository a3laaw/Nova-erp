
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, ArrowUpFromLine } from 'lucide-react';
import Link from 'next/link';
import { MaterialIssueList } from '@/components/warehouse/material-issue-list';

export default function MaterialIssuesPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-orange-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-600/10 rounded-2xl text-orange-600 shadow-inner">
                                <ArrowUpFromLine className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl font-black">صرف المواد للمشاريع</CardTitle>
                                <CardDescription className="text-base font-medium">تحميل تكلفة المواد على مواقع العمل وربطها بمراكز الربحية.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-orange-100 bg-orange-600 hover:bg-orange-700">
                            <Link href="/dashboard/warehouse/material-issue/new">
                                <PlusCircle className="ml-2 h-5 w-5" />
                                إذن صرف جديد
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardContent className="pt-8">
                    <MaterialIssueList filterType="project_site" />
                </CardContent>
            </Card>
        </div>
    );
}
