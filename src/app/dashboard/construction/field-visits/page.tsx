'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MapPin, LayoutGrid, LayoutList } from 'lucide-react';
import Link from 'next/link';
import { FieldVisitsList } from '@/components/construction/field-visits-list';
import { FieldVisitsGrid } from '@/components/construction/field-visits-grid';
import { cn } from '@/lib/utils';

/**
 * صفحة خطة الزيارات الميدانية:
 * تدعم العرض المزدوج (بطاقات أو جدول أفقي متكامل) لتسهيل الرقابة والإدخال.
 */
export default function FieldVisitsPage() {
    const [viewMode, setViewMode] = useState<'cards' | 'grid'>('grid');

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
                            <CardDescription className="text-base">إدارة وجدولة وتأكيد الزيارات الميدانية للمهندسين في مواقع المشاريع بنظام الجدولة الأفقية.</CardDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Toggle View Mode */}
                            <div className="flex bg-muted p-1 rounded-2xl border shadow-inner mr-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('grid')}
                                    className={cn("rounded-xl font-bold gap-2", viewMode === 'grid' && "bg-white shadow-sm text-primary")}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                    العرض الأفقي
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('cards')}
                                    className={cn("rounded-xl font-bold gap-2", viewMode === 'cards' && "bg-white shadow-sm text-primary")}
                                >
                                    <LayoutList className="h-4 w-4" />
                                    نظام البطاقات
                                </Button>
                            </div>

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
                    <h3 className="font-black text-lg">الخطة التنفيذية للمواقع</h3>
                </div>
                
                {viewMode === 'grid' ? <FieldVisitsGrid /> : <FieldVisitsList />}
            </div>
        </div>
    );
}
