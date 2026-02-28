
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, FileCheck } from 'lucide-react';
import Link from 'next/link';
import { GrnList } from '@/components/warehouse/grn-list';

export default function GrnsPage() {
    return (
        <Card dir="rtl">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileCheck className="text-primary" />
                            استلام بضاعة (GRN)
                        </CardTitle>
                        <CardDescription>إثبات وصول المواد للمخازن بناءً على أوامر الشراء المعتمدة.</CardDescription>
                    </div>
                    <Button asChild size="sm">
                        <Link href="/dashboard/warehouse/grns/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إذن استلام جديد
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <GrnList />
            </CardContent>
        </Card>
    );
}
