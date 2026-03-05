'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    PlusCircle, 
    Briefcase, 
    Search,
    LayoutGrid,
    MapPin,
    ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { ProjectsList } from '@/components/construction/projects-list';
import { cn } from '@/lib/utils';

export default function ExecutiveProjectsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header Section */}
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-gradient-to-l from-white to-sky-50 dark:from-card dark:to-card">
                <CardHeader className="pb-8 px-8">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-center lg:text-right">
                            <CardTitle className="text-3xl font-black flex items-center justify-center lg:justify-start gap-3 text-primary">
                                <Briefcase className="h-8 w-8" />
                                إدارة المشاريع التنفيذية
                            </CardTitle>
                            <CardDescription className="text-base font-medium">
                                متابعة الهيكل الفني، الإنجاز الميداني، والتكاليف الحقيقية للمواقع النشطة.
                            </CardDescription>
                        </div>
                        
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="بحث في المشاريع..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 h-11 rounded-xl shadow-inner bg-background border-2"
                                />
                            </div>
                            <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold gap-2">
                                <Link href="/dashboard/construction/field-visits">
                                    <MapPin className="h-5 w-5" />
                                    خطة الزيارات
                                </Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Projects Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                    <CardHeader className="bg-muted/10 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-black flex items-center gap-2">
                                    <LayoutGrid className="text-primary h-5 w-5" />
                                    المشاريع القائمة في المواقع
                                </CardTitle>
                                <CardDescription>هذه القائمة تعرض المشاريع التي لها هيكل فني و BOQ معتمد.</CardDescription>
                            </div>
                            <Button asChild size="sm" variant="ghost" className="text-primary font-bold">
                                <Link href="/dashboard/contracts" className="flex items-center gap-1">
                                    تأسيس مشروع جديد من عقد
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <ProjectsList searchQuery={searchQuery} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
