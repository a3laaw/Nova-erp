'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, MapPin, LayoutGrid, LayoutList, Table as TableIcon, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { FieldVisitsList } from '@/components/construction/field-visits-list';
import { FieldVisitsGrid } from '@/components/construction/field-visits-grid';
import { FieldVisitsSpreadsheet } from '@/components/construction/field-visits-spreadsheet';
import { cn } from '@/lib/utils';

/**
 * صفحة إدارة الزيارات الميدانية:
 * تم تصميمها لتعمل بنظام "الهجين الذكي":
 * 1. العرض الأفقي (Spreadsheet): للمدير في المكتب (تخطيط ولوجستيات).
 * 2. نظام البطاقات (Cards): للمهندس في الميدان (متوافق مع الجوال).
 * 3. إدخال سبريد شيت: للجدولة الجماعية السريعة.
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
                                إدارة العمل الميداني والمواقع
                            </CardTitle>
                            <CardDescription className="text-base font-medium">خطط ونفذ وراقب إنجاز مشاريعك في الموقع بنظام الجدولة الذكي.</CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {/* مفتاح تبديل أنماط العرض المطور */}
                            <div className="flex bg-muted p-1 rounded-2xl border shadow-inner">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('grid')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4 h-9", viewMode === 'grid' && "bg-white shadow-sm text-primary")}
                                    title="عرض المكتب الشامل"
                                >
                                    <Monitor className="h-4 w-4" />
                                    عرض المكتب
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('cards')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4 h-9", viewMode === 'cards' && "bg-white shadow-sm text-primary")}
                                    title="عرض الميدان للجوال"
                                >
                                    <Smartphone className="h-4 w-4" />
                                    عرض الموقع
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('spreadsheet')}
                                    className={cn("rounded-xl font-bold gap-2 text-xs px-4 h-9", viewMode === 'spreadsheet' && "bg-white shadow-sm text-primary")}
                                    title="جدولة جماعية سريعة"
                                >
                                    <TableIcon className="h-4 w-4" />
                                    جدولة سريعة
                                </Button>
                            </div>

                            <Button asChild className="h-11 px-6 rounded-xl font-black gap-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/construction/field-visits/new">
                                    <PlusCircle className="h-5 w-5" />
                                    جدولة زيارة
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="transition-all duration-500">
                {viewMode === 'spreadsheet' ? (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <FieldVisitsSpreadsheet onSaveSuccess={() => setViewMode('grid')} />
                    </div>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                                <h3 className="font-black text-xl">
                                    {viewMode === 'grid' ? 'لوحة المتابعة اللوجستية' : 'خطة العمل الميدانية'}
                                </h3>
                            </div>
                            <p className="text-xs text-muted-foreground font-bold italic">
                                {viewMode === 'grid' ? '* يفضل استخدام شاشات العرض الكبيرة لهذا النمط' : '* تم تحسين هذا العرض للاستخدام عبر الهواتف الذكية'}
                            </p>
                        </div>
                        {viewMode === 'grid' ? <FieldVisitsGrid /> : <FieldVisitsList />}
                    </div>
                )}
            </div>
        </div>
    );
}
