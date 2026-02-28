
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MapPin, ListFilter } from 'lucide-react';
import Link from 'next/link';
import { FieldVisitsList } from '@/components/construction/field-visits-list';

export default function FieldVisitsPage() {
    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-1 text-center md:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center md:justify-start gap-3">
                                <MapPin className="text-primary h-8 w-8" />
                                خطة الزيارات الميدانية
                            </CardTitle>
                            <CardDescription className="text-base">إدارة وجدولة وتأكيد الزيارات الميدانية للمهندسين في مواقع المشاريع.</CardDescription>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="h-12 px-6 rounded-2xl font-bold gap-2">
                                <ListFilter className="h-5 w-5" />
                                عرض حسب المهندس
                            </Button>
                            <Button asChild className="h-12 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                                <Link href="/dashboard/construction/field-visits/new">
                                    <PlusCircle className="h-6 w-6" />
                                    جدولة زيارة جديدة
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    <h3 className="font-black text-lg">الجدول الزمني للزيارات</h3>
                </div>
                <FieldVisitsList />
            </div>
        </div>
    );
}
