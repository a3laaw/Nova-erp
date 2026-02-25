
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import Link from 'next/link';
import { MaterialIssueList } from '@/components/warehouse/material-issue-list';

export default function MaterialIssuesPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>أذونات صرف المواد للمشاريع</CardTitle>
                        <CardDescription>متابعة حركة خروج المواد من المخزن وتحميلها على مراكز التكلفة.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/warehouse/material-issue/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إذن صرف جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <MaterialIssueList />
            </CardContent>
        </Card>
    );
}
