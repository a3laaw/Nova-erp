'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PlusCircle, BookOpen } from 'lucide-react';
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
        <div className="space-y-10" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm overflow-hidden bg-gradient-to-l from-white to-purple-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-10 border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-600/10 rounded-2xl text-purple-600 shadow-inner">
                                <BookOpen className="h-8 w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-3xl font-black">قيود اليومية العامة</CardTitle>
                                <CardDescription className="text-base font-bold text-slate-500 mt-1 pr-16">عرض وإدارة كافة القيود المحاسبية المرحلة والمسودة في النظام.</CardDescription>
                            </div>
                        </div>
                        <Button asChild className="h-12 px-10 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-purple-100 bg-purple-600 hover:bg-purple-700">
                            <Link href="/dashboard/accounting/journal-entries/new">
                                <PlusCircle className="h-6 w-6" />
                                إضافة
                            </Link>
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white/95">
                <CardContent className="pt-8">
                    <JournalEntriesList />
                </CardContent>
            </Card>
        </div>
    )
}
