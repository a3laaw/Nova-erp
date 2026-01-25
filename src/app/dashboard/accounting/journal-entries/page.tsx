'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { JournalEntriesList } from '@/components/accounting/journal-entries-list';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '@/components/ui/card';

export default function JournalEntriesPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>قيود اليومية</CardTitle>
                        <CardDescription>
                        عرض وإدارة جميع قيود اليومية المحاسبية.
                        </CardDescription>
                    </div>
                    <Button asChild>
                        <Link href="/dashboard/accounting/journal-entries/new">
                            <PlusCircle className="ml-2 h-4 w-4" />
                            إنشاء قيد يومية
                        </Link>
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <JournalEntriesList />
            </CardContent>
        </Card>
    )
}
