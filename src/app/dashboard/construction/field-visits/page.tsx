'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MapPin, LayoutGrid, LayoutList, Table as TableIcon } from 'lucide-react';
import Link from 'next/link';
import { FieldVisitsList } from '@/components/construction/field-visits-list';
import { FieldVisitsGrid } from '@/components/construction/field-visits-grid';
import { FieldVisitsSpreadsheet } from '@/components/construction/field-visits-spreadsheet';
import { cn } from '@/lib/utils';

/**
 * صفحة خطة الزيارات الميدانية المحدثة:
 * تدعم الآن 3 أنماط للعرض:
 * 1. العرض الأفقي (للمراجعة).
 * 2. نظام البطاقات (للمتابعة).
 * 3. سبريد شيت الإدخال (للجدولة الجماعية السريعة).
 */
export default function FieldVisitsPage() {
    const [viewMode, setViewMode] = useState<'cards' | 'grid' | 'spreadsheet'>('grid');

    return (
        <div className="space-y-6" dir="rtl">
            <Card className="rounded-[2.5rem] border-none shadow-sm bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader>
                    <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3">
                                <MapPin className="text-primary h-8 w-8" />
                                خطة الزيارات الميدانية
                            </CardTitle>
                            <CardDescription className="text-base font-medium">إدارة وجدولة وتأكيد الزيارات الميدانية للمهندسين بنظام الجدولة الجماعية السريع.</CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {/* مفتاح تبديل أنماط العرض */}
                            <div className="flex bg-muted p-1 rounded-2xl border shadow-inner">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('grid')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4", viewMode === 'grid' && "bg-white shadow-sm text-primary")}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                    العرض الأفقي
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('spreadsheet')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4", viewMode === 'spreadsheet' && "bg-white shadow-sm text-primary")}
                                >
                                    <TableIcon className="h-4 w-4" />
                                    إدخال سبريد شيت
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('cards')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4", viewMode === 'cards' && "bg-white shadow-sm text-primary")}
                                >
                                    <LayoutList className="h-4 w-4" />
                                    نظام البطاقات
                                </Button>
                            </div>

                            <Button asChild className="h-12 px-8 rounded-2xl font-black text-lg gap-2 shadow-xl shadow-primary/20">
                                <Link href="/dashboard/construction/field-visits/new">
                                    <PlusCircle className="h-6 w-6" />
                                    جدولة زيارة واحدة
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                {viewMode === 'spreadsheet' ? (
                    <FieldVisitsSpreadsheet onSaveSuccess={() => setViewMode('grid')} />
                ) : (
                    <>
                        <div className="flex items-center gap-2 px-2">
                            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            <h3 className="font-black text-lg">الخطة التنفيذية للمواقع</h3>
                        </div>
                        {viewMode === 'grid' ? <FieldVisitsGrid /> : <FieldVisitsList />}
                    </>
                )}
            </div>
        </div>
    );
}
